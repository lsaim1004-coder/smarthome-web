package kr.kiwan.smarthome.inquiry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.UploadResponse;

/**
 * 공개 사이트 쪽 사진 통로.
 *
 * 업로드는 비로그인 공개다 — 접수 직후 발급된 1회용 토큰이 있어야 하고, 신청당 장수 제한이 걸린다.
 * 파일은 이 서버(LXC 111)의 볼륨에 있으므로, 관리자 서버가 볼 때는 아래 내부 통로로 가져간다.
 */
@Profile("public")
@RestController
public class ApplianceController {

    private final ApplianceService appliances;
    private final AppProperties props;

    public ApplianceController(ApplianceService appliances, AppProperties props) {
        this.appliances = appliances;
        this.props = props;
    }

    /**
     * 신청 접수 응답으로 받은 uploadToken 과 가전 id 를 함께 넘긴다.
     * applianceId 가 없으면 어느 가전인지 모르는 사진으로 남는다.
     */
    @PostMapping(path = "/api/inquiries/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UploadResponse> upload(@PathVariable long id,
                                                 @RequestParam("token") String token,
                                                 @RequestParam(value = "applianceId", required = false)
                                                 Long applianceId,
                                                 @RequestPart("files") List<MultipartFile> files) {
        int stored = appliances.upload(id, token, applianceId, files);
        int rejected = files.size() - stored;
        String message = stored == 0
                ? "사진을 저장하지 못했습니다. 신청은 정상 접수되었습니다."
                : stored + "장이 첨부되었습니다."
                        + (rejected > 0 ? " " + rejected + "장은 형식·용량 때문에 제외했습니다." : "");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new UploadResponse(stored > 0, stored, rejected, message));
    }

    /**
     * 관리자 서버(LXC 112)가 LAN 으로만 부르는 통로. 공유 키가 맞아야 한다.
     * 이 포트는 공인망에 열려 있지 않다(compose 에서 LAN 주소에만 바인딩).
     */
    @GetMapping("/api/internal/photos/{id}")
    public ResponseEntity<Resource> internalPhoto(@PathVariable long id,
                                                  @RequestHeader(value = "X-Internal-Key", required = false)
                                                  String key) {
        requireInternal(key);
        Path path = appliances.photoFile(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "사진을 찾을 수 없습니다."));
        String type;
        try {
            type = Files.probeContentType(path);
        } catch (IOException e) {
            type = null;
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(type == null ? "application/octet-stream" : type))
                .cacheControl(CacheControl.noStore())
                .body(new FileSystemResource(path));
    }

    /**
     * 신청 한 건의 사진 원본을 지운다. 상담이 끝나면 관리자가 누르고, 자동판별이 끝나면 저절로 지워진다.
     * 사진 행은 남겨 둔다 — 몇 장을 받았는지는 기록으로 남아야 한다.
     */
    @DeleteMapping("/api/internal/inquiries/{id}/photos")
    public Map<String, Object> internalPurge(@PathVariable long id,
                                             @RequestHeader(value = "X-Internal-Key", required = false)
                                             String key) {
        requireInternal(key);
        int removed = appliances.purgePhotosOfInquiry(id);
        return Map.of("ok", true, "removed", removed);
    }

    private void requireInternal(String key) {
        if (!props.internal().configured() || !props.internal().key().equals(key)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "내부 통로 키가 맞지 않습니다.");
        }
    }
}
