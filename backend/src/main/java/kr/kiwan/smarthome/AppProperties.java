package kr.kiwan.smarthome;

import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String serviceName,
        String welcomeMessage,
        String baseUrl,
        String adminUrl,
        List<String> adminEmails,
        Mail mail,
        Verification verification,
        Analysis analysis,
        Internal internal
) {
    public record Mail(String mode, String host, int port, String username, String password, String from, boolean starttls) {
        public boolean smtp() {
            return "smtp".equalsIgnoreCase(mode);
        }
    }

    public record Verification(int codeTtlMinutes, int maxAttempts, int resendCooldownSeconds) {}

    /**
     * 가전 사진 자동판별.
     *
     * 사진에서 필요한 것은 모델명 한 줄뿐이다. 읽어내면 원본은 들고 있을 이유가 없어
     * purgeAfter 가 참이면 판별 직후 파일을 지우고 글자만 남긴다.
     * apiKey 가 비어 있으면 사진 판독은 건너뛰고 구매 시기·브랜드 규칙으로만 채운다.
     */
    public record Analysis(boolean enabled, String apiKey, String model, String baseUrl,
                           boolean purgeAfter, int maxAttempts, int batchSize) {
        public boolean visionReady() {
            return enabled && apiKey != null && !apiKey.isBlank();
        }
    }

    /** 관리자 서버가 LAN 으로만 부르는 통로. 두 서버가 같은 값을 갖는다. */
    public record Internal(String key, String publicApiUrl) {
        public boolean configured() {
            return key != null && !key.isBlank();
        }
    }

    /** 관리자 이메일 목록(소문자). APP_ADMIN_EMAILS 로 콤마 구분해 설정한다. */
    public List<String> normalizedAdminEmails() {
        if (adminEmails == null) {
            return List.of();
        }
        return adminEmails.stream()
                .filter(e -> e != null && !e.isBlank())
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .toList();
    }

    public boolean isAdmin(String email) {
        return email != null && normalizedAdminEmails().contains(email.trim().toLowerCase(Locale.ROOT));
    }
}
