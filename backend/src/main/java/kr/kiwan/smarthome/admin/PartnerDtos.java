package kr.kiwan.smarthome.admin;

import java.time.OffsetDateTime;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class PartnerDtos {

    private PartnerDtos() {}

    public record PartnerResponse(long id, String code, String name, String contactName, String contactEmail,
                                  String contactPhone, String region, String memo, boolean active,
                                  int inquiryCount, boolean accountJoined, OffsetDateTime createdAt) {}

    public record PartnerRequest(
            @NotBlank(message = "업체 코드를 입력해 주세요.")
            @Size(max = 20, message = "업체 코드는 20자 이하입니다.")
            String code,

            @NotBlank(message = "업체명을 입력해 주세요.")
            @Size(max = 60, message = "업체명은 60자 이하입니다.")
            String name,

            @Size(max = 40, message = "담당자 이름은 40자 이하입니다.")
            String contactName,

            /**
             * 담당자 이메일. 이 주소로만 관리자 계정을 만들 수 있다 — 등록이 곧 초대다.
             */
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            @Size(max = 120, message = "이메일이 너무 깁니다.")
            String contactEmail,

            @Size(max = 30, message = "연락처는 30자 이하입니다.")
            String contactPhone,

            @Size(max = 60, message = "담당 지역은 60자 이하입니다.")
            String region,

            @Size(max = 1000, message = "메모는 1000자 이하입니다.")
            String memo,

            boolean active) {}
}
