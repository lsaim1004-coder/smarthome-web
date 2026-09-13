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
