package kr.kiwan.smarthome.catalog;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

import kr.kiwan.smarthome.catalog.CatalogDtos.CatalogResponse;

/**
 * 공개 화면이 읽는 상품 구성.
 *
 * 프런트는 이 응답을 쓰되, 실패하면 번들에 들어 있는 상수로 그린다.
 * 값이 잠깐 옛것이 되는 편이 화면이 비는 것보다 낫다.
 */
@Profile("public")
@RestController
public class PublicCatalogController {

    private final CatalogService catalog;

    public PublicCatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/api/catalog")
    public ResponseEntity<CatalogResponse> catalog() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(catalog.catalog(true));
    }
}
