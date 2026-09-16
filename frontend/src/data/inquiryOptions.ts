/**
 * 상담 신청 양식의 선택지.
 *
 * 설계 원칙 — 신청자는 기기 이름을 모른다.
 *  - "Zigbee 모션 센서 3개" 가 아니라 "불이 저절로 켜지면 좋겠어요" 로 묻는다.
 *  - 고르고 나면 어느 패키지가 맞는지 폼이 알려 준다. 패키지 페이지를 왕복하지 않게 한다.
 *  - 신청자가 직접 셀 수 있는 수량만 묻는다(방 개수, 커튼 달 창 수). 스위치·센서 개수는 현장에서 정한다.
 *
 * `from` 은 그 항목이 실제로 들어가는 최소 패키지다. docs/견적.md 4-1 · packages.ts COMPARISON 과 맞춰야 한다.
 */

import type { PackageCode } from './packages'

/** 낮을수록 하위 패키지. 추천 계산에 쓴다. */
export const PACKAGE_RANK: Record<PackageCode, number> = {
  START: 0,
  BASIC: 1,
  STANDARD: 2,
  PREMIUM: 3,
  FULL: 4,
}

export type Choice = { code: string; label: string; note?: string }

/* ── 1단계. 어떤 집인가 ──────────────────────────────────────── */

export const HOME_TYPES: Choice[] = [
  { code: 'APT', label: '아파트' },
  { code: 'OFFICETEL', label: '오피스텔' },
  { code: 'HOUSE', label: '단독 · 빌라 · 주택' },
  { code: 'OTHER_SPACE', label: '상가 · 사무실 · 그 외' },
]

export const ROOM_COUNTS: Choice[] = [
  { code: 'R1', label: '원룸 · 1개' },
  { code: 'R2', label: '방 2개' },
  { code: 'R3', label: '방 3개' },
  { code: 'R4', label: '방 4개 이상' },
]

export const BUILD_STAGES: Choice[] = [
  { code: 'BEFORE', label: '인테리어 공사 전', note: '가장 좋은 시점입니다. 스위치 · 센서 위치를 같이 설계할 수 있습니다.' },
  { code: 'DURING', label: '공사 진행 중', note: '전기공사가 끝나기 전이면 아직 반영할 수 있습니다.' },
  { code: 'LIVING', label: '이미 살고 있음', note: '벽을 여는 공사 없이 되는 범위로 잡아 드립니다.' },
  { code: 'PLANNING', label: '아직 알아보는 중', note: '일정이 없어도 괜찮습니다. 가능한 구성만 먼저 보내 드립니다.' },
]

/* ── 2단계. 무엇을 바꾸고 싶은가 ─────────────────────────────── */

export type Interest = Choice & {
  /** 이 항목이 들어가는 최소 패키지 */
  from: PackageCode
  /** 커튼처럼 수량을 추가로 묻는 항목 */
  asksWindows?: boolean
}

export type InterestGroup = { key: string; title: string; hint: string; items: Interest[] }

export const INTEREST_GROUPS: InterestGroup[] = [
  {
    key: 'daily',
    title: '매일 쓰는 것',
    hint: '하루에 여러 번 손이 가는 일부터 고르시면 됩니다.',
    items: [
      {
        code: 'LIGHT',
        label: '조명',
        note: '방마다 스위치로, 또는 "다녀올게" 한 마디에 전체 소등',
        from: 'START',
      },
      {
        code: 'AIRCON',
        label: '에어컨 · 보일러',
        note: '집에 오기 전에 미리 켜 두기, 나가면 자동으로 끄기',
        from: 'STANDARD',
      },
      {
        code: 'CURTAIN',
        label: '전동 커튼 · 블라인드',
        note: '아침에 저절로 열리고 해 지면 닫힙니다',
        from: 'PREMIUM',
        asksWindows: true,
      },
      {
        code: 'CLEANER',
        label: '로봇청소기',
        note: '아무도 없을 때만 알아서 돌도록',
        from: 'STANDARD',
      },
      {
        code: 'VOICE',
        label: '음성으로 부르기',
        note: '빅스비 · Google 로 장면 실행',
        from: 'FULL',
      },
    ],
  },
  {
    key: 'safety',
    title: '없으면 불안한 것',
    hint: '집을 비웠을 때 알아야 하는 일들입니다.',
    items: [
      {
        code: 'SENSOR',
        label: '문 열림 · 움직임 알림',
        note: '비웠는데 문이 열리면 휴대폰으로',
        from: 'START',
      },
      {
        code: 'LEAK',
        label: '누수 · 온습도 경보',
        note: '세탁실 · 싱크대 밑 물 새면 바로 알림',
        from: 'BASIC',
      },
      {
        code: 'DOORLOCK',
        label: '도어락',
        note: '잠겼는지 밖에서 확인, 외출 장면에 포함',
        from: 'STANDARD',
      },
      {
        code: 'CCTV',
        label: '실내 CCTV',
        note: '반려동물 · 아이 방 확인용',
        from: 'PREMIUM',
      },
    ],
  },
  {
    key: 'manage',
    title: '한곳에서 관리하는 것',
    hint: '앱이 여러 개라 불편하셨다면 이쪽입니다.',
    items: [
      {
        code: 'MULTIBRAND',
        label: '삼성 · LG · 샤오미를 한 화면에',
        note: '쓰던 가전 그대로, 앱만 하나로',
        from: 'BASIC',
      },
      {
        code: 'LEGACY',
        label: '구형 가전도 같이',
        note: 'Wi-Fi 도 앱 등록도 안 되는 에어컨 · TV 를 리모컨 허브로',
        from: 'BASIC',
      },
      {
        code: 'ENERGY',
        label: '전기 사용량 보기',
        note: '가전별로 얼마 쓰는지 한 화면에. 플러그에 물린 기기 측정은 기본 포함',
        from: 'PREMIUM',
      },
      {
        code: 'TABLET',
        label: '벽에 붙은 태블릿',
        note: '휴대폰을 찾지 않아도 되는 고정 화면',
        from: 'PREMIUM',
      },
    ],
  },
]

export const ALL_INTERESTS: Interest[] = INTEREST_GROUPS.flatMap((g) => g.items)

export function findInterest(code: string): Interest | undefined {
  return ALL_INTERESTS.find((i) => i.code === code)
}

export const WINDOW_COUNTS: Choice[] = [
  { code: 'W1', label: '1창' },
  { code: 'W2', label: '2창' },
  { code: 'W3', label: '3창' },
  { code: 'W4', label: '4창 이상' },
  { code: 'W_UNSURE', label: '아직 모르겠음' },
]

/* ── 3단계. 지금 쓰는 가전 ───────────────────────────────────── */

/** ApplianceService.BRANDS 와 코드가 같아야 한다. */
export const BRANDS: Choice[] = [
  { code: 'SAMSUNG', label: '삼성', note: 'SmartThings' },
  { code: 'LG', label: 'LG', note: 'ThinQ' },
  { code: 'WINIA', label: '위니아' },
  { code: 'XIAOMI', label: '샤오미', note: 'Mi Home' },
  { code: 'CUCKOO', label: '쿠쿠' },
  { code: 'COWAY', label: '코웨이' },
  { code: 'ETC_BRAND', label: '그 외 브랜드' },
  { code: 'UNSURE', label: '모르겠음' },
]

/**
 * 보유 가전 항목. IoT 로 묶을 수 있는 후보군을 이 단위로 받는다.
 *
 * `labelSpot` 은 모델명 스티커가 보통 어디 붙어 있는지다. 사진을 이 라벨이 보이게 찍어 주시면
 * 모델명만으로 구형·신형과 연동 경로를 바로 가릴 수 있어서 상담이 훨씬 빨라진다.
 * `core` 는 거의 모든 집에 있는 필수 가전이라 목록 앞에 둔다.
 */
export type ApplianceKind = Choice & { labelSpot: string; core?: boolean }

/** ApplianceService.KINDS 와 코드가 같아야 한다. */
export const APPLIANCE_KINDS: ApplianceKind[] = [
  { code: 'FRIDGE', label: '냉장고', core: true, labelSpot: '문을 열면 안쪽 옆면에 붙은 스티커' },
  { code: 'WASHER', label: '세탁기', core: true, labelSpot: '문 안쪽 테두리, 없으면 뒷면' },
  { code: 'TV', label: 'TV', core: true, labelSpot: '화면 뒷면 아래쪽 라벨' },
  { code: 'AIRCON', label: '에어컨', core: true, labelSpot: '실내기 옆면, 없으면 필터 커버를 열면 안쪽' },
  { code: 'DRYER', label: '건조기', labelSpot: '문 안쪽 테두리' },
  { code: 'STYLER', label: '의류관리기', labelSpot: '문 안쪽 테두리' },
  { code: 'ROBOT', label: '로봇청소기', labelSpot: '본체를 뒤집으면 바닥 라벨' },
  { code: 'AIRPURIFIER', label: '공기청정기', labelSpot: '뒷면 또는 바닥' },
  { code: 'DISHWASHER', label: '식기세척기', labelSpot: '문 안쪽 테두리' },
  { code: 'RANGE', label: '전기레인지 · 오븐', labelSpot: '아래 서랍을 열면 안쪽, 또는 측면' },
  { code: 'WATERPURIFIER', label: '정수기', labelSpot: '뒷면 또는 바닥' },
  { code: 'BOILER', label: '보일러', labelSpot: '본체 앞면 라벨' },
  { code: 'DOORLOCK', label: '도어락', labelSpot: '실내쪽 덮개를 열면 배터리 칸 옆' },
  { code: 'ETC', label: '그 외', labelSpot: '제품 뒷면 또는 바닥 라벨' },
]

export function findKind(code: string): ApplianceKind | undefined {
  return APPLIANCE_KINDS.find((k) => k.code === code)
}

/** ApplianceService.PURCHASED 와 코드가 같아야 한다. */
export const PURCHASED: Choice[] = [
  { code: 'Y1', label: '1년 이내' },
  { code: 'Y3', label: '1~3년' },
  { code: 'Y5', label: '3~5년' },
  { code: 'Y10', label: '5~10년' },
  { code: 'Y10P', label: '10년 이상' },
  { code: 'UNSURE', label: '모르겠음' },
]

/** 관리자 판정 값. ApplianceService 의 ERAS · IOT_STATUSES 와 코드가 같아야 한다. */
export const ERAS: Choice[] = [
  { code: 'NEW', label: '신형', note: '앱 등록이 되는 세대' },
  { code: 'OLD', label: '구형', note: '앱 등록이 안 되는 세대' },
  { code: 'UNKNOWN', label: '판정 보류' },
]

export const IOT_STATUSES: Choice[] = [
  { code: 'APP', label: '앱 연동', note: '제조사 계정으로 바로 묶임' },
  { code: 'IR', label: '리모컨 허브', note: 'Tapo H110 같은 IR 허브 경유' },
  { code: 'NONE', label: '연동 불가', note: '교체 전에는 방법 없음' },
  { code: 'UNKNOWN', label: '확인 필요' },
]

/** 한 대에 붙일 수 있는 사진 수. 라벨 사진 + 전체 사진이면 충분하다. */
export const MAX_PHOTOS_PER_APPLIANCE = 3

/** 한 신청 전체 사진 수. ApplianceService.MAX_PHOTOS_PER_INQUIRY 와 맞춰야 한다. */
export const MAX_PHOTOS_PER_INQUIRY = 12

/** 한 장 최대 크기(바이트). ApplianceService.MAX_BYTES 와 맞춰야 한다. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/* ── 4단계. 패키지 추천 ──────────────────────────────────────── */

/**
 * 고른 항목 중 가장 상위 패키지를 요구하는 것에 맞춘다.
 * 아무것도 고르지 않았으면 추천하지 않는다(억지로 밀지 않는다).
 */
export function recommendPackage(interestCodes: string[]): { code: PackageCode; because: Interest[] } | null {
  const picked = interestCodes.map(findInterest).filter((i): i is Interest => !!i)
  if (picked.length === 0) return null

  let best: PackageCode = 'START'
  for (const i of picked) {
    if (PACKAGE_RANK[i.from] > PACKAGE_RANK[best]) best = i.from
  }
  // 그 패키지를 필요하게 만든 항목만 근거로 보여 준다
  const because = picked.filter((i) => i.from === best)
  return { code: best, because }
}

export const PACKAGE_UNDECIDED = 'UNDECIDED'

/* ── 저장된 코드 → 사람이 읽는 라벨 (관리자 화면용) ─────────────── */

export function labelFor(code: string | null | undefined, list: Choice[]): string | null {
  if (!code) return null
  return list.find((c) => c.code === code)?.label ?? code
}

/** 쉼표로 저장된 코드 묶음을 라벨 배열로 편다. */
export function labelsFor(csv: string | null | undefined, list: Choice[]): string[] {
  if (!csv) return []
  return csv
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => list.find((x) => x.code === c)?.label ?? c)
}
