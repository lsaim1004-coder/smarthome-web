package kr.kiwan.smarthome.inquiry;

import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.admin.AdminAccess;
import kr.kiwan.smarthome.admin.AuditRepository;
import kr.kiwan.smarthome.admin.InternalClient;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryDetail;
import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;
import kr.kiwan.smarthome.inquiry.InquiryDtos.UpdateRequest;
import kr.kiwan.smarthome.requirement.RequirementDtos.RequirementSheet;
import kr.kiwan.smarthome.requirement.RequirementService;

/**
 * 들어온 상담 신청을 보고 고친다.
 *
 * 운영자는 전부 보고, 업체 계정은 자기 업체가 담당인 건만 본다.
 * 담당 배정과 삭제는 운영자만 — 업체가 자기 건을 남에게 넘기거나 지우면 안 된다.
 */
@Profile("admin")
@RestController
@RequestMapping("/api/admin/inquiries")
public class AdminInquiryController {

    public record ListResponse(List<InquiryResponse> items, int total, List<String> statuses,
                               Map<String, Integer> counts, boolean canAssign) {}

    private final InquiryService inquiries;
    private final ApplianceService appliances;
    private final AdminAccess access;
    private final AuditRepository audit;
    private final InternalClient internal;
    private final RequirementService requirements;

    public AdminInquiryController(InquiryService inquiries, ApplianceService appliances,
                                  AdminAccess access, AuditRepository audit, InternalClient internal,
                                  RequirementService requirements) {
        this.inquiries = inquiries;
        this.appliances = appliances;
        this.access = access;
        this.audit = audit;
        this.internal = internal;
        this.requirements = requirements;
    }

    @GetMapping
    public ListResponse list(@RequestParam(required = false) String status,
                             @RequestParam(required = false) String q,
                             @RequestParam(defaultValue = "100") int limit,
                             @RequestParam(defaultValue = "0") int offset,
                             Authentication authentication) {
        UserRow me = access.require(authentication);
        Long scope = access.scope(me);
        int capped = Math.clamp(limit, 1, 500);
        return new ListResponse(
                inquiries.list(status, scope, q, capped, Math.max(offset, 0)),
                inquiries.count(status, scope, q),
                InquiryService.STATUSES,
                inquiries.statusCounts(scope),
                me.owner());
    }

    @GetMapping("/{id}")
    public InquiryDetail detail(@PathVariable long id, Authentication authentication) {
        UserRow me = access.require(authentication);
        InquiryResponse row = inquiries.get(id);
        access.requireOwns(me, row.partnerId());
        return new InquiryDetail(row, appliances.listByInquiry(id));
    }

    /**
     * 상담 준비 시트. 모아 둔 데이터를 "무엇이 얼마나 필요한가 / 무엇을 더 물어봐야 하는가"로 바꿔 준다.
     * 전화를 걸기 전에 이 한 장만 보면 되게 하는 것이 목적이다.
     */
    @GetMapping("/{id}/requirements")
    public RequirementSheet requirements(@PathVariable long id, Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        return requirements.build(id);
    }

    @PatchMapping("/{id}")
    public InquiryResponse update(@PathVariable long id,
                                  @Valid @RequestBody UpdateRequest req,
                                  Authentication authentication) {
        UserRow me = access.require(authentication);
        access.requireOwns(me, inquiries.get(id).partnerId());
        InquiryResponse updated = inquiries.update(id, req, me.owner());
        audit.log(access.actor(me), "INQUIRY_UPDATE", String.valueOf(id),
                "status=" + updated.status() + " partner=" + updated.partnerId());
        return updated;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable long id, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        // 사진 파일은 행보다 먼저 치운다. 행이 사라지면 어떤 파일이 남았는지 알 길이 없다.
        int removed = internal.purgePhotos(id);
        inquiries.delete(id);
        audit.log(access.actor(me), "INQUIRY_DELETE", String.valueOf(id), "photos=" + removed);
        return Map.of("ok", true, "photosRemoved", removed);
    }
}
