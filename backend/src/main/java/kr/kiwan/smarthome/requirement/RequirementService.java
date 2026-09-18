package kr.kiwan.smarthome.requirement;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import kr.kiwan.smarthome.catalog.CatalogDtos.PackageResponse;
import kr.kiwan.smarthome.catalog.CatalogService;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceService;
import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;
import kr.kiwan.smarthome.inquiry.InquiryService;
import kr.kiwan.smarthome.requirement.RequirementDtos.ApplianceRoll;
import kr.kiwan.smarthome.requirement.RequirementDtos.Fit;
import kr.kiwan.smarthome.requirement.RequirementDtos.Money;
import kr.kiwan.smarthome.requirement.RequirementDtos.Need;
import kr.kiwan.smarthome.requirement.RequirementDtos.RequirementSheet;
import kr.kiwan.smarthome.requirement.RequirementDtos.Work;

/**
 * 상담 준비 시트를 만든다.
 *
 * 규칙으로만 뽑는다 — 견적의 출발점이 되는 자리라 수량마다 근거를 댈 수 있어야 하고,
 * 같은 신청이면 언제 열어도 같은 답이 나와야 한다. (사진 판독 같은 외부 호출은 여기 끼지 않는다)
 *
 * 수량 규칙의 출처는 docs/견적.md 4장의 34평 기준 구성이다. 방·창 수로 비례시키되
 * 거실·주방·현관은 방 수와 별개로 항상 있는 공간으로 본다.
 */
@Service
public class RequirementService {

    /** 관심 항목이 요구하는 최소 패키지. frontend/src/data/inquiryOptions.ts 의 from 과 같아야 한다. */
    private static final Map<String, String> INTEREST_MIN = Map.ofEntries(
            Map.entry("LIGHT", "START"),
            Map.entry("SENSOR", "START"),
            Map.entry("LEAK", "BASIC"),
            Map.entry("MULTIBRAND", "BASIC"),
            Map.entry("LEGACY", "BASIC"),
            Map.entry("AIRCON", "STANDARD"),
            Map.entry("CLEANER", "STANDARD"),
            Map.entry("DOORLOCK", "STANDARD"),
            Map.entry("CURTAIN", "PREMIUM"),
            Map.entry("CCTV", "PREMIUM"),
            Map.entry("ENERGY", "PREMIUM"),
            Map.entry("TABLET", "PREMIUM"),
            Map.entry("VOICE", "FULL"));

    private static final List<String> LADDER = List.of("START", "BASIC", "STANDARD", "PREMIUM", "FULL");

    /** 방 개수 구간 → 셈에 쓸 방 수. R4 는 "4개 이상"이라 4 로 잡고 질문 목록에 올린다. */
    private static final Map<String, Integer> ROOMS = Map.of("R1", 1, "R2", 2, "R3", 3, "R4", 4);

    private static final Map<String, Integer> WINDOWS = Map.of("W1", 1, "W2", 2, "W3", 3, "W4", 4);

    /** 거실 · 주방 · 현관. 방 수와 별개로 늘 있는 공간이라 조명 셈에 더한다. */
    private static final int COMMON_SPACES = 3;

    private final InquiryService inquiries;
    private final ApplianceService appliances;
    private final CatalogService catalog;

    public RequirementService(InquiryService inquiries, ApplianceService appliances, CatalogService catalog) {
        this.inquiries = inquiries;
        this.appliances = appliances;
        this.catalog = catalog;
    }

    public RequirementSheet build(long inquiryId) {
        InquiryResponse q = inquiries.get(inquiryId);
        List<ApplianceResponse> owned = appliances.listByInquiry(inquiryId);
        List<String> interests = csv(q.interests());

        int rooms = ROOMS.getOrDefault(q.roomCount(), 2);
        Integer windows = WINDOWS.get(q.windowCount());

        ApplianceRoll roll = roll(owned);
        List<Need> devices = devices(interests, rooms, windows, roll);
        List<Work> works = works(interests, q, roll);
        List<String> questions = questions(q, owned, interests, windows);
        List<String> cautions = cautions(q, interests, roll);
        Fit fit = fit(q.packageCode(), interests);
        Money money = money(fit);

        String headline = headline(q, rooms, devices, roll);
        String plain = plainText(q, headline, fit, devices, works, roll, questions, cautions, money);

        return new RequirementSheet(inquiryId, headline, fit, devices, works, roll,
                questions, cautions, money, plain);
    }

    // ---------- 가전 집계 ----------

    private ApplianceRoll roll(List<ApplianceResponse> owned) {
        List<String> app = new ArrayList<>();
        List<String> ir = new ArrayList<>();
        List<String> none = new ArrayList<>();
        List<String> unknown = new ArrayList<>();
        for (ApplianceResponse a : owned) {
            String name = InquiryService.applianceLabel(a.kind())
                    + (a.detectedModel() != null ? " " + a.detectedModel()
                    : a.modelName() != null ? " " + a.modelName() : "");
            switch (a.iotStatus() == null ? "UNKNOWN" : a.iotStatus()) {
                case "APP" -> app.add(name);
                case "IR" -> ir.add(name);
                case "NONE" -> none.add(name);
                default -> unknown.add(name);
            }
        }
        return new ApplianceRoll(owned.size(), app.size(), ir.size(), none.size(), unknown.size(),
                app, ir, none, unknown);
    }

    // ---------- 기기 소요 ----------

    private List<Need> devices(List<String> interests, int rooms, Integer windows, ApplianceRoll roll) {
        List<Need> out = new ArrayList<>();
        out.add(new Need("SmartThings 허브", 1, "대", "모든 구성의 중심. 패키지 공통"));

        if (interests.contains("LIGHT")) {
            int n = rooms + COMMON_SPACES;
            out.add(new Need("조명 스위치", n, "개",
                    "방 " + rooms + " + 거실·주방·현관 " + COMMON_SPACES));
        }
        if (interests.contains("SENSOR")) {
            out.add(new Need("움직임 센서", rooms, "개", "방마다 1개"));
            out.add(new Need("문 열림 센서", 1, "개", "현관"));
        }
        if (interests.contains("LEAK")) {
            out.add(new Need("누수 센서", 2, "개", "주방 · 욕실"));
            out.add(new Need("온습도 센서", rooms, "개", "방마다 1개"));
        }
        if (interests.contains("CURTAIN")) {
            int n = windows == null ? 0 : windows;
            out.add(new Need("전동 커튼 모터", n, "개",
                    windows == null ? "창 개수 미정 — 확인 후 확정" : "신청서에 적은 창 " + n + "개"));
        }
        if (interests.contains("DOORLOCK")) {
            out.add(new Need("스마트 도어락", 1, "개", "현관"));
        }
        if (interests.contains("CCTV")) {
            out.add(new Need("실내 카메라", 1, "대", "거실 기준. 추가 설치 시 대수 조정"));
        }
        if (interests.contains("TABLET")) {
            out.add(new Need("벽면 태블릿", 1, "대", "거실 벽면 대시보드"));
        }
        if (interests.contains("ENERGY")) {
            out.add(new Need("계측 플러그", 3, "개", "전력이 큰 가전 위주. 분전반 CT 는 별도 검토"));
        }
        if (interests.contains("VOICE")) {
            out.add(new Need("음성 스피커", 1, "대", "거실 기준"));
        }

        // 리모컨 허브: 관심 항목으로 밝혔거나, 실제 보유 가전에 적외선 기기가 있으면 필요하다.
        boolean wantsLegacy = interests.contains("LEGACY") || interests.contains("AIRCON");
        if (wantsLegacy || roll.ir() > 0) {
            int n = Math.max(1, roll.ir());
            out.add(new Need("적외선 리모컨 허브", n, "대",
                    roll.ir() > 0 ? "리모컨으로만 되는 가전 " + roll.ir() + "대 (공간이 겹치면 줄어듦)"
                            : "구형 가전 연동 희망 — 실제 대수는 현장에서 확정"));
        }
        return out;
    }

    // ---------- 커미셔닝 작업 ----------

    private List<Work> works(List<String> interests, InquiryResponse q, ApplianceRoll roll) {
        List<Work> out = new ArrayList<>();
        out.add(new Work("허브 설치 · 공간 구성", "방 이름과 기기 배치를 실제 집 구조에 맞춘다"));

        List<String> brands = csv(q.brands());
        if (interests.contains("MULTIBRAND") || brands.size() > 1) {
            String names = brands.isEmpty() ? "보유 브랜드" : String.join(" · ", brands);
            out.add(new Work("브랜드 계정 통합", names + " 계정을 한 화면으로"));
        }
        if (roll.app() > 0) {
            out.add(new Work("가전 앱 연동 " + roll.app() + "대", String.join(", ", roll.appList())));
        }
        if (roll.ir() > 0) {
            out.add(new Work("리모컨 학습 " + roll.ir() + "대", String.join(", ", roll.irList())));
        }

        List<String> scenes = new ArrayList<>(List.of("외출", "귀가", "취침"));
        if (interests.contains("CLEANER")) {
            scenes.add("청소");
        }
        out.add(new Work("생활 장면 " + scenes.size() + "개", String.join(" · ", scenes)));

        if (interests.contains("VOICE")) {
            out.add(new Work("음성 명령 연결", "자주 쓰는 장면에 호출어 지정"));
        }
        if (interests.contains("ENERGY")) {
            out.add(new Work("에너지 대시보드", "기기별 사용량을 볼 수 있게 구성"));
        }
        if (interests.contains("TABLET")) {
            out.add(new Work("벽면 대시보드", "태블릿 화면 구성 · 상시 표시 설정"));
        }
        out.add(new Work("사용 교육 · 1개월 안정화", "쓰는 법 안내 후 한 달간 오작동 보정"));
        return out;
    }

    // ---------- 확인해야 할 것 ----------

    private List<String> questions(InquiryResponse q, List<ApplianceResponse> owned,
                                   List<String> interests, Integer windows) {
        List<String> out = new ArrayList<>();

        for (ApplianceResponse a : owned) {
            boolean noModel = blank(a.modelName()) && blank(a.detectedModel());
            boolean noVerdict = a.iotStatus() == null || "UNKNOWN".equals(a.iotStatus());
            if (noModel && noVerdict) {
                out.add(InquiryService.applianceLabel(a.kind())
                        + " 모델명 확인 (옆면·문 안쪽 라벨 사진이면 충분)");
            }
        }
        if (interests.contains("CURTAIN") && windows == null) {
            out.add("전동 커튼을 달 창이 몇 개인지");
        }
        if ("R4".equals(q.roomCount())) {
            out.add("방이 정확히 몇 개인지 (4개 이상으로만 표시됨)");
        }
        if (!"BEFORE".equals(q.buildStage())) {
            out.add("스위치 자리에 중성선이 있는지 (없으면 무중성선 스위치로 진행)");
        }
        if (blank(q.email())) {
            out.add("견적서를 받을 이메일");
        }
        if (blank(q.moveIn())) {
            out.add("입주 · 공사 예정 시기");
        }
        return out;
    }

    // ---------- 미리 알릴 것 ----------

    private List<String> cautions(InquiryResponse q, List<String> interests, ApplianceRoll roll) {
        List<String> out = new ArrayList<>();
        String stage = q.buildStage() == null ? "" : q.buildStage();

        switch (stage) {
            case "BEFORE" -> out.add("전기공사 전이라 중성선 확보를 요청할 수 있습니다 — 선택지가 가장 넓은 시점입니다.");
            case "DURING" -> out.add("공사가 진행 중이라 전기팀 일정에 맞춰야 합니다. 스위치 자리 확정 전에 연락이 필요합니다.");
            case "LIVING" -> out.add("이미 거주 중이라 배선 변경이 어렵습니다. 무중성선 스위치로 진행하면 조광에 제약이 있습니다.");
            default -> { }
        }
        if (roll.none() > 0) {
            out.add("연동이 안 되는 가전 " + roll.none() + "대: " + String.join(", ", roll.noneList())
                    + " — 교체 시점에 추가하는 것으로 안내합니다.");
        }
        if (roll.ir() > 0) {
            out.add("리모컨 허브로 묶는 가전은 상태 확인(켜짐/꺼짐)이 안 됩니다. 명령만 보냅니다.");
        }
        if (interests.contains("CURTAIN") && !"BEFORE".equals(stage)) {
            out.add("전동 커튼은 모터 전원이 필요합니다. 매립 전원이 없으면 노출 배선이 됩니다.");
        }
        if (roll.unknown() > 0) {
            out.add("아직 판별하지 못한 가전이 " + roll.unknown() + "대 있습니다. 모델명이 확인되면 구성이 바뀔 수 있습니다.");
        }
        return out;
    }

    // ---------- 패키지 · 금액 ----------

    private Fit fit(String chosen, List<String> interests) {
        String needed = "START";
        for (String code : interests) {
            String min = INTEREST_MIN.get(code);
            if (min != null && rank(min) > rank(needed)) {
                needed = min;
            }
        }
        String picked = chosen == null || "UNDECIDED".equals(chosen) ? null : chosen;
        if (picked == null) {
            return new Fit(null, needed, "MISSING",
                    "패키지를 고르지 않으셨습니다. 고른 항목 기준으로는 " + needed + " 부터 가능합니다.");
        }
        int diff = rank(picked) - rank(needed);
        if (diff < 0) {
            return new Fit(picked, needed, "SHORT",
                    picked + " 로는 고르신 항목을 다 담지 못합니다. " + needed + " 부터 가능합니다.");
        }
        if (diff == 0) {
            return new Fit(picked, needed, "MATCH", "고르신 항목과 패키지가 맞습니다.");
        }
        return new Fit(picked, needed, "ROOM",
                "고르신 항목만 보면 " + needed + " 로도 되지만 " + picked + " 를 선택하셨습니다. 여유분이 있습니다.");
    }

    private Money money(Fit fit) {
        String code = fit.chosen() != null && !"SHORT".equals(fit.verdict()) ? fit.chosen() : fit.needed();
        Optional<PackageResponse> p = catalog.packages(false).stream()
                .filter(x -> x.code().equals(code)).findFirst();
        if (p.isEmpty()) {
            return new Money(code, 0, 0, 0, "패키지 정보를 찾지 못했습니다.");
        }
        PackageResponse pkg = p.get();
        String note = switch (fit.verdict()) {
            case "SHORT" -> "고르신 항목을 담으려면 " + code + " 기준입니다.";
            case "MISSING" -> "패키지 미선택 — 고르신 항목 기준 " + code + " 로 계산했습니다.";
            default -> "선택하신 " + code + " 기준입니다.";
        };
        return new Money(code, pkg.price(), pkg.installFee(), pkg.price() + pkg.installFee(), note);
    }

    private static int rank(String code) {
        int i = LADDER.indexOf(code);
        return i < 0 ? 0 : i;
    }

    // ---------- 요약 · 전문 ----------

    private String headline(InquiryResponse q, int rooms, List<Need> devices, ApplianceRoll roll) {
        int units = devices.stream().mapToInt(Need::count).sum();
        return String.format("%s · 방 %d · 기기 %d점 · 보유 가전 %d대(앱 %d / 허브 %d / 불가 %d / 미확인 %d)",
                InquiryService.homeTypeLabel(q.homeType()), rooms, units,
                roll.total(), roll.app(), roll.ir(), roll.none(), roll.unknown());
    }

    private String plainText(InquiryResponse q, String headline, Fit fit, List<Need> devices,
                             List<Work> works, ApplianceRoll roll, List<String> questions,
                             List<String> cautions, Money money) {
        StringBuilder b = new StringBuilder();
        b.append("[상담 준비] #").append(q.id()).append(" ").append(q.name())
                .append(" ").append(q.phone()).append('\n');
        b.append(headline).append("\n\n");

        b.append("■ 패키지\n  ").append(money.packageCode()).append(" · ")
                .append(won(money.price())).append(" + 시공 ").append(won(money.installFee()))
                .append(" = ").append(won(money.total())).append('\n');
        b.append("  ").append(fit.note()).append("\n\n");

        b.append("■ 기기\n");
        for (Need n : devices) {
            b.append("  - ").append(n.item()).append(' ').append(n.count()).append(n.unit())
                    .append("  (").append(n.why()).append(")\n");
        }

        b.append("\n■ 작업\n");
        for (Work w : works) {
            b.append("  - ").append(w.item()).append("  (").append(w.why()).append(")\n");
        }

        if (!questions.isEmpty()) {
            b.append("\n■ 확인할 것\n");
            for (String s : questions) {
                b.append("  - ").append(s).append('\n');
            }
        }
        if (!cautions.isEmpty()) {
            b.append("\n■ 미리 알릴 것\n");
            for (String s : cautions) {
                b.append("  - ").append(s).append('\n');
            }
        }
        if (!blank(q.message())) {
            b.append("\n■ 남긴 말\n  ").append(q.message()).append('\n');
        }
        return b.toString();
    }

    private static String won(long value) {
        return String.format("%,d원", value);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static List<String> csv(String stored) {
        if (blank(stored)) {
            return List.of();
        }
        return Arrays.stream(stored.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

}
