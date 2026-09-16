package kr.kiwan.smarthome.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.common.ApiException;

/**
 * 관리자 서버(LXC 112) → 공개 서버(LXC 111) 내부 통로.
 *
 * 사진 파일은 접수를 받은 공개 서버의 볼륨에만 있다. 관리자 서버로 복사해 두지 않는 이유는
 * 지울 곳이 두 군데가 되면 결국 한 곳이 남기 때문이다. 필요할 때 받아서 흘려 보내고, 지울 때도 거기서 지운다.
 *
 * LAN 주소로만 붙고 공유 키를 헤더에 넣는다. 그 포트는 공인망에 열려 있지 않다.
 */
@Profile("admin")
@Component
public class InternalClient {

    private static final Logger log = LoggerFactory.getLogger(InternalClient.class);

    private final AppProperties props;
    private final RestClient http = RestClient.create();

    public InternalClient(AppProperties props) {
        this.props = props;
    }

    public boolean ready() {
        return props.internal().configured()
                && props.internal().publicApiUrl() != null
                && !props.internal().publicApiUrl().isBlank();
    }

    private String url(String path) {
        if (!ready()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "NO_INTERNAL_LINK",
                    "공개 서버와의 내부 통로가 설정되지 않았습니다. APP_INTERNAL_KEY / APP_PUBLIC_API_URL 을 확인해 주세요.");
        }
        return props.internal().publicApiUrl() + path;
    }

    /** 사진 원본. 이미 폐기된 사진이면 404 가 온다. */
    public ResponseEntity<byte[]> photo(long photoId) {
        try {
            return http.get()
                    .uri(url("/api/internal/photos/" + photoId))
                    .header("X-Internal-Key", props.internal().key())
                    .retrieve()
                    .toEntity(byte[].class);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PHOTO_FETCH_FAILED",
                    "사진을 가져오지 못했습니다. 이미 삭제되었을 수 있습니다.");
        }
    }

    /** 신청 한 건의 사진 원본을 공개 서버에서 지운다. 지운 장수를 돌려준다. */
    public int purgePhotos(long inquiryId) {
        if (!ready()) {
            log.warn("내부 통로가 없어 신청 #{} 의 사진을 지우지 못했습니다.", inquiryId);
            return 0;
        }
        try {
            JsonNode res = http.delete()
                    .uri(url("/api/internal/inquiries/" + inquiryId + "/photos"))
                    .header("X-Internal-Key", props.internal().key())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(JsonNode.class);
            return res == null ? 0 : res.path("removed").asInt(0);
        } catch (Exception e) {
            log.warn("신청 #{} 사진 폐기 실패: {}", inquiryId, e.toString());
            return 0;
        }
    }
}
