package kr.kiwan.smarthome.inquiry;

import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.admin.AdminAccess;
import kr.kiwan.smarthome.admin.AuditRepository;
import kr.kiwan.smarthome.admin.InternalClient;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.AnalyzeRequest;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.CandidateResponse;

/**
 * 보유 가전 판정 — 관리자 서버 쪽.
 *
 * 사진 파일은 공개 서버(LXC 111)의 볼륨에 있다. 여기서는 LAN 내부 통로로 받아 그대로 흘려 보낸다.
 * 사진을 관리자 서버로 복사해 두지 않는 이유는 단순하다 — 지울 곳이 두 군데가 되면 안 지워진다.
 */
@Profile("admin")
@RestController
public class AdminApplianceController {

    private final ApplianceService appliances;
    private final AdminAccess access;
    private final AuditRepository audit;
    private final InquiryService inquiries;
    private final InternalClient internal;

    public AdminApplianceController(ApplianceService appliances, AdminAccess access, AuditRepository audit,
                                    InquiryService inquiries, InternalClient internal) {
        this.appliances = appliances;
        this.access = access;
        this.audit = audit;
        this.inquiries = inquiries;
        this.internal = internal;
    }

    @GetMapping("/api/admin/inquiries/{id}/appliances")
    public List<ApplianceResponse> byInquiry(@PathVariable long id, Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        return appliances.listByInquiry(id);
    }

    /**
     * IoT 연동 후보 목록. 전체를 가로지르는 화면이라 운영자만 본다.
     * pending=true 면 아직 판정하지 않은 것, iotStatus 를 주면 그 판정만.
     */
    @GetMapping("/api/admin/appliances")
    public List<CandidateResponse> candidates(@RequestParam(required = false) String iotStatus,
                                              @RequestParam(defaultValue = "false") boolean pending,
                                              @RequestParam(defaultValue = "100") int limit,
                                              Authentication authentication) {
        access.requireOwner(authentication);
        return appliances.candidates(iotStatus, pending, limit);
    }

    /** 자동판별이 틀렸을 때 사람이 고친다. */
    @PatchMapping("/api/admin/appliances/{id}")
    public ApplianceResponse analyze(@PathVariable long id, @Valid @RequestBody AnalyzeRequest req,
                                     Authentication authentication) {
        UserRow me = access.require(authentication);
        ApplianceResponse row = appliances.get(id);
        access.requireOwns(me, inquiries.get(row.inquiryId()).partnerId());
        ApplianceResponse updated = appliances.analyze(id, req, "MANUAL");
        audit.log(access.actor(me), "APPLIANCE_ANALYZE", String.valueOf(id),
                updated.detectedModel() + " / " + updated.iotStatus());
        return updated;
    }

    /** 사진 원본. 공개 서버에서 받아 그대로 흘린다. */
    @GetMapping("/api/admin/photos/{id}/file")
    public ResponseEntity<byte[]> file(@PathVariable long id, Authentication authentication) {
        access.require(authentication);
        ResponseEntity<byte[]> res = internal.photo(id);
        MediaType type = res.getHeaders().getContentType();
        return ResponseEntity.ok()
                .contentType(type == null ? MediaType.APPLICATION_OCTET_STREAM : type)
                .header("Cache-Control", "no-store")
                .body(res.getBody());
    }

    /**
     * 신청 한 건의 사진 원본을 지운다.
     * 상담이 끝나면 지우겠다고 폼에 적어 두었으니, 그 버튼이 실제로 있어야 한다.
     */
    @DeleteMapping("/api/admin/inquiries/{id}/photos")
    public Map<String, Object> purgePhotos(@PathVariable long id, Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        int removed = internal.purgePhotos(id);
        audit.log(access.actor(me), "PHOTO_PURGE", String.valueOf(id), "removed=" + removed);
        return Map.of("ok", true, "removed", removed);
    }
}
