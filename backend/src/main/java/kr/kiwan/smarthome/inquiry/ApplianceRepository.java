package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.CandidateResponse;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.PhotoResponse;

@Repository
public class ApplianceRepository {

    private static final String A_COLUMNS =
            "a.id, a.inquiry_id, a.kind, a.brand, a.model_name, a.purchased, a.note, "
                    + "a.detected_model, a.era, a.iot_status, a.analysis_note, a.analyzed_at, a.created_at";

    /** 사진은 따로 읽어 붙인다. 여기서는 빈 목록으로 만들어 둔다. */
    private static final RowMapper<ApplianceResponse> A_MAPPER = (rs, i) -> new ApplianceResponse(
            rs.getLong("id"),
            rs.getLong("inquiry_id"),
            rs.getString("kind"),
            rs.getString("brand"),
            rs.getString("model_name"),
            rs.getString("purchased"),
            rs.getString("note"),
            rs.getString("detected_model"),
            rs.getString("era"),
            rs.getString("iot_status"),
            rs.getString("analysis_note"),
            rs.getObject("analyzed_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class),
            List.of());

    private static final RowMapper<PhotoResponse> P_MAPPER = (rs, i) -> new PhotoResponse(
            rs.getLong("id"),
            rs.getLong("inquiry_id"),
            rs.getObject("appliance_id", Long.class),
            rs.getString("original_name"),
            rs.getString("content_type"),
            rs.getLong("size_bytes"),
            rs.getObject("created_at", OffsetDateTime.class));

    private final JdbcTemplate jdbc;

    public ApplianceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /* ── 가전 ─────────────────────────────────────────────── */

    public long insertAppliance(long inquiryId, String kind, String brand, String modelName,
                                String purchased, String note) {
        Long id = jdbc.queryForObject(
                "INSERT INTO inquiry_appliances (inquiry_id, kind, brand, model_name, purchased, note) "
                        + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, inquiryId, kind, brand, modelName, purchased, note);
        return id == null ? -1 : id;
    }

    public List<ApplianceResponse> findByInquiry(long inquiryId) {
        List<ApplianceResponse> rows = jdbc.query(
                "SELECT " + A_COLUMNS + " FROM inquiry_appliances a WHERE a.inquiry_id = ? ORDER BY a.id",
                A_MAPPER, inquiryId);
        return attachPhotos(rows, photosByInquiry(inquiryId));
    }

    public Optional<ApplianceResponse> findApplianceById(long id) {
        return jdbc.query("SELECT " + A_COLUMNS + " FROM inquiry_appliances a WHERE a.id = ?", A_MAPPER, id)
                .stream().findFirst()
                .map(a -> withPhotos(a, findPhotosByAppliance(id)));
    }

    /** 이 신청에 이 가전 행이 실제로 속하는지. 업로드 시 남의 신청에 붙이지 못하게 막는다. */
    public boolean applianceBelongsTo(long applianceId, long inquiryId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM inquiry_appliances WHERE id = ? AND inquiry_id = ?",
                Integer.class, applianceId, inquiryId);
        return count != null && count > 0;
    }

    /**
     * 분석 결과 저장. null 로 온 칸은 그대로 두고, 호출될 때마다 analyzed_at 을 찍는다.
     */
    public void analyze(long id, String detectedModel, String era, String iotStatus, String analysisNote) {
        jdbc.update("UPDATE inquiry_appliances SET "
                        + "detected_model = COALESCE(?, detected_model), "
                        + "era = COALESCE(?, era), "
                        + "iot_status = COALESCE(?, iot_status), "
                        + "analysis_note = COALESCE(?, analysis_note), "
                        + "analyzed_at = now() WHERE id = ?",
                detectedModel, era, iotStatus, analysisNote, id);
    }

    /**
     * IoT 연동 후보 목록.
     * pendingOnly 면 아직 판정하지 않은 것, iotStatus 를 주면 그 판정만, 둘 다 없으면 판정 끝난 것 전부.
     */
    public List<CandidateResponse> findCandidates(String iotStatus, boolean pendingOnly, int limit) {
        String base = "SELECT " + A_COLUMNS + ", i.name AS inq_name, i.region AS inq_region, "
                + "i.status AS inq_status FROM inquiry_appliances a JOIN inquiries i ON i.id = a.inquiry_id ";
        String where;
        Object[] args;
        if (pendingOnly) {
            where = "WHERE a.analyzed_at IS NULL ORDER BY a.created_at DESC LIMIT ?";
            args = new Object[] {limit};
        } else if (iotStatus == null || iotStatus.isBlank()) {
            where = "WHERE a.analyzed_at IS NOT NULL ORDER BY a.analyzed_at DESC LIMIT ?";
            args = new Object[] {limit};
        } else {
            where = "WHERE a.iot_status = ? ORDER BY a.analyzed_at DESC LIMIT ?";
            args = new Object[] {iotStatus, limit};
        }

        List<CandidateResponse> rows = jdbc.query(base + where, (rs, i) -> new CandidateResponse(
                A_MAPPER.mapRow(rs, i),
                rs.getString("inq_name"),
                rs.getString("inq_region"),
                rs.getString("inq_status")), args);

        if (rows.isEmpty()) {
            return rows;
        }
        Map<Long, List<PhotoResponse>> byAppliance = photosFor(
                rows.stream().map(r -> r.appliance().id()).toList());
        List<CandidateResponse> out = new ArrayList<>(rows.size());
        for (CandidateResponse row : rows) {
            out.add(new CandidateResponse(
                    withPhotos(row.appliance(), byAppliance.getOrDefault(row.appliance().id(), List.of())),
                    row.inquiryName(), row.inquiryRegion(), row.inquiryStatus()));
        }
        return out;
    }

    /* ── 사진 ─────────────────────────────────────────────── */

    public long insertPhoto(long inquiryId, Long applianceId, String storedName, String originalName,
                            String contentType, long size) {
        Long id = jdbc.queryForObject(
                "INSERT INTO inquiry_photos (inquiry_id, appliance_id, stored_name, original_name, "
                        + "content_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, inquiryId, applianceId, storedName, originalName, contentType, size);
        return id == null ? -1 : id;
    }

    public List<PhotoResponse> photosByInquiry(long inquiryId) {
        return jdbc.query("SELECT id, inquiry_id, appliance_id, original_name, content_type, size_bytes, "
                + "created_at FROM inquiry_photos WHERE inquiry_id = ? ORDER BY id", P_MAPPER, inquiryId);
    }

    public List<PhotoResponse> findPhotosByAppliance(long applianceId) {
        return jdbc.query("SELECT id, inquiry_id, appliance_id, original_name, content_type, size_bytes, "
                + "created_at FROM inquiry_photos WHERE appliance_id = ? ORDER BY id", P_MAPPER, applianceId);
    }

    public int countPhotosByInquiry(long inquiryId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM inquiry_photos WHERE inquiry_id = ?", Integer.class, inquiryId);
        return count == null ? 0 : count;
    }

    public Optional<String> findStoredName(long photoId) {
        return jdbc.query("SELECT stored_name FROM inquiry_photos WHERE id = ?",
                (rs, i) -> rs.getString(1), photoId).stream().findFirst();
    }

    /* ── 조립 ─────────────────────────────────────────────── */

    private Map<Long, List<PhotoResponse>> photosFor(List<Long> applianceIds) {
        if (applianceIds.isEmpty()) {
            return Map.of();
        }
        String marks = String.join(",", applianceIds.stream().map(x -> "?").toList());
        List<PhotoResponse> all = jdbc.query(
                "SELECT id, inquiry_id, appliance_id, original_name, content_type, size_bytes, created_at "
                        + "FROM inquiry_photos WHERE appliance_id IN (" + marks + ") ORDER BY id",
                P_MAPPER, applianceIds.toArray());
        Map<Long, List<PhotoResponse>> map = new LinkedHashMap<>();
        for (PhotoResponse p : all) {
            map.computeIfAbsent(p.applianceId(), k -> new ArrayList<>()).add(p);
        }
        return map;
    }

    private static List<ApplianceResponse> attachPhotos(List<ApplianceResponse> rows, List<PhotoResponse> photos) {
        Map<Long, List<PhotoResponse>> map = new LinkedHashMap<>();
        for (PhotoResponse p : photos) {
            if (p.applianceId() != null) {
                map.computeIfAbsent(p.applianceId(), k -> new ArrayList<>()).add(p);
            }
        }
        List<ApplianceResponse> out = new ArrayList<>(rows.size());
        for (ApplianceResponse a : rows) {
            out.add(withPhotos(a, map.getOrDefault(a.id(), List.of())));
        }
        return out;
    }

    private static ApplianceResponse withPhotos(ApplianceResponse a, List<PhotoResponse> photos) {
        return new ApplianceResponse(a.id(), a.inquiryId(), a.kind(), a.brand(), a.modelName(), a.purchased(),
                a.note(), a.detectedModel(), a.era(), a.iotStatus(), a.analysisNote(), a.analyzedAt(),
                a.createdAt(), photos);
    }
}
