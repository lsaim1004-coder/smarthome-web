package kr.kiwan.smarthome.catalog;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 상품 구성 첫 채움.
 *
 * 값은 프런트 상수(frontend/src/data/packages.ts · products.ts)에서 그대로 뽑아 둔
 * resources/seed/*.json 이다. 손으로 옮겨 적으면 틀리므로 스크립트로 떴다.
 *
 * 표가 비어 있을 때만 넣는다. 한 번 채운 뒤에는 관리자 화면이 진짜이고,
 * 재배포가 운영자가 고친 가격을 되돌리면 안 된다.
 */
@Configuration
@Profile("public")
public class CatalogSeeder {

    private static final Logger log = LoggerFactory.getLogger(CatalogSeeder.class);

    @Bean
    ApplicationRunner seedCatalog(CatalogRepository repo, ObjectMapper json) {
        return args -> {
            try {
                seedPackages(repo, json);
                seedComparison(repo, json);
                seedProducts(repo, json);
            } catch (Exception e) {
                // 시드가 실패해도 접수는 받아야 한다. 화면은 번들 상수로 버틴다.
                log.error("상품 구성 시드 실패: {}", e.toString());
            }
        };
    }

    private void seedPackages(CatalogRepository repo, ObjectMapper json) throws Exception {
        if (repo.countPackages() > 0) {
            return;
        }
        List<Map<String, Object>> rows = read(json, "seed/packages.json");
        int order = 0;
        for (Map<String, Object> row : rows) {
            repo.seedPackage(
                    str(row.get("code")),
                    str(row.get("name")),
                    str(row.get("tagline")),
                    num(row.get("price")),
                    num(row.get("installFee")),
                    Boolean.TRUE.equals(row.get("featured")),
                    order += 10,
                    str(row.get("summary")),
                    str(row.get("hours")),
                    strings(row.get("devices")),
                    strings(row.get("commissioning")),
                    strings(row.get("scenes")));
        }
        log.info("패키지 {}건 시드", rows.size());
    }

    private void seedComparison(CatalogRepository repo, ObjectMapper json) throws Exception {
        if (repo.countComparison() > 0) {
            return;
        }
        List<Map<String, Object>> rows = read(json, "seed/comparison.json");
        int order = 0;
        for (Map<String, Object> row : rows) {
            repo.insertComparison(str(row.get("label")), anyList(row.get("values")), order += 10, true);
        }
        log.info("비교표 {}줄 시드", rows.size());
    }

    private void seedProducts(CatalogRepository repo, ObjectMapper json) throws Exception {
        if (repo.countProducts() > 0) {
            return;
        }
        List<Map<String, Object>> rows = read(json, "seed/products.json");
        int order = 0;
        for (Map<String, Object> row : rows) {
            repo.insertProduct(
                    str(row.get("kind")),
                    str(row.get("brand")),
                    str(row.get("model")),
                    str(row.get("role")),
                    str(row.get("link")),
                    str(row.get("from")),
                    str(row.get("note")),
                    true,
                    order += 10);
        }
        log.info("제품 {}건 시드", rows.size());
    }

    private static List<Map<String, Object>> read(ObjectMapper json, String path) throws Exception {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return json.readValue(in, new TypeReference<List<Map<String, Object>>>() {});
        }
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static long num(Object value) {
        return value instanceof Number n ? n.longValue() : 0L;
    }

    @SuppressWarnings("unchecked")
    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return ((List<Object>) list).stream().map(CatalogSeeder::str).filter(s -> s != null).toList();
    }

    @SuppressWarnings("unchecked")
    private static List<Object> anyList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return List.copyOf((List<Object>) list);
    }
}
