package kr.kiwan.smarthome.inquiry;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import kr.kiwan.smarthome.auth.AuthDtos.AuthUser;
import kr.kiwan.smarthome.inquiry.InquiryDtos.CreateRequest;
import kr.kiwan.smarthome.inquiry.InquiryDtos.CreateResponse;

/** 상담 신청 접수. 로그인 없이도 보낼 수 있다(요청 제한은 nginx 의 inquiry zone). */
@RestController
@RequestMapping("/api/inquiries")
public class InquiryController {

    private final InquiryService inquiries;

    public InquiryController(InquiryService inquiries) {
        this.inquiries = inquiries;
    }

    @PostMapping
    public ResponseEntity<CreateResponse> create(@Valid @RequestBody CreateRequest req,
                                                 Authentication authentication,
                                                 HttpServletRequest request) {
        Long userId = (authentication != null && authentication.getPrincipal() instanceof AuthUser user)
                ? user.id() : null;
        inquiries.create(req, userId, request.getRemoteAddr());
        return ResponseEntity.status(HttpStatus.CREATED).body(new CreateResponse(true,
                "상담 신청이 접수되었습니다. 영업일 기준 1~2일 안에 연락드리겠습니다."));
    }
}
