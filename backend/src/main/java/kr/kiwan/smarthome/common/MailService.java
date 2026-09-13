package kr.kiwan.smarthome.common;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

import kr.kiwan.smarthome.AppProperties;


/**
 * 인증 메일 발송.
 * app.mail.mode=smtp 면 설정된 SMTP 로 실제 발송, 그 외(log)에는 로그에만 남긴다.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final AppProperties.Mail mail;
    private final String serviceName;
    private final JavaMailSenderImpl sender; // log 모드에서는 null

    public MailService(AppProperties props) {
        this.mail = props.mail();
        this.serviceName = props.serviceName();
        if (mail.smtp()) {
            if (mail.host() == null || mail.host().isBlank()) {
                throw new IllegalStateException("app.mail.mode=smtp 인데 app.mail.host 가 비어 있습니다.");
            }
            JavaMailSenderImpl s = new JavaMailSenderImpl();
            s.setHost(mail.host());
            s.setPort(mail.port());
            if (mail.username() != null && !mail.username().isBlank()) {
                s.setUsername(mail.username());
                s.setPassword(mail.password());
            }
            Properties p = s.getJavaMailProperties();
            p.put("mail.smtp.auth", String.valueOf(mail.username() != null && !mail.username().isBlank()));
            p.put("mail.smtp.starttls.enable", String.valueOf(mail.starttls()));
            p.put("mail.smtp.connectiontimeout", "5000");
            p.put("mail.smtp.timeout", "5000");
            p.put("mail.smtp.writetimeout", "5000");
            this.sender = s;
            log.info("mail mode=smtp host={} port={} from={}", mail.host(), mail.port(), mail.from());
        } else {
            this.sender = null;
            log.warn("mail mode=log — 인증번호를 메일로 보내지 않고 로그와 API 응답(devCode)에 표시합니다.");
        }
    }

    public boolean smtpEnabled() {
        return sender != null;
    }

    public void sendVerificationCode(String to, String code, int ttlMinutes) {
        String subject = "[" + serviceName + "] 이메일 인증번호 " + code;
        String body = "안녕하세요.\n\n"
                + serviceName + " 이메일 인증번호는 아래와 같습니다.\n\n"
                + "    " + code + "\n\n"
                + ttlMinutes + "분 안에 화면에 입력해 주세요.\n"
                + "본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.";

        if (sender == null) {
            log.info("[MAIL:LOG] to={} code={} (expires in {} min)", to, code, ttlMinutes);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mail.from());
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        sender.send(message);
        log.info("verification mail sent to {}", to);
    }

    /**
     * 일반 알림 메일. 발송 실패가 호출자의 작업(예: 상담 접수)을 막으면 안 되므로 예외를 삼키고 false 를 돌려준다.
     */
    public boolean send(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            return false;
        }
        if (sender == null) {
            log.info("[MAIL:LOG] to={} subject={}\n{}", to, subject, body);
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mail.from());
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            sender.send(message);
            log.info("mail sent to {} subject={}", to, subject);
            return true;
        } catch (RuntimeException e) {
            log.warn("mail send failed to={} subject={}: {}", to, subject, e.toString());
            return false;
        }
    }
}
