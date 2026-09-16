CREATE TABLE IF NOT EXISTS welcome_visits (
  id         INTEGER PRIMARY KEY,
  visits     BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO welcome_visits (id, visits) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- 회원 (이메일 + 비밀번호). email 은 소문자로 정규화해 저장
CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  name              TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at     TIMESTAMPTZ
);

-- 이메일 인증번호 (해시 저장, 만료·시도횟수 관리)
CREATE TABLE IF NOT EXISTS email_verifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_created
  ON email_verifications (user_id, created_at DESC);
-- 상담 신청. 비로그인도 접수할 수 있고, 로그인 상태면 user_id 를 남긴다.
-- status: NEW(접수) → CONTACTED(연락함) → QUOTED(견적발송) → WON(계약) / LOST(무산)
CREATE TABLE IF NOT EXISTS inquiries (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  region       TEXT,
  area_pyeong  INTEGER,
  package_code TEXT,
  move_in      TEXT,
  channel      TEXT,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'NEW',
  memo         TEXT,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  client_ip    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries (status, created_at DESC);

-- 2026-09-16 상담 신청 양식 개편.
-- 신청자가 "내 집 얘기 → 원하는 것 → 쓰는 가전 → 패키지 → 연락처" 순으로 채우도록 바꾸면서
-- 견적을 짤 때 실제로 필요한 항목을 받는다. 평형(area_pyeong)은 과거 접수 건 조회용으로만 남는다.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS home_type    TEXT;  -- 아파트 / 오피스텔 / 단독·빌라 / 상가
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS room_count   TEXT;  -- 방 개수 구간
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS build_stage  TEXT;  -- 공사 전 / 공사 중 / 거주 중
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS interests    TEXT;  -- 관심 항목 코드, 쉼표 구분
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS brands       TEXT;  -- 보유 가전 브랜드 코드, 쉼표 구분
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS window_count TEXT;  -- 전동 커튼·블라인드 희망 창 수

-- 2026-09-16 보유 가전 목록 + 사진 첨부.
-- 신청자가 냉장고·세탁기·TV·에어컨 같은 항목별로 모델명과 구매 시기를 적고, 알면 사진도 올린다.
-- 판정 칸(detected_model / era / iot_status)은 나중에 사진을 분석해 채운다. 접수 시점에는 비어 있다.
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS upload_token      TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS inquiry_appliances (
  id             BIGSERIAL PRIMARY KEY,
  inquiry_id     BIGINT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,   -- FRIDGE / WASHER / DRYER / TV / AIRCON / ...
  brand          TEXT,            -- 신청자가 고른 브랜드 코드
  model_name     TEXT,            -- 신청자가 적은 모델명 (모르면 비움)
  purchased      TEXT,            -- 구매 시기 구간 코드
  note           TEXT,
  -- 아래는 사진 분석 결과로 채우는 칸
  detected_model TEXT,
  era            TEXT,            -- OLD / NEW / UNKNOWN
  iot_status     TEXT,            -- APP(제조사 앱 연동) / IR(리모컨 허브) / NONE(불가) / UNKNOWN
  analysis_note  TEXT,
  analyzed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiry_appliances_inquiry ON inquiry_appliances (inquiry_id, id);
CREATE INDEX IF NOT EXISTS idx_inquiry_appliances_iot ON inquiry_appliances (iot_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiry_appliances_pending ON inquiry_appliances (analyzed_at, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_photos (
  id            BIGSERIAL PRIMARY KEY,
  inquiry_id    BIGINT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  appliance_id  BIGINT REFERENCES inquiry_appliances(id) ON DELETE CASCADE,
  stored_name   TEXT NOT NULL,   -- 디스크 경로 (<inquiryId>/<uuid>.<ext>)
  original_name TEXT,
  content_type  TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inquiry_photos_inquiry ON inquiry_photos (inquiry_id, id);
CREATE INDEX IF NOT EXISTS idx_inquiry_photos_appliance ON inquiry_photos (appliance_id, id);

-- ---------------------------------------------------------------------------
-- 2026-09-16 관리자 분리 (iot-admin.kiwan.kr) · 업체(파트너) 구조 · 상품 구성 DB화
--
-- 공개 사이트(iot.kiwan.kr)는 로그인을 없애고 접수만 받는다. 로그인해서 보던 것은 전부
-- 관리자 서버로 옮긴다. 업체를 모집하면 업체 계정이 자기 담당 건만 보게 되므로,
-- 지금부터 계정에 역할(role)과 소속 업체(partner_id)를 달아 둔다.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS partners (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,   -- 짧은 식별자 (영문 대문자)
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  region        TEXT,                   -- 담당 지역 메모
  memo          TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 역할: OWNER(운영자, 전부 봄) / PARTNER(업체, 자기 담당 건만) / USER(일반 — 관리자 로그인 불가)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role       TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id BIGINT REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active     BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role, created_at DESC);

ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS partner_id BIGINT REFERENCES partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inquiries_partner ON inquiries (partner_id, created_at DESC);

-- 패키지 구성. 지금까지 프런트 상수(frontend/src/data/packages.ts)에 박혀 있어 값 하나 고치려면
-- 코드를 고치고 다시 배포해야 했다. DB 로 옮기고 관리자 화면에서 고친다.
-- 목록형 항목은 순서가 뜻을 가지므로 JSONB 배열로 그대로 둔다.
CREATE TABLE IF NOT EXISTS site_packages (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  tagline       TEXT,
  price         BIGINT NOT NULL DEFAULT 0,
  install_fee   BIGINT NOT NULL DEFAULT 0,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  summary       TEXT,
  hours         TEXT,
  devices       JSONB NOT NULL DEFAULT '[]'::jsonb,
  commissioning JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenes        JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT
);

-- 패키지 비교표 한 줄. levels 는 패키지 순서대로 0(없음)/1(포함)/2(강조).
CREATE TABLE IF NOT EXISTS site_comparison (
  id         BIGSERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  levels     JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 표준 스택 제품. from_package 는 "어느 패키지부터 들어가는지".
CREATE TABLE IF NOT EXISTS site_products (
  id           BIGSERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,   -- ProductShot 일러스트 종류
  brand        TEXT NOT NULL,
  model        TEXT NOT NULL,
  role         TEXT,
  link         TEXT,
  from_package TEXT,
  note         TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 사진 자동판별. 사진은 모델명만 읽으면 되므로, 읽어낸 뒤에는 원본을 지우고 글자만 남긴다.
-- analysis_source: AI(사진 판독) / RULE(구매시기·브랜드 규칙) / MANUAL(사람이 고침)
ALTER TABLE inquiry_appliances ADD COLUMN IF NOT EXISTS analysis_source   TEXT;
ALTER TABLE inquiry_appliances ADD COLUMN IF NOT EXISTS confidence        NUMERIC(3,2);
ALTER TABLE inquiry_appliances ADD COLUMN IF NOT EXISTS analysis_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inquiry_appliances ADD COLUMN IF NOT EXISTS analysis_error    TEXT;
ALTER TABLE inquiry_photos     ADD COLUMN IF NOT EXISTS purged_at         TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_inquiry_photos_purge ON inquiry_photos (purged_at, created_at);

-- 관리자가 무엇을 고쳤는지 남긴다. 업체 계정이 늘어나면 이 기록이 필요해진다.
CREATE TABLE IF NOT EXISTS admin_audit (
  id         BIGSERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at DESC);
