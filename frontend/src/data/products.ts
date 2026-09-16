/**
 * 실제로 공급하는 표준 스택 제품 목록.
 *
 * 모델명·연결 방식은 docs/견적.md 2장(2026-09-11 다나와·공식몰 확인) 기준이다.
 * **단가는 공개 화면에 쓰지 않는다** — 기기값과 서비스비 분리 표기는 견적서에서 하고,
 * 여기서는 "무엇을 쓰는지"만 밝힌다(견적.md 4-8).
 *
 * 이미지는 제조사 제품 사진 대신 직접 그린 일러스트(`ProductShot.tsx`)를 쓴다.
 * 제조사 파트너 자산을 정식으로 받거나 실물을 촬영하면 그때 교체한다.
 */

export type ShotKind =
  | 'station'
  | 'switch2'
  | 'motion'
  | 'door'
  | 'temp'
  | 'leak'
  | 'plug'
  | 'curtain'
  | 'blind'
  | 'irhub'
  | 'tablet'
  | 'hubm3'
  | 'doorlock'
  | 'minipc'
  | 'mesh'

export type Product = {
  kind: ShotKind
  /** 실제 브랜드 */
  brand: string
  /** 실제 모델명 */
  model: string
  /** 집에서 하는 일 */
  role: string
  /** 연결 규격 */
  link: string
  /** 어느 패키지부터 들어가는지 */
  from: string
  note: string
}

export const PRODUCTS: Product[] = [
  {
    kind: 'station',
    brand: '삼성',
    model: 'SmartThings Station EP-P9500',
    role: '집 전체의 중심',
    link: 'Wi-Fi · Zigbee · Thread(Matter)',
    from: 'START',
    note: '무선 충전기를 겸합니다. 정식 유통되는 SmartThings 허브 중 가장 부담이 적어 표준으로 정했습니다.',
  },
  {
    kind: 'switch2',
    brand: 'Aqara',
    model: '스마트 조명 스위치 2구 (중성선 불필요)',
    role: '기존 벽 스위치 자리에',
    link: 'Zigbee',
    from: 'START',
    note: '중성선이 없는 세대에도 들어갑니다. 벽에서 그대로 눌러도 켜지고, 앱과 자동화로도 켜집니다.',
  },
  {
    kind: 'motion',
    brand: 'IKEA',
    model: 'MYGGSPRAY 모션 센서',
    role: '사람이 있는지 판단',
    link: 'Matter over Thread',
    from: 'START',
    note: '조명과 공조를 움직이는 방아쇠입니다. 복도·현관·화장실에 둡니다.',
  },
  {
    kind: 'door',
    brand: 'IKEA',
    model: 'MYGGBETT 문·창문 센서',
    role: '열림과 닫힘 감지',
    link: 'Matter over Thread',
    from: 'START',
    note: '현관이 열리면 귀가 장면이 돌고, 창이 열려 있으면 에어컨을 멈춥니다.',
  },
  {
    kind: 'temp',
    brand: 'IKEA',
    model: 'TIMMERFLOTTE 온습도 센서',
    role: '방마다 온도·습도',
    link: 'Matter over Thread',
    from: 'START',
    note: '거실 에어컨 한 대가 집 전체를 대표하지 않습니다. 방별 실측값으로 공조를 나눕니다.',
  },
  {
    kind: 'plug',
    brand: 'TP-Link',
    model: 'Tapo P110M 스마트 플러그',
    role: '대기전력 차단 · 전력 측정',
    link: 'Matter (Wi-Fi)',
    from: 'START',
    note: '전력값을 읽어 "세탁 끝남" 같은 상태를 잡아냅니다. 콘센트 단위로 끊습니다.',
  },
  {
    kind: 'leak',
    brand: 'IKEA',
    model: 'KLIPPBOK 누수 센서',
    role: '싱크대 밑 · 세탁기 뒤',
    link: 'Matter over Thread',
    from: 'BASIC',
    note: '바닥이 젖기 전에 알립니다. 아랫집까지 내려가면 비용이 다른 차원이 됩니다.',
  },
  {
    kind: 'irhub',
    brand: 'TP-Link Tapo',
    model: 'H110 IR 리모컨 허브',
    role: '리모컨으로만 되는 구형 가전',
    link: 'Wi-Fi · Matter · IR 학습',
    from: 'BASIC',
    note: '오래된 에어컨·TV 는 Wi-Fi 도 없고 제조사 앱에도 안 잡힙니다. 리모컨 신호를 학습해 외출·귀가 장면에 넣습니다.',
  },
  {
    kind: 'curtain',
    brand: '마마바',
    model: '전동커튼 맞춤 레일 + 유선 Wi-Fi 모터',
    role: '창 크기에 맞춘 레일까지',
    link: 'Wi-Fi · SmartThings 연동',
    from: 'PREMIUM',
    note: '레일을 창 치수대로 맞춰 제작합니다. 일출·일몰 시각에 맞춰 열리고, 커튼 원단은 쓰시던 것을 그대로 답니다.',
  },
  {
    kind: 'blind',
    brand: '마마바',
    model: '전동 블라인드 매터 모터',
    role: '롤스크린 · 콤비 블라인드',
    link: 'Matter · SmartThings 직접',
    from: 'FULL HOME',
    note: '허브를 거치지 않고 SmartThings 에 바로 붙습니다. 햇빛이 드는 시간에 맞춰 내려갑니다.',
  },
  {
    kind: 'hubm3',
    brand: 'Aqara',
    model: '허브 M3',
    role: 'Zigbee 기기 + 거실 적외선',
    link: 'Zigbee · Thread · Matter · IR',
    from: 'PREMIUM',
    note: 'Zigbee 기기를 모으고, 거실 적외선 가전도 함께 잡습니다.',
  },
  {
    kind: 'tablet',
    brand: '벽면 태블릿',
    model: '11인치 + 벽 거치대 + 매립 전원',
    role: '가족 공용 한 화면 제어',
    link: 'Home Assistant 대시보드',
    from: 'PREMIUM',
    note: '앱을 여러 개 깔 필요 없이 벽에 붙은 화면 하나로 조명·커튼·에어컨을 누르고, 기기별 전기 사용량도 봅니다.',
  },
  {
    kind: 'mesh',
    brand: 'ipTIME',
    model: 'AX3000M 메시 세트',
    role: 'Wi-Fi 음영 제거',
    link: 'Wi-Fi 6 메시',
    from: 'PREMIUM',
    note: '스마트홈이 끊기는 원인 대부분은 기기가 아니라 Wi-Fi 입니다. 음영을 측정해 배치합니다.',
  },
  {
    kind: 'minipc',
    brand: 'GMKtec',
    model: 'NucBox G3 (N100, Home Assistant)',
    role: '세대 서버 — 브랜드 통합',
    link: '유선 · Wi-Fi',
    from: 'PREMIUM',
    note: '삼성·LG·샤오미를 한 화면으로 묶는 자리입니다. 인터넷이 끊겨도 집 안에서 자동화가 돕니다.',
  },
  {
    kind: 'doorlock',
    brand: '직방 (삼성SDS)',
    model: 'SHP-DP960 Plus',
    role: '도어락 신규 설치',
    link: 'Wi-Fi → SmartThings',
    from: 'FULL HOME',
    note: '쓰던 도어락이 연동되면 그대로 씁니다. 새로 놓을 때만 이 모델을 권합니다.',
  },
]
