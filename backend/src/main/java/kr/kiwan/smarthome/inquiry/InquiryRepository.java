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
            "id, name, phone, email, region, area_pyeong, home_type, room_count, build_stage, interests, "
                    + "window_count, brands, package_code, move_in, channel, message, "
                    + "status, memo, user_id, created_at, updated_at";

    private static final RowMapper<InquiryResponse> MAPPER = (rs, i) -> new InquiryResponse(
            rs.getLong("id"),
            rs.getString("name"),
            rs.getString("phone"),
            rs.getString("email"),
            rs.getString("region"),
            rs.getObject("area_pyeong", Integer.class),
            rs.getString("home_type"),
            rs.getString("room_count"),
            rs.getString("build_stage"),
            rs.getString("interests"),
            rs.getString("window_count"),
            rs.getString("brands"),
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
                       String homeType, String roomCount, String buildStage, String interests,
                       String windowCount, String brands,
                       String packageCode, String moveIn, String channel, String message,
                       Long userId, String clientIp) {
        Long id = jdbc.queryForObject(
                "INSERT INTO inquiries (name, phone, email, region, area_pyeong, home_type, room_count, "
                        + "build_stage, interests, window_count, brands, package_code, move_in, "
                        + "channel, message, user_id, client_ip) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, name, phone, email, region, areaPyeong, homeType, roomCount, buildStage,
                interests, windowCount, brands, packageCode, moveIn,
                channel, message, userId, clientIp);
        return id == null ? -1 : id;
    }

    /**
     * 접수 직후 발급하는 업로드 토큰. 비로그인 신청자가 사진을 붙일 수 있는 유일한 열쇠다.
     * 유효 시간이 지나면 저절로 못 쓰게 된다.
     */
    public void setUploadToken(long id, String token, int minutes) {
        jdbc.update("UPDATE inquiries SET upload_token = ?, "
                + "upload_expires_at = now() + (CAST(? AS INT) * interval '1 minute') WHERE id = ?",
                token, minutes, id);
    }

    public boolean isUploadTokenValid(long inquiryId, String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM inquiries WHERE id = ? AND upload_token = ? AND upload_expires_at > now()",
                Integer.class, inquiryId, token);
        return count != null && count > 0;
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
