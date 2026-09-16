/**
 * 에너지 관리 섹션.
 *
 * 두 그래프 모두 실제로 운영 중인 집의 Home Assistant 에서 그대로 가져온 값이다.
 * 없는 실적을 지어내지 않는다는 사이트 원칙에 따라 임의의 예시 숫자를 쓰지 않는다.
 * 가구 구성원을 특정할 수 있는 방 이름은 중립적인 명칭으로 바꿔 적었다.
 *
 * 색 규칙
 *  - 범주형 2슬롯: 냉방 #2a78d6 / 그 외 #eb6834 (검증 스크립트 전 항목 통과)
 *  - 선 그래프는 단일 시리즈라 범례 없이 한 가지 색만 쓴다
 *  - 값·축·라벨 텍스트는 절대 시리즈 색을 입지 않는다 (사이트 잉크 토큰 사용)
 *  - 사이트 자체가 라이트 전용이라 다크 팔레트는 두지 않는다
 */

const SERIES = {
  cool: '#2a78d6',
  etc: '#eb6834',
} as const

const INK = '#0f172a'
const INK2 = '#334155'
const MUTED = '#64748b'
const GRID = '#e2e8f0'

/* ── 1. 기기별 이번 달 사용량 (kWh) ───────────────────────────── */

type Row = { name: string; kwh: number; group: keyof typeof SERIES }

const MONTHLY: Row[] = [
  { name: '거실 에어컨', kwh: 44.2, group: 'cool' },
  { name: '안방 에어컨', kwh: 21.4, group: 'cool' },
  { name: '전기레인지', kwh: 10.7, group: 'etc' },
  { name: '작은방 에어컨', kwh: 7.8, group: 'cool' },
  { name: '정수기', kwh: 4.9, group: 'etc' },
  { name: '컴퓨터방 에어컨', kwh: 4.3, group: 'cool' },
]

const TOTAL = MONTHLY.reduce((s, r) => s + r.kwh, 0)
const COOL = MONTHLY.filter((r) => r.group === 'cool').reduce((s, r) => s + r.kwh, 0)
const COOL_PCT = Math.round((COOL / TOTAL) * 100)

const B = { x0: 128, w: 400, top: 18, rowH: 34, barH: 16, max: 50 }
const BAR_TICKS = [0, 10, 20, 30, 40, 50]
const bx = (v: number) => B.x0 + (v / B.max) * B.w
const barHeight = B.top + MONTHLY.length * B.rowH + 32

/** 막대: 기준선 쪽은 각지게, 데이터 끝만 4px 둥글게 */
function barPath(x0: number, y: number, w: number, h: number, r = 4) {
  const x1 = x0 + w
  const rr = Math.min(r, w)
  return `M${x0},${y} H${x1 - rr} Q${x1},${y} ${x1},${y + rr} V${y + h - rr} Q${x1},${y + h} ${x1 - rr},${y + h} H${x0} Z`
}

function MonthlyChart() {
  const axisY = B.top + MONTHLY.length * B.rowH

  return (
    <svg
      className="chart"
      viewBox={`0 0 620 ${barHeight}`}
      role="img"
      aria-label={`이번 달 기기별 전력 사용량. 합계 ${TOTAL.toFixed(1)} 킬로와트시. ${MONTHLY.map(
        (r) => `${r.name} ${r.kwh} 킬로와트시`,
      ).join(', ')}.`}
    >
      {BAR_TICKS.map((t) => (
        <line key={t} x1={bx(t)} y1={B.top - 6} x2={bx(t)} y2={axisY} stroke={GRID} strokeWidth={1} />
      ))}

      {MONTHLY.map((r, i) => {
        const y = B.top + i * B.rowH + (B.rowH - B.barH) / 2
        const w = (r.kwh / B.max) * B.w
        return (
          <g key={r.name}>
            <text x={B.x0 - 12} y={y + B.barH / 2 + 4} textAnchor="end" fontSize={13} fill={INK2}>
              {r.name}
            </text>
            <path d={barPath(B.x0, y, w, B.barH)} fill={SERIES[r.group]}>
              <title>{`${r.name} · ${r.kwh} kWh`}</title>
            </path>
            <text x={B.x0 + w + 9} y={y + B.barH / 2 + 4} fontSize={13} fontWeight={700} fill={INK}>
              {r.kwh}
            </text>
          </g>
        )
      })}

      <line x1={B.x0} y1={axisY} x2={bx(B.max)} y2={axisY} stroke={GRID} strokeWidth={1} />
      {BAR_TICKS.map((t) => (
        <text key={t} x={bx(t)} y={axisY + 18} textAnchor="middle" fontSize={11} fill={MUTED}>
          {t}
        </text>
      ))}
      <text x={bx(B.max) + 10} y={axisY + 18} fontSize={11} fill={MUTED}>
        kWh
      </text>
    </svg>
  )
}

/* ── 2. 하루 전력 곡선 (kW) ───────────────────────────────────── */

/** 어제 낮 12시 ~ 오늘 아침 8시, 시간별 평균 실측값 */
const HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8]
const KW = [
  0.042, 0.045, 0.044, 0.043, 0.043, 0.042, 0.042, 0.045, 0.057, 0.34, 0.326, 0.085, 0.078, 0.08, 0.136, 0.206,
  0.206, 0.167, 0.054, 0.05, 0.045,
]

const STANDBY = 0.042
const PEAK_I = KW.indexOf(Math.max(...KW))

const L = { x0: 46, x1: 596, top: 16, base: 170, max: 0.36 }
const lx = (i: number) => L.x0 + (i / (KW.length - 1)) * (L.x1 - L.x0)
const ly = (v: number) => L.base - (v / L.max) * (L.base - L.top)

const LINE_PATH = KW.map((v, i) => `${i ? 'L' : 'M'}${lx(i).toFixed(1)},${ly(v).toFixed(1)}`).join(' ')
const AREA_PATH = `${LINE_PATH} L${lx(KW.length - 1).toFixed(1)},${L.base} L${L.x0},${L.base} Z`
const Y_TICKS = [0, 0.1, 0.2, 0.3]
const X_TICKS = [0, 3, 6, 9, 12, 15, 18]

function DayChart() {
  return (
    <svg
      className="chart"
      viewBox="0 0 620 214"
      role="img"
      aria-label={`하루 전력 곡선. 어제 12시부터 오늘 8시까지 시간별 평균. 최저 ${STANDBY} 킬로와트, 최고 ${KW[PEAK_I]} 킬로와트, 최고 시각 ${HOURS[PEAK_I]}시.`}
    >
      {Y_TICKS.map((t) => (
        <g key={t}>
          <line x1={L.x0} y1={ly(t)} x2={L.x1} y2={ly(t)} stroke={GRID} strokeWidth={1} />
          <text x={L.x0 - 10} y={ly(t) + 4} textAnchor="end" fontSize={11} fill={MUTED}>
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      <path d={AREA_PATH} fill={SERIES.cool} opacity={0.1} />
      <path d={LINE_PATH} fill="none" stroke={SERIES.cool} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* 대기전력 기준선 */}
      <line x1={L.x0} y1={ly(STANDBY)} x2={L.x1} y2={ly(STANDBY)} stroke={MUTED} strokeWidth={1} strokeDasharray="4 4" />
      <text
        x={L.x1}
        y={ly(STANDBY) + 13}
        textAnchor="end"
        fontSize={11}
        fill={MUTED}
        stroke="#ffffff"
        strokeWidth={3}
        paintOrder="stroke"
      >
        아무도 안 쓸 때 42W
      </text>

      {/* 최고점만 직접 라벨 — 모든 점에 숫자를 붙이지 않는다 */}
      <circle cx={lx(PEAK_I)} cy={ly(KW[PEAK_I])} r={5} fill={SERIES.cool} stroke="#ffffff" strokeWidth={2} />
      <text x={lx(PEAK_I)} y={ly(KW[PEAK_I]) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill={INK}>
        {HOURS[PEAK_I]}시 0.34kW
      </text>

      {/* 호버용 히트 타깃 — 마크보다 크게 */}
      {KW.map((v, i) => (
        <circle key={HOURS[i]} cx={lx(i)} cy={ly(v)} r={11} fill="transparent">
          <title>{`${HOURS[i]}시 · ${v} kW`}</title>
        </circle>
      ))}

      <line x1={L.x0} y1={L.base} x2={L.x1} y2={L.base} stroke={GRID} strokeWidth={1} />
      {X_TICKS.map((i) => (
        <text key={i} x={lx(i)} y={L.base + 18} textAnchor="middle" fontSize={11} fill={MUTED}>
          {String(HOURS[i]).padStart(2, '0')}시
        </text>
      ))}
      <text x={L.x0 - 10} y={L.top + 2} textAnchor="end" fontSize={11} fill={MUTED}>
        kW
      </text>
      <text x={L.x1} y={L.base + 36} textAnchor="end" fontSize={11} fill={MUTED}>
        어제 낮 → 오늘 아침
      </text>
    </svg>
  )
}

/* ── 섹션 ─────────────────────────────────────────────────────── */

const USES = [
  {
    head: '요금 고지서가 오기 전에 압니다',
    body: '누진 구간을 넘길 속도로 쓰고 있으면 달 중간에 알림이 옵니다. 청구서를 받고 놀라는 대신 그 전에 줄입니다.',
  },
  {
    head: '안 쓰는데 나가는 전기를 찾습니다',
    body: '위 곡선의 점선이 새벽 대기전력입니다. 어떤 기기가 그걸 만드는지 플러그 단위로 보이면 끌 수 있습니다.',
  },
  {
    head: '숫자가 자동화의 방아쇠가 됩니다',
    body: '“세탁기가 30분째 5W 밑이면 다 돌아간 것” 처럼, 소비 전력을 조건으로 알림과 장면을 겁니다.',
  },
  {
    head: '고장을 먼저 눈치챕니다',
    body: '늘 쓰던 양보다 갑자기 많이 먹기 시작한 가전은 이상 신호입니다. 냉장고 · 에어컨에서 실제로 잡힙니다.',
  },
]

export default function EnergyBoard() {
  return (
    <section className="energy" aria-labelledby="energy-title">
      <div className="flow-head">
        <p className="kicker amber">에너지</p>
        <h2 id="energy-title">집 전체 한 숫자가 아니라, 가전 하나하나로 보입니다</h2>
        <p>
          한전 고지서에 찍히는 건 집 전체 한 줄입니다. Home Assistant 는 기기마다 따로 셉니다. 어느 가전이 얼마를 먹는지
          보이기 시작하면 그때부터 줄일 수 있습니다. 아래 두 그래프는 <b>실제로 운영 중인 집에서 그대로 가져온 값</b>
          입니다.
        </p>
      </div>

      <div className="energy-stats">
        <article className="estat">
          <p className="estat-label">이번 달 측정 합계</p>
          <p className="estat-value">
            {TOTAL.toFixed(1)}
            <span>kWh</span>
          </p>
          <p className="estat-note">가전 {MONTHLY.length}대 기준</p>
        </article>
        <article className="estat">
          <p className="estat-label">그중 냉방이 차지한 몫</p>
          <p className="estat-value">
            {COOL_PCT}
            <span>%</span>
          </p>
          <p className="estat-note">에어컨 4대 합계 {COOL.toFixed(1)} kWh</p>
        </article>
        <article className="estat">
          <p className="estat-label">아무도 안 쓸 때 기본 소비</p>
          <p className="estat-value">
            42<span>W</span>
          </p>
          <p className="estat-note">새벽 시간대 바닥값</p>
        </article>
      </div>

      <figure className="chart-card">
        <figcaption>
          <h3>기기별 이번 달 사용량</h3>
          <p className="chart-legend">
            <span className="lg">
              <i style={{ background: SERIES.cool }} aria-hidden="true" />
              냉방
            </span>
            <span className="lg">
              <i style={{ background: SERIES.etc }} aria-hidden="true" />그 외 가전
            </span>
          </p>
          <p className="chart-sub">
            에어컨 넉 대가 이번 달 전기의 {COOL_PCT}% 를 썼습니다. 거실 한 대만 {MONTHLY[0].kwh} kWh 로, 나머지 다섯 대를
            합친 것보다 많습니다. 고지서 한 줄만 봐서는 알 수 없는 숫자입니다.
          </p>
        </figcaption>
        <div className="chart-scroll">
          <MonthlyChart />
        </div>
      </figure>

      <figure className="chart-card">
        <figcaption>
          <h3>하루 전력 곡선</h3>
          <p className="chart-sub">
            어제 낮부터 오늘 아침까지 시간별 평균입니다. 저녁 {HOURS[PEAK_I]}시에 {KW[PEAK_I]} kW 로 올라갔다가, 새벽에는
            42W 언저리까지 내려갑니다. 이 바닥값이 <b>아무것도 안 하는데 계속 나가는 전기</b>입니다.
          </p>
        </figcaption>
        <div className="chart-scroll">
          <DayChart />
        </div>
        <table className="sr-only">
          <caption>하루 전력 곡선 데이터</caption>
          <thead>
            <tr>
              <th scope="col">시각</th>
              <th scope="col">평균 전력 (kW)</th>
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h, i) => (
              <tr key={h}>
                <th scope="row">{h}시</th>
                <td>{KW[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>

      <div className="energy-uses">
        <h3>이 숫자로 할 수 있는 일</h3>
        <ul>
          {USES.map((u) => (
            <li key={u.head}>
              <b>{u.head}</b>
              <span>{u.body}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="energy-note">
        측정 범위는 솔직하게 말씀드립니다. <b>스마트 플러그를 물린 기기</b>와 <b>제조사가 사용량을 보고해 주는 가전</b>
        (LG · 삼성 일부 모델)만 따로 잡힙니다. 붙박이 조명이나 인덕션처럼 플러그를 물릴 수 없는 회로까지 보시려면
        분전반에 별도 계측기를 다는 공사가 필요하고, 그건 업체 전기팀 견적에 들어갑니다. 패키지에 기본으로 넣지 않는
        이유입니다.
      </p>
    </section>
  )
}
