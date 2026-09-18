import { useCallback, useEffect, useRef, useState } from 'react'
import type { Geometry, Opening, PlacedDevice, Room, Scale, Wall } from './types'
import { newId, styleOf } from './types'

/**
 * 도면 위에 구조를 그리는 2D 편집기.
 *
 * 도면 이미지를 배경에 깔고 그 위에 SVG 를 겹친다. 좌표는 비율(0~1)로 들고 있다가
 * 그릴 때만 픽셀로 바꾼다 — 창 크기가 바뀌어도 선이 따라 움직이고, 저장된 값은 해상도와 무관하다.
 *
 * 벽을 자동으로 인식하지 않는 이유: 인테리어 도면은 축척·선 두께·범례가 제각각이라
 * 자동 인식 결과를 고치는 편이 처음부터 긋는 것보다 오래 걸린다. 대신 각도 스냅과
 * 끝점 스냅을 넣어 손으로 긋는 속도를 올렸다.
 */

export type Mode = 'select' | 'scale' | 'wall' | 'room' | 'opening' | 'device'

type Point = { x: number; y: number }

/** 끝점에 붙는 거리(px). 이 안에 들어오면 기존 점에 딱 맞춘다. */
const SNAP_PX = 10
/** 이 각도(도) 안쪽이면 수평·수직으로 편다. */
const ANGLE_SNAP_DEG = 7

export default function PlanEditor({
  imageUrl,
  geometry,
  devices,
  scale,
  mode,
  paletteItem,
  openingKind,
  wallHeightMm,
  mmPerUnitX,
  mmPerUnitY,
  selectedId,
  onSelect,
  onGeometry,
  onDevices,
  onScalePoints,
}: {
  imageUrl: string
  geometry: Geometry
  devices: PlacedDevice[]
  scale: Scale
  mode: Mode
  paletteItem: string | null
  openingKind: 'DOOR' | 'WINDOW'
  wallHeightMm: number
  mmPerUnitX: number
  mmPerUnitY: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onGeometry: (next: Geometry) => void
  onDevices: (next: PlacedDevice[]) => void
  onScalePoints: (a: Point, b: Point) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [draft, setDraft] = useState<Point[]>([])
  const [hover, setHover] = useState<Point | null>(null)
  const [drag, setDrag] = useState<string | null>(null)

  // 이미지가 실제로 그려진 크기를 재서 픽셀 변환에 쓴다.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 모드를 바꾸면 그리던 것을 버린다. 남아 있으면 다음 클릭이 엉뚱한 데 붙는다.
  useEffect(() => {
    setDraft([])
  }, [mode])

  const toRatio = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const r = boxRef.current!.getBoundingClientRect()
      return {
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      }
    },
    [],
  )

  const px = (p: Point) => ({ x: p.x * size.w, y: p.y * size.h })

  /** 기존 벽 끝점에 가까우면 거기에 붙인다. 방을 닫을 때 틈이 생기지 않게. */
  function snapToEnds(p: Point): Point {
    let best: Point | null = null
    let bestD = SNAP_PX
    const cand: Point[] = []
    for (const w of geometry.walls) {
      cand.push({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })
    }
    for (const r of geometry.rooms) {
      for (const [x, y] of r.points) cand.push({ x, y })
    }
    for (const c of cand) {
      const d = Math.hypot((c.x - p.x) * size.w, (c.y - p.y) * size.h)
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best ?? p
  }

  /** 직전 점에서 거의 수평·수직이면 반듯하게 편다. 도면 벽은 대부분 직각이다. */
  function snapAngle(from: Point, to: Point): Point {
    const dx = (to.x - from.x) * size.w
    const dy = (to.y - from.y) * size.h
    if (Math.hypot(dx, dy) < 2) return to
    const deg = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI)
    if (deg < ANGLE_SNAP_DEG || deg > 180 - ANGLE_SNAP_DEG) return { x: to.x, y: from.y }
    if (Math.abs(deg - 90) < ANGLE_SNAP_DEG) return { x: from.x, y: to.y }
    return to
  }

  function place(e: React.MouseEvent): Point {
    let p = toRatio(e)
    if (mode === 'wall' || mode === 'room') {
      p = snapToEnds(p)
      if (draft.length > 0) p = snapAngle(draft[draft.length - 1], p)
    }
    return p
  }

  function onClick(e: React.MouseEvent) {
    if (size.w === 0) return
    const p = place(e)

    if (mode === 'scale') {
      const next = [...draft, p]
      if (next.length === 2) {
        onScalePoints(next[0], next[1])
        setDraft([])
      } else {
        setDraft(next)
      }
      return
    }

    if (mode === 'wall') {
      if (draft.length === 0) {
        setDraft([p])
        return
      }
      const from = draft[draft.length - 1]
      const wall: Wall = { id: newId('w'), x1: from.x, y1: from.y, x2: p.x, y2: p.y, thicknessMm: 150 }
      onGeometry({ ...geometry, walls: [...geometry.walls, wall] })
      setDraft([p])   // 이어 긋는다
      return
    }

    if (mode === 'room') {
      if (draft.length >= 3) {
        const first = draft[0]
        const near = Math.hypot((first.x - p.x) * size.w, (first.y - p.y) * size.h) < SNAP_PX * 1.6
        if (near) {
          closeRoom()
          return
        }
      }
      setDraft([...draft, p])
      return
    }

    if (mode === 'opening') {
      const hit = nearestWall(p)
      if (!hit) return
      const op: Opening = {
        id: newId('o'),
        wallId: hit.wall.id,
        t: hit.t,
        widthMm: openingKind === 'DOOR' ? 900 : 1200,
        kind: openingKind,
        sillMm: openingKind === 'DOOR' ? 0 : 900,
        heightMm: openingKind === 'DOOR' ? 2100 : 1200,
      }
      onGeometry({ ...geometry, openings: [...geometry.openings, op] })
      return
    }

    if (mode === 'device') {
      if (!paletteItem) return
      const st = styleOf(paletteItem)
      const d: PlacedDevice = {
        id: newId('d'),
        item: paletteItem,
        x: p.x,
        y: p.y,
        mountMm: Math.min(st.mountMm, wallHeightMm),
      }
      onDevices([...devices, d])
      return
    }

    onSelect(null)
  }

  function closeRoom() {
    if (draft.length < 3) return
    const room: Room = {
      id: newId('r'),
      name: '방 ' + (geometry.rooms.length + 1),
      points: draft.map((p) => [p.x, p.y] as [number, number]),
    }
    onGeometry({ ...geometry, rooms: [...geometry.rooms, room] })
    setDraft([])
  }

  /** 클릭 지점에서 가장 가까운 벽과 그 위의 위치(0~1). 문·창을 놓을 때 쓴다. */
  function nearestWall(p: Point): { wall: Wall; t: number } | null {
    let best: { wall: Wall; t: number } | null = null
    let bestD = Infinity
    for (const w of geometry.walls) {
      const ax = w.x1 * size.w
      const ay = w.y1 * size.h
      const bx = w.x2 * size.w
      const by = w.y2 * size.h
      const vx = bx - ax
      const vy = by - ay
      const len2 = vx * vx + vy * vy || 1
      let t = ((p.x * size.w - ax) * vx + (p.y * size.h - ay) * vy) / len2
      t = Math.min(1, Math.max(0, t))
      const d = Math.hypot(ax + vx * t - p.x * size.w, ay + vy * t - p.y * size.h)
      if (d < bestD) {
        bestD = d
        best = { wall: w, t }
      }
    }
    return best && bestD < 24 ? best : null
  }

  // 기기는 끌어서 옮긴다. 배치하고 나서 미세 조정하는 일이 잦다.
  function onPointerMove(e: React.MouseEvent) {
    if (size.w === 0) return
    setHover(toRatio(e))
    if (drag) {
      const p = toRatio(e)
      onDevices(devices.map((d) => (d.id === drag ? { ...d, x: p.x, y: p.y } : d)))
    }
  }

  function lengthLabel(w: Wall): string | null {
    if (!mmPerUnitX) return null
    const mm = Math.hypot((w.x2 - w.x1) * mmPerUnitX, (w.y2 - w.y1) * mmPerUnitY)
    return mm < 10 ? null : (mm / 1000).toFixed(2) + 'm'
  }

  const cursor =
    mode === 'select' ? 'default' : mode === 'device' && !paletteItem ? 'not-allowed' : 'crosshair'

  return (
    <div
      ref={boxRef}
      className="plan-box"
      style={{ cursor }}
      onClick={onClick}
      onMouseMove={onPointerMove}
      onMouseUp={() => setDrag(null)}
      onMouseLeave={() => {
        setDrag(null)
        setHover(null)
      }}
      onDoubleClick={() => {
        if (mode === 'room') closeRoom()
        if (mode === 'wall') setDraft([])
      }}
    >
      <img src={imageUrl} alt="도면" draggable={false} />

      {size.w > 0 ? (
        <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {/* 방 — 면부터 깔아야 벽이 위에 보인다 */}
          {geometry.rooms.map((r) => {
            const pts = r.points.map(([x, y]) => `${x * size.w},${y * size.h}`).join(' ')
            const cx = (r.points.reduce((s, p) => s + p[0], 0) / r.points.length) * size.w
            const cy = (r.points.reduce((s, p) => s + p[1], 0) / r.points.length) * size.h
            return (
              <g key={r.id} onClick={(e) => { e.stopPropagation(); onSelect(r.id) }}>
                <polygon
                  points={pts}
                  fill={selectedId === r.id ? 'rgba(42,120,214,0.28)' : 'rgba(42,120,214,0.12)'}
                  stroke="#2a78d6"
                  strokeWidth={selectedId === r.id ? 2 : 1}
                />
                <text x={cx} y={cy} className="plan-room-name">{r.name}</text>
              </g>
            )
          })}

          {/* 벽 */}
          {geometry.walls.map((w) => {
            const a = px({ x: w.x1, y: w.y1 })
            const b = px({ x: w.x2, y: w.y2 })
            const label = lengthLabel(w)
            return (
              <g key={w.id} onClick={(e) => { e.stopPropagation(); onSelect(w.id) }}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={selectedId === w.id ? '#eb6834' : '#14233d'}
                  strokeWidth={selectedId === w.id ? 7 : 5}
                  strokeLinecap="round"
                />
                {label ? (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} className="plan-len">{label}</text>
                ) : null}
              </g>
            )
          })}

          {/* 문 · 창 */}
          {geometry.openings.map((o) => {
            const w = geometry.walls.find((x) => x.id === o.wallId)
            if (!w) return null
            const x = (w.x1 + (w.x2 - w.x1) * o.t) * size.w
            const y = (w.y1 + (w.y2 - w.y1) * o.t) * size.h
            return (
              <g key={o.id} onClick={(e) => { e.stopPropagation(); onSelect(o.id) }}>
                <circle
                  cx={x} cy={y} r={selectedId === o.id ? 9 : 7}
                  fill={o.kind === 'DOOR' ? '#f5b544' : '#7ec8e3'}
                  stroke="#14233d" strokeWidth={1.5}
                />
                <text x={x} y={y + 3.5} className="plan-pin-mark">{o.kind === 'DOOR' ? '문' : '창'}</text>
              </g>
            )
          })}

          {/* 배치한 기기 */}
          {devices.map((d) => {
            const p = px(d)
            const st = styleOf(d.item)
            return (
              <g
                key={d.id}
                onMouseDown={(e) => { e.stopPropagation(); setDrag(d.id); onSelect(d.id) }}
                onClick={(e) => { e.stopPropagation(); onSelect(d.id) }}
                style={{ cursor: 'grab' }}
              >
                <circle
                  cx={p.x} cy={p.y} r={selectedId === d.id ? 12 : 10}
                  fill={st.color} stroke="#fff" strokeWidth={2}
                />
                <text x={p.x} y={p.y + 3.5} className="plan-pin-mark">{st.short.slice(0, 2)}</text>
              </g>
            )
          })}

          {/* 그리는 중인 것 */}
          {draft.length > 0 ? (
            <g>
              <polyline
                points={[...draft, ...(hover ? [hover] : [])]
                  .map((p) => `${p.x * size.w},${p.y * size.h}`)
                  .join(' ')}
                fill="none"
                stroke={mode === 'scale' ? '#c0392b' : '#eb6834'}
                strokeWidth={2.5}
                strokeDasharray="6 4"
              />
              {draft.map((p, i) => (
                <circle key={i} cx={p.x * size.w} cy={p.y * size.h} r={4} fill="#eb6834" />
              ))}
            </g>
          ) : null}

          {/* 축척 기준선 */}
          {scale.x1 != null && scale.x2 != null && scale.mm ? (
            <g>
              <line
                x1={scale.x1 * size.w} y1={scale.y1! * size.h}
                x2={scale.x2 * size.w} y2={scale.y2! * size.h}
                stroke="#c0392b" strokeWidth={2.5}
              />
              <text
                x={((scale.x1 + scale.x2) / 2) * size.w}
                y={((scale.y1! + scale.y2!) / 2) * size.h - 8}
                className="plan-len scale"
              >
                기준 {(scale.mm / 1000).toFixed(2)}m
              </text>
            </g>
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}
