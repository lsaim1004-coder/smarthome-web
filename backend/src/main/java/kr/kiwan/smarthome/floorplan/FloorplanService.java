package kr.kiwan.smarthome.floorplan;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.Derived;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.FloorplanResponse;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.RoomArea;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.SaveRequest;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.Scale;

/**
 * 도면 이미지와 그 위에 그린 구조 · 기기 배치.
 *
 * 도면은 관리자가 올리는 작업 자료라 고객 사진과 저장 위치를 나눈다 —
 * 고객 사진은 판별 후 지우지만 도면은 시공이 끝날 때까지 남는다.
 */
@Service
public class FloorplanService {

    private static final Logger log = LoggerFactory.getLogger(FloorplanService.class);

    /** 도면은 큰 편이라 사진보다 여유를 둔다. */
    private static final long MAX_BYTES = 20L * 1024 * 1024;

    private static final Map<String, String> ALLOWED = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private final FloorplanRepository repo;
    private final Path root;

    public FloorplanService(FloorplanRepository repo,
                            @Value("${app.floorplan-dir:/data/floorplans}") String dir) {
        this.repo = repo;
        this.root = Path.of(dir).toAbsolutePath().normalize();
    }

    public List<FloorplanResponse> listByInquiry(long inquiryId) {
        return repo.findByInquiry(inquiryId).stream().map(this::withDerived).toList();
    }

    public FloorplanResponse get(long id) {
        return withDerived(repo.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "도면을 찾을 수 없습니다.")));
    }

    public FloorplanResponse upload(long inquiryId, String name, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE", "도면 이미지를 골라 주세요.");
        }
        String ext = ALLOWED.get(file.getContentType());
        if (ext == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_TYPE",
                    "JPG · PNG · WebP 만 올릴 수 있습니다. PDF 는 이미지로 내보내 주세요.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "TOO_BIG", "도면은 20MB 이하로 올려 주세요.");
        }

        try {
            Path dir = root.resolve(String.valueOf(inquiryId));
            Files.createDirectories(dir);
            String stored = inquiryId + "/" + UUID.randomUUID() + ext;
            Path target = root.resolve(stored).normalize();
            if (!target.startsWith(root)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "BAD_PATH", "저장 경로가 올바르지 않습니다.");
            }
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }

            Integer width = null;
            Integer height = null;
            try {
                BufferedImage img = ImageIO.read(target.toFile());
                if (img != null) {
                    width = img.getWidth();
                    height = img.getHeight();
                }
            } catch (Exception e) {
                // 크기를 못 읽어도 배치는 비율 좌표라 동작한다. 실제 치수 환산만 화면에서 다시 잡으면 된다.
                log.warn("도면 크기를 읽지 못했습니다: {}", e.toString());
            }

            long id = repo.insert(inquiryId, blankToNull(name), stored,
                    safeName(file.getOriginalFilename()), file.getContentType(), file.getSize(), width, height);
            return get(id);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SAVE_FAILED",
                    "도면을 저장하지 못했습니다.");
        }
    }

    public FloorplanResponse save(long id, SaveRequest req, String actor) {
        get(id);
        Scale scale = req.scale();
        if (scale != null && !scale.set()) {
            scale = new Scale(null, null, null, null, null);   // 축척 해제
        }
        repo.save(id, blankToNull(req.name()), scale, req.wallHeightMm(),
                req.geometry(), req.devices(), actor);
        return get(id);
    }

    public void delete(long id) {
        repo.findStoredName(id).ifPresent(this::deleteFile);
        if (repo.delete(id) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "도면을 찾을 수 없습니다.");
        }
    }

    public Optional<Path> imageFile(long id) {
        return repo.findStoredName(id).map(root::resolve).map(Path::normalize)
                .filter(p -> p.startsWith(root))
                .filter(Files::isReadable);
    }

    // ---------- 파생값 ----------

    /**
     * 축척이 잡혀 있으면 벽 길이 · 방 면적을 계산해 붙인다.
     * 화면마다 다시 세면 값이 어긋나므로 한 곳에서만 계산한다.
     */
    @SuppressWarnings("unchecked")
    private FloorplanResponse withDerived(FloorplanResponse f) {
        Map<String, Object> geo = f.geometry() == null ? Map.of() : f.geometry();
        List<Map<String, Object>> walls = (List<Map<String, Object>>) geo.getOrDefault("walls", List.of());
        List<Map<String, Object>> rooms = (List<Map<String, Object>>) geo.getOrDefault("rooms", List.of());
        List<Map<String, Object>> devices = f.devices() == null ? List.of() : f.devices();

        double mmX = 0;
        double mmY = 0;
        boolean scaled = false;
        Scale s = f.scale();
        if (s != null && s.set() && f.imageWidth() != null && f.imageHeight() != null) {
            // 두 점의 화면상 거리(px) 대비 실제 mm → 이미지 전체 폭·높이가 몇 mm 인지로 환산해 둔다.
            double dxPx = (s.x2() - s.x1()) * f.imageWidth();
            double dyPx = (s.y2() - s.y1()) * f.imageHeight();
            double px = Math.hypot(dxPx, dyPx);
            if (px > 0.5) {
                double mmPerPx = s.mm() / px;
                mmX = mmPerPx * f.imageWidth();
                mmY = mmPerPx * f.imageHeight();
                scaled = true;
            }
        }

        long wallTotal = 0;
        if (scaled) {
            for (Map<String, Object> w : walls) {
                double dx = (num(w.get("x2")) - num(w.get("x1"))) * mmX;
                double dy = (num(w.get("y2")) - num(w.get("y1"))) * mmY;
                wallTotal += Math.round(Math.hypot(dx, dy));
            }
        }

        List<RoomArea> roomAreas = new ArrayList<>();
        double totalArea = 0;
        for (Map<String, Object> r : rooms) {
            List<List<Object>> pts = (List<List<Object>>) r.getOrDefault("points", List.of());
            double area = scaled ? polygonAreaM2(pts, mmX, mmY) : 0;
            totalArea += area;
            int inside = 0;
            for (Map<String, Object> d : devices) {
                if (contains(pts, num(d.get("x")), num(d.get("y")))) {
                    inside++;
                }
            }
            roomAreas.add(new RoomArea(str(r.get("name")), round1(area), inside));
        }

        Derived derived = new Derived(scaled, mmX, mmY, walls.size(), wallTotal, rooms.size(),
                round1(totalArea), devices.size(), roomAreas);

        return new FloorplanResponse(f.id(), f.inquiryId(), f.name(), f.originalName(), f.contentType(),
                f.sizeBytes(), f.imageWidth(), f.imageHeight(), f.scale(), f.wallHeightMm(),
                f.geometry(), f.devices(), derived, f.createdAt(), f.updatedAt(), f.updatedBy());
    }

    /** 신발끈 공식. 비율 좌표를 mm 로 편 뒤 면적을 낸다. */
    private static double polygonAreaM2(List<List<Object>> pts, double mmX, double mmY) {
        if (pts.size() < 3) {
            return 0;
        }
        double sum = 0;
        for (int i = 0; i < pts.size(); i++) {
            List<Object> a = pts.get(i);
            List<Object> b = pts.get((i + 1) % pts.size());
            double ax = num(a.get(0)) * mmX;
            double ay = num(a.get(1)) * mmY;
            double bx = num(b.get(0)) * mmX;
            double by = num(b.get(1)) * mmY;
            sum += ax * by - bx * ay;
        }
        return Math.abs(sum) / 2.0 / 1_000_000.0;   // mm² → m²
    }

    /** 점이 다각형 안에 있는지 (ray casting). 방별 기기 수를 세는 데 쓴다. */
    private static boolean contains(List<List<Object>> pts, double x, double y) {
        if (pts.size() < 3) {
            return false;
        }
        boolean in = false;
        for (int i = 0, j = pts.size() - 1; i < pts.size(); j = i++) {
            double xi = num(pts.get(i).get(0));
            double yi = num(pts.get(i).get(1));
            double xj = num(pts.get(j).get(0));
            double yj = num(pts.get(j).get(1));
            boolean crosses = (yi > y) != (yj > y)
                    && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi;
            if (crosses) {
                in = !in;
            }
        }
        return in;
    }

    private static double num(Object v) {
        return v instanceof Number n ? n.doubleValue() : 0;
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }

    private void deleteFile(String storedName) {
        try {
            Path p = root.resolve(storedName).normalize();
            if (p.startsWith(root)) {
                Files.deleteIfExists(p);
            }
        } catch (IOException e) {
            log.warn("도면 파일 삭제 실패 {}: {}", storedName, e.toString());
        }
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    /** 올린 파일 이름은 표시용으로만 쓴다. 경로가 섞여 들어오지 않게 마지막 조각만 남긴다. */
    private static String safeName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String name = raw.replace('\\', '/');
        int cut = name.lastIndexOf('/');
        if (cut >= 0) {
            name = name.substring(cut + 1);
        }
        name = name.trim().toLowerCase(Locale.ROOT);
        return name.length() <= 120 ? name : name.substring(0, 120);
    }
}
