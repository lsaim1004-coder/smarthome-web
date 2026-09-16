package kr.kiwan.smarthome.inquiry;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.common.MailService;
import kr.kiwan.smarthome.inquiry.InquiryDtos.CreateRequest;
import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;

@Service
public class InquiryService {

    private static final Logger log = LoggerFactory.getLogger(InquiryService.class);

    /** 접수 → 연락 → 견적 → 계약/무산 */
    static final List<String> STATUSES = List.of("NEW", "CONTACTED", "QUOTED", "WON", "LOST");

    private static final Set<String> PACKAGES =
            Set.of("START", "BASIC", "STANDARD", "PREMIUM", "FULL", "UNDECIDED");

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** 같은 번호로 이 시간 안에 다시 보내면 중복으로 본다. */
    private static final int DEDUP_MINUTES = 10;

    private final InquiryRepository repo;
    private final MailService mail;
    private final AppProperties props;

    public InquiryService(InquiryRepository repo, MailService mail, AppProperties props) {
        this.repo = repo;
        this.mail = mail;
        this.props = props;
    }

    public long create(CreateRequest req, Long userId, String clientIp) {
        // 봇이 채운 숨김 필드. 사용자에게는 성공으로 보이게 하고 저장하지 않는다.
        if (req.company() != null && !req.company().isBlank()) {
            log.info("honeypot hit from ip={}", clientIp);
            return -1;
        }

        String phone = normalizePhone(req.phone());
        if (repo.existsRecentByPhone(phone, DEDUP_MINUTES)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE",
                    "같은 연락처로 방금 접수된 신청이 있습니다. 잠시 후 다시 시도해 주세요.");
        }

        String packageCode = normalizePackage(req.packageCode());
        long id = repo.insert(
                req.name().trim(),
                phone,
                blankToNull(req.email()),
                blankToNull(req.region()),
                req.areaPyeong(),
                packageCode,
                blankToNull(req.moveIn()),
                blankToNull(req.channel()),
                blankToNull(req.message()),
                userId,
                clientIp);

        repo.findById(id).ifPresent(this::notifyAdmins);
        sendReceipt(req.name().trim(), blankToNull(req.email()));
        return id;
    }

    public List<InquiryResponse> list(String status, int limit, int offset) {
        String normalized = normalizeStatus(status);
        return repo.findAll(normalized, limit, offset);
    }

    public int count(String status) {
        return repo.countByStatus(normalizeStatus(status));
    }

    public InquiryResponse update(long id, String status, String memo) {
        String normalized = status == null || status.isBlank() ? null : normalizeStatus(status);
        if (status != null && !status.isBlank() && normalized == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "상태 값이 올바르지 않습니다.");
        }
        repo.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "신청을 찾을 수 없습니다."));
        repo.update(id, normalized, memo);
        return repo.findById(id).orElseThrow();
    }

    private void notifyAdmins(InquiryResponse row) {
        List<String> admins = props.normalizedAdminEmails();
        if (admins.isEmpty()) {
            log.warn("상담 신청 #{} 접수 — APP_ADMIN_EMAILS 가 비어 있어 알림을 보내지 않습니다.", row.id());
            return;
        }
        String subject = "[상담신청] " + row.name() + " · " + packageLabel(row.packageCode())
                + (row.areaPyeong() == null ? "" : " · " + row.areaPyeong() + "평");
        String body = "새 상담 신청이 접수되었습니다.\n\n"
                + line("접수번호", "#" + row.id())
                + line("성함", row.name())
                + line("연락처", row.phone())
                + line("이메일", row.email())
                + line("지역", row.region())
                + line("관심 패키지", packageLabel(row.packageCode()))
                + line("입주·공사 예정", row.moveIn())
                + line("알게 된 경로", row.channel())
                + line("접수 시각", row.createdAt() == null ? null : STAMP.format(row.createdAt()))
                + "\n문의 내용\n"
                + (row.message() == null || row.message().isBlank() ? "  (없음)\n" : "  " + row.message() + "\n")
                + "\n관리자 목록: " + props.baseUrl() + "/admin/inquiries\n";
        for (String admin : admins) {
            mail.send(admin, subject, body);
        }
    }

    private void sendReceipt(String name, String email) {
        if (email == null) {
            return;
        }
        String subject = "[" + props.serviceName() + "] 상담 신청이 접수되었습니다.";
        String body = name + " 님, 안녕하세요.\n\n"
                + "스마트홈 상담 신청이 접수되었습니다. 확인 후 영업일 기준 1~2일 안에 연락드리겠습니다.\n\n"
                + "상담은 방 구성과 현재 인테리어 일정에 맞춰 어떤 구성이 가능한지 먼저 확인하는 순서로 진행합니다.\n"
                + "공사 일정이 이미 잡혀 있다면 전기공사 전에 연락 주시면 선택지가 넓어집니다.\n\n"
                + props.baseUrl() + "\n";
        mail.send(email, subject, body);
    }

    private static String line(String label, String value) {
        return "  " + label + ": " + (value == null || value.isBlank() ? "-" : value) + "\n";
    }

    static String packageLabel(String code) {
        if (code == null) {
            return "미정";
        }
        return switch (code) {
            case "START" -> "START (99만원)";
            case "BASIC" -> "BASIC (149만원)";
            case "STANDARD" -> "STANDARD (249만원)";
            case "PREMIUM" -> "PREMIUM (449만원)";
            case "FULL" -> "FULL HOME (699만원)";
            default -> "미정";
        };
    }

    private static String normalizePackage(String code) {
        if (code == null || code.isBlank()) {
            return "UNDECIDED";
        }
        String upper = code.trim().toUpperCase(Locale.ROOT);
        return PACKAGES.contains(upper) ? upper : "UNDECIDED";
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String upper = status.trim().toUpperCase(Locale.ROOT);
        return STATUSES.contains(upper) ? upper : null;
    }

    /** 숫자만 남긴 뒤 휴대폰 형태면 하이픈을 넣어 되돌린다. 중복 판정을 같은 표기로 맞추기 위함. */
    static String normalizePhone(String raw) {
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() == 11) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 7) + "-" + digits.substring(7);
        }
        if (digits.length() == 10) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 6) + "-" + digits.substring(6);
        }
        return digits.isEmpty() ? raw.trim() : digits;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
