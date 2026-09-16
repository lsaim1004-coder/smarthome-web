package kr.kiwan.smarthome.auth;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    /**
     * role 은 OWNER(운영자) / PARTNER(업체) / USER(일반).
     * 관리자 서버는 OWNER·PARTNER 만 들여보내고, PARTNER 는 자기 업체(partnerId) 건만 본다.
     */
    public record UserRow(long id, String email, String passwordHash, String name, String role, Long partnerId,
                          boolean active, OffsetDateTime emailVerifiedAt, OffsetDateTime createdAt,
                          OffsetDateTime lastLoginAt) {
        public boolean verified() {
            return emailVerifiedAt != null;
        }

        public boolean owner() {
            return "OWNER".equals(role);
        }

        public boolean staff() {
            return owner() || "PARTNER".equals(role);
        }
    }

    private static final String COLUMNS =
            "id, email, password_hash, name, role, partner_id, active, email_verified_at, created_at, last_login_at";

    private static final RowMapper<UserRow> MAPPER = (rs, i) -> new UserRow(
            rs.getLong("id"),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("name"),
            rs.getString("role"),
            rs.getObject("partner_id", Long.class),
            rs.getBoolean("active"),
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

    /** 관리자 서버의 계정 목록. 일반 계정은 여기 보여 줄 이유가 없다. */
    public List<UserRow> findStaff() {
        return jdbc.query("SELECT " + COLUMNS + " FROM users WHERE role <> 'USER' ORDER BY role, created_at",
                MAPPER);
    }

    public long insert(String email, String passwordHash, String name, String role, Long partnerId) {
        Long id = jdbc.queryForObject(
                "INSERT INTO users (email, password_hash, name, role, partner_id) "
                        + "VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, email, passwordHash, name, role, partnerId);
        return id == null ? -1 : id;
    }

    /** 미인증 상태에서 다시 가입하는 경우 비밀번호·이름을 갈아끼운다. */
    public void updateCredentials(long id, String passwordHash, String name) {
        jdbc.update("UPDATE users SET password_hash = ?, name = ? WHERE id = ?", passwordHash, name, id);
    }

    /** 설정(app.admin-emails)과 업체 담당자 이메일에 맞춰 역할을 다시 맞춘다. */
    public void updateRole(long id, String role, Long partnerId) {
        jdbc.update("UPDATE users SET role = ?, partner_id = ? WHERE id = ?", role, partnerId, id);
    }

    public void setActive(long id, boolean active) {
        jdbc.update("UPDATE users SET active = ? WHERE id = ?", active, id);
    }

    public void markVerified(long id) {
        jdbc.update("UPDATE users SET email_verified_at = now() WHERE id = ? AND email_verified_at IS NULL", id);
    }

    public void touchLogin(long id) {
        jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", id);
    }
}
