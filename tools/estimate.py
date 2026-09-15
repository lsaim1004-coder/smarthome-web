#!/usr/bin/env python3
"""패키지(거실·주방·현관·안방·침실 2 구성 기준) 원가·판매가·사업자 수익 계산 → 마크다운 출력.

사용: python tools/estimate.py > /tmp/estimate.md
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
    "leak":        (9_900, 44_000),      # IKEA KLIPPBOK(Matter, 신형) / Aqara 누수 T1(공식몰 44,000·품절). BADRING 12,900 은 구형 Zigbee → DIRIGERA 필수라 제외
    "plug":        (15_210, 42_900),     # Tapo P110M(Matter, 전력측정, 다나와 15,210·쿠팡 15,390) / Aqara 플러그
    "curtain":     (160_000, 230_000),   # 마마바 전동커튼 1창: 맞춤 레일 49,000 + 길이 추가(2m +8,000 · 3.5m +36,000) + 유선 Wi-Fi 모터 89,000 → 창당 14.6~17.4만(평균 16만) / 무선 모터(159,000) 기준 23만. 커튼 원단 제외, 2026-09-15 mamaba.co.kr
    "blind":       (109_000, 154_500),   # 마마바 전동 블라인드 1창: 무선모터20 79,000 + 롤스크린 ~30,000 / 매터 블라인드 모터25 119,000(SmartThings Station 직접 페어링) + 방염 스크린 35,500
    "ir_rf_hub":   (38_800, 58_740),     # 구형 가전용 리모컨 허브: 저가 = Tapo H110(IR 학습·Matter 인증·SmartThings 지원, 티피링크몰 38,800·공식 39,900) / 일반 = Broadlink RM4 Pro(IR+RF 433/315MHz, RF 리모컨 가전이 있을 때, 58,740). 대안 SwitchBot Hub 2 89,800
    "cctv":        (92_000, 92_000),     # ThingsOne T1 — 국내 리스팅 확인 불가(참고치). 대체 후보 Tapo C210 등 재확인 필요
    "doorlock":    (342_000, 426_310),   # 직방(삼성SDS) SHP-DP960 Plus (설치비 별도)
    "hub_m3":      (172_190, 253_000),   # Aqara 허브 M3 (Matter · IR)
    "mesh_wifi":   (210_000, 259_000),   # ipTIME AX3000M x2 / Deco X50 3팩
    "minipc_n100": (219_000, 329_000),   # GMKtec G3 N100 16GB/512GB / G3 Plus N150 16GB/1TB
    "ups":         (184_000, 188_000),   # APC BE550-KR
    "tablet":      (199_640, 360_030),   # 벽면 대시보드 태블릿: 레노버 탭 M11 128GB Wi-Fi(다나와 199,640) / 갤럭시탭 A9+ 11" 64GB(360,030, 20곳). 2026-09-15
    "tablet_mount": (25_600, 42_500),    # 벽걸이 거치대: 쿠팡 접이식 벽걸이(25,600) / 엔산마운트 PAD-W02 자석형 7~12.9"(42,500)
    "tablet_power": (38_000, 64_000),    # 태블릿 상시 전원용 USB 매립 콘센트: 인채널 노바 1구(38,000) / 인채널 회전 USB 2구 IBC-22M(64,000). 전기공사 단계에 시공
    "kiosk_lic":   (12_000, 12_000),     # Fully Kiosk Browser PLUS 기기당 1회 €7.90(≈12,000원)
}
LABEL = {
    "hub_station": "SmartThings 허브(Station)", "switch_2gang": "조명 스위치 2구", "motion": "모션 센서", "door": "문·창문 센서",
    "temp": "온습도 센서", "leak": "누수 센서", "plug": "스마트 플러그(전력측정)", "curtain": "전동 커튼 1창(마마바 레일+모터)", "blind": "전동 블라인드 1창(마마바)",
    "ir_rf_hub": "구형 가전 리모컨 허브(IR, RF 필요 시 교체)", "cctv": "실내 CCTV",
    "doorlock": "스마트 도어락(삼성SDS)", "hub_m3": "Aqara 허브 M3", "mesh_wifi": "메시 Wi-Fi 1세트", "minipc_n100": "N100 미니PC(세대 HA)", "ups": "UPS",
    "tablet": "벽면 태블릿(11인치)", "tablet_mount": "태블릿 벽 거치대", "tablet_power": "USB 매립 콘센트(태블릿 전원)", "kiosk_lic": "키오스크 앱 라이선스",
}

# ---------------------------------------------------------------------------
# 2) 가정 (부가세 제외 기준)
# ---------------------------------------------------------------------------
LABOR_HOUR = 40_000       # 설치 기술자 외주 시간 단가 (조사: 전기기술자 5~10만/시간 → 보수적 4만)
SETUP_HOUR = 40_000       # 설계·세팅·자동화·교육 시간 단가
AS_RESERVE = 0.05         # A/S 준비금 (공급가 대비)
CARD_FEE = 0.02           # 직접 판매 시 카드 수수료
REFERRAL = {"15%": 0.15, "20%": 0.20, "25%": 0.25}   # 인테리어 업체 파트너 마진 (참고 조사 15~25%)
MIX = {"START": 1, "BASIC": 1, "STANDARD": 2, "PREMIUM": 1, "FULL HOME": 0}   # 월 시나리오 건수 (업체 1곳)

# 경쟁 기준 설치 단가 (아카라라이프 공개가 + 추정)
COMP_TRIP = 50_000; COMP_SWITCH = 50_000; COMP_CURTAIN = 140_000; COMP_SENSOR = 10_000; COMP_DOORLOCK = 30_000; COMP_DESIGN = 330_000


@dataclass
class Package:
    name: str
    tagline: str
    target_price: int                 # 제안 판매가 (부가세 포함)
    market_low: int                   # 공개 시장 가격대 (부가세 포함)
    market_high: int
    market_label: str
    bom: dict[str, int]
    labor_hours: float
    setup_hours: float
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
    devices = supply(bom_std(p) if std_devices else bom_low(p))
    return {
        "기기": devices,
        "설치 인건비": p.labor_hours * LABOR_HOUR,
        "설계·세팅·교육": p.setup_hours * SETUP_HOUR,
        "소모품·이동": supply(p.misc),
    }


def competitor_itemized(p: Package) -> float:
    """아카라 방식: 출장 + 항목별 설치비 (+설계) + 동일 기기 일반가."""
    b = p.bom
    fee = COMP_TRIP + COMP_SWITCH * b.get("switch_2gang", 0) + COMP_CURTAIN * b.get("curtain", 0) \
        + COMP_SENSOR * (b.get("motion", 0) + b.get("door", 0) + b.get("temp", 0) + b.get("leak", 0)) \
        + COMP_DOORLOCK * b.get("doorlock", 0)
    if p.include_design_in_comp:
        fee += COMP_DESIGN
    return fee + bom_std(p)


def profit(p: Package, referral: float, self_labor: bool, card: float = 0.0, std_devices: bool = False) -> float:
    sp = supply(p.target_price)
    c = costs(p, std_devices)
    total = sum(c.values()) - ((c["설치 인건비"] + c["설계·세팅·교육"]) if self_labor else 0)
    return sp - total - sp * AS_RESERVE - sp * referral - sp * card


def breakeven(p: Package, referral: float, self_labor: bool) -> float:
    c = costs(p)
    total = sum(c.values()) - ((c["설치 인건비"] + c["설계·세팅·교육"]) if self_labor else 0)
    return total / (1 - AS_RESERVE - referral) * (1 + VAT)


def table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join([" --- "] * len(header)) + "|"]
    lines += ["| " + " | ".join(r) + " |" for r in rows]
    return NL.join(lines)


# ---------------------------------------------------------------------------
# 3) 항목별 단가표 (견적서용: 기기 + 설치 + 자동화 + 테스트·A/S)
# ---------------------------------------------------------------------------
UNITS: list[tuple[str, str | None, int, int, int]] = [
    # (항목, 기기 key(None=기기 없음), 설치비, 자동화 설정비, 테스트·A/S)
    ("출장비 (건당)", None, 50_000, 0, 0),
    ("SmartThings 허브 설치 · 계정 · 공간 구성", "hub_station", 30_000, 30_000, 10_000),
    ("스마트 조명 스위치 2구 (무중성선)", "switch_2gang", 35_000, 20_000, 10_000),
    ("모션 센서", "motion", 10_000, 10_000, 5_000),
    ("문·창문 센서", "door", 10_000, 10_000, 5_000),
    ("온습도 센서", "temp", 10_000, 5_000, 5_000),
    ("누수 센서", "leak", 10_000, 10_000, 5_000),
    ("스마트 플러그 (전력측정)", "plug", 10_000, 10_000, 5_000),
    ("전동 커튼 1창 (마마바 맞춤 레일 + 유선 Wi-Fi 모터, 커튼 원단 별도)", "curtain", 100_000, 20_000, 10_000),   # 마마바 방문설치 9~14만 → 자체 시공 10만
    ("전동 블라인드 1창 (마마바 모터 + 롤스크린)", "blind", 60_000, 20_000, 10_000),
    ("구형 가전 리모컨 허브 (Tapo H110 IR 학습, RF 리모컨 가전은 Broadlink RM4 Pro 로 교체)", "ir_rf_hub", 10_000, 30_000, 10_000),
    ("실내 CCTV", "cctv", 30_000, 10_000, 10_000),
    ("스마트 도어락 (신규 설치)", "doorlock", 80_000, 20_000, 10_000),   # 시장: 설치비 포함가 − 별도가 = 약 10.8만
    ("도어락 · 가전 계정 연동 (보유 기기 1종)", None, 0, 25_000, 5_000),
    ("생활 장면 자동화 1개 (외출·귀가·취침 등)", None, 0, 30_000, 10_000),
    ("Aqara 허브 M3 (Matter · IR 리모컨 통합)", "hub_m3", 30_000, 30_000, 10_000),
    ("메시 Wi-Fi 1세트 설치 · 최적화", "mesh_wifi", 80_000, 20_000, 10_000),
    ("세대 HA 서버 (N100 미니PC) 구축", "minipc_n100", 100_000, 100_000, 20_000),
    ("벽면 태블릿 대시보드 — 태블릿 본체 + 키오스크·방별 화면 구성", "tablet", 20_000, 60_000, 10_000),
    ("벽면 태블릿 — 벽 거치대 설치", "tablet_mount", 20_000, 0, 0),
    ("벽면 태블릿 — USB 매립 콘센트 (전기공사 단계)", "tablet_power", 30_000, 0, 0),
    ("벽면 태블릿 — 키오스크 앱 라이선스", "kiosk_lic", 0, 0, 0),
]


def render_units() -> str:
    rows = []
    for name, key, inst, auto, asfee in UNITS:
        dev_low = PRICE[key][0] if key else 0
        dev_std = PRICE[key][1] if key else 0
        rows.append([name, won(dev_low) if key else "-", won(dev_std) if key else "-", won(inst), won(auto), won(asfee),
                     f"**{won(dev_low + inst + auto + asfee)}**", won(dev_std + inst + auto + asfee)])
    return table(["항목", "기기(저가 스택)", "기기(일반)", "설치", "자동화 설정", "테스트·A/S", "고객가(저가 스택)", "고객가(일반)"], rows)


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
    rows.append(["설치 / 설계·세팅 시간"] + [f"{p.labor_hours:g}h / {p.setup_hours:g}h" for p in pk])
    rows.append(["**기기 합계 (저가 스택)**"] + [f"**{won(bom_low(p))}**" for p in pk])
    rows.append(["기기 합계 (일반)"] + [won(bom_std(p)) for p in pk])
    out.append(table(["항목"] + [f"{p.name}<br><small>{p.tagline}</small>" for p in pk], rows))

    # 원가
    rows = []
    for p in pk:
        c = costs(p); total = sum(c.values())
        rows.append([p.name] + [won(v) for v in c.values()] + [f"**{won(total)}**", won(total * (1 + VAT)), won(sum(costs(p, True).values()))])
    out.append(f"{NL}### 4-2. 패키지별 원가 (부가세 제외, 설치·설계를 외주로 볼 때){NL}"
               f"설치 {LABOR_HOUR:,}원/시간 · 설계·세팅 {SETUP_HOUR:,}원/시간 · 기기는 저가 스택 최저가 조달(매입세액 공제). 마지막 열은 Aqara 일반가로 살 때.{NL}"
               + table(["패키지", "기기", "설치 인건비", "설계·세팅·교육", "소모품·이동", "원가 합계", "(부가세 포함)", "일반가 기기일 때 원가"], rows))

    # 판매가 vs 시장
    rows = []
    for p in pk:
        comp = competitor_itemized(p)
        pos = pct(p.target_price - p.market_low, p.market_high - p.market_low)
        rows.append([p.name, f"**{won(p.target_price)}**", f"{won(p.market_low)} ~ {won(p.market_high)}<br><small>{p.market_label}</small>",
                     f"{pos:.0f}% 지점", won(comp), f"{pct(p.target_price - comp, comp):+.0f}%"])
    out.append(f"{NL}### 4-3. 제안 판매가 vs 시장 가격대 (부가세 포함 고객가){NL}"
               "'시장 가격대 내 위치' 0% = 하단, 100% = 상단. '경쟁 항목별 기준가' = 아카라라이프 공개 설치 단가(출장 5만 · 스위치 5만/개 · 커튼 14만/개, 센서 1만/개 추정"
               f" · 도어락 3만) + STANDARD 이상은 설계 검증 33만 + 동일 기기 일반가.{NL}"
               + table(["패키지", "제안 판매가", "공개 시장 가격대", "시장 가격대 내 위치", "경쟁 항목별 기준가", "경쁩 대비"], rows).replace("경쁩", "경쟁"))

    # 순이익
    header = ["패키지", "공급가"] + [f"외주 시공 · 업체 {k}" for k in REFERRAL] + [f"본인 시공 · 업체 {k}" for k in REFERRAL]
    for title, card in (("4-4. 사업자 순이익 — 모델 1 하도급형 (업체가 고객에게 판매, 우리는 업체에 공급)", 0.0),
                        (f"4-5. 사업자 순이익 — 모델 2 직접판매형 (우리가 고객 청구, 업체에 소개수수료, 카드수수료 {CARD_FEE:.0%} 부담)", CARD_FEE)):
        rows = []
        for p in pk:
            sp = supply(p.target_price)
            cells = [p.name, won(sp)]
            for self_labor in (False, True):
                for r in REFERRAL.values():
                    pr = profit(p, r, self_labor, card)
                    cells.append(f"{won(pr)} ({pct(pr, sp):.0f}%)")
            rows.append(cells)
        out.append(f"{NL}### {title}{NL}업체 몫 = 판매 공급가의 15 / 20 / 25 %. 괄호는 공급가 대비 순이익률.{NL}" + table(header, rows))
    out.append(f"- 순이익 = 공급가 − 원가 − A/S 준비금({AS_RESERVE:.0%}) − 업체 몫(− 카드수수료). '본인 시공'은 설치·설계를 직접 해서 그 인건비가 본인 수입이 된 경우(순이익에 인건비 포함).")

    # 손익분기
    rows = [[p.name, won(p.target_price)] + [won(breakeven(p, r, False)) for r in REFERRAL.values()] + [won(breakeven(p, r, True)) for r in REFERRAL.values()] for p in pk]
    out.append(f"{NL}### 4-6. 손익분기 판매가 (순이익 0, 부가세 포함){NL}"
               + table(["패키지", "제안 판매가"] + [f"외주 · 업체 {k}" for k in REFERRAL] + [f"본인 · 업체 {k}" for k in REFERRAL], rows))

    # 월 시나리오
    rows = []; tr = tp = tl = 0.0
    for p in pk:
        n = MIX.get(p.name, 0)
        if not n:
            continue
        sp = supply(p.target_price); c = costs(p)
        pr_self = profit(p, 0.20, True) * n
        labor = (c["설치 인건비"] + c["설계·세팅·교육"]) * n
        tr += sp * n; tp += pr_self; tl += labor
        rows.append([p.name, str(n), won(sp * n), won(pr_self - labor), won(labor), won(pr_self)])
    rows.append(["**합계**", str(sum(MIX.values())), won(tr), won(tp - tl), won(tl), f"**{won(tp)}**"])
    out.append(f"{NL}### 4-7. 월 시나리오 — 모델 1, 업체 몫 20%, 본인 시공, 인테리어 업체 1곳에서 월 {sum(MIX.values())}건"
               f"(START 1 · BASIC 1 · STANDARD 2 · PREMIUM 1){NL}"
               + table(["패키지", "건수", "매출(공급가)", "기기·소모품·업체몫 뺀 마진", "본인 인건비(설치+설계)", "월 총수입"], rows))

    out.append(f"{NL}### 4-8. 항목별 단가표 (견적서용) — 기기 + 설치 + 자동화 + 테스트·A/S{NL}"
               "시장 공개 사례(출장 4만 + 모션센서 3만 + 스위치 4.5만 = 11.5만, 허브 추가 시 +9.1만)와 같은 방식으로 항목마다 기기값과 서비스비를 분리 표기한다.{NL}"
               + render_units())
    return NL.join(out)


PACKAGES: list[Package] = [
    Package("START", "외출·귀가 자동화 입문", 990_000, 800_000, 1_500_000, "원룸·소형 기본 구축 공개가 80~150만",
            bom={"hub_station": 1, "motion": 2, "door": 2, "plug": 2, "switch_2gang": 3, "temp": 1},
            labor_hours=4, setup_hours=3, integrations=["가전 1종"], automations=2),
    # ir_rf_hub: Wi-Fi·앱 등록이 안 되는 구형 에어컨·TV·선풍기를 리모컨 학습으로 묶는 허브. BASIC 이상 기본 포함(거실 1대), FULL 은 안방까지 2대.
    #            START 는 단가표(4-8) 항목으로 선택 추가. 기본은 Tapo H110(IR, Tapo 앱 → SmartThings 연동·Matter), RF 리모컨 가전이 있으면 Broadlink RM4 Pro(HA 로컬 통합).
    Package("BASIC", "기본 자동화", 1_490_000, 1_500_000, 2_500_000, "24~34평 기본 구축 150~250만(참고 조사) / 미소 30평대 200~400만 하단",
            bom={"hub_station": 1, "motion": 3, "door": 3, "plug": 3, "switch_2gang": 5, "temp": 2, "leak": 1, "ir_rf_hub": 1},
            labor_hours=6, setup_hours=4, integrations=["가전 2종", "구형 가전 리모컨(IR/RF)"], automations=3),
    Package("STANDARD", "표준 (주력)", 2_490_000, 2_000_000, 3_500_000, "20평대 표준 200~350만 / 30평대 200~400만",
            bom={"hub_station": 1, "motion": 4, "door": 3, "plug": 3, "switch_2gang": 6, "temp": 2, "leak": 2, "ir_rf_hub": 1},
            labor_hours=8, setup_hours=6, integrations=["도어락", "에어컨", "로봇청소기", "구형 가전 리모컨(IR/RF)"], automations=4, include_design_in_comp=True),
    Package("PREMIUM", "풀 스마트홈 + 세대 HA", 5_290_000, 3_500_000, 7_000_000, "30~40평 아파트 350~700만 / 강남 시작·표준형 300~1,200만",
            bom={"hub_station": 1, "motion": 5, "door": 4, "plug": 5, "switch_2gang": 10, "temp": 3, "leak": 2, "ir_rf_hub": 1, "curtain": 2, "cctv": 1,
                 "hub_m3": 1, "mesh_wifi": 1, "minipc_n100": 1, "tablet": 1, "tablet_mount": 1, "tablet_power": 1, "kiosk_lic": 1},
            labor_hours=17, setup_hours=12, integrations=["도어락", "에어컨", "로봇청소기", "TV·냉장고·세탁기", "구형 가전 리모컨(IR/RF)"], automations=6, misc=50_000, include_design_in_comp=True),
    Package("FULL HOME", "전실 조명·커튼·도어락 신규 + HA", 7_990_000, 7_000_000, 15_000_000, "프리미엄 700~1,500만 / 강남 확장·프리미엄형 1,000~2,000만",
            bom={"hub_station": 1, "motion": 6, "door": 5, "plug": 6, "switch_2gang": 12, "temp": 3, "leak": 3, "ir_rf_hub": 2, "curtain": 4, "blind": 1, "cctv": 2,
                 "doorlock": 1, "hub_m3": 1, "mesh_wifi": 1, "minipc_n100": 1, "tablet": 1, "tablet_mount": 1, "tablet_power": 1, "kiosk_lic": 1},
            labor_hours=26, setup_hours=16, integrations=["도어락", "에어컨", "로봇청소기", "TV·냉장고·세탁기", "구형 가전 리모컨(IR/RF)", "음성(빅스비·Google)"], automations=8, misc=80_000, include_design_in_comp=True),
]

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(render(PACKAGES))
