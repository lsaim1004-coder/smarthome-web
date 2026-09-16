package kr.kiwan.smarthome.admin;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * 관리자가 무엇을 고쳤는지 남긴다.
 *
 * 업체 계정이 늘어나면 "누가 이 신청의 담당을 바꿨는지"를 물을 일이 생긴다.
 * 그때 다시 만들면 과거가 없으므로 지금부터 쌓아 둔다.
 */
@Repository
public class AuditRepository {

    public record AuditRow(long id, String actor, String action, String target, String detail,
                           OffsetDateTime createdAt) {}

    private static final RowMapper<AuditRow> MAPPER = (rs, i) -> new AuditRow(
            rs.getLong("id"),
            rs.getString("actor"),
            rs.getString("action"),
            rs.getString("target"),
            rs.getString("detail"),
            rs.getObject("created_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public AuditRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void log(String actor, String action, String target, String detail) {
        jdbc.update("INSERT INTO admin_audit (actor, action, target, detail) VALUES (?, ?, ?, ?)",
                actor == null ? "-" : actor, action, target, clip(detail));
    }

    public List<AuditRow> recent(int limit) {
        return jdbc.query("SELECT id, actor, action, target, detail, created_at FROM admin_audit "
                + "ORDER BY created_at DESC LIMIT ?", MAPPER, Math.clamp(limit, 1, 500));
    }

    /** 기록이 본문을 통째로 삼키지 않게 자른다. */
    private static String clip(String detail) {
        if (detail == null) {
            return null;
        }
        return detail.length() <= 1000 ? detail : detail.substring(0, 1000) + "…";
    }
}
