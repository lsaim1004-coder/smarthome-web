import type { Opening, Room, Wall } from './types'
import { newId } from './types'

/**
 * 도면 그림에서 **평면 전체**를 뽑는다 — 벽 · 문·창 · 방.
 *
 * 벽만 찾으면 문·창 자리에서 끊긴 조각이 흩어져 3D 가 부서져 보인다.
 * 그래서 세 단계로 간다:
 *
 *   1) 벽 띠 찾기   두꺼운 것만 남긴다(치수선·글자는 얇다)
 *   2) 잇고 뚫기    같은 선 위 조각을 잇고, 메운 틈을 문·창으로 되돌려 놓는다
 *   3) 방 찾기      이어진 벽으로 닫힌 영역을 칠해 방으로 만든다
 *
 * 축척은 벽 두께로 잰다 — 도면은 벽을 실제 두께대로 그린다.
 *
 * 결과는 **초안**이다. 도면마다 선 두께·범례가 달라 완벽할 수 없고, 그래서 편집기에서 고친다.
 */

export type PlanResult = {
  walls: Wall[]
  openings: Opening[]
  rooms: Room[]
  /**
   * 원본 이미지 1픽셀이 몇 mm 인지 **어림한** 값. 못 구하면 null.
   *
   * 벽 두께로 재는데, 도면을 실제 두께대로 그린 경우에만 맞는다.
   * 작게 축소된 그림이나 양식화된 평면도에서는 2배 넘게 틀릴 수 있다 —
   * 그래서 화면에서 "전체 가로 길이" 한 칸으로 바로잡게 해 두었다.
   */
  mmPerPx: number | null
  /** 찾은 벽 전체의 가로 범위(비율). 전체 폭을 입력받아 축척을 다시 잡을 때 쓴다. */
  extent: { x1: number; x2: number; y: number } | null
  note: string
}

/** 처리 해상도. 더 키워도 정확도가 오르지 않는다. */
const WORK_WIDTH = 1200
/** 이 반지름보다 얇은 선은 벽이 아니다. */
const ERODE_R = 2
/**
 * 벽으로 볼 어두운 픽셀 비율. Otsu 는 바닥 무늬까지 끌어와 못 쓴다(임계 174, 어두운 픽셀 23%).
 * 실측 도면에서 임계 110~120 이 가장 좋았고, 그 지점이 대략 상위 8.5% 였다.
 * 상한을 125 로 눌러 둔 이유: 더 올라가면 나무 바닥이 섞여 벽이 덩어리에 먹힌다.
 */
const DARK_FRACTION = 0.085
/**
 * 국소 임계값을 잴 창의 반지름(작업 픽셀). 방 하나가 들어갈 만큼 넓어야
 * 창 안의 평균이 "바탕"이 된다. 좁으면 굵은 벽 안쪽이 바탕으로 잡혀 속이 빈다.
 */
const LOCAL_R = 40
/** 바탕보다 이 비율만큼 어두우면 선으로 본다. */
const LOCAL_DROP = 0.14
/** 바탕과의 밝기 차가 이보다 작으면 JPEG 잡티다. */
const LOCAL_MIN_DIFF = 16
/**
 * 얇은 선 패스에서 요구하는 최소 길이(작업 폭 대비).
 * 연하게 그린 벽은 얇지만 길다. 글자·가구·치수 눈금은 짧다 — 길이로 가른다.
 */
const THIN_MIN_LEN_RATIO = 0.045
/**
 * 마주 보는 두 선을 한 벽으로 합칠 최대 간격(mm).
 * 도면은 벽을 속 빈 이중선으로 그리는 일이 많다 — 두 면 사이가 곧 벽 두께다.
 * 벽은 아무리 두꺼워도 이 정도고, 붙박이장 같은 좁은 공간도 이보다는 넓다.
 */
const PAIR_MAX_MM = 320
/**
 * 종이보다 이만큼 어두우면 "그려진 것"으로 본다.
 *
 * 고정 밝기로 자를 수 없다. 실측한 도면은 바탕이 251, 배경 격자가 247 이라 247 로 자르면
 * 격자가 통째로 그림이 되고 화면 전체가 건물이 된다. 종이 밝기를 도면에서 직접 재고
 * 거기서 떨어진 정도로 판단해야 한다.
 */
const CONTENT_DROP = 14
/** 아파트 도면의 벽 두께(내벽 150·외벽 200)에서 중앙값으로 잡은 값. 실측으로 맞췄다. */
const ASSUMED_WALL_MM = 200

const MIN_LEN = 18
const MAX_BAND = 26
const SAME_LINE = 5

/** 이 폭까지는 벽이 이어진 것으로 보고 틈을 문·창으로 만든다. */
const MAX_GAP_MM = 2600
/** 이보다 좁은 틈은 문, 넓으면 창으로 본다. */
const DOOR_MAX_MM = 1200
/**
 * 개구부로 인정할 최소 폭. 이보다 좁은 틈은 검출이 튄 것이지 문이 아니다.
 * 구멍을 함부로 내면 3D 에 빈 곳이 생긴다 — 애매하면 막아 두는 쪽이 낫다.
 */
const OPENING_MIN_MM = 600
/** 이보다 작은 영역은 방이 아니다(벽 사이 틈·다용도 공간). */
const MIN_ROOM_M2 = 2.0
/** 이보다 색이 진하면 벽이 아니다(치수선·바닥 채색). */
const SATURATION_MAX = 40

/** `keep` 은 건물 외곽선에서 나온 조각이라는 표시다 — 얇아도 버리지 않는다. */
type Seg = { h: boolean; a: number; b: number; c: number; thick: number; keep?: boolean }

export function detectPlan(img: HTMLImageElement): PlanResult {
  const empty: PlanResult = { walls: [], openings: [], rooms: [], mmPerPx: null, extent: null, note: '' }

  // 작은 그림은 키워서 쓴다. 침식 반지름·최소 길이가 픽셀 고정값이라, 폭을 맞춰 놓지 않으면
  // 720px 짜리 도면에서는 벽이 침식에 통째로 지워진다(실측: 조각 3개 → 확대하면 50개).
  const scale = WORK_WIDTH / img.naturalWidth
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { ...empty, note: '캔버스를 쓸 수 없습니다.' }
  ctx.drawImage(img, 0, 0, w, h)

  const gray = toGray(ctx.getImageData(0, 0, w, h).data, w * h)

  // 선을 두 갈래로 나눠 잡는다. 도면 한 장 안에 진한 벽과 연한 벽이 섞여 있어서
  // 전역 임계값 하나로는 둘 다 못 잡는다 — 연한 쪽을 살리려고 값을 올리면 바닥이 딸려 온다.
  //
  //   진한 선  전역 임계값 (기존). 두께가 믿을 만해서 **축척은 이쪽으로만** 잰다
  //   연한 선  국소 적응 임계값. 주변 바탕보다 어두우면 선으로 본다
  const t = darkPercentile(gray, DARK_FRACTION, 60, 160)
  const dark = new Uint8Array(w * h)
  let darkCount = 0
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < t) {
      dark[i] = 1
      darkCount++
    }
  }
  const ink = adaptiveInk(gray, w, h)
  if (darkCount < 50 && countOn(ink) < 50) {
    return { ...empty, note: '선을 찾지 못했습니다. 도면이 너무 흐릴 수 있습니다.' }
  }

  // 1) 벽 띠 — 진한 선에서
  const core = erode(dark, w, h, ERODE_R)
  // 침식한 만큼 두께가 깎여 있다. **여기서 한 번만** 되돌려 놓는다 —
  // 이제 조각의 thick 은 출처(진한 선·연한 선·짝 합치기)와 무관하게 실제 두께다.
  const thickSegs: Seg[] = [
    ...bands(core, w, h, true).map((b) => ({ h: true, ...b, thick: b.thick + 2 * ERODE_R })),
    ...bands(core, w, h, false).map((b) => ({ h: false, ...b, thick: b.thick + 2 * ERODE_R })),
  ]

  // 축척 — 띠 두께 중앙값을 실제 벽 두께로 본다.
  // **연한 선은 여기 넣지 않는다.** 얇은 조각이 섞이면 중앙값이 무너져 축척이 엉킨다.
  const thicks = thickSegs.map((s) => s.thick).sort((a, b) => a - b)
  const med = thicks.length ? thicks[Math.floor(thicks.length / 2)] : 0
  let mmPerPx: number | null = ASSUMED_WALL_MM / (med / scale)
  if (!Number.isFinite(mmPerPx) || mmPerPx < 2 || mmPerPx > 80) mmPerPx = null

  // 작업 해상도에서의 mm/px — 틈 폭 판단에 쓴다
  const mmPerWorkPx = mmPerPx ? mmPerPx / scale : 0
  const maxGapPx = mmPerWorkPx ? MAX_GAP_MM / mmPerWorkPx : 60

  // 연한 선 패스 — 침식하지 않는다(1~2px 선은 침식에 통째로 지워진다).
  // 대신 **길이**로 거른다. 연하게 그린 벽은 얇아도 길고, 글자·가구·치수 눈금은 짧다.
  const thinMin = Math.max(MIN_LEN, Math.round(w * THIN_MIN_LEN_RATIO))
  const thinSegs: Seg[] = [
    ...bands(ink, w, h, true, thinMin).map((b) => ({ h: true, ...b })),
    ...bands(ink, w, h, false, thinMin).map((b) => ({ h: false, ...b })),
  ]

  // 치수선은 길고 얇고 검다 — 길이만으로는 벽과 못 가른다. 대신 **건물 바깥에** 있다.
  // 진한 선이 이루는 상자 안쪽만 남겨서 떼어 낸다.
  // 건물 외곽선 — **창(샤시)이 있는 외벽은 어두운 선이 아예 없다.** 연한 회색 띠로 그려져
  // 있어서 어두운 선을 찾는 방식으로는 원리적으로 못 잡는다. 대신 "그려진 것 전체"의
  // 실루엣을 떠서 그 테두리를 벽으로 쓴다. 창도 종이가 아니라 그려진 것이므로 여기 들어온다.
  const outline = buildingOutline(gray, w, h)

  const box = bbox(thickSegs)
  const found = [
    ...thickSegs,
    ...thinSegs.filter((s) => insideBox(s, box) && !coveredBy(s, thickSegs)),
    ...outline,
  ]
  if (found.length === 0) {
    return { ...empty, note: '벽으로 볼 만한 선이 없습니다. 도면이 너무 흐리면 직접 그으셔야 합니다.' }
  }

  // 2) 잇고, 메운 틈을 문·창으로
  const { merged: joined, holes: holes0 } = joinAndPunch(found, maxGapPx)

  // 마주 보는 두 선을 한 벽으로 합친다. 도면이 벽을 속 빈 이중선으로 그리면 양쪽 면이
  // 따로 잡히는데, 그대로 두면 3D 에 얇은 판이 두 장 서고 그 사이가 빈다.
  // 합치면 두 면 사이 간격이 곧 벽 두께가 되므로 두께도 실제에 가까워진다.
  //
  // **조각을 이은 뒤에** 합친다. 잇기 전에는 같은 벽의 두 면이 서로 어긋난 토막이라
  // 겹침이 모자라 짝으로 안 잡히고, 그 뒤 잇기가 둘을 나란한 전체 길이로 늘려 놓는다
  // — 방과 방 사이에 벽이 두 줄 서 보이는 게 이것이다.
  const paired = mergeParallelPairs(joined, mmPerWorkPx ? PAIR_MAX_MM / mmPerWorkPx : 20)

  // 짝 없는 홑선은 벽이 아니다. 벽은 두 면으로 그리지만 치수선·가구 윤곽·타일 무늬는
  // 한 줄이다. 실측: 욕실 한 칸에 가로선이 다섯 겹 쌓여 방을 잘랐다.
  // 굵기로 가른다 — 짝지은 벽 두께의 절반에도 못 미치면 벽으로 볼 수 없다.
  // 이 때문에 진짜 외벽이 빠지더라도 뒤의 closeOuterBoundary 가 되메운다.
  const { segs: merged, holes } = dropLoneThinSegs(paired, holes0, joined)

  // 모서리에 문이 있으면 벽이 직교 벽에 닿지 않고 끊긴다. 거기까지 늘려야 방이 닫힌다.
  // 한 번 늘리면 다른 벽이 새로 닿을 수 있어 두 번 돈다 — 실측에서 방 3개 → 6개가 됐다.
  //
  // 여기서 늘린 구간은 **구멍을 내지 않는다.** 모서리 근처의 끊김은 실제 문일 수도 있지만
  // 검출이 벽 끝을 놓친 것일 때가 더 많고, 잘못 뚫으면 3D 에 빈 구석이 남는다.
  for (let pass = 0; pass < 2; pass++) {
    extendToCorners(merged, maxGapPx)
  }

  // 바깥 둘레를 먼저 닫는다. 집은 반드시 닫힌 외벽을 갖는데, 도면에서 그 일부가 연한 선으로
  // 그려져 있으면 걸러진다. 끊긴 자리를 메워야 3D 에 큰 구멍이 남지 않고 방도 제대로 닫힌다.
  closeOuterBoundary(merged, w, h)

  // 둘레를 닫으면서 **새로 생긴 벽**은 아직 아무 데도 물려 있지 않다. 한 번 더 맞물린다.
  // 실측: 침실 위 외벽을 메웠는데 왼쪽 세로벽 끝과 3px 어긋나 그 틈으로 바깥이 새어
  // 방이 통째로 사라졌다. 눈으로는 닫혀 보여서 찾기 어려운 종류의 구멍이다.
  extendToCorners(merged, maxGapPx)

  // 방 둘레에 벽이 빠진 곳도 메운다.
  const rooms0 = findRooms(merged, w, h, mmPerPx, scale)
  closeRoomEdges(merged, rooms0, w, h)

  const walls: Wall[] = merged.map((s) =>
    s.h
      ? mkWall(s.a / w, s.c / h, s.b / w, s.c / h, s.thick, scale, mmPerPx)
      : mkWall(s.c / w, s.a / h, s.c / w, s.b / h, s.thick, scale, mmPerPx),
  )

  const openings: Opening[] = holes
    .map((hole) => {
      const wall = walls[hole.wallIndex]
      if (!wall) return null
      const widthMm = mmPerWorkPx ? Math.round(hole.width * mmPerWorkPx) : 900
      // 문·창으로 볼 수 없는 크기면 뚫지 않는다. 벽으로 남겨 두는 편이 안전하다.
      if (widthMm < OPENING_MIN_MM || widthMm > MAX_GAP_MM) return null
      const door = widthMm <= DOOR_MAX_MM
      return {
        id: newId('o'),
        wallId: wall.id,
        t: hole.t,
        widthMm,
        kind: door ? ('DOOR' as const) : ('WINDOW' as const),
        sillMm: door ? 0 : 900,
        heightMm: door ? 2100 : 1400,
      }
    })
    .filter((o): o is Opening => o !== null)

  // 3) 방 — 둘레를 메운 벽으로 다시 찾는다(메우면서 새로 닫히는 방이 생긴다)
  const rooms = findRooms(merged, w, h, mmPerPx, scale)

  const note =
    `벽 ${walls.length}개 · 문·창 ${openings.length}개 · 방 ${rooms.length}개를 찾았습니다.` +
    (mmPerPx
      ? ` 벽 두께로 축척을 어림했습니다 (1px ≈ ${mmPerPx.toFixed(1)}mm). 도면에 적힌 전체 가로 길이를 넣으면 정확해집니다.`
      : ' 축척은 추정하지 못했습니다. 전체 가로 길이를 넣어 주세요.')

  let minX = 1
  let maxX = 0
  let sumY = 0
  for (const wl of walls) {
    minX = Math.min(minX, wl.x1, wl.x2)
    maxX = Math.max(maxX, wl.x1, wl.x2)
    sumY += (wl.y1 + wl.y2) / 2
  }
  const extent = maxX > minX ? { x1: minX, x2: maxX, y: walls.length ? sumY / walls.length : 0.5 } : null

  return { walls, openings, rooms, mmPerPx, extent, note }
}

function mkWall(
  x1: number, y1: number, x2: number, y2: number,
  thickWork: number, scale: number, mmPerPx: number | null,
): Wall {
  const mm = mmPerPx ? Math.round((thickWork / scale) * mmPerPx) : 150
  return { id: newId('aw'), x1, y1, x2, y2, thicknessMm: Math.min(400, Math.max(80, mm)) }
}

// ---------- 기본 처리 ----------

/**
 * 회색조로 바꾸되 **색이 있는 픽셀은 흰색으로 밀어 버린다.**
 *
 * 벽은 검정·회색이고, 빨간 치수선이나 색으로 칠한 바닥은 채도가 높다.
 * 회색조로만 바꾸면 빨강(#f00)이 밝기 76 이라 벽보다 어둡게 잡힌다 —
 * 실측에서 이 필터 하나로 어두운 픽셀이 6.3% → 3.8% 로 줄었다.
 */
function toGray(data: Uint8ClampedArray, n: number): Uint8Array {
  const gray = new Uint8Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const a = data[p + 3] / 255
    let v = 0.299 * r + 0.587 * g + 0.114 * b
    v = v * a + 255 * (1 - a)
    if (Math.max(r, g, b) - Math.min(r, g, b) > SATURATION_MAX) {
      v = 255
    }
    gray[i] = Math.round(v)
  }
  return gray
}

function darkPercentile(gray: Uint8Array, frac: number, lo: number, hi: number): number {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const target = gray.length * frac
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= target) return Math.max(lo, Math.min(hi, v))
  }
  return hi
}

function countOn(m: Uint8Array): number {
  let n = 0
  for (let i = 0; i < m.length; i++) n += m[i]
  return n
}

/**
 * **국소** 임계값으로 선을 잡는다 — 주변 바탕보다 어두우면 선이다.
 *
 * 전역 임계값은 도면 한 장 안에 진한 벽과 연한 벽이 섞이면 못 쓴다. 연한 쪽을 살리려고
 * 값을 올리면 나무 바닥·음영이 통째로 딸려 오고, 낮추면 연한 벽이 사라진다.
 * 국소로 재면 둘 다 풀린다 — 흰 바탕 위의 연한 선은 바탕보다 어두워서 잡히고,
 * 넓게 칠한 회색 바닥은 제 평균과 같아서 안 잡힌다.
 *
 * 적분 영상을 써서 창 크기와 무관하게 픽셀당 상수 시간에 계산한다.
 */
function adaptiveInk(gray: Uint8Array, w: number, h: number): Uint8Array {
  // 적분 영상 (w+1) x (h+1). 1200x900 이면 108만 칸이라 Float64 로도 충분히 가볍다.
  const iw = w + 1
  const sum = new Float64Array(iw * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x]
      sum[(y + 1) * iw + (x + 1)] = sum[y * iw + (x + 1)] + row
    }
  }

  const out = new Uint8Array(w * h)
  const r = LOCAL_R
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      const n = (x1 - x0 + 1) * (y1 - y0 + 1)
      const s =
        sum[(y1 + 1) * iw + (x1 + 1)] -
        sum[y0 * iw + (x1 + 1)] -
        sum[(y1 + 1) * iw + x0] +
        sum[y0 * iw + x0]
      const mean = s / n
      const v = gray[y * w + x]
      // 비율과 절대 차이를 **둘 다** 요구한다. 비율만 보면 어두운 영역에서 잡티가 걸리고,
      // 절대 차이만 보면 밝은 바탕의 연한 선을 놓친다.
      if (v < mean * (1 - LOCAL_DROP) && mean - v >= LOCAL_MIN_DIFF) out[y * w + x] = 1
    }
  }
  return out
}

/**
 * 나란한 두 선을 한 벽으로 합친다.
 *
 * 벽을 속 빈 이중선으로 그린 도면에서 양쪽 면이 따로 잡히는 것을 되돌린다.
 * 간격이 벽 두께로 볼 만하고(`maxPairPx` 이내) 서로 충분히 겹칠 때만 합친다 —
 * 좁은 방을 사이에 둔 두 벽을 잘못 합치면 방이 통째로 사라진다.
 */
type Paired = { out: Seg[]; map: number[]; isPair: boolean[] }

function mergeParallelPairs(segs: Seg[], maxPairPx: number): Paired {
  // **서로가 서로의 가장 가까운 짝일 때만** 합친다.
  // 한쪽만 보고 합치면 벽 하나가 엉뚱한 이웃을 붙잡아 중간으로 끌려가고,
  // 그 자리에 있던 방이 열려 버린다(실측: 거실 41㎡ 가 방에서 빠졌다).
  const nearest = segs.map((a, i) => {
    let best = -1
    let bestGap = Infinity
    for (let j = 0; j < segs.length; j++) {
      if (j === i) continue
      const b = segs[j]
      if (b.h !== a.h) continue
      const gap = Math.abs(b.c - a.c)
      // 간격 0 은 짝이 아니라 중복이다 — 여기서 다루지 않는다.
      if (gap < 2 || gap > maxPairPx) continue
      const ov = Math.min(a.b, b.b) - Math.max(a.a, b.a)
      if (ov <= 0 || ov < Math.min(a.b - a.a, b.b - b.a) * 0.6) continue
      if (gap < bestGap) {
        bestGap = gap
        best = j
      }
    }
    return { best, gap: bestGap }
  })

  const used = new Array(segs.length).fill(false)
  const map = new Array(segs.length).fill(-1)
  const isPair: boolean[] = []
  const out: Seg[] = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    const j = nearest[i].best
    if (j < 0 || used[j] || nearest[j].best !== i) {
      used[i] = true
      map[i] = out.length
      isPair.push(false)
      out.push({ ...segs[i] })
      continue
    }
    const a = segs[i]
    const b = segs[j]
    used[i] = true
    used[j] = true
    map[i] = out.length
    map[j] = out.length
    isPair.push(true)
    out.push({
      h: a.h,
      a: Math.min(a.a, b.a),
      b: Math.max(a.b, b.b),
      c: (a.c + b.c) / 2,
      // 두 면 사이 간격이 벽 두께다. 선 자체의 굵기는 이미 그 안에 들어가 있다.
      thick: Math.max(a.thick, b.thick, Math.round(nearest[i].gap)),
      keep: a.keep || b.keep,
    })
  }
  return { out, map, isPair }
}

/**
 * 짝 없는 홑선을 버린다.
 *
 * 도면은 벽을 두 면으로 그린다. 한 줄로만 그어진 선은 치수선·가구 윤곽·타일 무늬 쪽이
 * 훨씬 많고, 이것들이 방 안을 가로질러 방을 잘라 놓는다.
 *
 * 기준은 **짝지은 벽 두께의 중앙값 절반**이다. 절대 치수를 쓰지 않는 이유는 축척 추정이
 * 도면 양식을 타기 때문이다 — 같은 도면 안의 벽끼리 견주는 편이 훨씬 안정적이다.
 * 짝이 하나도 없으면(벽을 홑선으로 그린 도면) 아무것도 버리지 않는다.
 */
function dropLoneThinSegs(p: Paired, holes: Hole[], from: Seg[]): { segs: Seg[]; holes: Hole[] } {
  const pairThicks = p.out.filter((_, i) => p.isPair[i]).map((s) => s.thick).sort((a, b) => a - b)
  if (pairThicks.length < 3) return { segs: p.out, holes: remapHoles(holes, from, p.out, p.map) }
  const cut = pairThicks[Math.floor(pairThicks.length / 2)] / 2

  const compact = new Array(p.out.length).fill(-1)
  const segs: Seg[] = []
  for (let i = 0; i < p.out.length; i++) {
    if (!p.isPair[i] && !p.out[i].keep && p.out[i].thick < cut) continue
    compact[i] = segs.length
    segs.push(p.out[i])
  }
  const map = p.map.map((i) => (i < 0 ? -1 : compact[i]))
  return { segs, holes: remapHoles(holes, from, segs, map) }
}

/**
 * 짝을 합치면서 벽 번호가 바뀐다. 문·창이 붙어 있던 자리를 새 벽 위로 옮긴다.
 *
 * 한 벽의 두 면에 같은 문이 따로 기록돼 있으므로, 합쳐진 뒤 같은 자리에 겹치는 것은
 * 하나만 남긴다 — 안 그러면 같은 문이 두 번 뚫린다.
 */
function remapHoles(holes: Hole[], from: Seg[], to: Seg[], map: number[]): Hole[] {
  const out: Hole[] = []
  for (const hole of holes) {
    const src = from[hole.wallIndex]
    const dstIndex = map[hole.wallIndex]
    if (dstIndex < 0) continue
    const dst = to[dstIndex]
    if (!src || !dst) continue
    const pos = src.a + hole.t * (src.b - src.a)
    const span = dst.b - dst.a
    if (span <= 0) continue
    const t = (pos - dst.a) / span
    if (t < 0 || t > 1) continue
    const dup = out.some(
      (o) => o.wallIndex === dstIndex && Math.abs((o.t - t) * span) < hole.width,
    )
    if (dup) continue
    out.push({ wallIndex: dstIndex, t, width: hole.width })
  }
  return out
}

/**
 * 건물 실루엣의 테두리를 벽 조각으로 뽑는다.
 *
 * **창(샤시)이 있는 외벽에는 어두운 선이 없다.** 도면은 거기를 연한 회색 띠로 그린다.
 * 어두운 선을 찾는 방식으로는 원리적으로 못 잡으므로, 기준을 진하기에서 "그려졌는가"로
 * 바꾼다 — 종이(흰색)가 아니면 전부 건물의 일부다.
 *
 *   1. 흰색이 아닌 픽셀을 모은다 (창의 연한 띠도 들어온다)
 *   2. 1px 짜리 치수선·글자를 열기 연산으로 떨어뜨린다. 안 그러면 실루엣이 그쪽으로 끌려간다
 *   3. 바깥 흰 곳에서 번져 들어간다. 닿지 않은 곳이 건물 안쪽이다 — 방 안이 희어도
 *      테두리가 닫혀 있으므로 통째로 안쪽으로 잡힌다
 *   4. 가장 큰 덩어리만 남긴다 (도면 밖의 제목·범례는 따로 떨어진 작은 덩어리다)
 *   5. 그 덩어리의 테두리를 띠 검출에 넘겨 축에 나란한 조각으로 만든다
 */
function buildingOutline(gray: Uint8Array, w: number, h: number): Seg[] {
  const n = w * h
  // 종이 밝기 = 밝은 쪽에서 가장 흔한 값. 도면마다 흰 바탕이 다르고 배경 격자가 깔린 것도 있다.
  const hist = new Array(256).fill(0)
  for (let i = 0; i < n; i++) hist[gray[i]]++
  let paper = 255
  let bestCount = -1
  for (let v = 200; v < 256; v++) {
    if (hist[v] > bestCount) {
      bestCount = hist[v]
      paper = v
    }
  }
  const contentMax = paper - CONTENT_DROP
  const content = new Uint8Array(n)
  for (let i = 0; i < n; i++) content[i] = gray[i] < contentMax ? 1 : 0

  // 열기(침식 후 팽창) — 가는 선은 사라지고 벽·창 띠는 남는다
  const solid = dilate(erode(content, w, h, 1), w, h, 1)

  // 바깥 흰 곳에서 번지기
  const outer = new Uint8Array(n)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (outer[i] || solid[i]) return
    outer[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = (i / w) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  // 가장 큰 덩어리 = 건물
  const seen = new Uint8Array(n)
  let best: number[] | null = null
  for (let start = 0; start < n; start++) {
    if (seen[start] || outer[start]) continue
    const cells: number[] = []
    const q = [start]
    seen[start] = 1
    while (q.length) {
      const i = q.pop()!
      cells.push(i)
      const x = i % w
      const y = (i / w) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const j = yy * w + xx
        if (seen[j] || outer[j]) continue
        seen[j] = 1
        q.push(j)
      }
    }
    if (!best || cells.length > best.length) best = cells
  }
  // 도면이 화면의 일부만 차지해야 말이 된다. 너무 작으면 실루엣을 못 믿는다.
  if (!best || best.length < n * 0.05) return []

  const blob = new Uint8Array(n)
  for (const i of best) blob[i] = 1

  // 테두리 한 겹
  const inner = erode(blob, w, h, 1)
  const edge = new Uint8Array(n)
  for (let i = 0; i < n; i++) edge[i] = blob[i] && !inner[i] ? 1 : 0

  // 축에 나란한 **긴** 구간만 벽으로 본다. 비스듬하거나 굽은 구간은 1~2px 씩 끊겨 알아서 빠진다.
  //
  // 기준을 0.03 까지 낮춰 봤더니 벽이 35 -> 66 으로 늘고 화면이 지저분해졌다. 실루엣 테두리는
  // 1px 이라 짧은 조각끼리 짝을 지으면 "짝지은 벽 두께의 중앙값"이 무너지고, 그러면 홑선을
  // 걸러 내는 기준까지 같이 낮아져 치수선이 다시 들어온다. 길게 잡아 둘 것.
  const minLen = Math.max(MIN_LEN, Math.round(Math.min(w, h) * 0.08))
  return [
    ...bands(edge, w, h, true, minLen).map((b) => ({ h: true, ...b, keep: true })),
    ...bands(edge, w, h, false, minLen).map((b) => ({ h: false, ...b, keep: true })),
  ]
}

/** 조각들이 차지하는 상자. 치수선처럼 건물 바깥에 있는 선을 떼어 낼 때 쓴다. */
function bbox(segs: Seg[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (segs.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of segs) {
    const ax = s.h ? s.a : s.c
    const bx = s.h ? s.b : s.c
    const ay = s.h ? s.c : s.a
    const by = s.h ? s.c : s.b
    x0 = Math.min(x0, ax, bx)
    x1 = Math.max(x1, ax, bx)
    y0 = Math.min(y0, ay, by)
    y1 = Math.max(y1, ay, by)
  }
  return { x0, y0, x1, y1 }
}

/** 상자 안에 (약간의 여유를 두고) 들어오는가. 상자가 없으면 통과시킨다. */
function insideBox(s: Seg, box: { x0: number; y0: number; x1: number; y1: number } | null): boolean {
  if (!box) return true
  const m = 6
  const ax = s.h ? s.a : s.c
  const bx = s.h ? s.b : s.c
  const ay = s.h ? s.c : s.a
  const by = s.h ? s.c : s.b
  return (
    Math.min(ax, bx) >= box.x0 - m &&
    Math.max(ax, bx) <= box.x1 + m &&
    Math.min(ay, by) >= box.y0 - m &&
    Math.max(ay, by) <= box.y1 + m
  )
}

/** 이미 진한 선으로 잡힌 자리인가. 같은 벽을 두 번 넣으면 3D 에 겹친 판이 생긴다. */
function coveredBy(s: Seg, thick: Seg[]): boolean {
  for (const t of thick) {
    if (t.h !== s.h) continue
    if (Math.abs(t.c - s.c) > t.thick / 2 + SAME_LINE) continue
    const ov = Math.min(t.b, s.b) - Math.max(t.a, s.a)
    if (ov > (s.b - s.a) * 0.6) return true
  }
  return false
}

function erode(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let on = 1
      for (let d = -r; d <= r && on; d++) {
        const xx = x + d
        if (xx < 0 || xx >= w || !src[row + xx]) on = 0
      }
      tmp[row + x] = on
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let on = 1
      for (let d = -r; d <= r && on; d++) {
        const yy = y + d
        if (yy < 0 || yy >= h || !tmp[yy * w + x]) on = 0
      }
      out[y * w + x] = on
    }
  }
  return out
}

type Band = { a: number; b: number; c: number; thick: number }

function bands(core: Uint8Array, w: number, h: number, horizontal: boolean, minLen = MIN_LEN): Band[] {
  const major = horizontal ? h : w
  const minor = horizontal ? w : h
  const at = (i: number, j: number) => (horizontal ? core[i * w + j] : core[j * w + i])

  const open: { a: number; b: number; from: number; to: number }[] = []
  const done: Band[] = []

  for (let i = 0; i < major; i++) {
    const runs: { a: number; b: number }[] = []
    let start = -1
    for (let j = 0; j <= minor; j++) {
      const on = j < minor && at(i, j)
      if (on && start < 0) start = j
      if (!on && start >= 0) {
        if (j - start >= minLen) runs.push({ a: start, b: j - 1 })
        start = -1
      }
    }
    for (const r of runs) {
      let hit = -1
      for (let k = 0; k < open.length; k++) {
        const o = open[k]
        const ov = Math.min(o.b, r.b) - Math.max(o.a, r.a)
        if (ov > Math.min(o.b - o.a, r.b - r.a) * 0.5) {
          hit = k
          break
        }
      }
      if (hit >= 0) {
        open[hit].a = Math.min(open[hit].a, r.a)
        open[hit].b = Math.max(open[hit].b, r.b)
        open[hit].to = i
      } else {
        open.push({ a: r.a, b: r.b, from: i, to: i })
      }
    }
    for (let k = open.length - 1; k >= 0; k--) {
      if (open[k].to < i) {
        pushBand(done, open[k], minLen)
        open.splice(k, 1)
      }
    }
  }
  for (const o of open) pushBand(done, o, minLen)
  return done
}

function pushBand(done: Band[], o: { a: number; b: number; from: number; to: number }, minLen: number) {
  const thick = o.to - o.from + 1
  if (thick <= MAX_BAND && o.b - o.a >= minLen) {
    done.push({ a: o.a, b: o.b, c: (o.from + o.to) / 2, thick })
  }
}

// ---------- 잇고 뚫기 ----------

type Hole = { wallIndex: number; t: number; width: number }

/**
 * 같은 선 위의 조각을 잇는다. 이을 때 메운 틈은 원래 문이나 창이었으므로 되돌려 놓는다.
 * 이렇게 해야 3D 에서 벽이 이어지고 그 자리에 구멍이 뚫린다.
 */
function joinAndPunch(segs: Seg[], maxGapPx: number): { merged: Seg[]; holes: Hole[] } {
  const merged: Seg[] = []
  const holes: Hole[] = []

  for (const horizontal of [true, false]) {
    const group = segs.filter((s) => s.h === horizontal).sort((p, q) => p.c - q.c || p.a - q.a)
    let cur: Seg | null = null
    let gaps: { from: number; to: number }[] = []

    const flush = () => {
      const c = cur
      if (!c) return
      const index = merged.length
      merged.push(c)
      const len = c.b - c.a
      for (const g of gaps) {
        if (len > 1) {
          holes.push({ wallIndex: index, t: ((g.from + g.to) / 2 - c.a) / len, width: g.to - g.from })
        }
      }
      cur = null
      gaps = []
    }

    for (const s of group) {
      if (cur && Math.abs(cur.c - s.c) <= SAME_LINE && s.a - cur.b <= maxGapPx) {
        if (s.a - cur.b > 2) gaps.push({ from: cur.b, to: s.a })
        cur.b = Math.max(cur.b, s.b)
        cur.c = (cur.c + s.c) / 2
        cur.thick = Math.max(cur.thick, s.thick)
        cur.keep = cur.keep || s.keep
      } else {
        flush()
        cur = { ...s }
      }
    }
    flush()
  }

  // 벽 끝에 딱 붙으면 3D 에서 모서리가 무너진다. 조금 안쪽으로 민다.
  for (const hole of holes) {
    hole.t = Math.min(0.94, Math.max(0.06, hole.t))
  }
  return { merged, holes }
}

/**
 * 벽 끝이 직교 벽에 닿지 않고 끊겨 있으면(모서리에 문이 있는 경우) 거기까지 늘린다.
 * 늘린 구간은 원래 개구부였으므로 문·창으로 되돌려 놓는다.
 */
function extendToCorners(segs: Seg[], maxGapPx: number): Hole[] {
  const holes: Hole[] = []
  segs.forEach((s, index) => {
    const cross = segs.filter((o) => o.h !== s.h && o.a - 2 <= s.c && s.c <= o.b + 2)
    const len = () => Math.max(1, s.b - s.a)

    let bestB: number | null = null
    for (const o of cross) {
      if (o.c > s.b && o.c - s.b <= maxGapPx && (bestB === null || o.c < bestB)) bestB = o.c
    }
    if (bestB !== null) {
      const from = s.b
      s.b = bestB
      holes.push({ wallIndex: index, t: (from + bestB) / 2 / len() - s.a / len(), width: bestB - from })
    }

    let bestA: number | null = null
    for (const o of cross) {
      if (o.c < s.a && s.a - o.c <= maxGapPx && (bestA === null || o.c > bestA)) bestA = o.c
    }
    if (bestA !== null) {
      const to = s.a
      s.a = bestA
      holes.push({ wallIndex: index, t: (bestA + to) / 2 / len() - s.a / len(), width: to - bestA })
    }
  })
  for (const hole of holes) {
    hole.t = Math.min(0.94, Math.max(0.06, hole.t))
  }
  return holes
}

/**
 * 바깥 둘레(외벽)를 닫는다.
 *
 * 집은 반드시 닫힌 외벽을 갖는다. 도면에서 그 일부가 연한 색이나 얇은 선이면 걸러져
 * 3D 에 큰 구멍으로 남는다. 긴 벽들로 외곽 사각형을 잡고, 네 변에서 덮이지 않은
 * 구간만 벽으로 보충한다.
 *
 * 외곽을 잡을 때 **긴 벽만** 쓴다 — 치수선 조각 하나가 끼면 범위가 엉뚱하게 넓어진다.
 */
function closeOuterBoundary(segs: Seg[], w: number, h: number) {
  if (segs.length === 0) {
    return
  }
  const longEnough = Math.min(w, h) * 0.15
  const spine = segs.filter((s) => s.b - s.a >= longEnough)
  const base = spine.length >= 4 ? spine : segs
  const thick = segs.map((s) => s.thick).sort((a, b) => a - b)[Math.floor(segs.length / 2)]

  let x1 = w
  let x2 = 0
  let y1 = h
  let y2 = 0
  for (const s of base) {
    const ax = s.h ? s.a : s.c
    const bx = s.h ? s.b : s.c
    const ay = s.h ? s.c : s.a
    const by = s.h ? s.c : s.b
    x1 = Math.min(x1, ax, bx)
    x2 = Math.max(x2, ax, bx)
    y1 = Math.min(y1, ay, by)
    y2 = Math.max(y2, ay, by)
  }
  if (x2 - x1 < 20 || y2 - y1 < 20) {
    return
  }

  const edges: { h: boolean; c: number; a: number; b: number }[] = [
    { h: true, c: y1, a: x1, b: x2 },
    { h: true, c: y2, a: x1, b: x2 },
    { h: false, c: x1, a: y1, b: y2 },
    { h: false, c: x2, a: y1, b: y2 },
  ]

  for (const e of edges) {
    // 이 변 위에서 이미 벽이 덮은 구간을 모아 빈 곳만 채운다
    const covers: { a: number; b: number }[] = []
    for (const s of segs) {
      if (s.h !== e.h) continue
      if (Math.abs(s.c - e.c) > thick + 6) continue
      const a = Math.max(s.a, e.a)
      const b = Math.min(s.b, e.b)
      if (b > a) covers.push({ a, b })
    }
    covers.sort((p, q) => p.a - q.a)

    // **양끝이 고정된 틈만** 메운다.
    //
    // 고정이란 그 끝에 벽이 있다는 뜻이다 — 같은 선 위에 이어지는 벽이거나,
    // 그 자리에서 꺾여 올라가는 직교 벽이거나. 둘 중 하나면 건물이 거기까지 있는 것이다.
    //
    // 변 끝에 걸린 빈 구간을 무조건 메우면 마당이나 여백까지 감싸 가짜 방이 생기고
    // (실측: "84A Type" 제목이 적힌 여백), 무조건 놔두면 창이 연한 띠로 그려진
    // 외벽이 통째로 빠진다(실측: 침실 39㎡ 가 바깥으로 새어 방에서 빠졌다).
    // 모서리에 직교 벽이 닿았는지가 이 둘을 가른다.
    const tol = thick + 6
    const anchored = (pos: number) =>
      segs.some(
        (q) => q.h !== e.h && Math.abs(q.c - pos) <= tol && q.a - tol <= e.c && e.c <= q.b + tol,
      )

    const gaps: { a: number; b: number }[] = []
    let cursor = e.a
    let started = false
    for (const c of covers) {
      if (c.a > cursor && (started || anchored(e.a))) gaps.push({ a: cursor, b: c.a })
      cursor = Math.max(cursor, c.b)
      started = true
    }
    if (started && cursor < e.b && anchored(e.b)) gaps.push({ a: cursor, b: e.b })

    for (const g of gaps) {
      // 아주 짧은 틈은 문일 수 있으니 둔다. 큰 구멍만 메운다.
      if (g.b - g.a < thick * 2) continue
      segs.push({ h: e.h, a: g.a, b: g.b, c: e.c, thick })
    }
  }
}

/**
 * 방 네 변에 벽이 없으면 채워 넣는다.
 *
 * 검출이 벽 한 토막을 놓치면 3D 에서 그 자리가 뻥 뚫려 보인다. 방이 닫혔다는 것은
 * 그 둘레가 실제로 벽이라는 뜻이므로, 덮이지 않은 구간만 벽으로 보충한다.
 */
function closeRoomEdges(segs: Seg[], rooms: Room[], w: number, h: number) {
  const thick = segs.length
    ? segs.map((s) => s.thick).sort((a, b) => a - b)[Math.floor(segs.length / 2)]
    : 4

  for (const r of rooms) {
    const xs = r.points.map((pt) => pt[0] * w)
    const ys = r.points.map((pt) => pt[1] * h)
    const x1 = Math.min(...xs)
    const x2 = Math.max(...xs)
    const y1 = Math.min(...ys)
    const y2 = Math.max(...ys)

    const edges: { h: boolean; c: number; a: number; b: number }[] = [
      { h: true, c: y1, a: x1, b: x2 },
      { h: true, c: y2, a: x1, b: x2 },
      { h: false, c: x1, a: y1, b: y2 },
      { h: false, c: x2, a: y1, b: y2 },
    ]

    for (const e of edges) {
      const span = e.b - e.a
      if (span < 6) continue
      // 이 변을 덮는 기존 벽의 길이를 센다
      let covered = 0
      for (const s of segs) {
        if (s.h !== e.h) continue
        if (Math.abs(s.c - e.c) > thick + 4) continue
        covered += Math.max(0, Math.min(s.b, e.b) - Math.max(s.a, e.a))
      }
      if (covered >= span * 0.6) continue
      segs.push({ h: e.h, a: e.a, b: e.b, c: e.c, thick })
    }
  }
}

// ---------- 방 찾기 ----------

/** 이어진 벽을 다시 칠해 닫힌 영역을 찾는다. 문·창이 메워져 있어야 새지 않는다. */
function findRooms(
  segs: Seg[], w: number, h: number, mmPerPx: number | null, scale: number,
): Room[] {
  const mask = new Uint8Array(w * h)
  for (const s of segs) {
    const half = Math.max(1, Math.round(s.thick / 2))
    if (s.h) {
      for (let y = Math.round(s.c) - half; y <= Math.round(s.c) + half; y++) {
        if (y < 0 || y >= h) continue
        for (let x = Math.round(s.a); x <= Math.round(s.b); x++) {
          if (x >= 0 && x < w) mask[y * w + x] = 1
        }
      }
    } else {
      for (let x = Math.round(s.c) - half; x <= Math.round(s.c) + half; x++) {
        if (x < 0 || x >= w) continue
        for (let y = Math.round(s.a); y <= Math.round(s.b); y++) {
          if (y >= 0 && y < h) mask[y * w + x] = 1
        }
      }
    }
  }

  // 모서리에 남은 1~2px 틈으로 바깥이 새어 든다. 살짝 부풀려 막는다.
  const closed = dilate(mask, w, h, 2)

  // 바깥을 먼저 지운다 — 테두리에서 번지는 곳은 방이 아니다
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = y * w + x
    if (seen[i] || closed[i]) return
    seen[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = (i / w) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  const minPx = mmPerPx
    ? (MIN_ROOM_M2 * 1_000_000) / ((mmPerPx / scale) * (mmPerPx / scale))
    : (w * h) / 400

  const rooms: Room[] = []
  for (let start = 0; start < mask.length; start++) {
    if (seen[start] || closed[start]) continue
    // 연결 요소 하나를 긁는다
    const cells: number[] = []
    seen[start] = 1
    const q = [start]
    let minX = w
    let maxX = 0
    let minY = h
    let maxY = 0
    while (q.length) {
      const i = q.pop()!
      cells.push(i)
      const x = i % w
      const y = (i / w) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (seen[j] || closed[j]) continue
        seen[j] = 1
        q.push(j)
      }
    }
    if (cells.length < minPx) continue

    // 네모에 가까우면 네모로. 아파트 방은 대부분 직사각형이고, 그래야 3D 바닥이 깔끔하다.
    const boxArea = (maxX - minX + 1) * (maxY - minY + 1)
    const fill = cells.length / boxArea
    if (fill < 0.6) continue   // 새어 나간 영역으로 본다

    rooms.push({
      id: newId('r'),
      name: '방 ' + (rooms.length + 1),
      points: [
        [minX / w, minY / h],
        [(maxX + 1) / w, minY / h],
        [(maxX + 1) / w, (maxY + 1) / h],
        [minX / w, (maxY + 1) / h],
      ],
    })
    if (rooms.length >= 24) break
  }

  // 넓은 방부터 앞에 오게 — 화면에서 큰 것이 먼저 보이는 편이 낫다
  rooms.sort((a, b) => area(b.points) - area(a.points))
  rooms.forEach((r, i) => {
    r.name = '방 ' + (i + 1)
  })
  return rooms
}

/** 사각 팽창. 모서리의 작은 틈을 메워 방이 새지 않게 한다. */
function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return src
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let on = 0
      for (let d = -r; d <= r && !on; d++) {
        const xx = x + d
        if (xx >= 0 && xx < w && src[y * w + xx]) on = 1
      }
      tmp[y * w + x] = on
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let on = 0
      for (let d = -r; d <= r && !on; d++) {
        const yy = y + d
        if (yy >= 0 && yy < h && tmp[yy * w + x]) on = 1
      }
      out[y * w + x] = on
    }
  }
  return out
}

function area(points: [number, number][]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i]
    const [bx, by] = points[(i + 1) % points.length]
    sum += ax * by - bx * ay
  }
  return Math.abs(sum) / 2
}
