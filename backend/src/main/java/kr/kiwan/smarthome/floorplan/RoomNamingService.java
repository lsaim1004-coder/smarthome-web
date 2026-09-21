package kr.kiwan.smarthome.floorplan;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import kr.kiwan.smarthome.AppProperties;

/**
 * 도면에서 방 이름을 읽어 채운다.
 *
 * **이건 그림을 읽는 일이지 선을 재는 일이 아니다.** 실측으로 확인한 것:
 *
 *   - 어떤 도면은 욕실에 변기·세면대를 아예 안 그린다. "욕실" 이라는 **글자만** 있다
 *   - 어떤 도면은 변기·욕조는 그려 놓고 그 방에 **글자를 안 적는다**
 *   - 굽은 선 비율로 변기를 찾아보려 했더니 1등이 욕실이 아니라 **발코니**였다.
 *     문 열림 호(arc)가 모든 방에 있어서다
 *
 * 그래서 규칙으로는 못 가른다. 글자를 읽든 기구 모양을 알아보든, 둘 다 하려면 그림을
 * 이해해야 한다. 모델에게 넘긴다.
 *
 * 방을 좌표로 설명하지 않고 **그림 위에 번호를 찍어 보낸다.** 모델은 "3번 방이 뭐냐"에는
 * 잘 답하지만 "x 0.37~0.49 에 있는 방"은 잘 못 짚는다.
 *
 * 키가 없으면 아무것도 하지 않는다 — 판단을 지어내는 것보다 비워 두는 편이 낫다.
 */
@Service
public class RoomNamingService {

    private static final Logger log = LoggerFactory.getLogger(RoomNamingService.class);

    /** 도면 글자가 읽힐 만큼은 크고, 전송이 무겁지 않을 만큼은 작게. */
    private static final int SEND_WIDTH = 1400;

    private static final String PROMPT = """
            이 이미지는 주거 공간 평면도이고, 방마다 노란 동그라미에 번호를 찍어 두었습니다.
            번호마다 그 방의 이름을 한국어로 알려주세요.

            판단 근거는 두 가지입니다.
              1) 도면에 그 방 이름이 **적혀 있으면 적힌 그대로** 씁니다 (예: 침실, 거실, 주방, 드레스룸)
              2) 글자가 없으면 **그려진 기구**로 봅니다.
                 변기·세면대·욕조가 있으면 화장실, 싱크대·레인지가 있으면 주방,
                 건물 바깥쪽에 붙은 좁고 긴 칸이면 발코니입니다.

            {"names": [{"no": 1, "name": "침실", "confidence": 0.9}, ...]}
            형식의 JSON 만 답하세요. 다른 말은 쓰지 마세요.

            - 번호가 찍힌 모든 방에 대해 한 줄씩 주세요.
            - 정말 모르겠으면 name 을 null 로 두고 confidence 를 낮게 주세요.
              **지어내지 마세요.** 비어 있는 편이 틀린 이름보다 낫습니다.
            - confidence 는 0~1 입니다. 적힌 글자를 읽은 경우가 가장 높습니다.
            """;

    private final AppProperties props;
    private final FloorplanService floorplans;
    private final ObjectMapper json;
    private final RestClient http;

    public RoomNamingService(AppProperties props, FloorplanService floorplans, ObjectMapper json) {
        this.props = props;
        this.floorplans = floorplans;
        this.json = json;
        this.http = RestClient.builder()
                .baseUrl(props.analysis().baseUrl() == null ? "https://api.anthropic.com"
                        : props.analysis().baseUrl())
                .build();
    }

    /** 방 하나의 이름과 확신도. 못 읽으면 name 은 null. */
    public record Named(int no, String name, Double confidence) {}

    public boolean ready() {
        return props.analysis().visionReady();
    }

    /**
     * 방 중심점(비율 0~1)을 순서대로 받아 같은 순서의 이름을 돌려준다.
     * 읽지 못한 방은 name 이 null 이다.
     */
    public List<Named> name(long floorplanId, List<double[]> centers) {
        if (!ready() || centers.isEmpty()) {
            return List.of();
        }
        Path file = floorplans.imageFile(floorplanId)
                .orElseThrow(() -> new IllegalArgumentException("도면 이미지를 찾을 수 없습니다."));
        try {
            byte[] marked = mark(file, centers);
            return ask(marked, centers.size());
        } catch (Exception e) {
            log.warn("방 이름 읽기 실패 floorplan={} : {}", floorplanId, e.toString());
            return List.of();
        }
    }

    /** 도면 위 각 방 중심에 번호를 찍는다. 모델이 "몇 번 방"으로 답할 수 있게. */
    private byte[] mark(Path file, List<double[]> centers) throws Exception {
        BufferedImage src = ImageIO.read(file.toFile());
        if (src == null) {
            throw new IllegalStateException("이미지를 읽을 수 없습니다: " + file.getFileName());
        }
        int w = Math.min(SEND_WIDTH, src.getWidth());
        int h = Math.max(1, Math.round(src.getHeight() * (w / (float) src.getWidth())));

        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, w, h);
        g.drawImage(src, 0, 0, w, h, null);

        int r = Math.max(14, w / 55);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, (int) (r * 1.2)));
        for (int i = 0; i < centers.size(); i++) {
            double[] c = centers.get(i);
            int cx = (int) Math.round(Math.min(1, Math.max(0, c[0])) * w);
            int cy = (int) Math.round(Math.min(1, Math.max(0, c[1])) * h);
            String label = String.valueOf(i + 1);

            g.setColor(new Color(255, 214, 10));
            g.fillOval(cx - r, cy - r, r * 2, r * 2);
            g.setColor(new Color(20, 35, 61));
            g.setStroke(new BasicStroke(Math.max(2f, r / 7f)));
            g.drawOval(cx - r, cy - r, r * 2, r * 2);

            var fm = g.getFontMetrics();
            g.drawString(label, cx - fm.stringWidth(label) / 2, cy + fm.getAscent() / 2 - 2);
        }
        g.dispose();

        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        ImageIO.write(out, "png", buf);
        return buf.toByteArray();
    }

    private List<Named> ask(byte[] image, int count) throws Exception {
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(Map.of(
                "type", "image",
                "source", Map.of(
                        "type", "base64",
                        "media_type", "image/png",
                        "data", Base64.getEncoder().encodeToString(image))));
        content.add(Map.of("type", "text", "text", PROMPT + "\n번호는 1부터 " + count + " 까지입니다."));

        Map<String, Object> body = Map.of(
                "model", props.analysis().model(),
                "max_tokens", 1024,
                "messages", List.of(Map.of("role", "user", "content", content)));

        String raw = http.post()
                .uri("/v1/messages")
                .header("x-api-key", props.analysis().apiKey())
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode text = json.readTree(raw).path("content").path(0).path("text");
        if (text.isMissingNode()) {
            return List.of();
        }
        JsonNode parsed = json.readTree(stripFence(text.asText())).path("names");
        List<Named> out = new ArrayList<>();
        for (JsonNode n : parsed) {
            int no = n.path("no").asInt(0);
            if (no < 1 || no > count) {
                continue;
            }
            String name = n.hasNonNull("name") ? n.get("name").asText().trim() : null;
            out.add(new Named(no, name == null || name.isEmpty() ? null : name,
                    n.hasNonNull("confidence") ? n.get("confidence").asDouble() : null));
        }
        return out;
    }

    /** 모델이 코드블록으로 감싸 보내는 경우가 있어 벗겨 둔다. */
    private static String stripFence(String value) {
        String s = value.trim();
        if (!s.startsWith("```")) {
            return s;
        }
        int first = s.indexOf('\n');
        int last = s.lastIndexOf("```");
        return first < 0 || last <= first ? s : s.substring(first + 1, last).trim();
    }
}
