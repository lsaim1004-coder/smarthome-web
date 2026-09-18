package kr.kiwan.smarthome.floorplan;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * 도면 배치.
 *
 * 좌표는 전부 <b>이미지 대비 비율(0~1)</b> 이다. 도면 이미지를 확대하거나 다른 화면에서 열어도
 * 위치가 그대로 유지되고, 이미지를 더 큰 해상도로 다시 올려도 다시 그릴 필요가 없다.
 *
 * 실제 치수는 축척으로 환산한다 — 3D 로 세우려면 벽 길이와 높이가 있어야 하고,
 * 시공 검토(배선 길이 · 간섭)를 하려면 그 치수가 맞아야 한다.
 */
public final class FloorplanDtos {

    private FloorplanDtos() {}

    /**
     * 축척. 도면 위 두 점을 찍고 그 사이의 실제 길이를 mm 로 넣는다.
     * 예: 거실 폭 양 끝을 찍고 4200 입력.
     */
    public record Scale(Double x1, Double y1, Double x2, Double y2, Integer mm) {
        public boolean set() {
            return x1 != null && y1 != null && x2 != null && y2 != null && mm != null && mm > 0;
        }
    }

    public record FloorplanResponse(
            long id,
            long inquiryId,
            String name,
            String originalName,
            String contentType,
            long sizeBytes,
            Integer imageWidth,
            Integer imageHeight,
            Scale scale,
            int wallHeightMm,
            /** walls · rooms · openings. 모양이 자주 바뀌는 자리라 통째로 둔다. */
            Map<String, Object> geometry,
            List<Map<String, Object>> devices,
            /** 축척이 잡혀 있을 때만 채워지는 파생값 — 벽 길이 합계·방 면적 등. */
            Derived derived,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            String updatedBy) {}

    /** 치수에서 바로 나오는 값들. 화면마다 다시 세지 않게 서버가 계산해 준다. */
    public record Derived(
            boolean scaled,
            double mmPerUnitX,
            double mmPerUnitY,
            int wallCount,
            long wallTotalMm,
            int roomCount,
            double floorAreaM2,
            int deviceCount,
            List<RoomArea> rooms) {}

    public record RoomArea(String name, double areaM2, int deviceCount) {}

    /** 저장 요청. 보내지 않은 항목은 건드리지 않는다. */
    public record SaveRequest(
            @Size(max = 60, message = "도면 이름은 60자 이하입니다.")
            String name,

            Scale scale,

            @Min(value = 1800, message = "벽 높이는 1800mm 이상이어야 합니다.")
            @Max(value = 4000, message = "벽 높이는 4000mm 이하여야 합니다.")
            Integer wallHeightMm,

            Map<String, Object> geometry,

            List<Map<String, Object>> devices) {}
}
