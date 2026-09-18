package kr.kiwan.smarthome.requirement;

import java.util.List;

/**
 * 상담 준비 시트.
 *
 * 신청자가 채운 것(집 · 원하는 것 · 보유 가전)과 자동판별 결과를 모아
 * "무엇이 얼마나 필요한가 / 무엇을 더 물어봐야 하는가"로 바꾼 것이다.
 * 전화를 걸기 전에 이 한 장만 보면 되도록 만든다.
 *
 * 값은 전부 규칙으로 뽑는다 — 견적 근거가 되는 자리라 "왜 이 수량인지"를 댈 수 있어야 한다.
 */
public final class RequirementDtos {

    private RequirementDtos() {}

    /** 기기 한 품목. why 는 이 수량이 나온 근거다. */
    public record Need(String item, int count, String unit, String why) {}

    /** 커미셔닝 작업 한 줄. */
    public record Work(String item, String why) {}

    /** 보유 가전을 연동 경로로 모은 것. */
    public record ApplianceRoll(
            int total,
            int app,        // 제조사 앱으로 묶임
            int ir,         // 리모컨 허브 필요
            int none,       // 연동 불가
            int unknown,    // 아직 판별 못 함
            List<String> appList,
            List<String> irList,
            List<String> noneList,
            List<String> unknownList) {}

    /** 패키지 적합성. needed 는 고른 관심 항목이 요구하는 최소 패키지. */
    public record Fit(String chosen, String needed, String verdict, String note) {}

    public record Money(String packageCode, long price, long installFee, long total, String note) {}

    public record RequirementSheet(
            long inquiryId,
            String headline,
            Fit fit,
            List<Need> devices,
            List<Work> works,
            ApplianceRoll appliances,
            List<String> questions,
            List<String> cautions,
            Money money,
            /** 전화 상담용으로 그대로 복사해 쓰는 전문. */
            String plainText) {}
}
