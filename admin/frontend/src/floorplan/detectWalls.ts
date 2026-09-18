import type { Wall } from './types'
import { newId } from './types'

/**
 * 도면 그림에서 벽을 찾아낸다.
 *
 * 한국 아파트 평면도는 거의 직교(가로·세로)이고, **벽은 두껍게 칠해져 있고 치수선·글자는 얇다.**
 * 이 둘의 차이가 유일하게 믿을 만한 단서라, 두께로 가른다:
 *
 *   1) 회색조 → 임계값으로 이진화 (Otsu)
 *   2) 침식(erosion)으로 얇은 것을 지운다 — 치수선·글자·해치는 사라지고 벽 심만 남는다
 *   3) 남은 것에서 가로·세로 띠를 찾아 중심선을 벽으로 삼는다
 *   4) 같은 선 위의 조각을 잇고, 끝점끼리 붙인다
 *
 * 결과는 **초안**이다. 도면마다 선 두께·범례가 달라 완벽할 수 없고, 그래서 편집기에서
 * 고칠 수 있게 해 두었다. 자동 인식이 틀렸을 때 지우고 다시 긋는 비용이 작아야 한다.
 */

export type DetectResult = {
  walls: Wall[]
  /**
   * 원본 이미지 1픽셀이 몇 mm 인지 추정한 값.
   *
   * **벽 두께로 잰다.** 도면은 벽을 실제 두께대로 그리므로, 찾은 벽 띠의 두께 중앙값을
   * 흔한 내벽 두께(150mm)로 보면 축척이 나온다. 치수를 못 읽어도 되고 도면 크기와도 무관하다.
   * 어림값이라 실제와 10~20% 차이 날 수 있다 — 정확한 치수를 알면 그걸로 덮어쓰면 된다.
   */
  mmPerPx: number | null
  /** 판단 근거. 결과가 이상할 때 무엇을 조정할지 알려 준다. */
  note: string
}

/**
 * 벽 두께 가정. 축척 추정의 유일한 가정이다.
 *
 * 아파트 도면의 벽은 내벽 150 · 외벽 200 정도인데, 길이가 긴 외벽이 중앙값을 끌어올린다.
 * 실제 도면(archisketch 1585×907, 정답 1px≈12.97mm)으로 맞춰 보니 200mm 일 때 오차 −3% 였다.
 * 150mm 로 두면 −27%, 220mm 면 +7% 였다.
 */
const ASSUMED_WALL_MM = 200

/**
 * 벽으로 볼 어두운 픽셀의 비율.
 *
 * Otsu 는 이 용도에 쓸 수 없다 — 나무 바닥·타일 해치까지 "어두움"으로 끌어와
 * 임계값이 174 까지 올라가고 어두운 픽셀이 23% 가 된다. 도면에서 벽은 가장 어두운 일부이므로
 * 백분위로 자른다. 0.08~0.12 구간에서 두께 중앙값이 8 로 안정적이었다.
 */
const DARK_FRACTION = 0.1

/** 처리 해상도. 크게 잡아도 정확도가 오르지 않고 느려지기만 한다. */
const WORK_WIDTH = 1200
/** 이 픽셀보다 얇은 선은 벽이 아니다(침식 반지름). */
const ERODE_R = 2
/** 이 길이보다 짧은 조각은 버린다(작업 해상도 기준). */
const MIN_LEN = 18
/** 띠가 이보다 두꺼우면 벽이 아니라 칠해진 면이다. */
const MAX_BAND = 26
/** 같은 선으로 볼 수직 편차 · 이어 붙일 간격 */
const SAME_LINE = 4
const JOIN_GAP = 14
/** 끝점끼리 붙이는 거리 */
const SNAP = 9

export function detectWalls(img: HTMLImageElement): DetectResult {
  const scale = Math.min(1, WORK_WIDTH / img.naturalWidth)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { walls: [], mmPerPx: null, note: '캔버스를 쓸 수 없습니다.' }
  ctx.drawImage(img, 0, 0, w, h)

  const data = ctx.getImageData(0, 0, w, h).data
  const gray = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    // 투명한 곳은 흰 배경으로 본다 — PNG 도면은 배경이 알파 0 인 경우가 있다.
    const a = data[p + 3] / 255
    const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    gray[i] = Math.round(g * a + 255 * (1 - a))
  }

  const t = darkPercentile(gray, DARK_FRACTION, 60, 150)
  const dark = new Uint8Array(w * h)
  let darkCount = 0
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < t) {
      dark[i] = 1
      darkCount++
    }
  }
  if (darkCount < 50) {
    return { walls: [], mmPerPx: null, note: '어두운 선을 찾지 못했습니다. 도면이 너무 흐릴 수 있습니다.' }
  }

  const core = erode(dark, w, h, ERODE_R)

  const walls: Wall[] = []
  const thicks: number[] = []
  for (const seg of bands(core, w, h, true)) {
    walls.push(mkWall(seg.a / w, seg.c / h, seg.b / w, seg.c / h))
    thicks.push(seg.thick)
  }
  for (const seg of bands(core, w, h, false)) {
    walls.push(mkWall(seg.c / w, seg.a / h, seg.c / w, seg.b / h))
    thicks.push(seg.thick)
  }

  const joined = snapEnds(walls, SNAP / w, SNAP / h)
  if (joined.length === 0) {
    return {
      walls: [],
      mmPerPx: null,
      note: '벽으로 볼 만한 두꺼운 선이 없습니다. 선이 얇은 도면이면 직접 그으셔야 합니다.',
    }
  }

  // 침식으로 양쪽이 r 씩 깎였으므로 되돌려 원래 두께로 본다. 중앙값이라 이상치에 흔들리지 않는다.
  thicks.sort((a, b) => a - b)
  const coreThick = thicks[Math.floor(thicks.length / 2)]
  const origThickPx = (coreThick + 2 * ERODE_R) / scale
  let mmPerPx: number | null = ASSUMED_WALL_MM / origThickPx
  // 말이 안 되는 값이면 쓰지 않는다 (해치가 벽으로 잡혔거나 도면이 지나치게 크거나 작을 때)
  if (!Number.isFinite(mmPerPx) || mmPerPx < 2 || mmPerPx > 80) mmPerPx = null

  const note =
    `벽 ${joined.length}개를 찾았습니다.` +
    (mmPerPx
      ? ` 벽 두께를 ${ASSUMED_WALL_MM}mm 로 보고 축척을 잡았습니다 (1px ≈ ${mmPerPx.toFixed(1)}mm) — 어림값입니다.`
      : ' 축척은 추정하지 못했습니다.')
  return { walls: joined, mmPerPx, note }
}

function mkWall(x1: number, y1: number, x2: number, y2: number): Wall {
  return { id: newId('aw'), x1, y1, x2, y2, thicknessMm: 150 }
}

/**
 * 가장 어두운 frac 만큼을 벽으로 보는 임계값. 도면마다 잉크 농도가 달라 고정값을 쓸 수 없고,
 * Otsu 는 바닥 무늬까지 끌어와 쓸 수 없다.
 */
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

/** 반지름 r 의 사각 침식. 얇은 선은 사라지고 두꺼운 벽 심만 남는다. */
function erode(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h)
  // 가로 방향
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
  // 세로 방향
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

/**
 * 한 방향의 띠를 찾는다. horizontal 이면 행마다 가로로 이어진 구간을 모으고,
 * 세로로 겹치는 것을 한 띠로 합쳐 중심선을 낸다.
 */
function bands(core: Uint8Array, w: number, h: number, horizontal: boolean): Band[] {
  const major = horizontal ? h : w   // 훑어 내려가는 축
  const minor = horizontal ? w : h   // 구간을 재는 축
  const at = (i: number, j: number) => (horizontal ? core[i * w + j] : core[j * w + i])

  type Run = { a: number; b: number; i: number }
  const open: { a: number; b: number; from: number; to: number }[] = []
  const done: Band[] = []

  for (let i = 0; i < major; i++) {
    const runs: Run[] = []
    let start = -1
    for (let j = 0; j <= minor; j++) {
      const on = j < minor && at(i, j)
      if (on && start < 0) start = j
      if (!on && start >= 0) {
        if (j - start >= MIN_LEN) runs.push({ a: start, b: j - 1, i })
        start = -1
      }
    }

    const used = new Array(open.length).fill(false)
    for (const r of runs) {
      // 겹치는 열린 띠에 이어 붙인다
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
        used[hit] = true
      } else {
        open.push({ a: r.a, b: r.b, from: i, to: i })
      }
    }
    // 이번 줄에서 이어지지 않은 띠는 닫는다
    for (let k = open.length - 1; k >= 0; k--) {
      if (open[k].to < i) {
        const o = open[k]
        const thick = o.to - o.from + 1
        if (thick <= MAX_BAND && o.b - o.a >= MIN_LEN) {
          done.push({ a: o.a, b: o.b, c: (o.from + o.to) / 2, thick })
        }
        open.splice(k, 1)
      }
    }
  }
  for (const o of open) {
    const thick = o.to - o.from + 1
    if (thick <= MAX_BAND && o.b - o.a >= MIN_LEN) {
      done.push({ a: o.a, b: o.b, c: (o.from + o.to) / 2, thick })
    }
  }

  // 같은 선 위에서 끊긴 조각을 잇는다 (문·창 자리에서 끊긴다)
  done.sort((p, q) => p.c - q.c || p.a - q.a)
  const merged: Band[] = []
  for (const b of done) {
    const last = merged[merged.length - 1]
    if (last && Math.abs(last.c - b.c) <= SAME_LINE && b.a - last.b <= JOIN_GAP) {
      last.b = Math.max(last.b, b.b)
      last.c = (last.c + b.c) / 2
      last.thick = Math.max(last.thick, b.thick)
    } else {
      merged.push({ ...b })
    }
  }
  return merged
}

/** 끝점이 가까우면 한 점으로 모은다. 모서리가 벌어져 있으면 방이 닫히지 않는다. */
function snapEnds(walls: Wall[], tx: number, ty: number): Wall[] {
  const pts: { x: number; y: number }[] = []
  const find = (x: number, y: number) => {
    for (const p of pts) {
      if (Math.abs(p.x - x) <= tx && Math.abs(p.y - y) <= ty) return p
    }
    const p = { x, y }
    pts.push(p)
    return p
  }
  return walls.map((w) => {
    const a = find(w.x1, w.y1)
    const b = find(w.x2, w.y2)
    return { ...w, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
}
