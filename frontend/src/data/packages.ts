/**
 * 34평 아파트 기준 패키지 5단계.
 * 가격·구성·시간은 docs/견적.md 4장(2026-09-11 시장 조사)에서 가져왔다.
 * 숫자를 고칠 때는 견적.md 와 함께 고칠 것.
 */

export type PackageCode = 'START' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'FULL'

export type Package = {
  code: PackageCode
  name: string
  tagline: string
  /** 부가세 포함 고객가, 단위 만원 */
  price: number
  featured?: boolean
  summary: string
  highlights: string[]
  scenes: string[]
  hours: string
}

export const PACKAGES: Package[] = [
  {
    code: 'START',
    name: 'START',
    tagline: '외출·귀가 자동화 입문',
    price: 99,
    summary: '스마트홈이 처음이라면. 가장 자주 쓰는 두 장면만 확실하게 만듭니다.',
    highlights: [
      'SmartThings 허브 1대',
      '조명 스위치 3개 (거실·주방·현관)',
      '모션 2 · 문열림 2 · 온습도 1',
      '스마트 플러그 2개 (전력 측정)',
      '보유 가전 1종 계정 연동',
    ],
    scenes: ['외출 — 조명 소등, 대기전력 차단', '귀가 — 현관 조명 점등'],
    hours: '설치 4시간 · 설계와 세팅 3시간',
  },
  {
    code: 'BASIC',
    name: 'BASIC',
    tagline: '34평 기본 자동화',
    price: 149,
    summary: '전실은 아니지만 생활 동선 전체를 덮습니다. 누수 감지가 들어갑니다.',
    highlights: [
      'SmartThings 허브 1대',
      '조명 스위치 5개',
      '모션 3 · 문열림 3 · 온습도 2 · 누수 1',
      '스마트 플러그 3개',
      '보유 가전 2종 계정 연동',
    ],
    scenes: [
      '외출 — 조명·대기전력 정리',
      '귀가 — 현관·거실 점등',
      '취침 — 전체 소등, 침실만 상시등',
    ],
    hours: '설치 6시간 · 설계와 세팅 4시간',
  },
  {
    code: 'STANDARD',
    name: 'STANDARD',
    tagline: '34평 표준',
    price: 249,
    featured: true,
    summary: '가장 많이 선택하는 구성. 도어락·에어컨·로봇청소기까지 하나로 묶습니다.',
    highlights: [
      'SmartThings 허브 1대',
      '조명 스위치 6개',
      '모션 4 · 문열림 3 · 온습도 2 · 누수 2',
      '스마트 플러그 3개',
      '도어락 · 에어컨 · 로봇청소기 연동',
    ],
    scenes: [
      '외출 — 도어락 잠금 확인, 조명·에어컨 OFF',
      '귀가 — 현관 점등, 여름엔 에어컨 선가동',
      '취침 — 전체 소등, 문열림 감시 ON',
      '청소 — 외출 감지 후 로봇청소기 자동 시작',
    ],
    hours: '설치 8시간 · 설계와 세팅 6시간',
  },
  {
    code: 'PREMIUM',
    name: 'PREMIUM',
    tagline: '풀 스마트홈 + 세대 서버',
    price: 449,
    summary: '집 안에 서버를 두어 클라우드가 끊겨도 자동화가 돕니다. 브랜드가 섞여 있어도 한 화면에서 씁니다.',
    highlights: [
      '전실 조명 스위치 10개',
      '모션 5 · 문열림 4 · 온습도 3 · 누수 2 · 플러그 5',
      '전동 커튼 2대 · 실내 CCTV 1대',
      'Aqara 허브 M3 · 메시 Wi-Fi 1세트',
      '세대 서버(미니 PC, Home Assistant) 포함',
      'TV · 냉장고 · 세탁기까지 계정 연동',
    ],
    scenes: [
      '외출 · 귀가 · 취침 · 청소',
      '아침 — 커튼 개방, 실내 온도에 따른 공조',
      '부재중 보안 — 문열림·움직임 알림',
    ],
    hours: '설치 16시간 · 설계와 세팅 10시간',
  },
  {
    code: 'FULL',
    name: 'FULL HOME',
    tagline: '전실 + 커튼 4 + 도어락 신규',
    price: 699,
    summary: '조명·커튼·도어락까지 새로 놓는 구성. 음성으로도 장면을 부릅니다.',
    highlights: [
      '전실 조명 스위치 12개',
      '모션 6 · 문열림 5 · 온습도 3 · 누수 3 · 플러그 6',
      '전동 커튼 4대 · 실내 CCTV 2대',
      '스마트 도어락 신규 설치',
      'Aqara 허브 M3 · 메시 Wi-Fi · 세대 서버',
      '빅스비 · Google 음성 연동',
    ],
    scenes: [
      '외출 · 귀가 · 취침 · 청소 · 아침 · 보안',
      '커튼 — 일출·일몰 시각 자동 개폐',
      '음성 — "잘게", "다녀올게" 한 마디로 장면 실행',
    ],
    hours: '설치 24시간 · 설계와 세팅 14시간',
  },
]

/** 비교표. 값이 0 이면 미포함으로 표시한다. */
export const COMPARISON: { label: string; values: (number | string)[] }[] = [
  { label: 'SmartThings 허브', values: [1, 1, 1, 1, 1] },
  { label: '조명 스위치 2구', values: [3, 5, 6, 10, 12] },
  { label: '모션 센서', values: [2, 3, 4, 5, 6] },
  { label: '문 · 창문 센서', values: [2, 3, 3, 4, 5] },
  { label: '온습도 센서', values: [1, 2, 2, 3, 3] },
  { label: '누수 센서', values: [0, 1, 2, 2, 3] },
  { label: '스마트 플러그', values: [2, 3, 3, 5, 6] },
  { label: '전동 커튼 모터', values: [0, 0, 0, 2, 4] },
  { label: '실내 CCTV', values: [0, 0, 0, 1, 2] },
  { label: '스마트 도어락 신규', values: [0, 0, 0, 0, 1] },
  { label: 'Aqara 허브 M3', values: [0, 0, 0, 1, 1] },
  { label: '메시 Wi-Fi', values: [0, 0, 0, 1, 1] },
  { label: '세대 서버 (Home Assistant)', values: [0, 0, 0, 1, 1] },
  {
    label: '보유 가전 연동',
    values: ['1종', '2종', '도어락·에어컨·청소기', '+ TV·냉장고·세탁기', '+ 음성'],
  },
  { label: '생활 장면 자동화', values: ['2개', '3개', '4개', '6개', '8개'] },
]

export function priceLabel(price: number): string {
  return price.toLocaleString('ko-KR') + '만원'
}

export function findPackage(code: string | null | undefined): Package | undefined {
  return PACKAGES.find((p) => p.code === code)
}
