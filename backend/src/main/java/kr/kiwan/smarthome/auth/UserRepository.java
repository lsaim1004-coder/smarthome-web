package kr.kiwan.smarthome.auth;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    public record UserRow(long id, String email, String passwordHash, String name,
                          OffsetDateTime emailVerifiedAt, OffsetDateTime createdAt, OffsetDateTime lastLoginAt) {
        public boolean verified() {
            return emailVerifiedAt != null;
        }
    }

    private static final String COLUMNS =
            "id, email, password_hash, name, email_verified_at, created_at, last_login_at";

    private static final RowMapper<UserRow> MAPPER = (rs, i) -> new UserRow(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("name"),
            rs.getObject("email_verified_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("last_login_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserRow> findByEmail(String email) {
        return jdbc.query("SELECT " + COLUMNS + " FROM users WHERE email = ?", MAPPER, email)
                .stream().findFirst();
    }

    public Optional<UserRow> findById(long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM users WHERE id = ?", MAPPER, id)
                .stream().findFirst();
    }

    public long insert(String email, String passwordHash, String name) {
        Long id = jdbc.queryForObject(
                "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?) RETURNING id",
                Long.class, email, passwordHash, name);
        return id == null ? -1 : id;
    }

    /** 미인증 상태에서 다시 가입하는 경우 비밀번호·이름을 갈아끼운다. */
    public void updateCredentials(long id, String passwordHash, String name) {
        jdbc.update("UPDATE users SET password_hash = ?, name = ? WHERE id = ?", passwordHash, name, id);
    }

    public void markVerified(long id) {
        jdbc.update("UPDATE users SET email_verified_at = now() WHERE id = ? AND email_verified_at IS NULL", id);
    }

    public void touchLogin(long id) {
        jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", id);
    }
}
