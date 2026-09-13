package kr.kiwan.smarthome;

import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String serviceName,
        String welcomeMessage,
        String baseUrl,
        List<String> adminEmails,
        Mail mail,
        Verification verification
) {
    public record Mail(String mode, String host, int port, String username, String password, String from, boolean starttls) {
        public boolean smtp() {
            return "smtp".equalsIgnoreCase(mode);
        }
    }

    public record Verification(int codeTtlMinutes, int maxAttempts, int resendCooldownSeconds) {}

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
