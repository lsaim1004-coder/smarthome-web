package kr.kiwan.smarthome.floorplan;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import kr.kiwan.smarthome.floorplan.FloorplanDtos.FloorplanResponse;
import kr.kiwan.smarthome.floorplan.FloorplanDtos.Scale;

@Repository
public class FloorplanRepository {

    private static final TypeReference<Map<String, Object>> OBJ = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> ARR = new TypeReference<>() {};

    private static final String COLUMNS =
            "id, inquiry_id, name, stored_name, original_name, content_type, size_bytes, "
                    + "image_width, image_height, scale_x1, scale_y1, scale_x2, scale_y2, scale_mm, "
                    + "wall_height_mm, geometry, devices, created_at, updated_at, updated_by";

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public FloorplanRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private <T> T parse(String raw, TypeReference<T> type, T fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return json.readValue(raw, type);
        } catch (Exception e) {
            return fallback;
        }
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private final RowMapper<FloorplanResponse> mapper = (rs, i) -> new FloorplanResponse(
            rs.getLong("id"),
            rs.getLong("inquiry_id"),
            rs.getString("name"),
            rs.getString("original_name"),
            rs.getString("content_type"),
            rs.getLong("size_bytes"),
            rs.getObject("image_width", Integer.class),
            rs.getObject("image_height", Integer.class),
            new Scale(
                    rs.getObject("scale_x1", Double.class),
                    rs.getObject("scale_y1", Double.class),
                    rs.getObject("scale_x2", Double.class),
                    rs.getObject("scale_y2", Double.class),
                    rs.getObject("scale_mm", Integer.class)),
            rs.getInt("wall_height_mm"),
            parse(rs.getString("geometry"), OBJ, Map.of()),
            parse(rs.getString("devices"), ARR, List.of()),
            null,   // derived 는 서비스가 채운다
            rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class),
            rs.getString("updated_by"));

    public List<FloorplanResponse> findByInquiry(long inquiryId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM inquiry_floorplans WHERE inquiry_id = ? ORDER BY id",
                mapper, inquiryId);
    }

    public Optional<FloorplanResponse> findById(long id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM inquiry_floorplans WHERE id = ?", mapper, id)
                .stream().findFirst();
    }

    public Optional<String> findStoredName(long id) {
        return jdbc.query("SELECT stored_name FROM inquiry_floorplans WHERE id = ?",
                (rs, i) -> rs.getString(1), id).stream().findFirst();
    }

    public long insert(long inquiryId, String name, String storedName, String originalName,
                       String contentType, long size, Integer width, Integer height) {
        Long id = jdbc.queryForObject(
                "INSERT INTO inquiry_floorplans (inquiry_id, name, stored_name, original_name, "
                        + "content_type, size_bytes, image_width, image_height) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, inquiryId, name, storedName, originalName, contentType, size, width, height);
        return id == null ? -1 : id;
    }

    /** null 로 온 항목은 건드리지 않는다. 화면이 일부만 저장해도 나머지가 지워지면 안 된다. */
    public int save(long id, String name, Scale scale, Integer wallHeightMm,
                    Map<String, Object> geometry, List<Map<String, Object>> devices, String actor) {
        boolean hasScale = scale != null;
        return jdbc.update("UPDATE inquiry_floorplans SET "
                + "name = COALESCE(?, name), "
                + "scale_x1 = CASE WHEN ? THEN ? ELSE scale_x1 END, "
                + "scale_y1 = CASE WHEN ? THEN ? ELSE scale_y1 END, "
                + "scale_x2 = CASE WHEN ? THEN ? ELSE scale_x2 END, "
                + "scale_y2 = CASE WHEN ? THEN ? ELSE scale_y2 END, "
                + "scale_mm = CASE WHEN ? THEN ? ELSE scale_mm END, "
                + "wall_height_mm = COALESCE(?, wall_height_mm), "
                + "geometry = COALESCE(CAST(? AS jsonb), geometry), "
                + "devices = COALESCE(CAST(? AS jsonb), devices), "
                + "updated_at = now(), updated_by = ? WHERE id = ?",
                name,
                hasScale, hasScale ? scale.x1() : null,
                hasScale, hasScale ? scale.y1() : null,
                hasScale, hasScale ? scale.x2() : null,
                hasScale, hasScale ? scale.y2() : null,
                hasScale, hasScale ? scale.mm() : null,
                wallHeightMm,
                geometry == null ? null : write(geometry),
                devices == null ? null : write(devices),
                actor, id);
    }

    public int delete(long id) {
        return jdbc.update("DELETE FROM inquiry_floorplans WHERE id = ?", id);
    }
}
