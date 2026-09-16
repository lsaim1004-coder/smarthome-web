package kr.kiwan.smarthome.admin;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import kr.kiwan.smarthome.admin.PartnerDtos.PartnerRequest;
import kr.kiwan.smarthome.admin.PartnerDtos.PartnerResponse;
import kr.kiwan.smarthome.admin.PartnerRepository.PartnerRow;
import kr.kiwan.smarthome.auth.UserRepository;
import kr.kiwan.smarthome.common.ApiException;

@Service
public class PartnerService {

    private final PartnerRepository repo;
    private final UserRepository users;
    private final AuditRepository audit;

    public PartnerService(PartnerRepository repo, UserRepository users, AuditRepository audit) {
        this.repo = repo;
        this.users = users;
        this.audit = audit;
    }

    public List<PartnerResponse> list() {
        Set<String> joined = users.findStaff().stream()
                .map(u -> u.email() == null ? "" : u.email())
                .collect(java.util.stream.Collectors.toSet());
        return repo.findAll().stream().map(p -> toResponse(p, joined)).toList();
    }

    public PartnerResponse create(PartnerRequest req, String actor) {
        String code = normalizeCode(req.code());
        if (repo.codeTaken(code, null)) {
            throw new ApiException(HttpStatus.CONFLICT, "CODE_TAKEN", "이미 쓰는 업체 코드입니다.");
        }
        long id = repo.insert(code, req.name().trim(), trim(req.contactName()), email(req.contactEmail()),
                trim(req.contactPhone()), trim(req.region()), trim(req.memo()), req.active());
        audit.log(actor, "PARTNER_CREATE", String.valueOf(id), code + " " + req.name());
        return find(id);
    }

    public PartnerResponse update(long id, PartnerRequest req, String actor) {
        String code = normalizeCode(req.code());
        if (repo.codeTaken(code, id)) {
            throw new ApiException(HttpStatus.CONFLICT, "CODE_TAKEN", "이미 쓰는 업체 코드입니다.");
        }
        int changed = repo.update(id, code, req.name().trim(), trim(req.contactName()), email(req.contactEmail()),
                trim(req.contactPhone()), trim(req.region()), trim(req.memo()), req.active());
        if (changed == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "업체를 찾을 수 없습니다.");
        }
        audit.log(actor, "PARTNER_UPDATE", String.valueOf(id), code + " " + req.name());
        return find(id);
    }

    public PartnerResponse find(long id) {
        PartnerRow row = repo.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "업체를 찾을 수 없습니다."));
        Set<String> joined = users.findStaff().stream()
                .map(u -> u.email() == null ? "" : u.email())
                .collect(java.util.stream.Collectors.toSet());
        return toResponse(row, joined);
    }

    private PartnerResponse toResponse(PartnerRow p, Set<String> joinedEmails) {
        boolean joined = p.contactEmail() != null
                && joinedEmails.contains(p.contactEmail().toLowerCase(Locale.ROOT));
        return new PartnerResponse(p.id(), p.code(), p.name(), p.contactName(), p.contactEmail(),
                p.contactPhone(), p.region(), p.memo(), p.active(), repo.inquiryCount(p.id()), joined,
                p.createdAt());
    }

    private static String normalizeCode(String raw) {
        String code = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_]{2,20}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION",
                    "업체 코드는 영문 대문자·숫자·밑줄 2~20자입니다.");
        }
        return code;
    }

    private static String email(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim().toLowerCase(Locale.ROOT);
    }

    private static String trim(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }
}
