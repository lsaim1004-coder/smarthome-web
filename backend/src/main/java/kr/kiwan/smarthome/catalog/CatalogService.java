package kr.kiwan.smarthome.catalog;

import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import kr.kiwan.smarthome.admin.AuditRepository;
import kr.kiwan.smarthome.catalog.CatalogDtos.CatalogResponse;
import kr.kiwan.smarthome.catalog.CatalogDtos.ComparisonRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.ComparisonRow;
import kr.kiwan.smarthome.catalog.CatalogDtos.PackageRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.PackageResponse;
import kr.kiwan.smarthome.catalog.CatalogDtos.ProductRequest;
import kr.kiwan.smarthome.catalog.CatalogDtos.ProductResponse;
import kr.kiwan.smarthome.common.ApiException;

/**
 * 상품 구성 읽기·쓰기.
 *
 * 공개 화면은 active 인 것만 본다. 관리자 화면은 숨긴 것까지 본다 —
 * 값을 지우는 대신 숨기는 쪽이 되돌리기 쉽고, 지난 접수의 패키지 코드도 살아 있다.
 */
@Service
public class CatalogService {

    /** 목록 한 칸이 화면을 무너뜨리지 않게 자른다. */
    private static final int MAX_ITEMS = 30;
    private static final int MAX_ITEM_LENGTH = 200;

    private final CatalogRepository repo;
    private final AuditRepository audit;

    public CatalogService(CatalogRepository repo, AuditRepository audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public CatalogResponse catalog(boolean activeOnly) {
        return new CatalogResponse(repo.packages(activeOnly), repo.comparison(activeOnly),
                repo.products(activeOnly));
    }

    public List<PackageResponse> packages(boolean activeOnly) {
        return repo.packages(activeOnly);
    }

    // ---------- 패키지 ----------

    public PackageResponse savePackage(String codeFromPath, PackageRequest req, String actor) {
        String code = normalizeCode(codeFromPath != null ? codeFromPath : req.code());
        repo.savePackage(code, req.name().trim(), trim(req.tagline()), req.price(), req.installFee(),
                req.featured(), req.active(), req.sortOrder(), trim(req.summary()), trim(req.hours()),
                items(req.devices()), items(req.commissioning()), items(req.scenes()), actor);
        audit.log(actor, codeFromPath == null ? "PACKAGE_CREATE" : "PACKAGE_UPDATE", code,
                req.name() + " · " + req.price() + "원");
        return repo.findPackage(code).orElseThrow();
    }

    public void deletePackage(String code, String actor) {
        String normalized = normalizeCode(code);
        if (repo.deletePackage(normalized) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "패키지를 찾을 수 없습니다.");
        }
        audit.log(actor, "PACKAGE_DELETE", normalized, null);
    }

    // ---------- 비교표 ----------

    public ComparisonRow createComparison(ComparisonRequest req, String actor) {
        long id = repo.insertComparison(req.label().trim(), cells(req.values()), req.sortOrder(), req.active());
        audit.log(actor, "COMPARISON_CREATE", String.valueOf(id), req.label());
        return find(id);
    }

    public ComparisonRow updateComparison(long id, ComparisonRequest req, String actor) {
        if (repo.updateComparison(id, req.label().trim(), cells(req.values()), req.sortOrder(), req.active()) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "비교표 항목을 찾을 수 없습니다.");
        }
        audit.log(actor, "COMPARISON_UPDATE", String.valueOf(id), req.label());
        return find(id);
    }

    public void deleteComparison(long id, String actor) {
        if (repo.deleteComparison(id) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "비교표 항목을 찾을 수 없습니다.");
        }
        audit.log(actor, "COMPARISON_DELETE", String.valueOf(id), null);
    }

    private ComparisonRow find(long id) {
        return repo.comparison(false).stream().filter(r -> r.id() == id).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "비교표 항목을 찾을 수 없습니다."));
    }

    // ---------- 제품 ----------

    public ProductResponse createProduct(ProductRequest req, String actor) {
        long id = repo.insertProduct(trim(req.kind()), trim(req.brand()), trim(req.model()), trim(req.role()),
                trim(req.link()), normalizeCodeOrNull(req.fromPackage()), trim(req.note()),
                req.active(), req.sortOrder());
        audit.log(actor, "PRODUCT_CREATE", String.valueOf(id), req.brand() + " " + req.model());
        return product(id);
    }

    public ProductResponse updateProduct(long id, ProductRequest req, String actor) {
        int changed = repo.updateProduct(id, trim(req.kind()), trim(req.brand()), trim(req.model()),
                trim(req.role()), trim(req.link()), normalizeCodeOrNull(req.fromPackage()), trim(req.note()),
                req.active(), req.sortOrder());
        if (changed == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "제품을 찾을 수 없습니다.");
        }
        audit.log(actor, "PRODUCT_UPDATE", String.valueOf(id), req.brand() + " " + req.model());
        return product(id);
    }

    public void deleteProduct(long id, String actor) {
        if (repo.deleteProduct(id) == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "제품을 찾을 수 없습니다.");
        }
        audit.log(actor, "PRODUCT_DELETE", String.valueOf(id), null);
    }

    private ProductResponse product(long id) {
        return repo.products(false).stream().filter(p -> p.id() == id).findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "제품을 찾을 수 없습니다."));
    }

    // ---------- 다듬기 ----------

    /** 패키지 코드는 영문 대문자·숫자·밑줄만. 지난 접수 건이 이 코드를 가리키고 있다. */
    static String normalizeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "패키지 코드를 입력해 주세요.");
        }
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_]{2,20}")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION",
                    "패키지 코드는 영문 대문자·숫자·밑줄 2~20자입니다.");
        }
        return code;
    }

    private static String normalizeCodeOrNull(String raw) {
        return raw == null || raw.isBlank() ? null : normalizeCode(raw);
    }

    private static String trim(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static List<String> items(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .map(s -> s.length() <= MAX_ITEM_LENGTH ? s : s.substring(0, MAX_ITEM_LENGTH))
                .limit(MAX_ITEMS)
                .toList();
    }

    /** 비교표 한 칸. 숫자는 그대로 두고 글자는 길이만 자른다. 빈 칸은 0(미포함). */
    private static List<Object> cells(List<Object> raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.stream()
                .limit(MAX_ITEMS)
                .map(v -> {
                    if (v instanceof Number n) {
                        return (Object) n;
                    }
                    String s = v == null ? "" : String.valueOf(v).trim();
                    if (s.isEmpty()) {
                        return (Object) 0;
                    }
                    return (Object) (s.length() <= 40 ? s : s.substring(0, 40));
                })
                .toList();
    }
}
