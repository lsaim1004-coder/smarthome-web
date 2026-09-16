package kr.kiwan.smarthome.inquiry;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.AnalyzeRequest;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceInput;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.CandidateResponse;

/**
 * 보유 가전 목록과 사진.
 *
 * 신청자는 자기 에어컨이 앱에 등록되는 모델인지 모른다. 그래서 가전 종류를 고르게 하고,
 * 알면 모델명과 구매 시기를 받고, 모르면 <b>모델명 라벨이 보이는 사진</b>을 받는다.
 * 그 사진에서 모델명을 읽어 구형·신형과 연동 경로(APP/IR/NONE)를 판정하면
 * 그대로 "IoT 로 묶을 수 있는 후보군" 목록이 된다.
 */
@Service
public class ApplianceService {

    private static final Logger log = LoggerFactory.getLogger(ApplianceService.class);

    /** 사진만 받는다. 확장자를 바꿔도 Content-Type 이 맞지 않으면 통과하지 못한다. */
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "image/heic", "heic",
            "image/heif", "heif");

    /** 한 신청에 붙일 수 있는 사진 수. 가전 한 대당 2~3장이면 충분하다. */
    static final int MAX_PHOTOS_PER_INQUIRY = 12;

    /** 한 장 최대 크기. 요즘 폰 사진 한 장이 3~6MB 라 넉넉히 잡는다. */
    static final long MAX_BYTES = 10L * 1024 * 1024;

    /** 한 신청에 적을 수 있는 가전 수. */
    static final int MAX_APPLIANCES = 20;

    static final Set<String> KINDS = Set.of(
            "FRIDGE", "WASHER", "DRYER", "TV", "AIRCON", "AIRPURIFIER", "ROBOT",
            "DISHWASHER", "RANGE", "WATERPURIFIER", "BOILER", "DOORLOCK", "STYLER", "ETC");

    static final Set<String> BRANDS = Set.of(
            "SAMSUNG", "LG", "WINIA", "XIAOMI", "CUCKOO", "COWAY", "ETC_BRAND", "UNSURE");

    static final Set<String> PURCHASED = Set.of("Y1", "Y3", "Y5", "Y10", "Y10P", "UNSURE");

    static final Set<String> ERAS = Set.of("OLD", "NEW", "UNKNOWN");

    /** APP: 제조사 앱으로 바로 / IR: 리모컨 허브 경유 / NONE: 연동 불가 / UNKNOWN: 판정 보류 */
    static final Set<String> IOT_STATUSES = Set.of("APP", "IR", "NONE", "UNKNOWN");

    private final ApplianceRepository repo;
    private final InquiryRepository inquiries;
    private final Path root;

    public ApplianceService(ApplianceRepository repo, InquiryRepository inquiries,
                            @Value("${app.upload-dir:/data/uploads}") String uploadDir) {
        this.repo = repo;
        this.inquiries = inquiries;
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    /* ── 접수 시 ──────────────────────────────────────────── */

    /**
     * 신청과 함께 들어온 가전 목록을 저장하고, 프런트가 보낸 임시 키 → 저장된 id 를 돌려준다.
     * 사진은 그 id 로 붙는다. 알 수 없는 코드 값은 버린다.
     */
    public Map<Integer, Long> saveAll(long inquiryId, List<ApplianceInput> inputs) {
        Map<Integer, Long> idsByIndex = new LinkedHashMap<>();
        if (inputs == null || inputs.isEmpty()) {
            return idsByIndex;
        }
        int saved = 0;
        for (int i = 0; i < inputs.size() && saved < MAX_APPLIANCES; i++) {
            ApplianceInput in = inputs.get(i);
            String kind = code(in.kind(), KINDS);
            if (kind == null) {
                continue;
            }
            long id = repo.insertAppliance(inquiryId, kind, code(in.brand(), BRANDS),
                    trimOrNull(in.modelName()), code(in.purchased(), PURCHASED), trimOrNull(in.note()));
            idsByIndex.put(i, id);
            saved++;
        }
        return idsByIndex;
    }

    /** 신청 요약용. 가전들에서 브랜드만 추려 쉼표로 잇는다. */
    public static String brandSummary(List<ApplianceInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return null;
        }
        Set<String> out = new LinkedHashSet<>();
        for (ApplianceInput in : inputs) {
            String brand = code(in.brand(), BRANDS);
            if (brand != null && !"UNSURE".equals(brand)) {
                out.add(brand);
            }
        }
        return out.isEmpty() ? null : String.join(",", out);
    }

    /* ── 사진 업로드 ──────────────────────────────────────── */

    /**
     * 접수 직후 발급한 토큰으로만 올릴 수 있다.
     * 형식·용량이 맞지 않는 파일은 조용히 버리고 몇 장이 저장됐는지 돌려준다 —
     * 신청 자체는 이미 접수됐으므로 업로드 실패로 전체를 되돌리지 않는다.
     */
    public int upload(long inquiryId, String token, Long applianceId, List<MultipartFile> files) {
        if (!inquiries.isUploadTokenValid(inquiryId, token)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "UPLOAD_DENIED",
                    "업로드 권한이 없거나 유효 시간이 지났습니다.");
        }
        if (applianceId != null && !repo.applianceBelongsTo(applianceId, inquiryId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "가전 정보를 찾을 수 없습니다.");
        }
        if (files == null || files.isEmpty()) {
            return 0;
        }

        int room = MAX_PHOTOS_PER_INQUIRY - repo.countPhotosByInquiry(inquiryId);
        if (room <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TOO_MANY",
                    "사진은 신청당 " + MAX_PHOTOS_PER_INQUIRY + "장까지 올릴 수 있습니다.");
        }

        int stored = 0;
        for (MultipartFile file : files) {
            if (stored >= room) {
                break;
            }
            String ext = extensionOf(file);
            if (ext == null || file.getSize() <= 0 || file.getSize() > MAX_BYTES) {
                log.info("사진 거절 inquiry={} name={} type={} size={}",
                        inquiryId, file.getOriginalFilename(), file.getContentType(), file.getSize());
                continue;
            }
            try {
                Path dir = root.resolve(String.valueOf(inquiryId));
                Files.createDirectories(dir);
                String fileName = UUID.randomUUID() + "." + ext;
                try (InputStream in = file.getInputStream()) {
                    Files.copy(in, dir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
                }
                repo.insertPhoto(inquiryId, applianceId, inquiryId + "/" + fileName,
                        safeName(file.getOriginalFilename()),
                        file.getContentType().toLowerCase(Locale.ROOT), file.getSize());
                stored++;
            } catch (IOException e) {
                log.warn("사진 저장 실패 inquiry={} name={}", inquiryId, file.getOriginalFilename(), e);
            }
        }
        // 토큰은 지우지 않는다. 일부만 올라간 경우 다시 시도할 수 있어야 하고,
        // 남용은 유효 시간(30분)과 신청당 장수 제한으로 막는다.
        return stored;
    }

    /* ── 조회·판정 ────────────────────────────────────────── */

    public List<ApplianceResponse> listByInquiry(long inquiryId) {
        return repo.findByInquiry(inquiryId);
    }

    public List<CandidateResponse> candidates(String iotStatus, boolean pendingOnly, int limit) {
        String normalized = iotStatus == null || iotStatus.isBlank()
                ? null
                : iotStatus.trim().toUpperCase(Locale.ROOT);
        if (normalized != null && !IOT_STATUSES.contains(normalized)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "연동 가능성 값이 올바르지 않습니다.");
        }
        return repo.findCandidates(normalized, pendingOnly, Math.min(Math.max(limit, 1), 200));
    }

    public ApplianceResponse get(long id) {
        return repo.findApplianceById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "가전 정보를 찾을 수 없습니다."));
    }

    public ApplianceResponse analyze(long id, AnalyzeRequest req, String source) {
        get(id);
        repo.analyze(id,
                trimOrNull(req.detectedModel()),
                enumOrThrow(req.era(), ERAS, "연식"),
                enumOrThrow(req.iotStatus(), IOT_STATUSES, "연동 가능성"),
                trimOrNull(req.analysisNote()),
                source,
                null);
        return repo.findApplianceById(id).orElseThrow();
    }

    /* ── 자동판별 ─────────────────────────── */

    /** 아직 판별하지 않은 가전. 배치가 하나씩 집어 간다. */
    public List<Long> pendingAnalysis(int maxAttempts, int limit) {
        return repo.findPendingAnalysis(maxAttempts, limit);
    }

    public void markAttempt(long id, String error) {
        repo.markAttempt(id, error);
    }

    /** 자동판별 결과 저장. 사람이 고친 값(MANUAL)은 덮어쓰지 않는다. */
    public void saveAutoAnalysis(long id, String detectedModel, String era, String iotStatus,
                                 String note, String source, Double confidence) {
        repo.analyze(id,
                trimOrNull(detectedModel),
                code(era, ERAS),
                code(iotStatus, IOT_STATUSES),
                trimOrNull(note),
                source,
                confidence);
    }

    /** 판별에 쓸 사진 파일들. 아직 지우지 않은 것만. */
    public List<Path> livePhotos(long applianceId) {
        List<Path> out = new ArrayList<>();
        for (Object[] row : repo.livePhotoFiles(applianceId)) {
            Path p = root.resolve(String.valueOf(row[1])).normalize();
            if (p.startsWith(root) && Files.isReadable(p)) {
                out.add(p);
            }
        }
        return out;
    }

    /**
     * 모델명을 읽어냈으면 사진 원본은 들고 있을 이유가 없다. 파일만 지우고 행은 남긴다
     * (몇 장 받았는지는 남아야 한다). 지운 장수를 돌려준다.
     */
    public int purgePhotos(long applianceId) {
        int removed = 0;
        for (Object[] row : repo.livePhotoFiles(applianceId)) {
            if (deleteFile(String.valueOf(row[1]))) {
                removed++;
            }
            repo.markPurged((Long) row[0]);
        }
        return removed;
    }

    /** 신청 한 건의 사진을 전부 지운다. 상담이 끝났을 때 관리자가 누른다. */
    public int purgePhotosOfInquiry(long inquiryId) {
        int removed = 0;
        for (Object[] row : repo.livePhotoFilesByInquiry(inquiryId)) {
            if (deleteFile(String.valueOf(row[1]))) {
                removed++;
            }
            repo.markPurged((Long) row[0]);
        }
        return removed;
    }

    private boolean deleteFile(String storedName) {
        try {
            Path p = root.resolve(storedName).normalize();
            if (!p.startsWith(root)) {
                return false;
            }
            return Files.deleteIfExists(p);
        } catch (IOException e) {
            log.warn("사진 파일 삭제 실패 {}: {}", storedName, e.toString());
            return false;
        }
    }

    /** 이미지 파일 경로. 저장 이름은 DB 에만 있고, 경로 탈출이 없는지 다시 확인한다. */
    public Optional<Path> photoFile(long photoId) {
        return repo.findStoredName(photoId).map(root::resolve).map(Path::normalize)
                .filter(p -> p.startsWith(root))
                .filter(Files::isReadable);
    }

    /* ── 도우미 ───────────────────────────────────────────── */

    private static String extensionOf(MultipartFile file) {
        String type = file.getContentType();
        if (type == null) {
            return null;
        }
        return ALLOWED_TYPES.get(type.toLowerCase(Locale.ROOT).split(";")[0].trim());
    }

    /** 원본 파일명은 표시용으로만 쓴다. 경로 구분자와 제어문자를 털어 낸다. */
    private static String safeName(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String cleaned = raw.replaceAll("[\\\\/\\p{Cntrl}]", "").trim();
        if (cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() > 120 ? cleaned.substring(cleaned.length() - 120) : cleaned;
    }

    /** 화이트리스트에 없으면 조용히 버린다(신청 접수를 막지 않는다). */
    static String code(String raw, Set<String> allowed) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        return allowed.contains(upper) ? upper : null;
    }

    /** 관리자 입력은 조용히 버리지 않고 틀렸다고 알려 준다. */
    private static String enumOrThrow(String raw, Set<String> allowed, String what) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(upper)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", what + " 값이 올바르지 않습니다.");
        }
        return upper;
    }

    private static String trimOrNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    /** 관리자 메일에 쓸 한 줄 요약. */
    static String summarize(List<ApplianceInput> inputs, Map<String, String> kindLabels) {
        if (inputs == null || inputs.isEmpty()) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (ApplianceInput in : inputs) {
            String kind = code(in.kind(), KINDS);
            if (kind == null) {
                continue;
            }
            String label = kindLabels.getOrDefault(kind, kind);
            String model = trimOrNull(in.modelName());
            out.add(model == null ? label : label + "(" + model + ")");
        }
        return out.isEmpty() ? null : String.join(" · ", out);
    }
}
