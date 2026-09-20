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

type Seg = { h: boolean; a: number; b: number; c: number; thick: number }

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
  const t = darkPercentile(gray, DARK_FRACTION, 60, 160)
  const dark = new Uint8Array(w * h)
  let darkCount = 0
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < t) {
      dark[i] = 1
      darkCount++
    }
  }
  if (darkCount < 50) return { ...empty, note: '어두운 선을 찾지 못했습니다. 도면이 너무 흐릴 수 있습니다.' }

  // 1) 벽 띠
  const core = erode(dark, w, h, ERODE_R)
  const segs: Seg[] = [
    ...bands(core, w, h, true).map((b) => ({ h: true, ...b })),
    ...bands(core, w, h, false).map((b) => ({ h: false, ...b })),
  ]
  if (segs.length === 0) {
    return { ...empty, note: '벽으로 볼 만한 두꺼운 선이 없습니다. 선이 얇은 도면이면 직접 그으셔야 합니다.' }
  }

  // 축척 — 띠 두께 중앙값을 실제 벽 두께로 본다
  const thicks = segs.map((s) => s.thick).sort((a, b) => a - b)
  const med = thicks[Math.floor(thicks.length / 2)]
  let mmPerPx: number | null = ASSUMED_WALL_MM / ((med + 2 * ERODE_R) / scale)
  if (!Number.isFinite(mmPerPx) || mmPerPx < 2 || mmPerPx > 80) mmPerPx = null

  // 작업 해상도에서의 mm/px — 틈 폭 판단에 쓴다
  const mmPerWorkPx = mmPerPx ? mmPerPx / scale : 0
  const maxGapPx = mmPerWorkPx ? MAX_GAP_MM / mmPerWorkPx : 60

  // 2) 잇고, 메운 틈을 문·창으로
  const { merged, holes } = joinAndPunch(segs, maxGapPx)

  // 모서리에 문이 있으면 벽이 직교 벽에 닿지 않고 끊긴다. 거기까지 늘려야 방이 닫힌다.
  // 한 번 늘리면 다른 벽이 새로 닿을 수 있어 두 번 돈다 — 실측에서 방 3개 → 6개가 됐다.
  //
  // 여기서 늘린 구간은 **구멍을 내지 않는다.** 모서리 근처의 끊김은 실제 문일 수도 있지만
  // 검출이 벽 끝을 놓친 것일 때가 더 많고, 잘못 뚫으면 3D 에 빈 구석이 남는다.
  for (let pass = 0; pass < 2; pass++) {
    extendToCorners(merged, maxGapPx)
  }

  // 방 둘레에 벽이 빠진 곳을 메운다. 3D 에서 뻥 뚫려 보이는 자리가 대부분 여기다.
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
  const mm = mmPerPx ? Math.round(((thickWork + 2 * ERODE_R) / scale) * mmPerPx) : 150
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

function bands(core: Uint8Array, w: number, h: number, horizontal: boolean): Band[] {
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
        if (j - start >= MIN_LEN) runs.push({ a: start, b: j - 1 })
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
        pushBand(done, open[k])
        open.splice(k, 1)
      }
    }
  }
  for (const o of open) pushBand(done, o)
  return done
}

function pushBand(done: Band[], o: { a: number; b: number; from: number; to: number }) {
  const thick = o.to - o.from + 1
  if (thick <= MAX_BAND && o.b - o.a >= MIN_LEN) {
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
    const half = Math.max(1, Math.round((s.thick + 2 * ERODE_R) / 2))
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
