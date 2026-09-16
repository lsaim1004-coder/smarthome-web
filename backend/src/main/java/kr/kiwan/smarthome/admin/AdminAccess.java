package kr.kiwan.smarthome.admin;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import kr.kiwan.smarthome.auth.AuthDtos.AuthUser;
import kr.kiwan.smarthome.auth.UserRepository;
import kr.kiwan.smarthome.auth.UserRepository.UserRow;
import kr.kiwan.smarthome.common.ApiException;

/**
 * 관리자 서버의 권한 판정 한 곳.
 *
 * 세션에 구운 역할을 믿지 않고 요청마다 DB 를 본다. 업체 담당을 내리거나 계정을 막았을 때
 * 그 사람이 로그아웃할 때까지 기다릴 수 없기 때문이다.
 *
 * OWNER  : 전부 본다.
 * PARTNER: 자기 업체가 담당인 건만 본다 (scope() 가 업체 id 를 돌려준다).
 */
@Component
public class AdminAccess {

    private final UserRepository users;

    public AdminAccess(UserRepository users) {
        this.users = users;
    }

    /** 로그인한 관리자. 아니면 403. */
    public UserRow require(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser principal)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자만 접근할 수 있습니다.");
        }
        UserRow row = users.findById(principal.id())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "계정을 찾을 수 없습니다."));
        if (!row.active() || !row.staff()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "관리자 권한이 없습니다.");
        }
        return row;
    }

    /** 운영자만. 상품 구성·업체·계정처럼 업체가 건드리면 안 되는 것에 쓴다. */
    public UserRow requireOwner(Authentication authentication) {
        UserRow row = require(authentication);
        if (!row.owner()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "운영자만 바꿀 수 있습니다.");
        }
        return row;
    }

    /** 목록을 어디까지 보여 줄지. null 이면 전부(운영자). */
    public Long scope(UserRow row) {
        return row.owner() ? null : row.partnerId();
    }

    /** 이 건이 그 사람 소관인지. */
    public void requireOwns(UserRow row, Long ownerPartnerId) {
        if (row.owner()) {
            return;
        }
        if (row.partnerId() == null || !row.partnerId().equals(ownerPartnerId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "담당이 아닌 건입니다.");
        }
    }

    public String actor(UserRow row) {
        return row.email();
    }
}
