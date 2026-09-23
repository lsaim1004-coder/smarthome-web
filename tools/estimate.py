#!/usr/bin/env python3
"""패키지(거실·주방·현관·안방·침실 2 구성 기준) 원가·판매가·사업자 수익 계산 → 마크다운 출력.

사용: python tools/estimate.py > /tmp/estimate.md

**사업 모델 (2026-09-13 전환)**
우리가 파는 것은 **설계 + 기기 + 프로그램 설치(커미셔닝) + 설정 A/S** 이고,
**물리 시공(스위치 교체·커튼 모터 부착·배선·타공)은 하지 않는다.**
시공은 인테리어 업체의 전기팀 또는 협력 설치기사가 맡고, 그 비용은 업체 견적에 들어간다.
따라서 시공 인건비는 우리 원가에서 빠지고 판매가에서도 빠진다. 대신 4-9 에 "고객이 따로 부담하는
시공비" 참고치를 제시해 총부담을 숨기지 않는다.

단가(원, 부가세 포함 소비자가)는 docs/견적.md 2·3장 조사 결과(2026-09-11) 기준. 값이 바뀌면 여기만 고친다.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field

NL = chr(10)
VAT = 0.10

# ---------------------------------------------------------------------------
# 1) 기기 단가: (최저 = 저가 표준 스택 IKEA/Tapo/최저가 조달, 일반 = Aqara 정발·일반 판매가)
#    * IKEA·Tapo 단가는 2026-09-11 공식몰·다나와로 검증 완료(docs/견적.md 2-10). IKEA 센서는 Thread 보더 라우터 필요 — SmartThings Station 직접 페어링은 공식 보증 미확인
# ---------------------------------------------------------------------------
PRICE: dict[str, tuple[int, int]] = {
    "hub_station": (36_000, 40_700),     # 삼성 SmartThings Station
    "switch_2gang": (54_900, 67_100),    # Aqara 조명 스위치 2구 (중성선 불필요)
    "motion":      (9_900, 33_000),      # IKEA MYGGSPRAY(Matter-over-Thread) / Aqara 모션 T1
    "door":        (12_900, 49_500),     # IKEA MYGGBETT(Matter) / Aqara 열림 P2
    "temp":        (14_900, 28_600),     # IKEA TIMMERFLOTTE / Aqara 온습도 T1
    "leak":        (9_900, 44_000),      # IKEA KLIPPBOK(Matter, 신형) / Aqara 누수 T1(공식몰 44,000·품절)
    "plug":        (15_210, 42_900),     # Tapo P110M(Matter, 전력측정) / Aqara 플러그
    "curtain":     (160_000, 230_000),   # 마마바 전동커튼 1창: 맞춤 레일 49,000 + 길이 추가(2m +8,000 · 3.5m +36,000) + 유선 Wi-Fi 모터 89,000 → 창당 14.6~17.4만(평균 16만) / 무선 모터(159,000) 기준 23만. 커튼 원단 제외, 2026-09-15 mamaba.co.kr
    "blind":       (109_000, 154_500),   # 마마바 전동 블라인드 1창: 무선모터20 79,000 + 롤스크린 ~30,000 / 매터 블라인드 모터25 119,000(SmartThings Station 직접 페어링) + 방염 스크린 35,500
    "ir_rf_hub":   (38_800, 58_740),     # 구형 가전용 리모컨 허브: 저가 = Tapo H110(IR 학습·Matter 인증·SmartThings 지원, 티피링크몰 38,800·공식 39,900) / 일반 = Broadlink RM4 Pro(IR+RF 433/315MHz, RF 리모컨 가전이 있을 때, 58,740). 대안 SwitchBot Hub 2 89,800
    "cctv":        (92_000, 92_000),     # ThingsOne T1 — 국내 리스팅 확인 불가(참고치)
    "doorlock":    (342_000, 426_310),   # 직방(삼성SDS) SHP-DP960 Plus (설치비 별도)
    "hub_m3":      (172_190, 253_000),   # Aqara 허브 M3 (Matter · IR)
    "mesh_wifi":   (210_000, 259_000),   # ipTIME AX3000M x2 / Deco X50 3팩
    # 2026-09-22 재조사. 이전 219,000 은 다나와 상품카드의 **최저 옵션(베어본)** 을 완제품으로 잘못 읽은 값이다.
    # 같은 카드에 옵션이 셋 있다 — 베어본 213,410 / 중간 470,900 / 16GB·512GB 완제품 733,200(상세 738,200, 등록 1곳).
    # 부품을 따로 사면 RAM 16GB 149,570 + SSD 512GB 127,510 = 277,080 이라 베어본 조립도 49만이 넘는다(다나와 최저, 2026-09-22).
    #
    # 세대 HA 는 HA + Matterbridge + MQTT 만 돌리므로 **8GB/256GB 로 충분**하다(HA 공식 권장 2GB/32GB).
    # 16GB/512GB 는 관제 서버 사양이지 세대 사양이 아니다.
    #   저가 = 알리 GMKtec G3 N100 8GB/256GB. 본체 $84~86 + 배송 $6.95 ≈ $92 (환율 1,380원 → 약 127,000, 13만으로 잡음)
    #   일반 = 국내 유통 GIGABYTE BRIX GB-BPCE-3455 8GB/256GB 249,230원(다나와). J3455 는 2016년 Apollo Lake 라
    #          N100 의 약 1/3 성능이지만 HA 용도에는 충분하다(공식 지원 라즈베리파이 4보다 빠르다).
    #          국내 유통 동급 N100(MSI Cubi 8GB/256GB)은 560,000 이라 고객 납품용 기준가로는 BRIX 쪽이 현실적이다.
    # 알리 직구 리스크는 2-9 참고. N100 아래로 내려갈 이유는 없다 — 라즈베리파이 4 보드만 163,010, Pi5 8GB 322,300,
    # N97 국내 30~78만으로 전부 더 비싸다.
    "minipc_n100": (130_000, 249_230),   # 세대 HA 서버 8GB/256GB (알리 N100 직구 / 국내 유통 BRIX J3455)
    "ups":         (184_000, 188_000),   # APC BE550-KR
    "tablet":      (199_640, 360_030),   # 벽면 대시보드 태블릿: 레노버 탭 M11 128GB Wi-Fi(다나와 199,640) / 갤럭시탭 A9+ 11" 64GB(360,030, 20곳). 2026-09-15
    "tablet_mount": (25_600, 42_500),    # 벽걸이 거치대: 쿠팡 접이식 벽걸이(25,600) / 엔산마운트 PAD-W02 자석형 7~12.9"(42,500)
    "tablet_power": (38_000, 64_000),    # 태블릿 상시 전원용 USB 매립 콘센트: 인채널 노바 1구(38,000) / 인채널 회전 USB 2구 IBC-22M(64,000). 전기공사 단계에 업체가 시공
    "kiosk_lic":   (12_000, 12_000),     # Fully Kiosk Browser PLUS 기기당 1회 €7.90(≈12,000원)
}
LABEL = {
    "hub_station": "SmartThings 허브(Station)", "switch_2gang": "조명 스위치 2구", "motion": "모션 센서", "door": "문·창문 센서",
    "temp": "온습도 센서", "leak": "누수 센서", "plug": "스마트 플러그(전력측정)", "curtain": "전동 커튼 1창(마마바 레일+모터)", "blind": "전동 블라인드 1창(마마바)",
    "ir_rf_hub": "구형 가전 리모컨 허브(IR, RF 필요 시 교체)", "cctv": "실내 CCTV",
    "doorlock": "스마트 도어락(삼성SDS)", "hub_m3": "Aqara 허브 M3", "mesh_wifi": "메시 Wi-Fi 1세트", "minipc_n100": "세대 HA 서버(미니PC 8GB/256GB)", "ups": "UPS",
    "tablet": "벽면 태블릿(11인치)", "tablet_mount": "태블릿 벽 거치대", "tablet_power": "USB 매립 콘센트(태블릿 전원)", "kiosk_lic": "키오스크 앱 라이선스",
}

# ---------------------------------------------------------------------------
# 2) 가정 (부가세 제외 기준)
# ---------------------------------------------------------------------------
COMMISSION_HOUR = 40_000  # 설계·커미셔닝·교육 시간 단가 (우리 본업)
INSTALL_HOUR = 40_000     # 시공 기술자 시간 단가 — 우리 원가가 아니라 업체 견적 참고용
AS_RESERVE = 0.05         # 설정 A/S 준비금 (공급가 대비)
CARD_FEE = 0.02           # 직접 판매 시 카드 수수료
REFERRAL = {"15%": 0.15, "20%": 0.20, "25%": 0.25}   # 인테리어 업체 파트너 마진
MIX = {"START": 1, "BASIC": 1, "STANDARD": 2, "PREMIUM": 1, "FULL HOME": 0}   # 월 시나리오 건수 (업체 1곳)

# 겸업 기준 월 가용 시간 (주말 8일 + 평일 저녁)
MONTHLY_HOURS = 80
OVERHEAD = 0.35           # 실작업 외 부대시간 비율 (상담·조달·이동·A/S)

# 경쟁 기준 설치 단가 (아카라라이프 공개가 + 추정)
COMP_TRIP = 50_000; COMP_SWITCH = 50_000; COMP_CURTAIN = 140_000; COMP_SENSOR = 10_000; COMP_DOORLOCK = 30_000; COMP_DESIGN = 330_000

# 스마트홈 케어 (월 구독) — 원격 중심, 방문은 할인가 별도
CARE_MONTHLY = 19_000
CARE_VISITS_YEAR = 2      # 원격 점검 연 2회
CARE_VISIT_HOURS = 1.0
CARE_TOOLING_YEAR = 12_000  # 세대당 관제·도구 분담(부가세 제외)
CARE_TAKE_RATE = 0.40     # 설치 고객 중 가입률 가정


@dataclass
class Package:
    name: str
    tagline: str
    target_price: int                 # 제안 판매가 (부가세 포함, 우리 공급분 = 설계+기기+커미셔닝)
    market_low: int                   # 공개 시장 가격대 (부가세 포함, 시공 포함 총액 기준)
    market_high: int
    market_label: str
    bom: dict[str, int]
    install_hours: float              # 업체 전기팀이 쓰는 시간 (우리 원가 아님, 참고 표기용)
    commission_hours: float           # 우리가 쓰는 설계 + 현장 커미셔닝 시간
    integrations: list[str] = field(default_factory=list)   # 기기 없이 계정 연동만 하는 항목
    automations: int = 2
    misc: int = 30_000                # 소모품·이동 (부가세 포함)
    include_design_in_comp: bool = False


def supply(x: float) -> float:
    return x / (1 + VAT)


def pct(a: float, b: float) -> float:
    return a / b * 100 if b else 0.0


def won(x: float) -> str:
    return f"{int(round(x, -3)):,}"


def bom_low(p: Package) -> float:
    return sum(PRICE[k][0] * q for k, q in p.bom.items())


def bom_std(p: Package) -> float:
    return sum(PRICE[k][1] * q for k, q in p.bom.items())


def costs(p: Package, std_devices: bool = False) -> dict[str, float]:
    """우리 원가. 시공 인건비는 들어가지 않는다(업체 몫)."""
    devices = supply(bom_std(p) if std_devices else bom_low(p))
    return {
        "기기": devices,
        "설계·커미셔닝·교육": p.commission_hours * COMMISSION_HOUR,
        "소모품·이동": supply(p.misc),
    }


def install_fee(p: Package) -> float:
    """고객이 인테리어 업체(또는 설치기사)에게 따로 내는 시공비 참고치. 4-8 단가표의 시공비 열과 같은 기준."""
    fee = COMP_TRIP
    for _name, key, inst, _auto, _as in UNITS:
        if key and p.bom.get(key):
            fee += inst * p.bom[key]
    return fee


def competitor_itemized(p: Package) -> float:
    """아카라 방식: 출장 + 항목별 설치비 (+설계) + 동일 기기 일반가. 시공 포함 총액이라 우리 총부담과 비교한다."""
    b = p.bom
    fee = COMP_TRIP + COMP_SWITCH * b.get("switch_2gang", 0) + COMP_CURTAIN * b.get("curtain", 0) \
        + COMP_SENSOR * (b.get("motion", 0) + b.get("door", 0) + b.get("temp", 0) + b.get("leak", 0)) \
        + COMP_DOORLOCK * b.get("doorlock", 0)
    if p.include_design_in_comp:
        fee += COMP_DESIGN
    return fee + bom_std(p)


def profit(p: Package, referral: float, outsource_commission: bool, card: float = 0.0, std_devices: bool = False) -> float:
    """outsource_commission=True 면 커미셔닝까지 사람을 써서 그 인건비가 원가로 나간 경우."""
    sp = supply(p.target_price)
    c = costs(p, std_devices)
    total = sum(c.values()) if outsource_commission else sum(c.values()) - c["설계·커미셔닝·교육"]
    return sp - total - sp * AS_RESERVE - sp * referral - sp * card


def breakeven(p: Package, referral: float, outsource_commission: bool) -> float:
    c = costs(p)
    total = sum(c.values()) if outsource_commission else sum(c.values()) - c["설계·커미셔닝·교육"]
    return total / (1 - AS_RESERVE - referral) * (1 + VAT)


def care_profit_year() -> float:
    revenue = supply(CARE_MONTHLY * 12)
    cost = CARE_VISITS_YEAR * CARE_VISIT_HOURS * COMMISSION_HOUR + CARE_TOOLING_YEAR
    return revenue - cost


def table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join([" --- "] * len(header)) + "|"]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return NL.join(lines)


# ---------------------------------------------------------------------------
# 3) 항목별 단가표 (견적서용). '시공비' 열은 우리 매출이 아니라 업체·설치기사 몫이다.
# ---------------------------------------------------------------------------
UNITS: list[tuple[str, str | None, int, int, int]] = [
    # (항목, 기기 key(None=기기 없음), 시공비(업체 몫), 커미셔닝(우리), 테스트·A/S(우리))
    ("출장비 (건당)", None, 50_000, 0, 0),
    # ── 리모델링 단계에서만 팔 수 있는 것들 (2026-09-23 신설)
    # 근거: 클리앙 19260809 — 30평 업체 견적 2,000만원을 받고 직접 한 IT 종사자의 기록.
    # 그 사람이 리모델링 때 미리 해둔 것이 중성선·간접조명·다운라이트·SMPS·센서 위치였다.
    # "기기는 나중에 바꿀 수 있지만 전기 배선은 못 바꾼다" — 우리가 파는 타이밍이 정확히 여기다.
    ("조명·전기 설계 검토 (도면 기준, 스위치/센서/콘센트 위치와 회로 구성)", None, 0, 150_000, 0),
    ("중성선 선반영 (스위치 박스당) — 지금 5천원, 나중에 하면 5~10만원 + 벽 해체", None, 5_000, 3_000, 0),
    ("간접조명·다운라이트 구간 설계 (SMPS·드라이버 위치, 조광 회로 분리)", None, 0, 100_000, 0),
    # ── 소액 진입 상품 (2026-09-23 신설)
    # 지인 대상 시범 제안에 응답이 0건이었다. 부탁의 크기가 문제다 —
    # "집 전체 한 달"은 무료여도 받기 어렵고, 곰팡이 같은 실재하는 고통은 설명이 필요 없다.
    ("욕실 환풍기 자동화 1개소 (모션 센서 + 스위치, 나가면 1시간 뒤 자동 정지)", None, 35_000, 30_000, 10_000),
    # ── 시공 당일을 좌우하는 준비 작업 (2026-09-23 신설)
    # 근거: blog.naver.com/wolfv/224336423621 — "시공 당일에는 누구도 설명서를 읽을 시간이 없다".
    # 그 사람은 택배가 올 때마다 검수하고, 미리 페어링까지 하고, 용도별로 라벨을 붙여
    # 다시 포장해 인테리어 사장님께 넘겼다. "라벨 하나가 시공 하루를 바꾼다."
    ("기기 사전 검수·테스트·페어링·용도별 라벨링 (건당)", None, 0, 120_000, 0),
    # 같은 글: 그는 휴가를 내고 시공 당일 아침부터 현장에 상주했다. 걱정한 것은 전기 작업이 아니라
    # "Driver 채널이 바뀌지 않을까 · 병렬 연결이 다르게 시공되지 않을까 · 전기사장님이 고집피우지 않을까".
    # 우리 기획의 "전기공사 단계에 반나절" 가정은 낙관일 수 있다 — 하루로 잡는다.
    ("전기 시공 당일 입회 (1일, 배선도 대조·현장 판단)", None, 0, 200_000, 0),
    ("SmartThings 허브 설치 · 계정 · 공간 구성", "hub_station", 30_000, 30_000, 10_000),
    ("스마트 조명 스위치 2구 (무중성선)", "switch_2gang", 35_000, 20_000, 10_000),
    ("모션 센서", "motion", 10_000, 10_000, 5_000),
    ("문·창문 센서", "door", 10_000, 10_000, 5_000),
    ("온습도 센서", "temp", 10_000, 5_000, 5_000),
    ("누수 센서", "leak", 10_000, 10_000, 5_000),
    ("스마트 플러그 (전력측정)", "plug", 10_000, 10_000, 5_000),
    ("전동 커튼 1창 (마마바 맞춤 레일 + 유선 Wi-Fi 모터, 커튼 원단 별도)", "curtain", 100_000, 20_000, 10_000),   # 마마바 방문설치 9~14만 → 업체 전기팀 시공 10만
    ("전동 블라인드 1창 (마마바 모터 + 롤스크린)", "blind", 60_000, 20_000, 10_000),
    ("구형 가전 리모컨 허브 (Tapo H110 IR 학습, RF 리모컨 가전은 Broadlink RM4 Pro 로 교체)", "ir_rf_hub", 10_000, 30_000, 10_000),
    ("실내 CCTV", "cctv", 30_000, 10_000, 10_000),
    ("스마트 도어락 (신규 설치)", "doorlock", 80_000, 20_000, 10_000),
    ("도어락 · 가전 계정 연동 (보유 기기 1종)", None, 0, 25_000, 5_000),
    ("생활 장면 자동화 1개 (외출·귀가·취침 등)", None, 0, 30_000, 10_000),
    ("Aqara 허브 M3 (Matter · IR 리모컨 통합)", "hub_m3", 30_000, 30_000, 10_000),
    ("메시 Wi-Fi 1세트 설치 · 최적화", "mesh_wifi", 80_000, 20_000, 10_000),
    ("세대 HA 서버 (미니PC 8GB/256GB) 구축", "minipc_n100", 100_000, 100_000, 20_000),
    ("벽면 태블릿 대시보드 — 태블릿 본체 + 키오스크·방별 화면·에너지 대시보드 구성", "tablet", 0, 60_000, 10_000),
    ("벽면 태블릿 — 벽 거치대 부착 (업체)", "tablet_mount", 20_000, 0, 0),
    ("벽면 태블릿 — USB 매립 콘센트 (전기공사 단계, 업체)", "tablet_power", 30_000, 0, 0),
    ("벽면 태블릿 — 키오스크 앱 라이선스", "kiosk_lic", 0, 0, 0),
]


def render_units() -> str:
    rows = []
    for name, key, inst, auto, asfee in UNITS:
        dev_low = PRICE[key][0] if key else 0
        dev_std = PRICE[key][1] if key else 0
        ours = dev_low + auto + asfee
        rows.append([name, won(dev_low) if key else "-", won(dev_std) if key else "-",
                     f"**{won(auto + asfee)}**", won(inst), f"**{won(ours)}**", won(ours + inst)])
    return table(["항목", "기기(저가 스택)", "기기(일반)", "우리 서비스비<br><small>커미셔닝+A/S</small>",
                  "시공비<br><small>업체 몫</small>", "우리 청구액<br><small>기기+서비스</small>", "고객 총부담"], rows)


def render(pk: list[Package]) -> str:
    out: list[str] = []

    # 구성표
    out.append("### 4-1. 패키지 구성 (거실 · 주방 · 현관 · 안방 · 침실 2 기준)")
    keys = ["hub_station", "switch_2gang", "motion", "door", "temp", "leak", "plug", "ir_rf_hub", "curtain", "blind", "cctv", "doorlock",
            "hub_m3", "mesh_wifi", "minipc_n100", "tablet", "tablet_mount", "tablet_power", "kiosk_lic"]
    rows = []
    for k in keys:
        rows.append([LABEL[k]] + [str(p.bom.get(k, 0)) if p.bom.get(k, 0) else "-" for p in pk])
    rows.append(["계정 연동(기기 없음)"] + [", ".join(p.integrations) if p.integrations else "-" for p in pk])
    rows.append(["생활 장면 자동화"] + [f"{p.automations}개" for p in pk])
    rows.append(["**우리 시간** (설계+커미셔닝)"] + [f"**{p.commission_hours:g}h**" for p in pk])
    rows.append(["업체 시공 시간 (참고)"] + [f"{p.install_hours:g}h" for p in pk])
    rows.append(["**기기 합계 (저가 스택)**"] + [f"**{won(bom_low(p))}**" for p in pk])
    rows.append(["기기 합계 (일반)"] + [won(bom_std(p)) for p in pk])
    out.append(table(["항목"] + [f"{p.name}<br><small>{p.tagline}</small>" for p in pk], rows))

    # 원가
    rows = []
    for p in pk:
        c = costs(p); total = sum(c.values())
        rows.append([p.name] + [won(v) for v in c.values()] + [f"**{won(total)}**", won(total * (1 + VAT)), won(sum(costs(p, True).values()))])
    out.append(f"{NL}### 4-2. 패키지별 원가 (부가세 제외) — 시공비는 우리 원가가 아니다{NL}"
               f"설계·커미셔닝 {COMMISSION_HOUR:,}원/시간 · 기기는 저가 스택 최저가 조달(매입세액 공제). 마지막 열은 Aqara 일반가로 살 때.{NL}"
               f"**물리 시공은 인테리어 업체 전기팀이 하므로 시공 인건비가 여기 들어가지 않는다.** 고객이 따로 내는 시공비는 4-9 참고.{NL}"
               + table(["패키지", "기기", "설계·커미셔닝·교육", "소모품·이동", "원가 합계", "(부가세 포함)", "일반가 기기일 때 원가"], rows))

    # 판매가 vs 시장
    rows = []
    for p in pk:
        comp = competitor_itemized(p)
        total_burden = p.target_price + install_fee(p)
        pos = pct(total_burden - p.market_low, p.market_high - p.market_low)
        rows.append([p.name, f"**{won(p.target_price)}**", won(install_fee(p)), f"**{won(total_burden)}**",
                     f"{won(p.market_low)} ~ {won(p.market_high)}<br><small>{p.market_label}</small>",
                     f"{pos:.0f}% 지점", won(comp), f"{pct(total_burden - comp, comp):+.0f}%"])
    out.append(f"{NL}### 4-3. 제안 판매가 vs 시장 가격대 (부가세 포함 고객가){NL}"
               f"우리 청구액은 **설계 + 기기 + 커미셔닝**만이다. 시장 가격대는 시공까지 포함한 총액이므로 '고객 총부담'과 비교한다.{NL}"
               "'시장 가격대 내 위치' 0% = 하단, 100% = 상단. '경쟁 항목별 기준가' = 아카라라이프 공개 설치 단가(출장 5만 · 스위치 5만/개 · 커튼 14만/개, 센서 1만/개 추정"
               f" · 도어락 3만) + STANDARD 이상은 설계 검증 33만 + 동일 기기 일반가.{NL}"
               + table(["패키지", "우리 청구액", "시공비(업체)", "고객 총부담", "공개 시장 가격대", "시장 내 위치", "경쟁 항목별 기준가", "경쟁 대비"], rows))

    # 순이익
    header = ["패키지", "공급가"] + [f"본인 커미셔닝 · 업체 {k}" for k in REFERRAL] + [f"커미셔닝 외주 · 업체 {k}" for k in REFERRAL]
    profit_blocks = []
    for title, card in (("4-4. 사업자 순이익 — 모델 1 하도급형 (업체가 고객에게 판매, 우리는 업체에 공급)", 0.0),
                        (f"4-5. 사업자 순이익 — 모델 2 직접판매형 (우리가 고객 청구, 업체에 소개수수료, 카드수수료 {CARD_FEE:.0%} 부담)", CARD_FEE)):
        rows = []
        for p in pk:
            sp = supply(p.target_price)
            cells = [p.name, won(sp)]
            for outsourced in (False, True):
                for r in REFERRAL.values():
                    pr = profit(p, r, outsourced, card)
                    cells.append(f"{won(pr)} ({pct(pr, sp):.0f}%)")
            rows.append(cells)
        profit_blocks.append(f"{NL}### {title}{NL}업체 몫 = 판매 공급가의 15 / 20 / 25 %. 괄호는 공급가 대비 순이익률.{NL}" + table(header, rows))

    # 시간당 수익 — 모델 1 기준이라 4-4 바로 뒤에 둔다
    rows = []
    for p in pk:
        pr = profit(p, 0.20, False)
        hours = p.commission_hours * (1 + OVERHEAD)
        rows.append([p.name, f"{p.commission_hours:g}h", f"{hours:.1f}h", won(pr), f"**{won(pr / hours)}**",
                     f"{p.install_hours:g}h", won(pr / (hours + p.install_hours * (1 + OVERHEAD)))])
    hourly = (f"{NL}### 4-4b. 시간당 수익 — 시공을 넘긴 효과 (업체 20%, 본인 커미셔닝){NL}"
              f"부대시간(상담·조달·이동·A/S) {OVERHEAD:.0%} 가산. 마지막 열은 같은 순이익을 **예전처럼 시공까지 직접 했을 때**의 시간으로 나눈 값이다.{NL}"
              + table(["패키지", "우리 시간", "부대 포함", "순이익", "시간당", "시공 시간(업체)", "직접 시공했다면 시간당"], rows))

    out.append(profit_blocks[0])
    out.append(hourly)
    out.append(profit_blocks[1])
    out.append(f"- 순이익 = 공급가 − 원가 − 설정 A/S 준비금({AS_RESERVE:.0%}) − 업체 몫(− 카드수수료). "
               "'본인 커미셔닝'은 설계·세팅을 직접 해서 그 인건비가 본인 수입이 된 경우(순이익에 인건비 포함), "
               "'커미셔닝 외주'는 그 일까지 사람을 썼을 때다. **시공 인건비는 어느 쪽에도 없다 — 업체 몫이다.**")

    # 손익분기
    rows = [[p.name, won(p.target_price)] + [won(breakeven(p, r, False)) for r in REFERRAL.values()] + [won(breakeven(p, r, True)) for r in REFERRAL.values()] for p in pk]
    out.append(f"{NL}### 4-6. 손익분기 판매가 (순이익 0, 부가세 포함){NL}"
               + table(["패키지", "제안 판매가"] + [f"본인 커미셔닝 · 업체 {k}" for k in REFERRAL] + [f"외주 · 업체 {k}" for k in REFERRAL], rows))

    # 월 시나리오 + 캐파
    rows = []; tr = tp = th = 0.0
    for p in pk:
        n = MIX.get(p.name, 0)
        if not n:
            continue
        sp = supply(p.target_price)
        pr_self = profit(p, 0.20, False) * n
        hours = p.commission_hours * (1 + OVERHEAD) * n
        tr += sp * n; tp += pr_self; th += hours
        rows.append([p.name, str(n), won(sp * n), f"{hours:.1f}h", won(pr_self), won(pr_self / hours)])
    rows.append(["**합계**", str(sum(MIX.values())), won(tr), f"**{th:.1f}h**", f"**{won(tp)}**", won(tp / th)])
    old_hours = sum((p.install_hours + p.commission_hours) * (1 + OVERHEAD) * MIX.get(p.name, 0) for p in pk)
    out.append(f"{NL}### 4-7. 월 시나리오 — 모델 1, 업체 몫 20%, 본인 커미셔닝, 인테리어 업체 1곳에서 월 {sum(MIX.values())}건"
               f"(START 1 · BASIC 1 · STANDARD 2 · PREMIUM 1){NL}"
               f"겸업 가용 시간을 월 {MONTHLY_HOURS}h 로 보면 아래 합계가 그 안에 들어와야 한다. "
               f"시공까지 직접 하던 예전 모델은 같은 5건에 부대시간 포함 약 {old_hours:.0f}h 가 필요해 **겸업으로는 불가능**했다.{NL}"
               + table(["패키지", "건수", "매출(공급가)", "소요 시간(부대 포함)", "순이익", "시간당"], rows))

    # 케어 구독
    care_year = care_profit_year()
    households = int(48 * CARE_TAKE_RATE)
    out.append(f"{NL}### 4-7b. 스마트홈 케어 (월 구독) — 설치 시점에 같이 팔아야 하는 반복 매출{NL}"
               f"월 {CARE_MONTHLY:,}원. 포함: 원격 점검 연 {CARE_VISITS_YEAR}회, 자동화 수정 무제한, 신규 기기 연 2대 등록, 장애 원격 대응. "
               f"**방문은 포함하지 않는다**(할인가 별도) — 무상 출동을 넣으면 적자다.{NL}"
               + table(["항목", "세대당 연 금액"],
                       [["구독 매출(공급가)", won(supply(CARE_MONTHLY * 12))],
                        ["원격 점검 인건비", won(CARE_VISITS_YEAR * CARE_VISIT_HOURS * COMMISSION_HOUR)],
                        ["관제·도구 분담", won(CARE_TOOLING_YEAR)],
                        ["**세대당 연 순이익**", f"**{won(care_year)}**"],
                        [f"월 4건 × 12개월 × 가입률 {CARE_TAKE_RATE:.0%} = 연 {households}세대 누적 시 연 순이익",
                         f"**{won(care_year * households)}**"]]))

    out.append(f"{NL}### 4-8. 항목별 단가표 (견적서용){NL}"
               f"견적서에는 **우리 청구액과 시공비를 반드시 분리 표기**한다. 고객이 총부담을 나중에 알게 되면 신뢰를 잃는다.{NL}"
               + render_units())

    # 시공비 안내
    rows = [[p.name, f"{p.install_hours:g}h", won(install_fee(p)), won(p.target_price), won(p.target_price + install_fee(p)),
             f"{pct(install_fee(p), p.target_price + install_fee(p)):.0f}%"] for p in pk]
    out.append(f"{NL}### 4-9. 고객이 따로 부담하는 시공비 (업체 견적에 들어가는 몫){NL}"
               f"4-8 단가표의 시공비 열을 패키지 구성에 대입한 값. 인테리어 업체가 자기 견적에 넣을 근거이자, "
               f"우리가 상담에서 먼저 밝혀야 하는 금액이다. 시공 시간 단가는 {INSTALL_HOUR:,}원/시간 기준.{NL}"
               + table(["패키지", "시공 시간", "시공비(업체)", "우리 청구액", "고객 총부담", "총부담 중 시공 비중"], rows))
    return NL.join(out)


PACKAGES: list[Package] = [
    Package("START", "외출·귀가 자동화 입문", 790_000, 800_000, 1_500_000, "원룸·소형 기본 구축 공개가 80~150만",
            bom={"hub_station": 1, "motion": 2, "door": 2, "plug": 2, "switch_2gang": 3, "temp": 1},
            install_hours=4, commission_hours=4, integrations=["가전 1종"], automations=2),
    # ir_rf_hub: Wi-Fi·앱 등록이 안 되는 구형 에어컨·TV·선풍기를 리모컨 학습으로 묶는 허브. BASIC 이상 기본 포함(거실 1대), FULL 은 안방까지 2대.
    #            START 는 단가표(4-8) 항목으로 선택 추가. 기본은 Tapo H110(IR, Tapo 앱 → SmartThings·Matter), RF 리모컨 가전이 있으면 Broadlink RM4 Pro(세대 HA 로컬 통합).
    # tablet*:   PREMIUM 이상 벽면 태블릿 대시보드 세트(태블릿·거치대·USB 매립 콘센트·키오스크 앱). 거치대 부착·매립 콘센트는 업체 시공(시공비), 화면 구성은 우리 커미셔닝.
    # 2026-09-15: 커튼을 마마바(레일+모터)로 바꾸고 위 두 가지를 넣으면서 PREMIUM 339→399, FULL 539→619 (v0.4 마진 21%·25% 유지선).
    Package("BASIC", "기본 자동화", 1_190_000, 1_500_000, 2_500_000, "24~34평 기본 구축 150~250만(참고 조사) / 미소 30평대 200~400만 하단",
            bom={"hub_station": 1, "motion": 3, "door": 3, "plug": 3, "switch_2gang": 5, "temp": 2, "leak": 1, "ir_rf_hub": 1},
            install_hours=6, commission_hours=5, integrations=["가전 2종", "구형 가전 리모컨(IR/RF)"], automations=3),
    Package("STANDARD", "표준 (주력)", 1_990_000, 2_000_000, 3_500_000, "20평대 표준 200~350만 / 30평대 200~400만",
            bom={"hub_station": 1, "motion": 4, "door": 3, "plug": 3, "switch_2gang": 6, "temp": 2, "leak": 2, "ir_rf_hub": 1},
            install_hours=8, commission_hours=7, integrations=["도어락", "에어컨", "로봇청소기", "구형 가전 리모컨(IR/RF)"], automations=4, include_design_in_comp=True),
    Package("PREMIUM", "풀 스마트홈 + 세대 HA", 3_990_000, 3_500_000, 7_000_000, "30~40평 아파트 350~700만 / 강남 시작·표준형 300~1,200만",
            bom={"hub_station": 1, "motion": 5, "door": 4, "plug": 5, "switch_2gang": 10, "temp": 3, "leak": 2, "ir_rf_hub": 1, "curtain": 2, "cctv": 1,
                 "hub_m3": 1, "mesh_wifi": 1, "minipc_n100": 1, "tablet": 1, "tablet_mount": 1, "tablet_power": 1, "kiosk_lic": 1},
            install_hours=17, commission_hours=14, integrations=["도어락", "에어컨", "로봇청소기", "TV·냉장고·세탁기", "구형 가전 리모컨(IR/RF)"], automations=6, misc=50_000, include_design_in_comp=True),
    Package("FULL HOME", "전실 조명·커튼·도어락 신규 + HA", 6_190_000, 7_000_000, 15_000_000, "프리미엄 700~1,500만 / 강남 확장·프리미엄형 1,000~2,000만",
            bom={"hub_station": 1, "motion": 6, "door": 5, "plug": 6, "switch_2gang": 12, "temp": 3, "leak": 3, "ir_rf_hub": 2, "curtain": 4, "blind": 1, "cctv": 2,
                 "doorlock": 1, "hub_m3": 1, "mesh_wifi": 1, "minipc_n100": 1, "tablet": 1, "tablet_mount": 1, "tablet_power": 1, "kiosk_lic": 1},
            install_hours=25, commission_hours=18, integrations=["도어락", "에어컨", "로봇청소기", "TV·냉장고·세탁기", "구형 가전 리모컨(IR/RF)", "음성(빅스비·Google)"], automations=8, misc=80_000, include_design_in_comp=True),
]

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(render(PACKAGES))
