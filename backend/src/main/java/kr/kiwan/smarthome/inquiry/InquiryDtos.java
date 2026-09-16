package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class InquiryDtos {

    private InquiryDtos() {}

    /** 상담 신청. 비로그인도 보낼 수 있다. */
    public record CreateRequest(
            @NotBlank(message = "성함을 입력해 주세요.")
            @Size(max = 50, message = "성함은 50자 이하로 입력해 주세요.")
            String name,

            @NotBlank(message = "연락처를 입력해 주세요.")
            @Pattern(regexp = "[0-9()+ -]{9,20}", message = "연락처 형식이 올바르지 않습니다.")
            String phone,

            @Email(message = "이메일 형식이 올바르지 않습니다.")
            @Size(max = 120, message = "이메일이 너무 깁니다.")
            String email,

            @Size(max = 60, message = "지역은 60자 이하로 입력해 주세요.")
            String region,

            // 2026-09-16: 평형으로 규모를 특정하지 않기로 해 상담 폼에서 입력을 없앴다.
            // DB 컬럼(area_pyeong)과 이 필드는 과거 접수 건 조회를 위해 남겨 두고, 신규 접수는 항상 null 이다.
            Integer areaPyeong,

            @Size(max = 20, message = "패키지 값이 올바르지 않습니다.")
            String packageCode,

            @Size(max = 40, message = "예정 시기는 40자 이하로 입력해 주세요.")
            String moveIn,

            @Size(max = 80, message = "유입 경로는 80자 이하로 입력해 주세요.")
            String channel,

            @Size(max = 2000, message = "문의 내용은 2000자 이하로 입력해 주세요.")
            String message,

            @AssertTrue(message = "개인정보 수집·이용에 동의해 주세요.")
            boolean agree,

            /** 스팸 봇 유인용 숨김 필드. 사람이 채우지 않는다. */
            String company
    ) {}

    public record CreateResponse(boolean ok, String message) {}

    /** 관리자 목록 행. */
    public record InquiryResponse(
            long id, String name, String phone, String email, String region, Integer areaPyeong,
            String packageCode, String moveIn, String channel, String message, String status, String memo,
            Long userId, OffsetDateTime createdAt, OffsetDateTime updatedAt
    ) {}

    public record UpdateRequest(
            @Size(max = 20, message = "상태 값이 올바르지 않습니다.")
            String status,
            @Size(max = 2000, message = "메모는 2000자 이하로 입력해 주세요.")
            String memo
    ) {}
}
