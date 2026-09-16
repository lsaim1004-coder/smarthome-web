package kr.kiwan.smarthome.analysis;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.inquiry.ApplianceDtos.ApplianceResponse;
import kr.kiwan.smarthome.inquiry.ApplianceService;

/**
 * 가전 자동판별.
 *
 * 두 단계로 본다.
 *  1) 규칙 — 구매 시기와 브랜드만으로도 구형·신형과 연동 경로를 대충 가른다. 외부 호출이 없어 항상 돈다.
 *  2) 사진 — 모델명 라벨을 읽어 1) 을 덮어쓴다. API 키가 있을 때만.
 *
 * 사진에서 필요한 것은 모델명 한 줄이다. 읽어낸 뒤에는 원본을 지운다(app.analysis.purge-after).
 * 남겨 둘 이유가 없고, 남기면 그때부터 관리해야 할 개인정보가 된다.
 */
@Profile("public")
@Service
public class PhotoAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(PhotoAnalysisService.class);

    /** 리모컨 허브로 묶을 수 있는 종류. 구형이어도 적외선이면 길이 있다. */
    private static final Set<String> IR_KINDS = Set.of("TV", "AIRCON", "AIRPURIFIER", "BOILER");

    /** 제조사 앱이 실제로 있는 브랜드. */
    private static final Set<String> APP_BRANDS = Set.of("SAMSUNG", "LG", "XIAOMI", "COWAY", "CUCKOO");

    private static final String PROMPT = """
            이 사진은 한국 가정의 가전제품, 또는 그 제품에 붙은 모델명 라벨입니다.
            라벨에서 모델명을 읽어 아래 JSON 하나만 출력하세요. 설명이나 코드블록 없이 JSON 만 출력합니다.

            {
              "modelName": "라벨에 적힌 모델명 그대로. 못 읽으면 null",
              "brand": "SAMSUNG | LG | WINIA | XIAOMI | CUCKOO | COWAY | ETC_BRAND | null",
              "year": 추정 출시연도 숫자 또는 null,
              "era": "NEW | OLD | UNKNOWN",
              "iotStatus": "APP | IR | NONE | UNKNOWN",
              "confidence": 0.0 ~ 1.0,
              "note": "판단 근거를 한 문장으로. 한국어."
            }

            기준:
            - era 는 2018년 이후 출시로 보이면 NEW, 그 이전이면 OLD, 모르겠으면 UNKNOWN.
            - iotStatus 는 제조사 앱(SmartThings·ThinQ 등)에 등록되는 모델이면 APP,
              적외선 리모컨으로만 조작되는 모델이면 IR, 둘 다 아니면 NONE, 모르겠으면 UNKNOWN.
            - 사진이 흐리거나 라벨이 아니면 modelName 은 null 로 두고 confidence 를 낮게 주세요.
            - 사람 얼굴이나 문서 같은 무관한 사진이면 전부 null 과 UNKNOWN 으로 답하세요.
            """;

    private final AppProperties props;
    private final ApplianceService appliances;
    private final ObjectMapper json;
    private final RestClient http;

    public PhotoAnalysisService(AppProperties props, ApplianceService appliances, ObjectMapper json) {
        this.props = props;
        this.appliances = appliances;
        this.json = json;
        this.http = RestClient.builder()
                .baseUrl(props.analysis().baseUrl() == null ? "https://api.anthropic.com"
                        : props.analysis().baseUrl())
                .build();
    }

    /** 결과 한 벌. */
    public record Verdict(String modelName, String era, String iotStatus, String note, String source,
                          Double confidence) {}

    /**
     * 가전 한 대를 판별한다. 사진이 있고 키가 있으면 읽고, 아니면 규칙만으로 채운다.
     * 돌려준 값은 곧바로 저장된다.
     */
    public Verdict judge(long applianceId) {
        ApplianceResponse a = appliances.get(applianceId);
        Verdict rule = byRule(a);

        if (!props.analysis().visionReady()) {
            return rule;
        }
        List<Path> photos = appliances.livePhotos(applianceId);
        if (photos.isEmpty()) {
            return rule;
        }
        try {
            Verdict seen = byPhoto(a, photos);
            if (seen == null) {
                return rule;
            }
            // 사진에서 못 읽은 칸은 규칙 값으로 메운다.
            return new Verdict(
                    seen.modelName() != null ? seen.modelName() : a.modelName(),
                    seen.era() != null && !"UNKNOWN".equals(seen.era()) ? seen.era() : rule.era(),
                    seen.iotStatus() != null && !"UNKNOWN".equals(seen.iotStatus())
                            ? seen.iotStatus() : rule.iotStatus(),
                    seen.note(),
                    "AI",
                    seen.confidence());
        } catch (Exception e) {
            log.warn("사진 판별 실패 appliance={}: {}", applianceId, e.toString());
            return rule;
        }
    }

    /** 사진 판별까지 끝났으면 원본을 지운다. 지운 장수를 돌려준다. */
    public int purgeIfDone(long applianceId) {
        if (!props.analysis().purgeAfter()) {
            return 0;
        }
        return appliances.purgePhotos(applianceId);
    }

    // ---------- 1) 규칙 ----------

    /**
     * 구매 시기와 브랜드만 보고 가른다.
     * 정확하지는 않지만 "리모컨 허브가 필요한 집"과 "앱만 묶으면 되는 집"을 먼저 나누는 데는 충분하다.
     */
    private Verdict byRule(ApplianceResponse a) {
        String era = switch (a.purchased() == null ? "" : a.purchased()) {
            case "Y1", "Y3", "Y5" -> "NEW";
            case "Y10P" -> "OLD";
            default -> "UNKNOWN";
        };
        String brand = a.brand() == null ? "" : a.brand().toUpperCase(Locale.ROOT);
        String kind = a.kind() == null ? "" : a.kind().toUpperCase(Locale.ROOT);

        String iot;
        if ("NEW".equals(era) && APP_BRANDS.contains(brand)) {
            iot = "APP";
        } else if (IR_KINDS.contains(kind)) {
            iot = "IR";
        } else if ("OLD".equals(era)) {
            iot = "NONE";
        } else {
            iot = "UNKNOWN";
        }

        String note = "구매 시기" + (a.purchased() == null ? " 미기재" : "(" + a.purchased() + ")")
                + "와 브랜드로 본 1차 분류입니다. 모델명이 확인되면 다시 판정합니다.";
        return new Verdict(a.modelName(), era, iot, note, "RULE", null);
    }

    // ---------- 2) 사진 ----------

    private Verdict byPhoto(ApplianceResponse a, List<Path> photos) throws Exception {
        List<Map<String, Object>> content = new ArrayList<>();
        // 모델명 라벨을 노린 사진이라 여러 장이어도 앞의 두 장이면 충분하다.
        for (Path p : photos.subList(0, Math.min(2, photos.size()))) {
            byte[] bytes = Files.readAllBytes(p);
            content.add(Map.of(
                    "type", "image",
                    "source", Map.of(
                            "type", "base64",
                            "media_type", mediaType(p),
                            "data", Base64.getEncoder().encodeToString(bytes))));
        }
        String hint = "참고: 신청자가 고른 종류는 " + (a.kind() == null ? "미상" : a.kind())
                + ", 브랜드는 " + (a.brand() == null ? "미상" : a.brand())
                + ", 적어 준 모델명은 " + (a.modelName() == null ? "없음" : a.modelName()) + " 입니다.";
        content.add(Map.of("type", "text", "text", PROMPT + "\n" + hint));

        Map<String, Object> body = Map.of(
                "model", props.analysis().model(),
                "max_tokens", 512,
                "messages", List.of(Map.of("role", "user", "content", content)));

        String raw = http.post()
                .uri("/v1/messages")
                .header("x-api-key", props.analysis().apiKey())
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode root = json.readTree(raw);
        JsonNode text = root.path("content").path(0).path("text");
        if (text.isMissingNode()) {
            return null;
        }
        JsonNode parsed = json.readTree(stripFence(text.asText()));
        return new Verdict(
                textOrNull(parsed, "modelName"),
                upperOrNull(parsed, "era"),
                upperOrNull(parsed, "iotStatus"),
                textOrNull(parsed, "note"),
                "AI",
                parsed.hasNonNull("confidence") ? parsed.get("confidence").asDouble() : null);
    }

    /** 모델이 코드블록으로 감싸 보내는 경우가 있어 벗겨 둔다. */
    private static String stripFence(String value) {
        String s = value.trim();
        if (s.startsWith("```")) {
            int first = s.indexOf('\n');
            int last = s.lastIndexOf("```");
            if (first > 0 && last > first) {
                s = s.substring(first + 1, last);
            }
        }
        return s.trim();
    }

    private static String textOrNull(JsonNode node, String field) {
        return node.hasNonNull(field) && !node.get(field).asText().isBlank() ? node.get(field).asText() : null;
    }

    private static String upperOrNull(JsonNode node, String field) {
        String v = textOrNull(node, field);
        return v == null ? null : v.trim().toUpperCase(Locale.ROOT);
    }

    private static String mediaType(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".png")) {
            return "image/png";
        }
        if (name.endsWith(".webp")) {
            return "image/webp";
        }
        if (name.endsWith(".gif")) {
            return "image/gif";
        }
        return "image/jpeg";
    }
}
