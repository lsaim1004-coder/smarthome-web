/**
 * 패키지 5단계 (거실 · 주방 · 현관 · 안방 · 침실 2 구성 기준).
 *
 * **2026-09-13 모델 전환**: 우리는 물리 시공을 하지 않는다.
 * **2026-09-15**: 커튼·블라인드는 마마바(레일+모터), 구형 가전용 Tapo H110 IR 허브(BASIC 이상), 벽면 태블릿 대시보드 세트(PREMIUM 이상) 추가.
 *                 PREMIUM 339→399, FULL 539→619 (원가 상승분, 마진 유지선).
 * price      = 우리 청구액 (설계 + 기기 + 프로그램 설치/커미셔닝 + 설정 A/S)
 * installFee = 고객이 인테리어 업체 전기팀에 따로 내는 시공비 (우리 매출이 아님)
 *
 * 숫자는 docs/견적.md 4장(`python tools/estimate.py` 생성)에서 가져왔다. 둘을 같이 고칠 것.
 */

export type PackageCode = 'START' | 'BASIC' | 'STANDARD' | 'PREMIUM' | 'FULL'

export type Package = {
  code: PackageCode
  name: string
  tagline: string
  /** 우리 청구액, 부가세 포함 (원) */
  price: number
  /** 업체 시공비, 부가세 포함 (원) */
  installFee: number
  featured?: boolean
  summary: string
  /** 공급하는 기기 */
  devices: string[]
  /** 프로그램 설치(커미셔닝)로 해 드리는 것 */
  commissioning: string[]
  scenes: string[]
  /** 우리가 쓰는 설계 + 현장 커미셔닝 시간 */
  hours: string
}

export const PACKAGES: Package[] = [
  {
    code: 'START',
    name: 'START',
    tagline: '외출·귀가 자동화 입문',
    price: 790_000,
    installFee: 255_000,
    summary: '스마트홈이 처음이라면. 가장 자주 쓰는 두 장면만 확실하게 만듭니다.',
    devices: [
      'SmartThings 허브 1대',
      '조명 스위치 3개 (거실·주방·현관)',
      '모션 2 · 문열림 2 · 온습도 1',
      '스마트 플러그 2개 (전력 측정)',
    ],
    commissioning: ['허브·계정·공간 구성', '보유 가전 1종 계정 연동', '생활 장면 2개', '사용 교육 + 1개월 안정화'],
    scenes: ['외출 — 조명 소등, 대기전력 차단', '귀가 — 현관 조명 점등'],
    hours: '설계와 커미셔닝 4시간',
  },
  {
    code: 'BASIC',
    name: 'BASIC',
    tagline: '기본 자동화',
    price: 1_190_000,
    installFee: 385_000,
    summary: '전실은 아니지만 생활 동선 전체를 덮습니다. 누수 감지가 들어갑니다.',
    devices: [
      'SmartThings 허브 1대',
      '조명 스위치 5개',
      '모션 3 · 문열림 3 · 온습도 2 · 누수 1',
      '스마트 플러그 3개',
      'Tapo H110 리모컨 허브 — 앱 등록이 안 되는 구형 에어컨·TV도 연동',
    ],
    commissioning: ['허브·계정·공간 구성', '보유 가전 2종 계정 연동', '생활 장면 3개', '사용 교육 + 1개월 안정화'],
    scenes: [
      '외출 — 조명·대기전력 정리',
      '귀가 — 현관·거실 점등',
      '취침 — 전체 소등, 침실만 상시등',
    ],
    hours: '설계와 커미셔닝 5시간',
  },
  {
    code: 'STANDARD',
    name: 'STANDARD',
    tagline: '표준 구성',
    price: 1_990_000,
    installFee: 440_000,
    featured: true,
    summary: '가장 많이 선택하는 구성. 도어락·에어컨·로봇청소기까지 하나로 묶습니다.',
    devices: [
      'SmartThings 허브 1대',
      '조명 스위치 6개',
      '모션 4 · 문열림 3 · 온습도 2 · 누수 2',
      '스마트 플러그 3개',
      'Tapo H110 리모컨 허브 — 앱 등록이 안 되는 구형 에어컨·TV도 연동',
    ],
    commissioning: [
      '허브·계정·공간 구성',
      '도어락 · 에어컨 · 로봇청소기 연동',
      '생활 장면 4개',
      '사용 교육 + 1개월 안정화',
    ],
    scenes: [
      '외출 — 도어락 잠금 확인, 조명·에어컨 OFF',
      '귀가 — 현관 점등, 여름엔 에어컨 선가동',
      '취침 — 전체 소등, 문열림 감시 ON',
      '청소 — 외출 감지 후 로봇청소기 자동 시작',
    ],
    hours: '설계와 커미셔닝 7시간',
  },
  {
    code: 'PREMIUM',
    name: 'PREMIUM',
    tagline: '풀 스마트홈 + 세대 서버',
    price: 3_990_000,
    installFee: 1_190_000,
    summary:
      '집 안에 서버를 두어 클라우드가 끊겨도 자동화가 돕니다. 브랜드가 섞여 있어도 벽에 붙은 태블릿 한 화면에서 씁니다.',
    devices: [
      '전실 조명 스위치 10개',
      '모션 5 · 문열림 4 · 온습도 3 · 누수 2 · 플러그 5',
      '전동 커튼 2창 (마마바 맞춤 레일 + 모터) · 실내 CCTV 1대',
      'Tapo H110 리모컨 허브 (구형 가전용)',
      'Aqara 허브 M3 · 메시 Wi-Fi 1세트',
      '세대 서버 (미니 PC, Home Assistant)',
      '벽면 태블릿 11인치 + 거치대 + 매립 전원',
    ],
    commissioning: [
      '세대 서버 구축 + 브랜드 통합 브릿지',
      'TV · 냉장고 · 세탁기까지 계정 연동',
      '벽면 태블릿 대시보드 — 방별 제어 화면 구성',
      '기기별 에너지 모니터링 — 플러그·가전 사용량을 한 화면에',
      '생활 장면 6개',
      'Wi-Fi 음영 측정 · 채널 최적화',
      '사용 교육 + 1개월 안정화',
    ],
    scenes: [
      '외출 · 귀가 · 취침 · 청소',
      '아침 — 커튼 개방, 실내 온도에 따른 공조',
      '부재중 보안 — 문열림·움직임 알림',
    ],
    hours: '설계와 커미셔닝 14시간',
  },
  {
    code: 'FULL',
    name: 'FULL HOME',
    tagline: '전실 + 커튼 4 · 블라인드 + 도어락 신규',
    price: 6_190_000,
    installFee: 1_760_000,
    summary: '조명·커튼·블라인드·도어락까지 새로 놓는 구성. 음성으로도 장면을 부릅니다.',
    devices: [
      '전실 조명 스위치 12개',
      '모션 6 · 문열림 5 · 온습도 3 · 누수 3 · 플러그 6',
      '전동 커튼 4창 · 전동 블라인드 1창 (마마바) · 실내 CCTV 2대',
      'Tapo H110 리모컨 허브 2대 — 거실 · 안방',
      '스마트 도어락 (신규)',
      'Aqara 허브 M3 · 메시 Wi-Fi · 세대 서버',
      '벽면 태블릿 11인치 + 거치대 + 매립 전원',
    ],
    commissioning: [
      '세대 서버 구축 + 브랜드 통합 브릿지',
      '벽면 태블릿 대시보드 + 기기별 에너지 리포트',
      '빅스비 · Google 음성 연동',
      '생활 장면 8개',
      'Wi-Fi 음영 측정 · 채널 최적화',
      '사용 교육 + 1개월 안정화',
    ],
    scenes: [
      '외출 · 귀가 · 취침 · 청소 · 아침 · 보안',
      '커튼 — 일출·일몰 시각 자동 개폐',
      '음성 — "잘게", "다녀올게" 한 마디로 장면 실행',
    ],
    hours: '설계와 커미셔닝 18시간',
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
  { label: '구형 가전 리모컨 허브 (IR · RF 옵션)', values: [0, 1, 1, 1, 2] },
  { label: '전동 커튼 (마마바)', values: [0, 0, 0, 2, 4] },
  { label: '전동 블라인드 (마마바)', values: [0, 0, 0, 0, 1] },
  { label: '실내 CCTV', values: [0, 0, 0, 1, 2] },
  { label: '스마트 도어락 신규', values: [0, 0, 0, 0, 1] },
  { label: 'Aqara 허브 M3', values: [0, 0, 0, 1, 1] },
  { label: '메시 Wi-Fi', values: [0, 0, 0, 1, 1] },
  { label: '세대 서버 (Home Assistant)', values: [0, 0, 0, 1, 1] },
  { label: '벽면 태블릿 대시보드', values: [0, 0, 0, '✓', '✓'] },
  { label: '기기별 에너지 모니터링', values: [0, 0, 0, '✓', '✓'] },
  {
    label: '보유 가전 연동',
    values: ['1종', '2종', '도어락·에어컨·청소기', '+ TV·냉장고·세탁기', '+ 음성'],
  },
  { label: '생활 장면 자동화', values: ['2개', '3개', '4개', '6개', '8개'] },
]

export function priceLabel(won: number): string {
  return (won / 10_000).toLocaleString('ko-KR') + '만원'
}

export function totalLabel(p: Package): string {
  return priceLabel(p.price + p.installFee)
}

export function findPackage(code: string | null | undefined): Package | undefined {
  return PACKAGES.find((p) => p.code === code)
}
