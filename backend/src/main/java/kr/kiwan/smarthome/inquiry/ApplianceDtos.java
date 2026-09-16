package kr.kiwan.smarthome.inquiry;

import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.constraints.Size;

/**
 * 신청자가 적어 주는 보유 가전과, 거기 붙는 사진.
 *
 * 판정 칸(detectedModel / era / iotStatus)은 접수 시점에 비어 있고, 사진의 모델명을 읽어
 * 나중에 채운다. 그 결과가 곧 "IoT 로 묶을 수 있는 후보군" 목록이 된다.
 */
public final class ApplianceDtos {

    private ApplianceDtos() {}

    /** 상담 신청과 함께 들어오는 한 대. */
    public record ApplianceInput(
            @Size(max = 30, message = "가전 종류 값이 올바르지 않습니다.")
            String kind,

            @Size(max = 30, message = "브랜드 값이 올바르지 않습니다.")
            String brand,

            @Size(max = 120, message = "모델명은 120자 이하로 입력해 주세요.")
            String modelName,

            @Size(max = 30, message = "구매 시기 값이 올바르지 않습니다.")
            String purchased,

            @Size(max = 300, message = "메모는 300자 이하로 입력해 주세요.")
            String note
    ) {}

    public record PhotoResponse(
            long id,
            long inquiryId,
            Long applianceId,
            String originalName,
            String contentType,
            long sizeBytes,
            OffsetDateTime createdAt
    ) {}

    /** 관리자 화면에 보여 줄 한 대 + 붙은 사진들. */
    public record ApplianceResponse(
            long id,
            long inquiryId,
            String kind,
            String brand,
            String modelName,
            String purchased,
            String note,
            String detectedModel,
            String era,
            String iotStatus,
            String analysisNote,
            OffsetDateTime analyzedAt,
            OffsetDateTime createdAt,
            List<PhotoResponse> photos
    ) {}

    /** 후보 목록 행. 어느 신청에서 온 가전인지 같이 본다. */
    public record CandidateResponse(
            ApplianceResponse appliance,
            String inquiryName,
            String inquiryRegion,
            String inquiryStatus
    ) {}

    /** 사진 분석 결과 입력. 보낸 칸만 덮어쓴다. */
    public record AnalyzeRequest(
            @Size(max = 120, message = "모델명은 120자 이하로 입력해 주세요.")
            String detectedModel,

            @Size(max = 20, message = "연식 값이 올바르지 않습니다.")
            String era,

            @Size(max = 20, message = "연동 가능성 값이 올바르지 않습니다.")
            String iotStatus,

            @Size(max = 1000, message = "메모는 1000자 이하로 입력해 주세요.")
            String analysisNote
    ) {}

    public record UploadResponse(boolean ok, int stored, int rejected, String message) {}
}
