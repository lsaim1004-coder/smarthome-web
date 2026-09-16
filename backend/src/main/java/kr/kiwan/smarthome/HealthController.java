package kr.kiwan.smarthome;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 컨테이너 헬스체크. 공개 서버와 관리자 서버 양쪽에서 같은 주소로 답해야 하므로 프로필을 걸지 않는다.
 */
@RestController
public class HealthController {

    private final WelcomeService service;

    public HealthController(WelcomeService service) {
        this.service = service;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        boolean dbUp = service.databaseUp();
        Map<String, String> body = Map.of(
                "status", dbUp ? "UP" : "DEGRADED",
                "db", dbUp ? "UP" : "DOWN");
        return ResponseEntity.status(dbUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
