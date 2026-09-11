package kr.kiwan.smarthome;

import java.net.InetAddress;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringBootVersion;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class WelcomeService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final JdbcTemplate jdbc;
    private final Instant startedAt = Instant.now();
    private final String hostname;

    @Value("${app.service-name}")
    private String serviceName;

    @Value("${app.welcome-message}")
    private String welcomeMessage;

    public WelcomeService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.hostname = resolveHostname();
    }

    public WelcomeResponse welcome() {
        return new WelcomeResponse(
                serviceName,
                welcomeMessage,
                OffsetDateTime.now(KST).format(ISO),
                backendInfo(),
                databaseInfo()
        );
    }

    public boolean databaseUp() {
        try {
            Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            return one != null && one == 1;
        } catch (DataAccessException e) {
            return false;
        }
    }

    private WelcomeResponse.BackendInfo backendInfo() {
        long uptime = Duration.between(startedAt, Instant.now()).getSeconds();
        return new WelcomeResponse.BackendInfo(
                "Spring Boot " + SpringBootVersion.getVersion(),
                "Java " + Runtime.version().feature() + " (" + System.getProperty("java.vendor") + ")",
                hostname,
                startedAt.atZone(KST).toOffsetDateTime().format(ISO),
                uptime
        );
    }

    private WelcomeResponse.DatabaseInfo databaseInfo() {
        try {
            Long visits = jdbc.queryForObject(
                    "UPDATE welcome_visits SET visits = visits + 1, updated_at = now() WHERE id = 1 RETURNING visits",
                    Long.class);
            String version = jdbc.queryForObject("SHOW server_version", String.class);
            return new WelcomeResponse.DatabaseInfo(
                    "UP", "PostgreSQL", version, visits == null ? 0 : visits, null);
        } catch (DataAccessException e) {
            String reason = e.getMostSpecificCause() != null
                    ? e.getMostSpecificCause().getMessage()
                    : e.getMessage();
            return new WelcomeResponse.DatabaseInfo("DOWN", "PostgreSQL", null, -1, reason);
        }
    }

    private static String resolveHostname() {
        String env = System.getenv("HOSTNAME");
        if (env != null && !env.isBlank()) {
            return env;
        }
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
