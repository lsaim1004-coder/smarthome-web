/**
 * 코드 → 한글 라벨.
 *
 * 백엔드(InquiryService · ApplianceService)와 공개 폼(frontend/src/data/inquiryOptions.ts)이
 * 쓰는 코드와 같아야 한다. 셋 중 하나를 고치면 나머지도 같이 고칠 것.
 */

export const STATUS_LABELS: Record<string, string> = {
  NEW: '접수',
  CONTACTED: '연락함',
  QUOTED: '견적발송',
  WON: '계약',
  LOST: '무산',
}

export const STATUS_COLORS: Record<string, string> = {
  NEW: 'primary',
  CONTACTED: 'info',
  QUOTED: 'warning',
  WON: 'success',
  LOST: 'secondary',
}

export const HOME_TYPES: Record<string, string> = {
  APT: '아파트',
  OFFICETEL: '오피스텔',
  HOUSE: '단독·빌라·주택',
  OTHER_SPACE: '상가·사무실·그 외',
}

export const ROOM_COUNTS: Record<string, string> = {
  R1: '원룸·방 1개',
  R2: '방 2개',
  R3: '방 3개',
  R4: '방 4개 이상',
}

export const BUILD_STAGES: Record<string, string> = {
  BEFORE: '인테리어 공사 전',
  DURING: '공사 진행 중',
  LIVING: '이미 거주 중',
  PLANNING: '아직 알아보는 중',
}

export const INTERESTS: Record<string, string> = {
  LIGHT: '조명',
  AIRCON: '에어컨·보일러',
  CURTAIN: '전동 커튼·블라인드',
  CLEANER: '로봇청소기',
  VOICE: '음성 제어',
  SENSOR: '문열림·움직임 알림',
  LEAK: '누수·온습도 경보',
  DOORLOCK: '도어락',
  CCTV: '실내 CCTV',
  MULTIBRAND: '브랜드 통합(삼성·LG·샤오미)',
  LEGACY: '구형 가전 리모컨 허브',
  ENERGY: '기기별 전기 사용량',
  TABLET: '벽면 태블릿 대시보드',
}

export const WINDOW_COUNTS: Record<string, string> = {
  W1: '1창',
  W2: '2창',
  W3: '3창',
  W4: '4창 이상',
  W_UNSURE: '미정',
}

export const BRANDS: Record<string, string> = {
  SAMSUNG: '삼성',
  LG: 'LG',
  WINIA: '위니아',
  XIAOMI: '샤오미',
  CUCKOO: '쿠쿠',
  COWAY: '코웨이',
  ETC_BRAND: '그 외 브랜드',
  UNSURE: '모름',
}

export const APPLIANCE_KINDS: Record<string, string> = {
  FRIDGE: '냉장고',
  WASHER: '세탁기',
  DRYER: '건조기',
  TV: 'TV',
  AIRCON: '에어컨',
  AIRPURIFIER: '공기청정기',
  ROBOT: '로봇청소기',
  DISHWASHER: '식기세척기',
  RANGE: '전기레인지·오븐',
  WATERPURIFIER: '정수기',
  BOILER: '보일러',
  DOORLOCK: '도어락',
  STYLER: '스타일러·의류관리기',
  ETC: '그 외',
}

export const PURCHASED: Record<string, string> = {
  Y1: '1년 이내',
  Y3: '3년 이내',
  Y5: '5년 이내',
  Y10: '10년 이내',
  Y10P: '10년 이상',
  UNSURE: '모름',
}

export const ERAS: Record<string, string> = {
  NEW: '신형',
  OLD: '구형',
  UNKNOWN: '미확인',
}

export const IOT_STATUSES: Record<string, string> = {
  APP: '제조사 앱 연동',
  IR: '리모컨 허브',
  NONE: '연동 불가',
  UNKNOWN: '미확인',
}

export const IOT_COLORS: Record<string, string> = {
  APP: 'success',
  IR: 'warning',
  NONE: 'secondary',
  UNKNOWN: 'light',
}

export const ANALYSIS_SOURCES: Record<string, string> = {
  AI: '사진 판독',
  RULE: '규칙 추정',
  MANUAL: '사람이 지정',
}

/** 제품 일러스트 종류. 공개 사이트의 ProductShot 과 같아야 그림이 나온다. */
export const SHOT_KINDS = [
  'station', 'switch2', 'motion', 'door', 'temp', 'leak', 'plug', 'curtain',
  'blind', 'irhub', 'tablet', 'hubm3', 'doorlock', 'minipc', 'mesh',
] as const

export function labelOf(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '-'
  return map[code] ?? code
}

/** 쉼표로 이어진 코드 묶음을 한글로 편다. */
export function labelList(map: Record<string, string>, stored: string | null | undefined): string {
  if (!stored) return '-'
  return stored
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => map[c] ?? c)
    .join(' · ')
}
