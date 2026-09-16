package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;

@Repository
public class InquiryRepository {

    private static final String COLUMNS =
            "i.id, i.name, i.phone, i.email, i.region, i.area_pyeong, i.home_type, i.room_count, i.build_stage, "
                    + "i.interests, i.window_count, i.brands, i.package_code, i.move_in, i.channel, i.message, "
                    + "i.status, i.memo, i.user_id, i.partner_id, p.name AS partner_name, "
                    + "i.created_at, i.updated_at";

    private static final String FROM = " FROM inquiries i LEFT JOIN partners p ON p.id = i.partner_id ";

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
            rs.getObject("partner_id", Long.class),
            rs.getString("partner_name"),
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

    /**
     * 목록. 업체 계정은 자기 담당만 보므로 partnerScope 가 들어오면 거기로 좁힌다.
     * q 는 이름·연락처·지역을 한 번에 훑는 검색어.
     */
    public List<InquiryResponse> findAll(String status, Long partnerScope, String q, int limit, int offset) {
        List<Object> args = new ArrayList<>();
        String sql = "SELECT " + COLUMNS + FROM + where(status, partnerScope, q, args)
                + " ORDER BY i.created_at DESC LIMIT ? OFFSET ?";
        args.add(limit);
        args.add(offset);
        return jdbc.query(sql, MAPPER, args.toArray());
    }

    public int count(String status, Long partnerScope, String q) {
        List<Object> args = new ArrayList<>();
        String sql = "SELECT count(*)" + FROM + where(status, partnerScope, q, args);
        Integer count = jdbc.queryForObject(sql, Integer.class, args.toArray());
        return count == null ? 0 : count;
    }

    private static String where(String status, Long partnerScope, String q, List<Object> args) {
        StringBuilder sb = new StringBuilder(" WHERE TRUE ");
        if (status != null && !status.isBlank()) {
            sb.append(" AND i.status = ? ");
            args.add(status);
        }
        if (partnerScope != null) {
            sb.append(" AND i.partner_id = ? ");
            args.add(partnerScope);
        }
        if (q != null && !q.isBlank()) {
            sb.append(" AND (i.name ILIKE ? OR i.phone ILIKE ? OR i.region ILIKE ? OR i.email ILIKE ?) ");
            String like = "%" + q.trim() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        return sb.toString();
    }

    public Optional<InquiryResponse> findById(long id) {
        return jdbc.query("SELECT " + COLUMNS + FROM + " WHERE i.id = ?", MAPPER, id)
                .stream().findFirst();
    }

    /** 상태별 건수. 화면 위쪽 요약에 쓴다. */
    public List<Object[]> countByStatus(Long partnerScope) {
        String sql = "SELECT status, count(*) AS n FROM inquiries "
                + (partnerScope == null ? "" : "WHERE partner_id = ? ")
                + "GROUP BY status";
        return partnerScope == null
                ? jdbc.query(sql, (rs, i) -> new Object[] {rs.getString("status"), rs.getInt("n")})
                : jdbc.query(sql, (rs, i) -> new Object[] {rs.getString("status"), rs.getInt("n")}, partnerScope);
    }

    /**
     * 관리자 편집. null 인 항목은 건드리지 않는다 — 화면이 일부만 보내도 나머지가 지워지지 않게.
     * 담당 업체를 떼려면 partnerId 에 0 을 보낸다(null 은 "안 바꿈"이라서).
     */
    public void update(long id, String status, String memo, String name, String phone, String email,
                       String region, String homeType, String roomCount, String buildStage, String interests,
                       String windowCount, String packageCode, String moveIn, String channel, String message,
                       Long partnerId) {
        jdbc.update("UPDATE inquiries SET "
                + "status = COALESCE(?, status), memo = COALESCE(?, memo), name = COALESCE(?, name), "
                + "phone = COALESCE(?, phone), email = COALESCE(?, email), region = COALESCE(?, region), "
                + "home_type = COALESCE(?, home_type), room_count = COALESCE(?, room_count), "
                + "build_stage = COALESCE(?, build_stage), interests = COALESCE(?, interests), "
                + "window_count = COALESCE(?, window_count), package_code = COALESCE(?, package_code), "
                + "move_in = COALESCE(?, move_in), channel = COALESCE(?, channel), "
                + "message = COALESCE(?, message), "
                + "partner_id = CASE WHEN ? IS NULL THEN partner_id WHEN ? = 0 THEN NULL ELSE ? END, "
                + "updated_at = now() WHERE id = ?",
                status, memo, name, phone, email, region, homeType, roomCount, buildStage, interests,
                windowCount, packageCode, moveIn, channel, message,
                partnerId, partnerId, partnerId, id);
    }

    public int delete(long id) {
        return jdbc.update("DELETE FROM inquiries WHERE id = ?", id);
    }
}
