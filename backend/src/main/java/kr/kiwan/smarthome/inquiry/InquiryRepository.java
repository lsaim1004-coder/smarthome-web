package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;

@Repository
public class InquiryRepository {

    private static final String COLUMNS =
            "id, name, phone, email, region, area_pyeong, package_code, move_in, channel, message, "
                    + "status, memo, user_id, created_at, updated_at";

    private static final RowMapper<InquiryResponse> MAPPER = (rs, i) -> new InquiryResponse(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("phone"),
            rs.getString("email"),
            rs.getString("region"),
            rs.getObject("area_pyeong", Integer.class),
            rs.getString("package_code"),
            rs.getString("move_in"),
            rs.getString("channel"),
            rs.getString("message"),
            rs.getString("status"),
            rs.getString("memo"),
            rs.getObject("user_id", Long.class),
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public InquiryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long insert(String name, String phone, String email, String region, Integer areaPyeong,
                       String packageCode, String moveIn, String channel, String message,
                       Long userId, String clientIp) {
        Long id = jdbc.queryForObject(
                "INSERT INTO inquiries (name, phone, email, region, area_pyeong, package_code, move_in, "
                        + "channel, message, user_id, client_ip) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, name, phone, email, region, areaPyeong, packageCode, moveIn,
                channel, message, userId, clientIp);
        return id == null ? -1 : id;
    }

    /** 같은 번호로 방금 들어온 접수가 있는지 (더블클릭·중복 제출 방지). */
    public boolean existsRecentByPhone(String phone, int withinMinutes) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM inquiries WHERE phone = ? "
                        + "AND created_at > now() - (CAST(? AS INT) * interval '1 minute')",
                Integer.class, phone, withinMinutes);
        return count != null && count > 0;
    }

    public List<InquiryResponse> findAll(String status, int limit, int offset) {
        if (status == null || status.isBlank()) {
            return jdbc.query("SELECT " + COLUMNS + " FROM inquiries ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    MAPPER, limit, offset);
        }
        return jdbc.query("SELECT " + COLUMNS + " FROM inquiries WHERE status = ? ORDER BY created_at DESC "
                + "LIMIT ? OFFSET ?", MAPPER, status, limit, offset);
    }

    public Optional<InquiryResponse> findById(long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM inquiries WHERE id = ?", MAPPER, id)
                .stream().findFirst();
    }

    public int countByStatus(String status) {
        Integer count = (status == null || status.isBlank())
                ? jdbc.queryForObject("SELECT count(*) FROM inquiries", Integer.class)
                : jdbc.queryForObject("SELECT count(*) FROM inquiries WHERE status = ?", Integer.class, status);
        return count == null ? 0 : count;
    }

    public void update(long id, String status, String memo) {
        jdbc.update("UPDATE inquiries SET status = COALESCE(?, status), memo = COALESCE(?, memo), "
                + "updated_at = now() WHERE id = ?", status, memo, id);
    }
}
