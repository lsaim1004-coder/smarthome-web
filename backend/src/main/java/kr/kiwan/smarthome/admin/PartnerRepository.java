package kr.kiwan.smarthome.admin;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * 시공·상담을 맡는 업체.
 *
 * 업체를 모집하면 각자 자기 담당 건만 보게 된다. 그래서 업체를 먼저 등록하고,
 * 그 담당자 이메일로만 관리자 계정을 만들 수 있게 한다(초대 대신 화이트리스트).
 */
@Repository
public class PartnerRepository {

    public record PartnerRow(long id, String code, String name, String contactName, String contactEmail,
                             String contactPhone, String region, String memo, boolean active,
                             OffsetDateTime createdAt) {}

    private static final String COLUMNS =
            "id, code, name, contact_name, contact_email, contact_phone, region, memo, active, created_at";

    private static final RowMapper<PartnerRow> MAPPER = (rs, i) -> new PartnerRow(
            rs.getLong("id"),
            rs.getString("code"),
            rs.getString("name"),
            rs.getString("contact_name"),
            rs.getString("contact_email"),
            rs.getString("contact_phone"),
            rs.getString("region"),
            rs.getString("memo"),
            rs.getBoolean("active"),
            rs.getObject("created_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public PartnerRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PartnerRow> findAll() {
        return jdbc.query("SELECT " + COLUMNS + " FROM partners ORDER BY active DESC, name", MAPPER);
    }

    public Optional<PartnerRow> findById(long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM partners WHERE id = ?", MAPPER, id)
                .stream().findFirst();
    }

    /** 담당자 이메일로 업체를 찾는다. 관리자 가입 자격을 이걸로 가린다. */
    public Optional<PartnerRow> findByContactEmail(String email) {
        return jdbc.query("SELECT " + COLUMNS + " FROM partners WHERE lower(contact_email) = ? AND active",
                MAPPER, email).stream().findFirst();
    }

    public long insert(String code, String name, String contactName, String contactEmail,
                       String contactPhone, String region, String memo, boolean active) {
        Long id = jdbc.queryForObject(
                "INSERT INTO partners (code, name, contact_name, contact_email, contact_phone, region, memo, active) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, code, name, contactName, contactEmail, contactPhone, region, memo, active);
        return id == null ? -1 : id;
    }

    public int update(long id, String code, String name, String contactName, String contactEmail,
                      String contactPhone, String region, String memo, boolean active) {
        return jdbc.update("UPDATE partners SET code = ?, name = ?, contact_name = ?, contact_email = ?, "
                + "contact_phone = ?, region = ?, memo = ?, active = ?, updated_at = now() WHERE id = ?",
                code, name, contactName, contactEmail, contactPhone, region, memo, active, id);
    }

    public boolean codeTaken(String code, Long exceptId) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM partners WHERE code = ? AND (? IS NULL OR id <> ?)",
                Integer.class, code, exceptId, exceptId == null ? 0L : exceptId);
        return n != null && n > 0;
    }

    /** 담당 건 수. 업체를 지우기 전에 확인한다. */
    public int inquiryCount(long partnerId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM inquiries WHERE partner_id = ?",
                Integer.class, partnerId);
        return n == null ? 0 : n;
    }
}
