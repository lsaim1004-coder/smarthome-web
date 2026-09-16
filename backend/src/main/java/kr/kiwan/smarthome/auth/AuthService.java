package kr.kiwan.smarthome.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.admin.PartnerRepository;
import kr.kiwan.smarthome.admin.PartnerRepository.PartnerRow;
import kr.kiwan.smarthome.auth.AuthDtos.AuthUser;
import kr.kiwan.smarthome.auth.AuthDtos.CodeIssued;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.auth.VerificationRepository.CodeRow;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.common.MailService;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final VerificationRepository codes;
    private final PartnerRepository partners;
    private final MailService mail;
    private final PasswordHasher hasher;
    private final AppProperties props;
    private final AppProperties.Verification policy;
    /** 존재하지 않는 이메일로 로그인할 때도 같은 시간이 걸리도록 비교에 쓰는 더미 해시. */
    private final String dummyHash;

    public AuthService(UserRepository users, VerificationRepository codes, PartnerRepository partners,
                       MailService mail, PasswordHasher hasher, AppProperties props) {
        this.users = users;
        this.codes = codes;
        this.partners = partners;
        this.mail = mail;
        this.hasher = hasher;
        this.props = props;
        this.policy = props.verification();
        this.dummyHash = hasher.hash("dummy-password-for-timing");
    }

    // ---------- 역할 ----------

    /** 이메일 하나에 대한 역할과 소속 업체. 설정(app.admin-emails)과 업체 담당자 이메일이 근거다. */
    record Grant(String role, Long partnerId) {
        boolean staff() {
            return !"USER".equals(role);
        }
    }

    Grant grantFor(String email) {
        if (props.isAdmin(email)) {
            return new Grant("OWNER", null);
        }
        return partners.findByContactEmail(email)
                .map(p -> new Grant("PARTNER", p.id()))
                .orElseGet(() -> new Grant("USER", null));
    }

    // ---------- 회원가입 ----------

    @Transactional
    public CodeIssued register(String rawEmail, String password, String rawName) {
        String email = normalizeEmail(rawEmail);
        String name = rawName == null || rawName.isBlank() ? null : rawName.trim();
        String hash = hasher.hash(password);

        // 관리자 서버는 아무나 가입할 수 없다. 운영자 이메일(app.admin-emails) 이거나
        // 등록된 업체의 담당자 이메일이어야 한다. 업체를 먼저 등록하는 것이 곧 초대다.
        Grant grant = grantFor(email);
        if (!grant.staff()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_INVITED",
                    "가입할 수 없는 이메일입니다. 담당자에게 업체 등록을 요청해 주세요.");
        }

        Optional<UserRow> existing = users.findByEmail(email);
        long userId;
        if (existing.isPresent()) {
            if (existing.get().verified()) {
                throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "이미 가입된 이메일입니다. 로그인해 주세요.");
            }
            // 인증을 마치지 않은 계정: 비밀번호를 새로 설정하고 인증번호를 다시 보낸다
            userId = existing.get().id();
            users.updateCredentials(userId, hash, name);
            users.updateRole(userId, grant.role(), grant.partnerId());
        } else {
            userId = users.insert(email, hash, name, grant.role(), grant.partnerId());
        }
        return issueCode(userId, email, "가입이 접수되었습니다. 이메일로 보낸 인증번호를 입력해 주세요.");
    }

    // ---------- 인증번호 ----------

    @Transactional
    public CodeIssued resend(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        Optional<UserRow> user = users.findByEmail(email);
        String generic = "가입된 이메일이면 인증번호를 보냈습니다.";
        if (user.isEmpty()) {
            // 가입 여부를 드러내지 않기 위해 성공처럼 응답
            return new CodeIssued(email, generic, null, policy.codeTtlMinutes());
        }
        if (user.get().verified()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ALREADY_VERIFIED", "이미 인증된 이메일입니다. 로그인해 주세요.");
        }
        return issueCode(user.get().id(), email, generic);
    }

    private CodeIssued issueCode(long userId, String email, String message) {
        OffsetDateTime now = OffsetDateTime.now();
        Optional<CodeRow> latest = codes.findLatest(userId);
        if (latest.isPresent()) {
            long elapsed = Duration.between(latest.get().createdAt(), now).getSeconds();
            long wait = policy.resendCooldownSeconds() - elapsed;
            if (wait > 0) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RESEND_COOLDOWN",
                        wait + "초 후에 다시 요청할 수 있습니다.");
            }
        }
        codes.closeOpen(userId);
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        codes.insert(userId, sha256(code), now.plusMinutes(policy.codeTtlMinutes()));
        try {
            mail.sendVerificationCode(email, code, policy.codeTtlMinutes());
        } catch (MailException e) {
            log.error("verification mail failed for {}: {}", email, e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "MAIL_FAILED",
                    "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        String devCode = mail.smtpEnabled() ? null : code;
        return new CodeIssued(email, message, devCode, policy.codeTtlMinutes());
    }

    @Transactional
    public void verify(String rawEmail, String code) {
        String email = normalizeEmail(rawEmail);
        UserRow user = users.findByEmail(email)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "CODE_INVALID", "인증번호가 올바르지 않습니다."));
        if (user.verified()) {
            return; // 이미 인증됨: 멱등 처리
        }
        CodeRow row = codes.findLatest(user.id()).filter(CodeRow::open)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "CODE_INVALID",
                        "유효한 인증번호가 없습니다. 다시 요청해 주세요."));

        if (row.expiresAt().isBefore(OffsetDateTime.now())) {
            codes.consume(row.id());
            throw new ApiException(HttpStatus.BAD_REQUEST, "CODE_EXPIRED", "인증번호가 만료되었습니다. 다시 요청해 주세요.");
        }
        if (row.attempts() >= policy.maxAttempts()) {
            codes.consume(row.id());
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "입력 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.");
        }
        if (!MessageDigest.isEqual(row.codeHash().getBytes(StandardCharsets.US_ASCII),
                sha256(code).getBytes(StandardCharsets.US_ASCII))) {
            codes.incrementAttempts(row.id());
            int remaining = policy.maxAttempts() - row.attempts() - 1;
            throw new ApiException(HttpStatus.BAD_REQUEST, "CODE_INVALID",
                    "인증번호가 올바르지 않습니다." + (remaining > 0 ? " (남은 횟수 " + remaining + "회)" : ""));
        }
        codes.consume(row.id());
        users.markVerified(user.id());
        log.info("email verified: {}", email);
    }

    // ---------- 로그인 ----------

    @Transactional
    public AuthUser login(String rawEmail, String password) {
        String email = normalizeEmail(rawEmail);
        Optional<UserRow> user = users.findByEmail(email);
        boolean ok = user.isPresent()
                ? hasher.matches(password, user.get().passwordHash())
                : hasher.matches(password, dummyHash) && false;
        if (!ok) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        UserRow u = user.get();
        if (!u.verified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED",
                    "이메일 인증이 완료되지 않았습니다. 인증번호를 입력해 주세요.");
        }
        if (!u.active()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED",
                    "사용이 중지된 계정입니다. 담당자에게 문의해 주세요.");
        }

        // 설정과 업체 담당자 이메일이 바뀌었을 수 있으니 로그인할 때마다 역할을 다시 맞춘다.
        Grant grant = grantFor(u.email());
        if (!grant.staff()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_STAFF",
                    "관리자 권한이 없는 계정입니다.");
        }
        if (!grant.role().equals(u.role()) || !java.util.Objects.equals(grant.partnerId(), u.partnerId())) {
            users.updateRole(u.id(), grant.role(), grant.partnerId());
            log.info("role updated for {}: {} -> {}", u.email(), u.role(), grant.role());
        }
        // 옛 방식(서버키 없이 BCrypt 만)으로 저장돼 있으면 이 기회에 새 방식으로 바꿔 둔다.
        if (hasher.needsUpgrade(u.passwordHash())) {
            users.updateCredentials(u.id(), hasher.hash(password), u.name());
            log.info("password rehashed for {}", u.email());
        }
        users.touchLogin(u.id());
        return new AuthUser(u.id(), u.email(), u.name(), grant.role(), grant.partnerId());
    }

    public Optional<UserRow> findById(long id) {
        return users.findById(id);
    }

    /** 화면에 업체 이름을 같이 보여 주기 위해. */
    public Optional<PartnerRow> partner(Long partnerId) {
        return partnerId == null ? Optional.empty() : partners.findById(partnerId);
    }

    // ---------- util ----------

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
