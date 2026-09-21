package kr.kiwan.smarthome.floorplan;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.admin.AdminAccess;
import kr.kiwan.smarthome.admin.AuditRepository;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.FloorplanResponse;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.SaveRequest;
import kr.kiwan.smarthome.inquiry.InquiryService;

/**
 * 도면 배치. 담당인 건만 열 수 있다 — 도면은 그 집의 구조 그 자체라 남의 것을 보면 안 된다.
 */
@Profile("admin")
@RestController
public class AdminFloorplanController {

    private final FloorplanService floorplans;
    private final InquiryService inquiries;
    private final AdminAccess access;
    private final AuditRepository audit;
    private final RoomNamingService roomNames;

    public AdminFloorplanController(FloorplanService floorplans, InquiryService inquiries,
                                    AdminAccess access, AuditRepository audit,
                                    RoomNamingService roomNames) {
        this.floorplans = floorplans;
        this.inquiries = inquiries;
        this.access = access;
        this.audit = audit;
        this.roomNames = roomNames;
    }

    /** 방 이름 자동 채우기 요청. 방 중심점을 화면에서 보낸 순서 그대로 받는다. */
    public record RoomNameRequest(List<double[]> centers) {}

    /**
     * 도면을 읽어 방 이름을 채운다.
     *
     * 규칙으로는 못 가른다 — 어떤 도면은 욕실에 변기를 안 그리고 글자만 적고, 어떤 도면은
     * 변기는 그리고 글자를 안 적는다. 굽은 선 비율로 찾아보려 했더니 1등이 욕실이 아니라
     * 발코니였다(문 열림 호가 모든 방에 있다). 그림을 이해해야 하는 일이라 모델에 넘긴다.
     */
    @PostMapping("/api/admin/floorplans/{fid}/room-names")
    public Map<String, Object> roomNames(@PathVariable long fid, @RequestBody RoomNameRequest req,
                                         Authentication authentication) {
        UserRow me = access.require(authentication);
        FloorplanResponse f = floorplans.get(fid);
        access.requireOwns(me, inquiries.get(f.inquiryId()).partnerId());

        if (!roomNames.ready()) {
            throw new ApiException(HttpStatus.CONFLICT, "NO_VISION_KEY",
                    "도면 판독 키가 없어 방 이름을 읽을 수 없습니다. 서버 설정에 APP_ANALYSIS_API_KEY 를 넣어 주세요.");
        }
        List<double[]> centers = req.centers() == null ? List.of() : req.centers();
        if (centers.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_ROOMS", "먼저 방을 만들어 주세요.");
        }
        List<RoomNamingService.Named> named = roomNames.name(fid, centers);
        audit.log(access.actor(me), "FLOORPLAN_ROOM_NAMES", String.valueOf(fid),
                "방 " + centers.size() + "개 중 " + named.size() + "개 읽음");
        return Map.of("names", named);
    }

    @GetMapping("/api/admin/inquiries/{id}/floorplans")
    public List<FloorplanResponse> list(@PathVariable long id, Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        return floorplans.listByInquiry(id);
    }

    @PostMapping(path = "/api/admin/inquiries/{id}/floorplans",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<FloorplanResponse> upload(@PathVariable long id,
                                                    @RequestParam(required = false) String name,
                                                    @RequestPart("file") MultipartFile file,
                                                    Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        FloorplanResponse saved = floorplans.upload(id, name, file);
        audit.log(access.actor(me), "FLOORPLAN_UPLOAD", String.valueOf(saved.id()), "inquiry=" + id);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/api/admin/floorplans/{fid}")
    public FloorplanResponse save(@PathVariable long fid, @Valid @RequestBody SaveRequest req,
                                  Authentication authentication) {
        UserRow me = access.require(authentication);
        FloorplanResponse before = floorplans.get(fid);
        access.requireOwns(me, inquiries.get(before.inquiryId()).partnerId());
        return floorplans.save(fid, req, access.actor(me));
    }

    @DeleteMapping("/api/admin/floorplans/{fid}")
    public Map<String, Object> delete(@PathVariable long fid, Authentication authentication) {
        UserRow me = access.require(authentication);
        FloorplanResponse before = floorplans.get(fid);
        access.requireOwns(me, inquiries.get(before.inquiryId()).partnerId());
        floorplans.delete(fid);
        audit.log(access.actor(me), "FLOORPLAN_DELETE", String.valueOf(fid),
                "inquiry=" + before.inquiryId());
        return Map.of("ok", true);
    }

    /** 도면 이미지. 배치 화면의 배경으로 쓴다. */
    @GetMapping("/api/admin/floorplans/{fid}/image")
    public ResponseEntity<Resource> image(@PathVariable long fid, Authentication authentication) {
        UserRow me = access.require(authentication);
        FloorplanResponse f = floorplans.get(fid);
        access.requireOwns(me, inquiries.get(f.inquiryId()).partnerId());

        Path path = floorplans.imageFile(fid).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "도면 이미지를 찾을 수 없습니다."));
        String type;
        try {
            type = Files.probeContentType(path);
        } catch (IOException e) {
            type = null;
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(type == null ? f.contentType() : type))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePrivate())
                .body(new FileSystemResource(path));
    }
}
