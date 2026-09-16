package kr.kiwan.smarthome.inquiry;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.AnalyzeRequest;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.CandidateResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.UploadResponse;

/**
 * 보유 가전 사진 업로드와 판정.
 *
 * 업로드만 비로그인 공개다 — 접수 직후 발급된 1회용 토큰이 있어야 하고, 신청당 장수 제한이 걸린다.
 * 조회와 판정은 로그인한 관리자만 (SecurityConfig 의 /api/** 인증 규칙).
 */
@RestController
public class ApplianceController {

    private final ApplianceService appliances;

    public ApplianceController(ApplianceService appliances) {
        this.appliances = appliances;
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

    @GetMapping("/api/admin/inquiries/{id}/appliances")
    public List<ApplianceResponse> byInquiry(@PathVariable long id) {
        return appliances.listByInquiry(id);
    }

    /**
     * IoT 연동 후보 목록.
     * pending=true 면 아직 판정하지 않은 것, iotStatus 를 주면 그 판정만, 없으면 판정 끝난 것 전부.
     */
    @GetMapping("/api/admin/appliances")
    public List<CandidateResponse> candidates(@RequestParam(required = false) String iotStatus,
                                              @RequestParam(defaultValue = "false") boolean pending,
                                              @RequestParam(defaultValue = "100") int limit) {
        return appliances.candidates(iotStatus, pending, limit);
    }

    /** 사진에서 읽어낸 모델명과 판정을 저장한다. 사람이 채워도 되고, 분석 스크립트가 호출해도 된다. */
    @PatchMapping("/api/admin/appliances/{id}")
    public ApplianceResponse analyze(@PathVariable long id, @Valid @RequestBody AnalyzeRequest req) {
        return appliances.analyze(id, req);
    }

    /** 이미지 원본. 관리자 세션이 있어야 한다. */
    @GetMapping("/api/admin/photos/{id}/file")
    public ResponseEntity<Resource> file(@PathVariable long id) {
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
}
