package kr.kiwan.smarthome.auth;

import java.io.Serializable;
import java.time.OffsetDateTime;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    /** 세션에 저장되는 로그인 주체. Spring Session JDBC 직렬화 대상이므로 Serializable. */
    public record AuthUser(long id, String email, String name) implements Serializable {}

    public record RegisterRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            @Size(max = 120, message = "이메일이 너무 깁니다.")
            String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 72, message = "비밀번호는 8자 이상 72자 이하로 입력해 주세요.")
            String password,
            @Size(max = 50, message = "이름은 50자 이하로 입력해 주세요.")
            String name
    ) {}

    public record VerifyRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,
            @NotBlank(message = "인증번호를 입력해 주세요.")
            @Pattern(regexp = "\\d{6}", message = "인증번호는 숫자 6자리입니다.")
            String code
    ) {}

    public record EmailRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email
    ) {}

    public record LoginRequest(
            @NotBlank(message = "이메일을 입력해 주세요.")
            @Email(message = "이메일 형식이 올바르지 않습니다.")
            String email,
            @NotBlank(message = "비밀번호를 입력해 주세요.")
            String password
    ) {}

    /** 인증번호 발급 결과. devCode 는 메일 모드가 log 일 때만 채워진다. */
    public record CodeIssued(String email, String message, String devCode, int expiresInMinutes) {}

    public record UserResponse(long id, String email, String name, OffsetDateTime emailVerifiedAt,
                               OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {}

    public record MeResponse(boolean authenticated, UserResponse user) {}
}
