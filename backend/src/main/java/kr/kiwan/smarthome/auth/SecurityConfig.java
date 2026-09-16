package kr.kiwan.smarthome.auth;

import java.nio.charset.StandardCharsets;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

/**
 * 세션 쿠키 기반 인증.
 * - 로그인은 {@link AuthController} 가 JSON 으로 처리하고 SecurityContext 를 세션에 저장
 * - 세션은 Spring Session JDBC 로 PostgreSQL 에 보관 (백엔드 재시작에도 유지)
 * - CSRF 토큰은 사용하지 않고 SameSite=Lax 쿠키 + JSON 요청으로 방어 (동일 출처 SPA 전제)
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

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository repository) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .securityContext(sc -> sc.securityContextRepository(repository))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/check").authenticated()   // nginx auth_request 용: 세션 없으면 401
                        .requestMatchers("/api/auth/**", "/api/welcome", "/api/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/inquiries").permitAll()  // 비로그인 상담 신청
                        // 가전 사진 첨부: 접수 직후 발급한 토큰을 ApplianceService 가 검사한다
                        .requestMatchers(HttpMethod.POST, "/api/inquiries/*/photos").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(eh -> eh.authenticationEntryPoint((request, response, ex) -> {
                    response.setStatus(401);
                    response.setContentType("application/json");
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.getWriter().write("{\"error\":\"UNAUTHENTICATED\",\"message\":\"로그인이 필요합니다.\"}");
                }));
        return http.build();
    }
}
