package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

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

            // 2026-09-16 양식 개편: 신청자가 기기 이름을 몰라도 채울 수 있게 집 상태와 관심 항목을 받는다.
            // 코드 값 검증은 서비스에서 화이트리스트로 한다(프런트 코드표: frontend/src/data/inquiryOptions.ts).
            @Size(max = 20, message = "주거 형태 값이 올바르지 않습니다.")
            String homeType,

            @Size(max = 20, message = "방 개수 값이 올바르지 않습니다.")
            String roomCount,

            @Size(max = 20, message = "공사 상태 값이 올바르지 않습니다.")
            String buildStage,

            /** 관심 항목 코드. 알 수 없는 코드는 버린다. */
            List<String> interests,

            @Size(max = 20, message = "창 개수 값이 올바르지 않습니다.")
            String windowCount,

            /**
             * 보유 가전 목록. 종류 · 브랜드 · 모델명 · 구매 시기를 한 대씩 받는다.
             * 사진은 접수 후 이 목록의 id 에 붙는다(ApplianceController).
             */
            @jakarta.validation.Valid
            List<ApplianceDtos.ApplianceInput> appliances,

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

    /**
     * 접수 응답. 사진을 붙일 수 있게 접수번호와 업로드 토큰, 그리고
     * 프런트가 보낸 순번 → 저장된 가전 id 매핑을 같이 준다.
     * 봇 요청(허니팟)이면 전부 비어 있고, 프런트는 업로드를 건너뛴다.
     */
    public record CreateResponse(boolean ok, String message, Long id, String uploadToken,
                                 Map<Integer, Long> applianceIds) {}

    /** 관리자 목록 행. */
    public record InquiryResponse(
            long id, String name, String phone, String email, String region, Integer areaPyeong,
            String homeType, String roomCount, String buildStage, String interests, String windowCount,
            String brands,
            String packageCode, String moveIn, String channel, String message, String status, String memo,
            Long userId, Long partnerId, String partnerName,
            OffsetDateTime createdAt, OffsetDateTime updatedAt
    ) {}

    /**
     * 관리자 편집. 보내지 않은(null) 항목은 그대로 둔다 —
     * 화면이 한 칸만 고쳐 보내도 나머지가 지워지면 안 된다.
     * 담당 업체를 떼려면 partnerId 에 0 을 보낸다.
     */
    public record UpdateRequest(
            @Size(max = 20, message = "상태 값이 올바르지 않습니다.")
            String status,

            @Size(max = 2000, message = "메모는 2000자 이하로 입력해 주세요.")
            String memo,

            @Size(max = 50, message = "성함은 50자 이하로 입력해 주세요.")
            String name,

            @Size(max = 30, message = "연락처는 30자 이하로 입력해 주세요.")
            String phone,

            @Size(max = 120, message = "이메일이 너무 깁니다.")
            String email,

            @Size(max = 60, message = "지역은 60자 이하로 입력해 주세요.")
            String region,

            @Size(max = 20, message = "주거 형태 값이 올바르지 않습니다.")
            String homeType,

            @Size(max = 20, message = "방 개수 값이 올바르지 않습니다.")
            String roomCount,

            @Size(max = 20, message = "공사 상태 값이 올바르지 않습니다.")
            String buildStage,

            List<String> interests,

            @Size(max = 20, message = "창 개수 값이 올바르지 않습니다.")
            String windowCount,

            @Size(max = 20, message = "패키지 값이 올바르지 않습니다.")
            String packageCode,

            @Size(max = 40, message = "예정 시기는 40자 이하로 입력해 주세요.")
            String moveIn,

            @Size(max = 80, message = "유입 경로는 80자 이하로 입력해 주세요.")
            String channel,

            @Size(max = 2000, message = "문의 내용은 2000자 이하로 입력해 주세요.")
            String message,

            Long partnerId
    ) {}

    /** 상세 화면 한 벌. 신청 내용 + 보유 가전(판별 결과 포함). */
    public record InquiryDetail(InquiryResponse inquiry, List<ApplianceDtos.ApplianceResponse> appliances) {}
}
