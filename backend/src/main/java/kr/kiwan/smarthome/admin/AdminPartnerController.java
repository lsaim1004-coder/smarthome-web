package kr.kiwan.smarthome.admin;

import java.util.List;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.admin.AuditRepository.AuditRow;
import kr.kiwan.smarthome.admin.PartnerDtos.PartnerRequest;
import kr.kiwan.smarthome.admin.PartnerDtos.PartnerResponse;
import kr.kiwan.smarthome.auth.AuthDtos.UserResponse;
import kr.kiwan.smarthome.auth.UserRepository;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;

/**
 * 업체와 관리자 계정.
 *
 * 업체를 등록하면 그 담당자 이메일로만 관리자 가입이 열린다(초대 대신 화이트리스트).
 * 계정을 막는 것도 여기서 한다 — 비밀번호를 바꾸게 하는 것보다 확실하다.
 */
@Profile("admin")
@RestController
@RequestMapping("/api/admin")
public class AdminPartnerController {

    private final PartnerService partners;
    private final UserRepository users;
    private final AuditRepository audit;
    private final AdminAccess access;

    public AdminPartnerController(PartnerService partners, UserRepository users, AuditRepository audit,
                                  AdminAccess access) {
        this.partners = partners;
        this.users = users;
        this.audit = audit;
        this.access = access;
    }

    /** 업체 목록. 담당 배정 드롭다운에 쓰므로 업체 계정도 읽을 수 있다. */
    @GetMapping("/partners")
    public List<PartnerResponse> list(Authentication authentication) {
        access.require(authentication);
        return partners.list();
    }

    @PostMapping("/partners")
    public PartnerResponse create(@Valid @RequestBody PartnerRequest req, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return partners.create(req, access.actor(me));
    }

    @PutMapping("/partners/{id}")
    public PartnerResponse update(@PathVariable long id, @Valid @RequestBody PartnerRequest req,
                                  Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return partners.update(id, req, access.actor(me));
    }

    /** 관리자 계정 목록. 누가 들어올 수 있는지 한눈에. */
    @GetMapping("/accounts")
    public List<UserResponse> accounts(Authentication authentication) {
        access.requireOwner(authentication);
        return users.findStaff().stream()
                .map(u -> new UserResponse(u.id(), u.email(), u.name(), "OWNER".equals(u.role()), u.role(),
                        u.partnerId(), null, u.active(), u.emailVerifiedAt(), u.createdAt(), u.lastLoginAt()))
                .toList();
    }

    /** 계정 사용 중지·재개. 자기 계정은 막을 수 없다(스스로 잠기는 사고 방지). */
    @PutMapping("/accounts/{id}/active")
    public Map<String, Object> setActive(@PathVariable long id, @RequestParam boolean value,
                                         Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        if (me.id() == id) {
            return Map.of("ok", false, "message", "자기 계정은 바꿀 수 없습니다.");
        }
        users.setActive(id, value);
        audit.log(access.actor(me), value ? "ACCOUNT_ENABLE" : "ACCOUNT_DISABLE", String.valueOf(id), null);
        return Map.of("ok", true);
    }

    /** 최근 변경 기록. */
    @GetMapping("/audit")
    public List<AuditRow> auditLog(@RequestParam(defaultValue = "100") int limit,
                                   Authentication authentication) {
        access.requireOwner(authentication);
        return audit.recent(limit);
    }
}
