package kr.kiwan.smarthome.auth;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.auth.AuthDtos.AuthUser;
import kr.kiwan.smarthome.auth.AuthDtos.CodeIssued;
import kr.kiwan.smarthome.auth.AuthDtos.EmailRequest;
import kr.kiwan.smarthome.auth.AuthDtos.LoginRequest;
import kr.kiwan.smarthome.auth.AuthDtos.MeResponse;
import kr.kiwan.smarthome.auth.AuthDtos.RegisterRequest;
import kr.kiwan.smarthome.auth.AuthDtos.UserResponse;
import kr.kiwan.smarthome.auth.AuthDtos.VerifyRequest;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final SecurityContextRepository contextRepository;
    private final AppProperties props;

    public AuthController(AuthService auth, SecurityContextRepository contextRepository, AppProperties props) {
        this.auth = auth;
        this.contextRepository = contextRepository;
        this.props = props;
    }

    /** 1) 가입: 계정 생성(미인증) + 인증번호 발급 */
    @PostMapping("/register")
    public ResponseEntity<CodeIssued> register(@Valid @RequestBody RegisterRequest req) {
        CodeIssued issued = auth.register(req.email(), req.password(), req.name());
        return ResponseEntity.status(HttpStatus.CREATED).body(issued);
    }

    /** 2) 인증번호 확인 → 이메일 인증 완료 */
    @PostMapping("/verify")
    public Map<String, Object> verify(@Valid @RequestBody VerifyRequest req) {
        auth.verify(req.email(), req.code());
        return Map.of("email", AuthService.normalizeEmail(req.email()), "verified", true,
                "message", "이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다.");
    }

    /** 인증번호 재발송 */
    @PostMapping("/resend")
    public CodeIssued resend(@Valid @RequestBody EmailRequest req) {
        return auth.resend(req.email());
    }

    /** 3) 로그인: 인증 완료 계정만 세션 발급 */
    @PostMapping("/login")
    public MeResponse login(@Valid @RequestBody LoginRequest req,
                            HttpServletRequest request, HttpServletResponse response) {
        AuthUser user = auth.login(req.email(), req.password());

        // 세션 고정 공격 방지: 기존 세션은 버리고 새 세션에 인증 정보를 저장
        HttpSession old = request.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        request.getSession(true);

        Authentication token = UsernamePasswordAuthenticationToken.authenticated(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(token);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);

        return new MeResponse(true, toResponse(auth.findById(user.id()).orElseThrow()));
    }

    /** 현재 로그인 상태. 비로그인도 200 으로 authenticated=false 를 돌려준다. */
    @GetMapping("/me")
    public MeResponse me(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication.getPrincipal() instanceof AuthUser principal)) {
            return new MeResponse(false, null);
        }
        return auth.findById(principal.id())
                .map(row -> new MeResponse(true, toResponse(row)))
                .orElseGet(() -> new MeResponse(false, null));
    }

    /** nginx auth_request 가 호출. 필터에서 인증을 요구하므로 여기 도달하면 로그인 상태. 2xx 만 돌려준다. */
    @GetMapping("/check")
    public ResponseEntity<Void> check() {
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return Map.of("ok", true);
    }

    private UserResponse toResponse(UserRow row) {
        return new UserResponse(row.id(), row.email(), row.name(), props.isAdmin(row.email()), row.emailVerifiedAt(),
                row.createdAt(), row.lastLoginAt());
    }
}
