# smarthome-web

**Smart Home Option Service** 소개 웹. 인테리어 공사에 스마트홈 옵션을 더해 "입주하는 날 완성된 스마트홈"을 제공하는 서비스의 웹사이트입니다.

현재 v0.2 — 연결 상태를 보여주는 **웰컴 페이지**와 **이메일 인증 기반 회원가입·로그인**이 있습니다.

## 서비스 구상

> 전문은 [docs/business-plan.md](docs/business-plan.md) · 시장 조사와 원가는 [docs/견적.md](docs/견적.md)

**인테리어 업체를 통해 판매하는 스마트홈 옵션.** 기기를 파는 게 아니라 "입주하는 날 완성되어 있는 스마트홈"을 판다.

```
[인테리어 업체] ──옵션 제안──▶ [스마트홈 전문업체] ──설계·제품선정·네트워크·설치·연동·자동화·A/S──▶ [고객]
```

- **포지셔닝**: IoT 설치업체가 아닌 **스마트홈 컨설팅 + 커미셔닝(SI)**. 고객이 겪는 문제는 구매가 아니라 연결(삼성→SmartThings, LG→ThinQ, 커튼·도어락은 별도 앱, Wi-Fi 끊김, 월패드 호환성)이다.
- **인테리어 업체가 얻는 것**: 견적에 옵션 한 줄 추가로 객단가 상승, 새 영업 상품, 입주 고객 만족. 기술 학습·관리 부담 없음(소개수수료 10~20%).
- **공정 삽입**: 상담 → 옵션 선택 → **전기·통신 설계** → 공사 → IoT 설치 → 가전 입고 → 통합 → 입주 → 자동화 세팅. 전기공사 단계에 스위치·센서·통신선을 미리 반영한다.

| 패키지 (34평 기준) | 판매가 (부가세 포함) | 구성 요약 |
| --- | --- | --- |
| START · 외출/귀가 자동화 입문 | 99만원 | 허브, 스위치 3, 모션 2, 문센서 2, 플러그 2, 온습도 1, 자동화 2 |
| BASIC · 34평 기본 자동화 | 149만원 | 허브, 스위치 5, 센서 9(모션·문·온습도·누수), 플러그 3, 가전 2종 연동, 자동화 3 |
| **STANDARD · 34평 표준 (주력)** | **249만원** | 허브, 스위치 6, 센서 11, 플러그 3, 도어락·에어컨·로봇청소기 연동, 자동화 4 |
| PREMIUM · 풀 스마트홈 + 세대 HA | 449만원 | STANDARD + 전실 스위치 10, 전동커튼 2, CCTV, Aqara M3, 메시 Wi-Fi, N100 미니PC(Home Assistant) |
| FULL HOME · 전실 + 커튼 4 + 도어락 신규 | 699만원 | PREMIUM + 커튼 4, 도어락 신규, 스위치 12, 음성 연동, 자동화 8 |

  2026-09-11 시장 조사로 재편한 가격. 기획안 원문의 30~50 / 100~180 / 250~500만원은 외주 시공·설계비를 넣으면 원가에 미치지 못해 폐기했다. 원가·시장 가격대·사업자 순이익 계산은 [docs/견적.md](docs/견적.md) 4장(`tools/estimate.py` 로 재생성).

- **진짜 상품은 자동화**: 외출(도어락 잠금→조명·에어컨 OFF→커튼 CLOSE), 귀가, 취침("잘게"), 청소(외출 감지→로봇청소기) 같은 생활 장면.
- **서비스 4단계**: 진단(Wi-Fi 음영·2.4GHz·AP·단자함) → 통합(SmartThings·Matter·Zigbee·제조사 앱) → 설치(커튼·센서·스위치·플러그·도어락) → 커미셔닝(기기 등록·공간·자동화·음성·교육).
- **초기 표준**: SmartThings + Matter + Zigbee 로 한정하고 제품 라인업을 고정해 A/S 를 줄인다. 처음부터 모든 브랜드를 다루지 않는다.
- **단계**: PoC(인테리어 업체 1곳, 옵션 3종, 5~10세대) → 상품화(제품 고정) → 업체 확대(1→3→10). 장기적으로 연 단위 유지관리(스마트홈 케어) 매출까지.
- **운영 방식 2트랙** (2026-09-11 추가):

  | 구분 | A. 세대 설치형 | B. 중앙 관제형 |
  | --- | --- | --- |
  | 형태 | 패키지에 **소형 PC(N100 미니PC)** 를 포함해 고객이 구매, 집 안에 Home Assistant 를 설치·세팅 | 세대 PC 는 동일하게 설치하되 **아웃바운드 터널**로 사업자 관제 서버에 연결해 상시 모니터링 |
  | 과금 | 일회성 (기기 + 설치 + 세팅), 선택 A/S | 월/연 구독 (스마트홈 케어) + 초기 설치비 |
  | 데이터 | 집 안에만 저장, 원격 점검은 동의 시 임시 연결 | 상태·오류 정보가 관제 서버로 전달 (동의 필수, 항목 최소화) |
  | 장애 대응 | 고객 연락 후 원격/방문 | 끊김·오동작을 먼저 감지해 선제 대응 |
  | 필요 인프라 | 없음 (세대 PC 만) | 관제 서버(N100 급) + VPN 허브 + 모니터링 + 알림 |
  | 적합 대상 | 인테리어 옵션 판매, 개인정보 민감 고객, PoC 단계 | 다세대(건설·분양 채널), A/S 콜을 줄이려는 파트너, 유지관리 매출 |

  PoC 는 A 로 시작하고, 세대 10곳 이상이 되면 B 의 관제 서버를 도입한다. 자세한 원가는 [docs/견적.md](docs/견적.md).
- **미결 검토 항목**: 소개수수료를 반영한 마진 산식, 전기공사업·정보통신공사업 등록 범위, 중성선 없는 스위치 박스, 난방·가스밸브·월패드 연동, 국내 도어락의 SmartThings 연동 가능 제품, PoC KPI(세대당 시공 시간·A/S 콜 수).

이 저장소는 위 서비스의 웹(소개·회원·상담 접수)을 만드는 프로젝트다.

## 스택

| 구성 | 기술 | 컨테이너 |
| --- | --- | --- |
| Frontend | React 18 · TypeScript · Vite 6 (모바일 우선 반응형) | `node:22-alpine` 빌드 → `nginx:1.27-alpine` 서빙, `/api/` 를 백엔드로 프록시 |
| Backend | Java 21 · Spring Boot 3.5 (`web`, `jdbc`, `validation`) | `maven:3.9-eclipse-temurin-21` 빌드 → `eclipse-temurin:21-jre-alpine` |
| Database | PostgreSQL 16 | `postgres:16-alpine`, 볼륨 `dbdata` |

세 서비스는 `docker-compose.yml` 하나로 빌드·기동합니다. 외부로 열리는 포트는 frontend의 80만입니다.

```
브라우저 ──▶ frontend(nginx :80) ──/api/──▶ backend(Spring Boot :8080) ──▶ db(PostgreSQL :5432)
```

## 디렉터리

```
docker-compose.yml     # 세 서비스 정의
.env.example           # DB_PASSWORD 예시 (실제 .env 는 커밋하지 않음)
backend/               # Spring Boot 앱 + Dockerfile
frontend/              # React 앱 + Dockerfile + nginx/default.conf
deploy/                # 서버(Debian 12 LXC) 준비·배포 스크립트
docs/landing-draft/    # 다음 단계용 상세 랜딩페이지 초안(정적 HTML)
```

## 실행

```bash
cp .env.example .env          # DB_PASSWORD 를 실제 값으로 변경
docker compose up -d --build
curl http://localhost/api/health
```

- `http://localhost/` — 웰컴 페이지
- `GET /api/welcome` — 서비스명·메시지·백엔드/DB 정보. 호출마다 DB 방문 카운터가 1 증가합니다
- `GET /api/health` — DB 연결 확인. 정상 200, DB 불가 503

프론트만 개발할 때는 `frontend/` 에서 `npm install && npm run dev` (Vite dev 서버가 `/api` 를 `localhost:8080` 으로 프록시), 백엔드는 `backend/` 에서 `./mvnw` 없이 `mvn spring-boot:run` 으로 띄우면 됩니다.

## 회원 · 로그인

이메일 + 비밀번호 계정이며, **이메일 인증번호를 확인한 계정만 로그인**할 수 있습니다.

```
회원가입 ──▶ 인증번호 발급(6자리, 10분 유효, 5회 제한) ──▶ 인증 완료 ──▶ 로그인(세션 쿠키)
```

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/register` | `{email, password, name?}` 가입 + 인증번호 발급. 미인증 계정은 재가입 시 비밀번호를 갈아끼움 |
| POST | `/api/auth/verify` | `{email, code}` 인증 완료 |
| POST | `/api/auth/resend` | `{email}` 인증번호 재발송 (60초 쿨다운) |
| POST | `/api/auth/login` | `{email, password}` → 세션 쿠키 `SHSESSION`. 미인증이면 `403 EMAIL_NOT_VERIFIED` |
| GET | `/api/auth/me` | 로그인 상태 `{authenticated, user}` |
| POST | `/api/auth/logout` | 세션 종료 |

- 비밀번호는 BCrypt, 인증번호는 SHA-256 해시로 저장. 세션은 Spring Session JDBC 로 DB(`SPRING_SESSION`)에 보관되어 백엔드를 재시작해도 유지됩니다.
- `/api/auth/` 는 nginx 에서 IP 당 분당 10회로 제한합니다 (Cloudflare 실제 IP 기준).
- **메일 발송**: `.env` 의 `APP_MAIL_MODE` 가 `log` 면 메일을 보내지 않고 백엔드 로그와 API 응답(`devCode`)에 인증번호를 표시합니다(개발용). `smtp` 로 바꾸고 `APP_MAIL_HOST/PORT/USERNAME/PASSWORD/FROM` 을 채우면 실제 발송합니다.
- 화면: `/register` → `/verify` → `/login` → `/me`. 로그인하면 헤더에 이름(이메일)과 로그아웃 버튼이 보입니다.

## 배포

Proxmox 위 Debian 12 LXC(Docker 설치)에서 운영합니다.

1. `deploy/docker-install.sh` — Docker CE + compose plugin 설치 (1회)
2. 소스를 `tar czf` 로 묶어 서버 `/root/smarthome-web.tgz` 로 전송
3. `deploy/deploy.sh <DB_PASSWORD>` — `/opt/smarthome-web` 에 풀고 `docker compose build && up -d`, 헬스체크 대기

리버스 프록시(Nginx Proxy Manager)와 Cloudflare 뒤에 두고 HTTPS 도메인으로 서비스합니다.

## 로드맵

- [ ] 랜딩페이지 이식: 패키지 3종, 자동화 장면, 진행 절차, 인테리어 파트너 제안, FAQ (`docs/landing-draft/` 참고)
- [x] 이메일 인증 회원가입·로그인 (v0.2)
- [ ] 상담 신청 폼 + `POST /api/inquiries` + 관리자 목록
- [ ] 비밀번호 재설정(이메일 인증번호 재사용)
- [ ] DB 마이그레이션 도구(Flyway) 도입
