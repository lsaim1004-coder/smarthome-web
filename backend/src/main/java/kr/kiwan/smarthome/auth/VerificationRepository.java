package kr.kiwan.smarthome.auth;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class VerificationRepository {

    public record CodeRow(long id, long userId, String codeHash, OffsetDateTime expiresAt,
                          int attempts, OffsetDateTime consumedAt, OffsetDateTime createdAt) {
        public boolean open() {
            return consumedAt == null;
        }
    }

    private static final RowMapper<CodeRow> MAPPER = (rs, i) -> new CodeRow(
            rs.getLong("id"),
            rs.getLong("user_id"),
            rs.getString("code_hash"),
            rs.getObject("expires_at", OffsetDateTime.class),
            rs.getInt("attempts"),
            rs.getObject("consumed_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public VerificationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 가장 최근 발급된 코드 (소비 여부 무관). 재발송 쿨다운 판단에 사용. */
    public Optional<CodeRow> findLatest(long userId) {
        return jdbc.query(
                "SELECT id, user_id, code_hash, expires_at, attempts, consumed_at, created_at "
                        + "FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                MAPPER, userId).stream().findFirst();
    }

    public void insert(long userId, String codeHash, OffsetDateTime expiresAt) {
        jdbc.update("INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
                userId, codeHash, expiresAt);
    }

    /** 새 코드를 내기 전에 열려 있는 이전 코드를 모두 닫는다. */
    public void closeOpen(long userId) {
        jdbc.update("UPDATE email_verifications SET consumed_at = now() WHERE user_id = ? AND consumed_at IS NULL", userId);
    }

    public void incrementAttempts(long id) {
        jdbc.update("UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?", id);
    }

    public void consume(long id) {
        jdbc.update("UPDATE email_verifications SET consumed_at = now() WHERE id = ?", id);
    }
}
