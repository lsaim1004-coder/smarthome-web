# smarthome-web

**Smart Home Option Service** 소개 웹. 인테리어 공사에 스마트홈 옵션을 더해 "입주하는 날 완성된 스마트홈"을 제공하는 서비스의 웹사이트입니다.

현재 v0.2 — 연결 상태를 보여주는 **웰컴 페이지**와 **이메일 인증 기반 회원가입·로그인**이 있습니다.

## 서비스 구상

> 전문은 [docs/business-plan.md](docs/business-plan.md)

**인테리어 업체를 통해 판매하는 스마트홈 옵션.** 기기를 파는 게 아니라 "입주하는 날 완성되어 있는 스마트홈"을 판다.

```
[인테리어 업체] ──옵션 제안──▶ [스마트홈 전문업체] ──설계·제품선정·네트워크·설치·연동·자동화·A/S──▶ [고객]
```

- **포지셔닝**: IoT 설치업체가 아닌 **스마트홈 컨설팅 + 커미셔닝(SI)**. 고객이 겪는 문제는 구매가 아니라 연결(삼성→SmartThings, LG→ThinQ, 커튼·도어락은 별도 앱, Wi-Fi 끊김, 월패드 호환성)이다.
- **인테리어 업체가 얻는 것**: 견적에 옵션 한 줄 추가로 객단가 상승, 새 영업 상품, 입주 고객 만족. 기술 학습·관리 부담 없음(소개수수료 10~20%).
- **공정 삽입**: 상담 → 옵션 선택 → **전기·통신 설계** → 공사 → IoT 설치 → 가전 입고 → 통합 → 입주 → 자동화 세팅. 전기공사 단계에 스위치·센서·통신선을 미리 반영한다.

| 패키지 | 예상 판매가 | 구성 |
| --- | --- | --- |
| BASIC 스마트홈 준비 | 30~50만원 | Wi-Fi 점검, 공유기/AP, 허브, 플러그·센서 일부, 기본 자동화 |
| **STANDARD 스마트홈 패키지 (주력)** | 100~180만원 | 조명/스위치, 커튼, 플러그, 센서, 도어락 연동, SmartThings, 자동화 5~10개, 입주 후 세팅 |
| PREMIUM 올인원 | 250~500만원+ | 네트워크 설계·AP/유선망, 전동커튼, 가전·로봇청소기·에어컨 연동, Scene, 교육, 유지관리 |

- **진짜 상품은 자동화**: 외출(도어락 잠금→조명·에어컨 OFF→커튼 CLOSE), 귀가, 취침("잘게"), 청소(외출 감지→로봇청소기) 같은 생활 장면.
- **서비스 4단계**: 진단(Wi-Fi 음영·2.4GHz·AP·단자함) → 통합(SmartThings·Matter·Zigbee·제조사 앱) → 설치(커튼·센서·스위치·플러그·도어락) → 커미셔닝(기기 등록·공간·자동화·음성·교육).
- **초기 표준**: SmartThings + Matter + Zigbee 로 한정하고 제품 라인업을 고정해 A/S 를 줄인다. 처음부터 모든 브랜드를 다루지 않는다.
- **단계**: PoC(인테리어 업체 1곳, 옵션 3종, 5~10세대) → 상품화(제품 고정) → 업체 확대(1→3→10). 장기적으로 연 단위 유지관리(스마트홈 케어) 매출까지.
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
