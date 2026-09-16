package kr.kiwan.smarthome.catalog;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * 공개 화면에 나가는 상품 구성 — 패키지 · 비교표 · 표준 제품.
 *
 * 지금까지 프런트 상수에 박혀 있어 값 하나 고치려면 배포를 다시 해야 했다.
 * 관리자 화면에서 고칠 수 있게 DB 로 옮기면서 오간다.
 */
public final class CatalogDtos {

    private CatalogDtos() {}

    public record PackageResponse(
            String code, String name, String tagline, long price, long installFee,
            boolean featured, boolean active, int sortOrder, String summary, String hours,
            List<String> devices, List<String> commissioning, List<String> scenes,
            OffsetDateTime updatedAt, String updatedBy) {}

    public record PackageRequest(
            @Size(max = 20, message = "코드는 20자 이하입니다.")
            String code,

            @NotBlank(message = "이름을 입력해 주세요.")
            @Size(max = 60, message = "이름은 60자 이하입니다.")
            String name,

            @Size(max = 200, message = "한 줄 소개는 200자 이하입니다.")
            String tagline,

            @PositiveOrZero(message = "금액은 0 이상이어야 합니다.")
            long price,

            @PositiveOrZero(message = "시공비는 0 이상이어야 합니다.")
            long installFee,

            boolean featured,
            boolean active,
            int sortOrder,

            @Size(max = 500, message = "설명은 500자 이하입니다.")
            String summary,

            @Size(max = 100, message = "작업 시간 표기는 100자 이하입니다.")
            String hours,

            List<String> devices,
            List<String> commissioning,
            List<String> scenes) {}

    /**
      * 비교표 한 줄. values 는 패키지 순서대로 한 칸씩이고, 숫자(개수)와 글자가 섞인다.
      * 예: [3, 5, 6, 10, 12] · ["1종", "2종", "도어락·에어컨·청소기", ...] · [0, 0, 0, "✓", "✓"]
      * 0 은 미포함으로 그린다.
      */
    public record ComparisonRow(long id, String label, List<Object> values, int sortOrder, boolean active) {}

    public record ComparisonRequest(
            @NotBlank(message = "항목 이름을 입력해 주세요.")
            @Size(max = 80, message = "항목 이름은 80자 이하입니다.")
            String label,
            List<Object> values,
            int sortOrder,
            boolean active) {}

    public record ProductResponse(long id, String kind, String brand, String model, String role,
                                  String link, String fromPackage, String note,
                                  boolean active, int sortOrder) {}

    public record ProductRequest(
            @NotBlank(message = "일러스트 종류를 고르세요.")
            @Size(max = 30, message = "종류 값이 올바르지 않습니다.")
            String kind,

            @NotBlank(message = "브랜드를 입력해 주세요.")
            @Size(max = 40, message = "브랜드는 40자 이하입니다.")
            String brand,

            @NotBlank(message = "모델명을 입력해 주세요.")
            @Size(max = 120, message = "모델명은 120자 이하입니다.")
            String model,

            @Size(max = 80, message = "역할은 80자 이하입니다.")
            String role,

            @Size(max = 80, message = "연결 규격은 80자 이하입니다.")
            String link,

            @Size(max = 20, message = "패키지 코드가 올바르지 않습니다.")
            String fromPackage,

            @Size(max = 500, message = "설명은 500자 이하입니다.")
            String note,

            boolean active,
            int sortOrder) {}

    /** 공개 화면이 한 번에 받아 가는 묶음. */
    public record CatalogResponse(List<PackageResponse> packages,
                                  List<ComparisonRow> comparison,
                                  List<ProductResponse> products) {}
}
