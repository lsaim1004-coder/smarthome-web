package kr.kiwan.smarthome;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WelcomeController {

    private final WelcomeService service;

    public WelcomeController(WelcomeService service) {
        this.service = service;
    }

    @GetMapping("/welcome")
    public WelcomeResponse welcome() {
        return service.welcome();
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        boolean dbUp = service.databaseUp();
        Map<String, String> body = Map.of(
                "status", dbUp ? "UP" : "DEGRADED",
                "db", dbUp ? "UP" : "DOWN");
        return ResponseEntity.status(dbUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
