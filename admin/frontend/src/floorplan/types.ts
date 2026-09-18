/**
 * 도면 배치에 쓰는 모양들.
 *
 * 좌표는 전부 **이미지 대비 비율(0~1)** 이다. 도면을 확대하거나 더 큰 해상도로 다시 올려도
 * 위치가 그대로 유지된다. 실제 치수는 축척(scale)으로 환산한다.
 */

export type Wall = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  /** 벽 두께. 3D 로 세울 때만 쓴다. 기본 150mm */
  thicknessMm: number
}

export type Room = {
  id: string
  name: string
  /** 닫힌 다각형. [[x, y], ...] */
  points: [number, number][]
}

/** 문·창. 벽 위의 위치(t: 0~1)와 폭으로 잡는다. */
export type Opening = {
  id: string
  wallId: string
  t: number
  widthMm: number
  kind: 'DOOR' | 'WINDOW'
  /** 바닥에서 아랫변까지. 문은 0, 창은 보통 900 */
  sillMm: number
  heightMm: number
}

export type Geometry = {
  walls: Wall[]
  rooms: Room[]
  openings: Opening[]
}

export type PlacedDevice = {
  id: string
  item: string
  x: number
  y: number
  /** 설치 높이(바닥 기준 mm). 스위치 1200 · 천장 조명은 벽 높이 · 센서 2100 등 */
  mountMm: number
  note?: string
}

export type Scale = {
  x1: number | null
  y1: number | null
  x2: number | null
  y2: number | null
  mm: number | null
}

export type RoomArea = { name: string | null; areaM2: number; deviceCount: number }

export type Derived = {
  scaled: boolean
  /** 이미지 전체 폭·높이가 몇 mm 인지. 비율 좌표 × 이 값 = mm */
  mmPerUnitX: number
  mmPerUnitY: number
  wallCount: number
  wallTotalMm: number
  roomCount: number
  floorAreaM2: number
  deviceCount: number
  rooms: RoomArea[]
}

export type Floorplan = {
  id: number
  inquiryId: number
  name: string | null
  originalName: string | null
  contentType: string
  sizeBytes: number
  imageWidth: number | null
  imageHeight: number | null
  scale: Scale
  wallHeightMm: number
  geometry: Partial<Geometry>
  devices: PlacedDevice[]
  derived: Derived | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

export const EMPTY_GEOMETRY: Geometry = { walls: [], rooms: [], openings: [] }

export function geometryOf(f: Floorplan): Geometry {
  return {
    walls: f.geometry?.walls ?? [],
    rooms: f.geometry?.rooms ?? [],
    openings: f.geometry?.openings ?? [],
  }
}

/** 기기 품목 → 기본 설치 높이(mm)와 3D 표시 색. 현장 관행에 맞춘 값이다. */
export const DEVICE_STYLE: Record<string, { mountMm: number; color: string; short: string }> = {
  '조명 스위치': { mountMm: 1200, color: '#2a78d6', short: '스위치' },
  '움직임 센서': { mountMm: 2100, color: '#7a5cd6', short: '모션' },
  '문 열림 센서': { mountMm: 2000, color: '#7a5cd6', short: '문열림' },
  '누수 센서': { mountMm: 30, color: '#1b9e8a', short: '누수' },
  '온습도 센서': { mountMm: 1500, color: '#1b9e8a', short: '온습도' },
  '전동 커튼 모터': { mountMm: 2300, color: '#eb6834', short: '커튼' },
  '스마트 도어락': { mountMm: 1000, color: '#c0392b', short: '도어락' },
  '실내 카메라': { mountMm: 2200, color: '#c0392b', short: '카메라' },
  '벽면 태블릿': { mountMm: 1400, color: '#0f7b6c', short: '태블릿' },
  '계측 플러그': { mountMm: 300, color: '#b8860b', short: '플러그' },
  '음성 스피커': { mountMm: 900, color: '#0f7b6c', short: '스피커' },
  '적외선 리모컨 허브': { mountMm: 1800, color: '#eb6834', short: 'IR허브' },
  'SmartThings 허브': { mountMm: 900, color: '#333333', short: '허브' },
}

export function styleOf(item: string) {
  return DEVICE_STYLE[item] ?? { mountMm: 1200, color: '#666666', short: item.slice(0, 4) }
}

export function newId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9)
}
