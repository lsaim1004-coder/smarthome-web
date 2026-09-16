package kr.kiwan.smarthome.catalog;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import kr.kiwan.smarthome.catalog.CatalogDtos.ComparisonRow;
import kr.kiwan.smarthome.catalog.CatalogDtos.PackageResponse;
import kr.kiwan.smarthome.catalog.CatalogDtos.ProductResponse;

/**
 * 상품 구성 저장소.
 *
 * 목록형 항목(기기·커미셔닝·장면)은 순서가 곧 뜻이라 JSONB 배열로 그대로 둔다.
 * 표를 세로로 쪼개면 화면에서 순서를 다시 맞춰야 하고, 관리자 화면은 어차피 통째로 저장한다.
 */
@Repository
public class CatalogRepository {

    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {};
    private static final TypeReference<List<Object>> ANY = new TypeReference<>() {};

    private static final String PACKAGE_COLUMNS =
            "code, name, tagline, price, install_fee, featured, active, sort_order, summary, hours, "
                    + "devices, commissioning, scenes, updated_at, updated_by";

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public CatalogRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    private <T> List<T> parse(String raw, TypeReference<List<T>> type) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            return json.readValue(raw, type);
        } catch (Exception e) {
            return List.of();
        }
    }

    private String write(List<?> value) {
        try {
            return json.writeValueAsString(value == null ? List.of() : value);
        } catch (Exception e) {
            return "[]";
        }
    }

    // ---------- 패키지 ----------

    private final RowMapper<PackageResponse> packageMapper = (rs, i) -> new PackageResponse(
            rs.getString("code"),
            rs.getString("name"),
            rs.getString("tagline"),
            rs.getLong("price"),
            rs.getLong("install_fee"),
            rs.getBoolean("featured"),
            rs.getBoolean("active"),
            rs.getInt("sort_order"),
            rs.getString("summary"),
            rs.getString("hours"),
            parse(rs.getString("devices"), STRINGS),
            parse(rs.getString("commissioning"), STRINGS),
            parse(rs.getString("scenes"), STRINGS),
            rs.getObject("updated_at", OffsetDateTime.class),
            rs.getString("updated_by"));

    public List<PackageResponse> packages(boolean activeOnly) {
        String where = activeOnly ? " WHERE active " : " ";
        return jdbc.query("SELECT " + PACKAGE_COLUMNS + " FROM site_packages" + where
                + "ORDER BY sort_order, code", packageMapper);
    }

    public Optional<PackageResponse> findPackage(String code) {
        return jdbc.query("SELECT " + PACKAGE_COLUMNS + " FROM site_packages WHERE code = ?",
                packageMapper, code).stream().findFirst();
    }

    public int countPackages() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM site_packages", Integer.class);
        return n == null ? 0 : n;
    }

    /** 있으면 갱신, 없으면 넣는다. 관리자 저장이 쓰는 길. */
    public void savePackage(String code, String name, String tagline, long price, long installFee,
                            boolean featured, boolean active, int sortOrder, String summary, String hours,
                            List<String> devices, List<String> commissioning, List<String> scenes,
                            String updatedBy) {
        jdbc.update("INSERT INTO site_packages (code, name, tagline, price, install_fee, featured, active, "
                + "sort_order, summary, hours, devices, commissioning, scenes, updated_at, updated_by) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), CAST(? AS jsonb), "
                + "now(), ?) "
                + "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, "
                + "price = EXCLUDED.price, install_fee = EXCLUDED.install_fee, featured = EXCLUDED.featured, "
                + "active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, summary = EXCLUDED.summary, "
                + "hours = EXCLUDED.hours, devices = EXCLUDED.devices, commissioning = EXCLUDED.commissioning, "
                + "scenes = EXCLUDED.scenes, updated_at = now(), updated_by = EXCLUDED.updated_by",
                code, name, tagline, price, installFee, featured, active, sortOrder, summary, hours,
                write(devices), write(commissioning), write(scenes), updatedBy);
    }

    /** 시드 전용: 이미 있으면 손대지 않는다. 운영자가 고친 값을 재배포가 덮어쓰면 안 된다. */
    public void seedPackage(String code, String name, String tagline, long price, long installFee,
                            boolean featured, int sortOrder, String summary, String hours,
                            List<String> devices, List<String> commissioning, List<String> scenes) {
        jdbc.update("INSERT INTO site_packages (code, name, tagline, price, install_fee, featured, active, "
                + "sort_order, summary, hours, devices, commissioning, scenes, updated_by) "
                + "VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), CAST(? AS jsonb), "
                + "?) ON CONFLICT (code) DO NOTHING",
                code, name, tagline, price, installFee, featured, sortOrder, summary, hours,
                write(devices), write(commissioning), write(scenes), "seed");
    }

    public int deletePackage(String code) {
        return jdbc.update("DELETE FROM site_packages WHERE code = ?", code);
    }

    // ---------- 비교표 ----------

    private final RowMapper<ComparisonRow> comparisonMapper = (rs, i) -> new ComparisonRow(
            rs.getLong("id"),
            rs.getString("label"),
            parse(rs.getString("levels"), ANY),
            rs.getInt("sort_order"),
            rs.getBoolean("active"));

    public List<ComparisonRow> comparison(boolean activeOnly) {
        String where = activeOnly ? " WHERE active " : " ";
        return jdbc.query("SELECT id, label, levels, sort_order, active FROM site_comparison" + where
                + "ORDER BY sort_order, id", comparisonMapper);
    }

    public int countComparison() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM site_comparison", Integer.class);
        return n == null ? 0 : n;
    }

    public long insertComparison(String label, List<Object> values, int sortOrder, boolean active) {
        Long id = jdbc.queryForObject(
                "INSERT INTO site_comparison (label, levels, sort_order, active) "
                        + "VALUES (?, CAST(? AS jsonb), ?, ?) RETURNING id",
                Long.class, label, write(values), sortOrder, active);
        return id == null ? -1 : id;
    }

    public int updateComparison(long id, String label, List<Object> values, int sortOrder, boolean active) {
        return jdbc.update("UPDATE site_comparison SET label = ?, levels = CAST(? AS jsonb), sort_order = ?, "
                + "active = ?, updated_at = now() WHERE id = ?",
                label, write(values), sortOrder, active, id);
    }

    public int deleteComparison(long id) {
        return jdbc.update("DELETE FROM site_comparison WHERE id = ?", id);
    }

    // ---------- 제품 ----------

    private static final RowMapper<ProductResponse> PRODUCT_MAPPER = (rs, i) -> new ProductResponse(
            rs.getLong("id"),
            rs.getString("kind"),
            rs.getString("brand"),
            rs.getString("model"),
            rs.getString("role"),
            rs.getString("link"),
            rs.getString("from_package"),
            rs.getString("note"),
            rs.getBoolean("active"),
            rs.getInt("sort_order"));

    public List<ProductResponse> products(boolean activeOnly) {
        String where = activeOnly ? " WHERE active " : " ";
        return jdbc.query("SELECT id, kind, brand, model, role, link, from_package, note, active, sort_order "
                + "FROM site_products" + where + "ORDER BY sort_order, id", PRODUCT_MAPPER);
    }

    public int countProducts() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM site_products", Integer.class);
        return n == null ? 0 : n;
    }

    public long insertProduct(String kind, String brand, String model, String role, String link,
                              String fromPackage, String note, boolean active, int sortOrder) {
        Long id = jdbc.queryForObject(
                "INSERT INTO site_products (kind, brand, model, role, link, from_package, note, active, sort_order) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, kind, brand, model, role, link, fromPackage, note, active, sortOrder);
        return id == null ? -1 : id;
    }

    public int updateProduct(long id, String kind, String brand, String model, String role, String link,
                             String fromPackage, String note, boolean active, int sortOrder) {
        return jdbc.update("UPDATE site_products SET kind = ?, brand = ?, model = ?, role = ?, link = ?, "
                + "from_package = ?, note = ?, active = ?, sort_order = ?, updated_at = now() WHERE id = ?",
                kind, brand, model, role, link, fromPackage, note, active, sortOrder, id);
    }

    public int deleteProduct(long id) {
        return jdbc.update("DELETE FROM site_products WHERE id = ?", id);
    }
}
