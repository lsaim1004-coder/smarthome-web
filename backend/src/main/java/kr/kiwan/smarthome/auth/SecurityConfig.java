package kr.kiwan.smarthome.auth;

import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * 같은 이미지를 두 서버로 띄운다 — 프로필이 무엇을 열어 둘지 가른다.
 *
 * public : iot.kiwan.kr. 로그인이 없다. 소개와 접수만 받는다.
 * admin  : iot-admin.kiwan.kr. 로그인해야 하고, 들어오면 전부 관리자 API 다.
 *
 * 세션 쿠키 기반이며 세션은 Spring Session JDBC 로 PostgreSQL 에 보관한다(재시작해도 유지).
 * CSRF 토큰 대신 SameSite=Lax 쿠키 + JSON 요청으로 막는다(동일 출처 SPA 전제).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** 공개 사이트: 로그인 없음. 접수와 사진 첨부만 열어 둔다. */
    @Bean
    @Profile("public")
    SecurityFilterChain publicChain(HttpSecurity http, SecurityContextRepository repository) throws Exception {
        common(http, repository)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/inquiries").permitAll()
                        // 가전 사진 첨부: 접수 직후 발급한 토큰을 ApplianceService 가 검사한다
                        .requestMatchers(HttpMethod.POST, "/api/inquiries/*/photos").permitAll()
                        // 관리자 서버가 LAN 으로만 부르는 통로. 공유 키를 컨트롤러에서 확인한다.
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers("/api/welcome", "/api/health", "/api/catalog").permitAll()
                        .anyRequest().permitAll());
        return http.build();
    }

    /** 관리자 서버: 로그인 관련만 열고 나머지는 전부 인증. */
    @Bean
    @Profile("admin")
    SecurityFilterChain adminChain(HttpSecurity http, SecurityContextRepository repository) throws Exception {
        common(http, repository)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/check").authenticated()   // nginx auth_request 용
                        .requestMatchers("/api/auth/**", "/api/health").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll());
        return http.build();
    }

    private HttpSecurity common(HttpSecurity http, SecurityContextRepository repository) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .securityContext(sc -> sc.securityContextRepository(repository))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(eh -> eh.authenticationEntryPoint((request, response, ex) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.getWriter().write("{\"error\":\"UNAUTHENTICATED\",\"message\":\"로그인이 필요합니다.\"}");
                }));
    }
}
