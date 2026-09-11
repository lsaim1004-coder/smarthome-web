package kr.kiwan.smarthome;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String serviceName,
        String welcomeMessage,
        String baseUrl,
        Mail mail,
        Verification verification
) {
    public record Mail(String mode, String host, int port, String username, String password, String from, boolean starttls) {
        public boolean smtp() {
            return "smtp".equalsIgnoreCase(mode);
        }
    }

    public record Verification(int codeTtlMinutes, int maxAttempts, int resendCooldownSeconds) {}
}
