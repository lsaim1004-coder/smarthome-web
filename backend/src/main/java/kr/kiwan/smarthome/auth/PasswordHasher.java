package kr.kiwan.smarthome.auth;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 비밀번호 저장.
 *
 * 저장하는 값은 <b>BCrypt(HMAC-SHA256(서버키, 비밀번호))</b> 다.
 *
 * <p>서버키(pepper)는 DB 가 아니라 서버 볼륨의 파일에만 있다. 그래서 DB 만 새어 나가도
 * 그 해시로는 비밀번호를 맞춰 볼 수 없다 — 키가 없으면 후보 비밀번호를 넣어 볼 수조차 없기 때문이다.
 *
 * <p>SHA-256 하나로 끝내지 않고 BCrypt 를 밑에 둔 이유는, SHA-256 은 빠르게 계산되도록 만든 함수라
 * 키까지 함께 새는 날에는 대입 공격을 막지 못하기 때문이다. BCrypt 는 한 번 계산하는 데 일부러
 * 시간이 걸리게 되어 있어 그 경우에도 시간을 벌어 준다.
 *
 * <p><b>키를 잃으면 기존 비밀번호는 모두 확인할 수 없다.</b> 볼륨(keys)을 지우지 말 것.
 * 옛 방식(BCrypt 만)으로 저장된 값도 그대로 로그인되고, 로그인에 성공하면 새 방식으로 바꿔 둔다.
 */
@Component
public class PasswordHasher {

    private static final Logger log = LoggerFactory.getLogger(PasswordHasher.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    /** 새 방식으로 저장한 값임을 알리는 표시. 옛 값과 섞여 있어도 구분된다. */
    private static final String PREFIX = "p1$";
    private static final String HMAC = "HmacSHA256";
    private static final int KEY_BYTES = 32;

    private final PasswordEncoder encoder;
    private final byte[] key;

    public PasswordHasher(PasswordEncoder encoder,
                          @Value("${app.security.key-file:/data/keys/password.key}") String keyFile) {
        this.encoder = encoder;
        this.key = loadOrCreate(Path.of(keyFile));
    }

    /** 저장할 값. */
    public String hash(String raw) {
        return PREFIX + encoder.encode(pepper(raw));
    }

    /** 맞는 비밀번호인지. 옛 방식으로 저장된 값도 받아 준다. */
    public boolean matches(String raw, String stored) {
        if (stored == null || stored.isBlank()) {
            return false;
        }
        if (stored.startsWith(PREFIX)) {
            return encoder.matches(pepper(raw), stored.substring(PREFIX.length()));
        }
        return encoder.matches(raw, stored);
    }

    /** 옛 방식으로 저장돼 있어 다시 저장해야 하는지. */
    public boolean needsUpgrade(String stored) {
        return stored != null && !stored.startsWith(PREFIX);
    }

    private String pepper(String raw) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(key, HMAC));
            return Base64.getEncoder().encodeToString(mac.doFinal(raw.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("비밀번호 해싱에 실패했습니다.", e);
        }
    }

    /**
     * 키 파일을 읽고, 없으면 만든다.
     *
     * 공개·관리자 두 컨테이너가 같은 볼륨을 보므로 동시에 만들려 들 수 있다.
     * CREATE_NEW 는 이미 있으면 실패하므로, 실패하면 남이 만든 것을 읽는다.
     */
    private static byte[] loadOrCreate(Path path) {
        try {
            if (Files.exists(path)) {
                return decode(path);
            }
            Files.createDirectories(path.getParent());
            byte[] fresh = new byte[KEY_BYTES];
            RANDOM.nextBytes(fresh);
            try {
                Files.writeString(path, Base64.getEncoder().encodeToString(fresh), StandardCharsets.US_ASCII,
                        StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
                harden(path);
                log.info("비밀번호 서버키를 새로 만들었습니다: {} (이 파일을 잃으면 기존 비밀번호를 확인할 수 없습니다)",
                        path);
                return fresh;
            } catch (java.nio.file.FileAlreadyExistsException e) {
                return decode(path);
            }
        } catch (Exception e) {
            throw new IllegalStateException("비밀번호 서버키를 준비하지 못했습니다: " + path, e);
        }
    }

    private static byte[] decode(Path path) throws Exception {
        byte[] loaded = Base64.getDecoder().decode(Files.readString(path, StandardCharsets.US_ASCII).trim());
        if (loaded.length < 16) {
            throw new IllegalStateException("서버키가 너무 짧습니다: " + path);
        }
        return loaded;
    }

    /** 같은 호스트의 다른 사용자가 읽지 못하게. 파일 시스템이 지원하지 않으면 넘어간다. */
    private static void harden(Path path) {
        try {
            Files.setPosixFilePermissions(path,
                    java.util.Set.of(java.nio.file.attribute.PosixFilePermission.OWNER_READ,
                            java.nio.file.attribute.PosixFilePermission.OWNER_WRITE));
        } catch (Exception e) {
            log.debug("서버키 권한을 좁히지 못했습니다: {}", e.toString());
        }
    }
}
