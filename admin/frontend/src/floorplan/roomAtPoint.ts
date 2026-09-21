import type { Wall } from './types'

/**
 * 클릭한 자리를 둘러싼 방을 찾아 테두리 좌표로 돌려준다. 안 닫혀 있으면 null.
 *
 * 방 하나 그리려고 모서리를 네댓 번 찍는 건 도면 한 장에 스무 번 넘는 클릭이 된다.
 * 벽을 다 그었으면 안쪽은 이미 정해져 있으므로, 한 번 클릭으로 끝나야 한다.
 *
 * 벽을 격자에 굽고 → 클릭 지점에서 번지고 → 번진 영역의 테두리를 따라간다.
 * 테두리는 격자 선을 따라가므로 자연히 직각 다각형이 되고, 이어진 직선은 하나로 줄인다.
 */

/** 작업 격자 폭. 방 테두리에 이 정도면 충분하고, 10만 칸이라 클릭마다 돌려도 즉시 끝난다. */
const GRID_W = 400
/** 벽을 굽는 굵기(칸). 끝점이 스냅으로 딱 맞아도 대각선 이음매에 1칸 틈이 생긴다. */
const WALL_CELLS = 2
/** 이보다 짧은 층계참은 펴 버린다. 격자 때문에 생긴 톱니지 실제 꺾임이 아니다. */
const SIMPLIFY_CELLS = 4

type Pt = { x: number; y: number }

export function roomAtPoint(walls: Wall[], at: Pt, aspect: number): [number, number][] | null {
  if (walls.length < 3) return null

  const w = GRID_W
  const h = Math.max(8, Math.round(GRID_W * aspect))
  const solid = new Uint8Array(w * h)

  const mark = (x: number, y: number) => {
    for (let dy = -WALL_CELLS; dy <= WALL_CELLS; dy++) {
      for (let dx = -WALL_CELLS; dx <= WALL_CELLS; dx++) {
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) solid[yy * w + xx] = 1
      }
    }
  }
  for (const wall of walls) {
    const ax = wall.x1 * w
    const ay = wall.y1 * h
    const bx = wall.x2 * w
    const by = wall.y2 * h
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))))
    for (let i = 0; i <= steps; i++) {
      mark(Math.round(ax + ((bx - ax) * i) / steps), Math.round(ay + ((by - ay) * i) / steps))
    }
  }

  const sx = Math.min(w - 1, Math.max(0, Math.round(at.x * w)))
  const sy = Math.min(h - 1, Math.max(0, Math.round(at.y * h)))
  if (solid[sy * w + sx]) return null

  // 번지기. 테두리에 닿으면 바깥과 통해 있다는 뜻이라 방이 아니다.
  const inside = new Uint8Array(w * h)
  const stack = [sy * w + sx]
  inside[sy * w + sx] = 1
  let cells = 0
  while (stack.length) {
    const i = stack.pop()!
    cells++
    const x = i % w
    const y = (i / w) | 0
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return null
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = (y + dy) * w + (x + dx)
      if (inside[j] || solid[j]) continue
      inside[j] = 1
      stack.push(j)
    }
  }
  // 벽 사이 실금은 방이 아니다.
  if (cells < 40) return null

  const loop = traceOutline(inside, w, h)
  if (!loop) return null
  return loop.map(([x, y]) => [x / w, y / h] as [number, number])
}

/**
 * 채워진 영역의 테두리를 한 바퀴 따라간다.
 *
 * 칸이 아니라 **칸 사이 격자선**을 따라간다. 안쪽 칸과 바깥쪽 칸이 맞닿는 곳마다
 * 방향을 정해 선분을 하나씩 만들어 두고(안쪽이 왼쪽에 오도록), 끝점을 이어 고리를 만든다.
 */
function traceOutline(inside: Uint8Array, w: number, h: number): [number, number][] | null {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : inside[y * w + x])
  const key = (x: number, y: number) => x * (h + 1) + y
  const next = new Map<number, [number, number]>()

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue
      if (!at(x, y - 1)) next.set(key(x + 1, y), [x, y])
      if (!at(x - 1, y)) next.set(key(x, y), [x, y + 1])
      if (!at(x, y + 1)) next.set(key(x, y + 1), [x + 1, y + 1])
      if (!at(x + 1, y)) next.set(key(x + 1, y + 1), [x + 1, y])
    }
  }
  if (next.size < 4) return null

  const startKey = next.keys().next().value as number
  const startX = Math.floor(startKey / (h + 1))
  const startY = startKey % (h + 1)
  const loop: [number, number][] = []
  let cx = startX
  let cy = startY
  for (let guard = 0; guard <= next.size; guard++) {
    loop.push([cx, cy])
    const step = next.get(key(cx, cy))
    if (!step) return null
    cx = step[0]
    cy = step[1]
    if (cx === startX && cy === startY) return simplify(loop)
  }
  return null
}

/** 같은 방향으로 이어지는 점을 없애고, 격자 때문에 생긴 잔 톱니를 편다. */
function simplify(points: [number, number][]): [number, number][] {
  let out = dropCollinear(points)
  // 짧은 층계참 펴기 — 한 번 펴면 새로 일직선이 되는 곳이 생겨 다시 줄인다.
  for (let pass = 0; pass < 3; pass++) {
    const kept: [number, number][] = []
    for (let i = 0; i < out.length; i++) {
      const prev = out[(i - 1 + out.length) % out.length]
      const cur = out[i]
      const nxt = out[(i + 1) % out.length]
      const inLen = Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1])
      const outLen = Math.abs(nxt[0] - cur[0]) + Math.abs(nxt[1] - cur[1])
      if (inLen < SIMPLIFY_CELLS && outLen < SIMPLIFY_CELLS) continue
      kept.push(cur)
    }
    if (kept.length < 4) break
    const reduced = dropCollinear(kept)
    if (reduced.length === out.length) break
    out = reduced
  }
  return out.length >= 4 ? out : points
}

function dropCollinear(points: [number, number][]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const cur = points[i]
    const nxt = points[(i + 1) % points.length]
    const straight =
      (prev[0] === cur[0] && cur[0] === nxt[0]) || (prev[1] === cur[1] && cur[1] === nxt[1])
    if (!straight) out.push(cur)
  }
  return out.length >= 4 ? out : points
}
