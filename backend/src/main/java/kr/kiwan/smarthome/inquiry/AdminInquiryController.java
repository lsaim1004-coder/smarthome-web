package kr.kiwan.smarthome.inquiry;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import kr.kiwan.smarthome.AppProperties;
import kr.kiwan.smarthome.auth.AuthDtos.AuthUser;
import kr.kiwan.smarthome.common.ApiException;
import kr.kiwan.smarthome.inquiry.InquiryDtos.InquiryResponse;
import kr.kiwan.smarthome.inquiry.InquiryDtos.UpdateRequest;

/**
 * 상담 신청 관리. 로그인 계정의 이메일이 app.admin-emails 에 있을 때만 통과한다.
 * 세션에 권한을 굽지 않고 요청마다 설정을 확인하므로, 관리자 목록을 바꾸면 재로그인 없이 반영된다.
 */
@RestController
@RequestMapping("/api/admin/inquiries")
public class AdminInquiryController {

    public record ListResponse(List<InquiryResponse> items, int total, List<String> statuses) {}

    private final InquiryService inquiries;
    private final AppProperties props;

    public AdminInquiryController(InquiryService inquiries, AppProperties props) {
        this.inquiries = inquiries;
        this.props = props;
    }

    @GetMapping
    public ListResponse list(@RequestParam(required = false) String status,
                             @RequestParam(defaultValue = "100") int limit,
                             @RequestParam(defaultValue = "0") int offset,
                             Authentication authentication) {
        requireAdmin(authentication);
        int capped = Math.clamp(limit, 1, 500);
        return new ListResponse(inquiries.list(status, capped, Math.max(offset, 0)),
                inquiries.count(status), InquiryService.STATUSES);
    }

    @PatchMapping("/{id}")
    public InquiryResponse update(@PathVariable long id,
                                  @Valid @RequestBody UpdateRequest req,
                                  Authentication authentication) {
        requireAdmin(authentication);
        return inquiries.update(id, req.status(), req.memo());
    }

    private void requireAdmin(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser user)
                || !props.isAdmin(user.email())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
        }
    }
}
