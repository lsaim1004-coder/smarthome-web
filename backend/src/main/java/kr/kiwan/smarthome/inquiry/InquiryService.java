package kr.kiwan.smarthome.inquiry;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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

    /**
     * 상담 폼 선택지 코드 → 관리자 메일에 쓸 한글 라벨.
     * 프런트 코드표(frontend/src/data/inquiryOptions.ts)와 코드가 같아야 한다. 둘을 같이 고칠 것.
     */
    private static Map<String, String> labels(String... pairs) {
        Map<String, String> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            map.put(pairs[i], pairs[i + 1]);
        }
        return map;
    }

    private static final Map<String, String> HOME_TYPES = labels(
            "APT", "아파트", "OFFICETEL", "오피스텔", "HOUSE", "단독·빌라·주택", "OTHER_SPACE", "상가·사무실·그 외");

    private static final Map<String, String> ROOM_COUNTS = labels(
            "R1", "원룸·방 1개", "R2", "방 2개", "R3", "방 3개", "R4", "방 4개 이상");

    private static final Map<String, String> BUILD_STAGES = labels(
            "BEFORE", "인테리어 공사 전", "DURING", "공사 진행 중",
            "LIVING", "이미 거주 중", "PLANNING", "아직 알아보는 중");

    private static final Map<String, String> INTERESTS = labels(
            "LIGHT", "조명",
            "AIRCON", "에어컨·보일러",
            "CURTAIN", "전동 커튼·블라인드",
            "CLEANER", "로봇청소기",
            "VOICE", "음성 제어",
            "SENSOR", "문열림·움직임 알림",
            "LEAK", "누수·온습도 경보",
            "DOORLOCK", "도어락",
            "CCTV", "실내 CCTV",
            "MULTIBRAND", "브랜드 통합(삼성·LG·샤오미)",
            "LEGACY", "구형 가전 리모컨 허브",
            "ENERGY", "기기별 전기 사용량",
            "TABLET", "벽면 태블릿 대시보드");

    private static final Map<String, String> WINDOW_COUNTS = labels(
            "W1", "1창", "W2", "2창", "W3", "3창", "W4", "4창 이상", "W_UNSURE", "미정");

    /** ApplianceService.BRANDS 와 코드가 같아야 한다. */
    private static final Map<String, String> BRANDS = labels(
            "SAMSUNG", "삼성", "LG", "LG", "WINIA", "위니아", "XIAOMI", "샤오미",
            "CUCKOO", "쿠쿠", "COWAY", "코웨이", "ETC_BRAND", "그 외 브랜드", "UNSURE", "모름");

    /** ApplianceService.KINDS 와 코드가 같아야 한다. */
    static final Map<String, String> APPLIANCE_KINDS = labels(
            "FRIDGE", "냉장고",
            "WASHER", "세탁기",
            "DRYER", "건조기",
            "TV", "TV",
            "AIRCON", "에어컨",
            "AIRPURIFIER", "공기청정기",
            "ROBOT", "로봇청소기",
            "DISHWASHER", "식기세척기",
            "RANGE", "전기레인지·오븐",
            "WATERPURIFIER", "정수기",
            "BOILER", "보일러",
            "DOORLOCK", "도어락",
            "STYLER", "스타일러·의류관리기",
            "ETC", "그 외");

    /** 선택지가 늘어나도 폭주하지 않게 개수를 자른다. */
    private static final int MAX_CODES = 30;

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** 같은 번호로 이 시간 안에 다시 보내면 중복으로 본다. */
    private static final int DEDUP_MINUTES = 10;

    /** 접수 직후 사진을 올릴 수 있는 시간. 폼에서 바로 올리므로 길 필요가 없다. */
    private static final int UPLOAD_WINDOW_MINUTES = 30;

    /** 접수 결과. 사진 업로드에 필요한 것들을 같이 돌려준다. */
    public record Created(long id, String uploadToken, Map<Integer, Long> applianceIds) {}

    private final InquiryRepository repo;
    private final ApplianceService appliances;
    private final MailService mail;
    private final AppProperties props;

    public InquiryService(InquiryRepository repo, ApplianceService appliances, MailService mail,
                          AppProperties props) {
        this.repo = repo;
        this.appliances = appliances;
        this.mail = mail;
        this.props = props;
    }

    public Created create(CreateRequest req, Long userId, String clientIp) {
        // 봇이 채운 숨김 필드. 사용자에게는 성공으로 보이게 하고 저장하지 않는다.
        if (req.company() != null && !req.company().isBlank()) {
            log.info("honeypot hit from ip={}", clientIp);
            return new Created(-1, null, Map.of());
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
                code(req.homeType(), HOME_TYPES),
                code(req.roomCount(), ROOM_COUNTS),
                code(req.buildStage(), BUILD_STAGES),
                codes(req.interests(), INTERESTS),
                code(req.windowCount(), WINDOW_COUNTS),
                ApplianceService.brandSummary(req.appliances()),
                packageCode,
                blankToNull(req.moveIn()),
                blankToNull(req.channel()),
                blankToNull(req.message()),
                userId,
                clientIp);

        Map<Integer, Long> applianceIds = appliances.saveAll(id, req.appliances());

        String uploadToken = UUID.randomUUID().toString();
        repo.setUploadToken(id, uploadToken, UPLOAD_WINDOW_MINUTES);

        String applianceSummary = ApplianceService.summarize(req.appliances(), APPLIANCE_KINDS);
        repo.findById(id).ifPresent(row -> notifyAdmins(row, applianceSummary));
        sendReceipt(req.name().trim(), blankToNull(req.email()));
        return new Created(id, uploadToken, applianceIds);
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

    private void notifyAdmins(InquiryResponse row, String applianceSummary) {
        List<String> admins = props.normalizedAdminEmails();
        if (admins.isEmpty()) {
            log.warn("상담 신청 #{} 접수 — APP_ADMIN_EMAILS 가 비어 있어 알림을 보내지 않습니다.", row.id());
            return;
        }
        String subject = "[상담신청] " + row.name() + " · " + packageLabel(row.packageCode())
                + (row.roomCount() == null ? "" : " · " + label(row.roomCount(), ROOM_COUNTS));
        String body = "새 상담 신청이 접수되었습니다.\n\n"
                + line("접수번호", "#" + row.id())
                + line("성함", row.name())
                + line("연락처", row.phone())
                + line("이메일", row.email())
                + line("지역", row.region())
                + line("접수 시각", row.createdAt() == null ? null : STAMP.format(row.createdAt()))
                + "\n집\n"
                + line("주거 형태", label(row.homeType(), HOME_TYPES))
                + line("방 개수", label(row.roomCount(), ROOM_COUNTS))
                + line("공사 상태", label(row.buildStage(), BUILD_STAGES))
                + line("입주·공사 예정", row.moveIn())
                + "\n원하는 것\n"
                + line("관심 항목", labelList(row.interests(), INTERESTS))
                + line("커튼 창 수", label(row.windowCount(), WINDOW_COUNTS))
                + line("보유 가전", applianceSummary)
                + line("가전 브랜드", labelList(row.brands(), BRANDS))
                + line("관심 패키지", packageLabel(row.packageCode()))
                + line("알게 된 경로", row.channel())
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
            case "START" -> "START (79만원)";
            case "BASIC" -> "BASIC (119만원)";
            case "STANDARD" -> "STANDARD (199만원)";
            case "PREMIUM" -> "PREMIUM (399만원)";
            case "FULL" -> "FULL HOME (619만원)";
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

    /** 화이트리스트에 없는 코드는 버린다. 프런트가 바뀌어도 쓰레기 값이 들어오지 않게. */
    private static String code(String raw, Map<String, String> allowed) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        return allowed.containsKey(upper) ? upper : null;
    }

    /** 코드 목록을 쉼표로 이어 한 칸에 담는다. 중복·미지 코드는 제거한다. */
    static String codes(List<String> raw, Map<String, String> allowed) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        List<String> kept = new ArrayList<>();
        for (String one : raw) {
            String normalized = code(one, allowed);
            if (normalized != null && !kept.contains(normalized)) {
                kept.add(normalized);
            }
            if (kept.size() >= MAX_CODES) {
                break;
            }
        }
        return kept.isEmpty() ? null : String.join(",", kept);
    }

    static String label(String code, Map<String, String> allowed) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return allowed.getOrDefault(code, code);
    }

    static String labelList(String stored, Map<String, String> allowed) {
        if (stored == null || stored.isBlank()) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (String one : stored.split(",")) {
            String trimmed = one.trim();
            if (!trimmed.isEmpty()) {
                out.add(allowed.getOrDefault(trimmed, trimmed));
            }
        }
        return out.isEmpty() ? null : String.join(" · ", out);
    }
}
