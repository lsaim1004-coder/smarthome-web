package kr.kiwan.smarthome.catalog;

import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.admin.AdminAccess;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.catalog.CatalogDtos.CatalogResponse;
import kr.kiwan.smarthome.catalog.CatalogDtos.ComparisonRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.ComparisonRow;
import kr.kiwan.smarthome.catalog.CatalogDtos.PackageRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.PackageResponse;
import kr.kiwan.smarthome.catalog.CatalogDtos.ProductRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.ProductResponse;

/**
 * 상품 구성 편집. 가격표는 운영자만 만진다 — 업체가 자기 견적을 바꾸게 둘 수는 없다.
 * 읽기는 업체도 된다(자기 담당 건을 설명하려면 구성표가 필요하다).
 */
@Profile("admin")
@RestController
@RequestMapping("/api/admin/catalog")
public class AdminCatalogController {

    private final CatalogService catalog;
    private final AdminAccess access;

    public AdminCatalogController(CatalogService catalog, AdminAccess access) {
        this.catalog = catalog;
        this.access = access;
    }

    @GetMapping
    public CatalogResponse all(Authentication authentication) {
        access.require(authentication);
        return catalog.catalog(false);
    }

    // ---------- 패키지 ----------

    @PostMapping("/packages")
    public PackageResponse createPackage(@Valid @RequestBody PackageRequest req, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.savePackage(null, req, access.actor(me));
    }

    @PutMapping("/packages/{code}")
    public PackageResponse updatePackage(@PathVariable String code, @Valid @RequestBody PackageRequest req,
                                         Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.savePackage(code, req, access.actor(me));
    }

    @DeleteMapping("/packages/{code}")
    public Map<String, Object> deletePackage(@PathVariable String code, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        catalog.deletePackage(code, access.actor(me));
        return Map.of("ok", true);
    }

    // ---------- 비교표 ----------

    @PostMapping("/comparison")
    public ComparisonRow createRow(@Valid @RequestBody ComparisonRequest req, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.createComparison(req, access.actor(me));
    }

    @PutMapping("/comparison/{id}")
    public ComparisonRow updateRow(@PathVariable long id, @Valid @RequestBody ComparisonRequest req,
                                   Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.updateComparison(id, req, access.actor(me));
    }

    @DeleteMapping("/comparison/{id}")
    public Map<String, Object> deleteRow(@PathVariable long id, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        catalog.deleteComparison(id, access.actor(me));
        return Map.of("ok", true);
    }

    // ---------- 제품 ----------

    @PostMapping("/products")
    public ProductResponse createProduct(@Valid @RequestBody ProductRequest req, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.createProduct(req, access.actor(me));
    }

    @PutMapping("/products/{id}")
    public ProductResponse updateProduct(@PathVariable long id, @Valid @RequestBody ProductRequest req,
                                         Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        return catalog.updateProduct(id, req, access.actor(me));
    }

    @DeleteMapping("/products/{id}")
    public Map<String, Object> deleteProduct(@PathVariable long id, Authentication authentication) {
        UserRow me = access.requireOwner(authentication);
        catalog.deleteProduct(id, access.actor(me));
        return Map.of("ok", true);
    }
}
