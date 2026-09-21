import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CRow,
  CSpinner,
} from '@coreui/react'
import { api, errorMessage } from '../api'
import PlanEditor, { type Mode } from '../floorplan/PlanEditor'
import PlanView3D from '../floorplan/PlanView3D'
import { EMPTY_GEOMETRY, geometryOf, styleOf } from '../floorplan/types'
import { detectPlan } from '../floorplan/detectPlan'
import type { Floorplan, Geometry, PlacedDevice, Scale } from '../floorplan/types'
import type { InquiryDetail, RequirementSheet } from '../data/types'

/**
 * 도면 배치 화면.
 *
 * 왼쪽에서 도면 위에 구조를 그리고, 오른쪽에서 그게 바로 3D 로 선다.
 * 하나의 데이터를 두 화면이 나눠 볼 뿐이라 따로 맞출 일이 없다.
 *
 * 기준은 시공 검토다 — 축척·문·창을 제대로 넣어야 배선 길이와 간섭을 볼 수 있다.
 * 그 데이터가 그대로 고객 설명용 그림이 된다.
 */
/**
 * 그리는 순서. 벽을 자동으로 인식하지 않으므로 사람이 이 차례로 짚어 나간다.
 * 화면이 이걸 말해 주지 않으면 올려 놓고 아무 일도 안 일어나는 것처럼 보인다.
 */
/**
 * 손으로 칠 일이 아닌 이름들. 아파트 평면도에 나오는 순서대로 뒀다.
 * 판독 키가 없어도 클릭 한 번이면 끝나게 하려는 것이다.
 */
const ROOM_NAMES = ['거실', '안방', '침실', '주방', '화장실', '드레스룸', '발코니', '현관', '다용도실', '서재']

const STEPS: { mode: Mode; no: string; label: string; hint: string }[] = [
  {
    mode: 'scale',
    no: '1',
    label: '축척',
    hint: '길이를 아는 두 점을 차례로 클릭한 뒤 실제 치수(mm)를 넣으세요. 도면에 적힌 치수를 쓰면 가장 정확합니다.',
  },
  {
    mode: 'wall',
    no: '2',
    label: '벽',
    hint: '벽을 따라 클릭해 이어 그으세요. 수평·수직에 가까우면 자동으로 반듯해지고, 기존 끝점 근처는 달라붙습니다. Esc 를 누르면 끊깁니다. 잘못 그었으면 Ctrl+Z.',
  },
  {
    mode: 'room',
    no: '3',
    label: '방',
    hint: '방 안쪽을 한 번 클릭하면 벽을 따라 저절로 채워집니다. 벽이 안 닫혀 있으면 채워지지 않으니, 그때는 모서리를 돌아가며 클릭하고 첫 점을 다시 누르세요.',
  },
  {
    mode: 'opening',
    no: '4',
    label: '문·창',
    hint: '문 또는 창을 고른 뒤 놓을 벽을 클릭하세요. 폭·높이는 오른쪽에서 고칩니다.',
  },
  {
    mode: 'device',
    no: '5',
    label: '기기',
    hint: '아래 팔레트에서 기기를 고른 뒤 도면을 클릭하면 놓입니다. 놓인 기기는 끌어서 옮길 수 있습니다.',
  },
]

export default function FloorplanPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<Floorplan[] | null>(null)
  const [current, setCurrent] = useState<Floorplan | null>(null)
  const [sheet, setSheet] = useState<RequirementSheet | null>(null)
  const [detail, setDetail] = useState<InquiryDetail | null>(null)

  const [geometry, setGeometry] = useState<Geometry>(EMPTY_GEOMETRY)
  const [devices, setDevices] = useState<PlacedDevice[]>([])
  const [scale, setScale] = useState<Scale>({ x1: null, y1: null, x2: null, y2: null, mm: null })
  const [wallHeightMm, setWallHeightMm] = useState(2400)

  const [mode, setMode] = useState<Mode>('wall')
  const [paletteItem, setPaletteItem] = useState<string | null>(null)
  const [openingKind, setOpeningKind] = useState<'DOOR' | 'WINDOW'>('DOOR')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [show3d, setShow3d] = useState(true)

  const [pendingScale, setPendingScale] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null)
  const [scaleMm, setScaleMm] = useState('')

  const [nameBusy, setNameBusy] = useState(false)
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoNote, setAutoNote] = useState<string | null>(null)
  const [extent, setExtent] = useState<{ x1: number; x2: number; y: number } | null>(null)
  const [totalWidthM, setTotalWidthM] = useState('')

  // 되돌리기 — change() 한 곳만 지나가므로 여기서 직전 상태를 쌓으면 된다.
  // 사람은 실수를 되돌릴 수 있을 때 훨씬 빨리 긋는다. 편집기를 주 경로로 쓰려면 이게 먼저다.
  type Snap = { geometry: Geometry; devices: PlacedDevice[] }
  const undoRef = useRef<Snap[]>([])
  const redoRef = useRef<Snap[]>([])
  const [histDepth, setHistDepth] = useState({ undo: 0, redo: 0 })

  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    api<Floorplan[]>(`/api/admin/inquiries/${id}/floorplans`)
      .then((list) => {
        setPlans(list)
        setCurrent((prev) => list.find((p) => p.id === prev?.id) ?? list[0] ?? null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  useEffect(load, [load])

  useEffect(() => {
    api<InquiryDetail>(`/api/admin/inquiries/${id}`).then(setDetail).catch(() => setDetail(null))
    api<RequirementSheet>(`/api/admin/inquiries/${id}/requirements`).then(setSheet).catch(() => setSheet(null))
  }, [id])

  // 고른 도면이 바뀌면 편집 상태를 그 도면 것으로 갈아 끼운다.
  useEffect(() => {
    if (!current) return
    setGeometry(geometryOf(current))
    setDevices(current.devices ?? [])
    setScale(current.scale)
    setWallHeightMm(current.wallHeightMm)
    setSelectedId(null)
    setDirty(false)
  }, [current?.id])

  /**
   * 축척 환산. 서버도 같은 값을 내지만 그건 저장해야 갱신된다 —
   * 그리는 도중에도 3D 가 따라와야 하므로 여기서 직접 계산한다.
   */
  const view = useMemo(() => {
    const w = current?.imageWidth ?? 0
    const h = current?.imageHeight ?? 0
    if (!w || !h || scale.x1 == null || scale.x2 == null || scale.y1 == null || scale.y2 == null || !scale.mm) {
      return { scaled: false, mmX: 0, mmY: 0 }
    }
    const px = Math.hypot((scale.x2 - scale.x1) * w, (scale.y2 - scale.y1) * h)
    if (px < 0.5) return { scaled: false, mmX: 0, mmY: 0 }
    const mmPerPx = scale.mm / px
    return { scaled: true, mmX: mmPerPx * w, mmY: mmPerPx * h }
  }, [scale, current?.imageWidth, current?.imageHeight])

  const mmX = view.mmX
  const mmY = view.mmY

  /** 필요 수량(시트) 대비 배치 수량. 도면을 채우다 보면 모자란 게 바로 보인다. */
  const palette = useMemo(() => {
    const need = sheet?.devices ?? []
    return need.map((n) => ({
      item: n.item,
      need: n.count,
      placed: devices.filter((d) => d.item === n.item).length,
    }))
  }, [sheet, devices])

  /**
   * 도면 그림에서 벽을 찾아 넣고, 벽 두께로 축척까지 추정한다.
   * 결과는 초안이다 — 틀린 곳은 편집기에서 고친다. 서버를 거치지 않고 브라우저에서 끝난다.
   */
  async function runDetect(planId: number, imageWidth: number, imageHeight: number) {
    setAutoBusy(true)
    setAutoNote(null)
    try {
      const img = new Image()
      img.src = `/api/admin/floorplans/${planId}/image`
      await img.decode()
      const res = detectPlan(img)
      let note = res.note
      setExtent(res.extent)

      if (res.walls.length > 0) {
        // 벽·문창·방을 통째로 갈아 끼운다. 손으로 고친 게 있으면 덮어쓰므로 버튼을 눌러야만 돈다.
        setGeometry({ walls: res.walls, openings: res.openings, rooms: res.rooms })
        setDirty(true)
        setMode('select')

        // 가장 긴 벽에 추정 축척을 물려 준다. 두 점 + 실제 길이가 우리 축척 표현이다.
        if (res.mmPerPx && imageWidth && imageHeight) {
          let best = res.walls[0]
          let bestPx = 0
          for (const wl of res.walls) {
            const d = Math.hypot((wl.x2 - wl.x1) * imageWidth, (wl.y2 - wl.y1) * imageHeight)
            if (d > bestPx) {
              bestPx = d
              best = wl
            }
          }
          const mm = Math.round(bestPx * res.mmPerPx)
          setScale({ x1: best.x1, y1: best.y1, x2: best.x2, y2: best.y2, mm })
          if (res.extent && imageWidth) {
            const widthM = ((res.extent.x2 - res.extent.x1) * imageWidth * res.mmPerPx) / 1000
            setTotalWidthM(widthM.toFixed(2))
            note += ` 전체 가로를 ${widthM.toFixed(2)}m 로 봤습니다.`
          }
        }
      }
      setAutoNote(note)
    } catch (e) {
      setAutoNote('도면을 읽지 못했습니다: ' + errorMessage(e))
    } finally {
      setAutoBusy(false)
    }
  }

  /**
   * 도면에 적힌 전체 가로 길이 하나로 축척을 다시 잡는다.
   *
   * 벽 두께로 어림한 값은 도면 양식에 따라 두 배 넘게 틀린다(실측: 한 도면은 -3%, 다른 도면은 +150%).
   * 전체 폭은 거의 모든 평면도에 적혀 있고 읽기도 쉬워서, 이 한 칸이 가장 확실한 보정 수단이다.
   */
  function applyTotalWidth() {
    const m = Number(totalWidthM)
    if (!extent || !Number.isFinite(m) || m <= 0) return
    setScale({ x1: extent.x1, y1: extent.y, x2: extent.x2, y2: extent.y, mm: Math.round(m * 1000) })
    setDirty(true)
    setNotice(`전체 가로를 ${m}m 로 맞췄습니다.`)
  }

  function change(next: { geometry?: Geometry; devices?: PlacedDevice[] }) {
    undoRef.current.push({ geometry, devices })
    // 한 번 되돌린 뒤 새로 그으면 앞으로 가기는 의미가 없어진다.
    redoRef.current = []
    if (undoRef.current.length > 200) undoRef.current.shift()
    setHistDepth({ undo: undoRef.current.length, redo: 0 })
    if (next.geometry) setGeometry(next.geometry)
    if (next.devices) setDevices(next.devices)
    setDirty(true)
  }

  function undo() {
    const prev = undoRef.current.pop()
    if (!prev) return
    redoRef.current.push({ geometry, devices })
    setGeometry(prev.geometry)
    setDevices(prev.devices)
    setSelectedId(null)
    setDirty(true)
    setHistDepth({ undo: undoRef.current.length, redo: redoRef.current.length })
  }

  function redo() {
    const next = redoRef.current.pop()
    if (!next) return
    undoRef.current.push({ geometry, devices })
    setGeometry(next.geometry)
    setDevices(next.devices)
    setSelectedId(null)
    setDirty(true)
    setHistDepth({ undo: undoRef.current.length, redo: redoRef.current.length })
  }

  // 도면을 바꾸면 이전 도면의 되돌리기 기록은 의미가 없다.
  useEffect(() => {
    undoRef.current = []
    redoRef.current = []
    setHistDepth({ undo: 0, redo: 0 })
  }, [current?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 입력칸에서 친 건 그대로 둔다. 방 이름을 고치다가 Ctrl+Z 가 도면을 되돌리면 곤란하다.
      const el = e.target as HTMLElement | null
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable
      if (typing) return

      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedId) return
        e.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const created = await api<Floorplan>(`/api/admin/inquiries/${id}/floorplans`, {
        method: 'POST',
        body: form,
      })
      setNotice('도면을 올렸습니다. 벽을 찾는 중입니다…')
      setCurrent(created)
      load()
      await runDetect(created.id, created.imageWidth ?? 0, created.imageHeight ?? 0)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!current) return
    setBusy(true)
    setError(null)
    try {
      const saved = await api<Floorplan>(`/api/admin/floorplans/${current.id}`, {
        method: 'PUT',
        json: { scale, wallHeightMm, geometry, devices },
      })
      setCurrent(saved)
      setDirty(false)
      setNotice('저장했습니다.')
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function removePlan() {
    if (!current) return
    if (!confirm('이 도면과 그 위에 그린 것을 모두 지웁니다.')) return
    try {
      await api(`/api/admin/floorplans/${current.id}`, { method: 'DELETE' })
      setCurrent(null)
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  function applyScale() {
    const mm = Number(scaleMm)
    if (!pendingScale || !Number.isFinite(mm) || mm <= 0) return
    setScale({ x1: pendingScale.a.x, y1: pendingScale.a.y, x2: pendingScale.b.x, y2: pendingScale.b.y, mm })
    setPendingScale(null)
    setScaleMm('')
    setDirty(true)
    setMode('wall')
    setNotice('축척을 잡았습니다. 이제 벽을 따라 그으시면 됩니다.')
  }

  /**
   * 도면을 읽어 방 이름을 채운다.
   *
   * 규칙으로는 못 가른다 — 어떤 도면은 욕실에 변기를 안 그리고 "욕실" 글자만 적고,
   * 어떤 도면은 변기·욕조를 그려 놓고 글자를 안 적는다. 굽은 선 비율로 찾아보려 했더니
   * 1등이 욕실이 아니라 발코니였다(문 열림 호가 모든 방에 있다). 서버가 모델에 넘긴다.
   *
   * 채운 결과도 change() 를 지나가므로 마음에 안 들면 Ctrl+Z 로 되돌린다.
   */
  async function autoNameRooms() {
    if (!current || geometry.rooms.length === 0) return
    setNameBusy(true)
    setError(null)
    setNotice(null)
    try {
      const centers = geometry.rooms.map((r) => {
        const xs = r.points.map((p) => p[0])
        const ys = r.points.map((p) => p[1])
        return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
      })
      const res = await api<{ names: { no: number; name: string | null; confidence: number | null }[] }>(
        `/api/admin/floorplans/${current.id}/room-names`,
        { method: 'POST', body: JSON.stringify({ centers }) },
      )
      const byNo = new Map(res.names.filter((n) => n.name).map((n) => [n.no, n.name as string]))
      if (byNo.size === 0) {
        setNotice('도면에서 방 이름을 읽지 못했습니다. 직접 적어 주세요.')
        return
      }
      change({
        geometry: {
          ...geometry,
          rooms: geometry.rooms.map((r, i) => ({ ...r, name: byNo.get(i + 1) ?? r.name })),
        },
      })
      setNotice(`방 ${byNo.size}개의 이름을 채웠습니다. 틀린 곳은 고치시고, 되돌리려면 Ctrl+Z 를 누르세요.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setNameBusy(false)
    }
  }

  /**
   * 방 이름을 정한다. 같은 이름이 이미 있으면 번호를 붙인다 —
   * 3D 라벨과 기기 목록에 "침실"이 둘이면 어느 쪽인지 알 수 없다.
   */
  function setRoomName(roomId: string, base: string) {
    const taken = new Set(geometry.rooms.filter((r) => r.id !== roomId).map((r) => r.name))
    let name = base
    for (let n = 2; taken.has(name); n++) name = base + ' ' + n
    change({
      geometry: {
        ...geometry,
        rooms: geometry.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)),
      },
    })
  }

  function removeSelected() {
    if (!selectedId) return
    change({
      geometry: {
        walls: geometry.walls.filter((w) => w.id !== selectedId),
        rooms: geometry.rooms.filter((r) => r.id !== selectedId),
        openings: geometry.openings.filter((o) => o.id !== selectedId && o.wallId !== selectedId),
      },
      devices: devices.filter((d) => d.id !== selectedId),
    })
    setSelectedId(null)
  }

  const selectedRoom = geometry.rooms.find((r) => r.id === selectedId)
  const selectedOpening = geometry.openings.find((o) => o.id === selectedId)
  const selectedDevice = devices.find((d) => d.id === selectedId)

  if (!plans) return error ? <CAlert color="danger">{error}</CAlert> : <CSpinner color="primary" />

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 mb-0">
          도면 배치
          {detail ? <span className="text-body-secondary fs-6 ms-2">#{detail.inquiry.id} {detail.inquiry.name}</span> : null}
        </h1>
        <div className="d-flex gap-2">
          <CButton color="secondary" variant="outline" onClick={() => navigate(`/inquiries/${id}`)}>
            신청 상세
          </CButton>
          <CButton color="primary" onClick={() => void save()} disabled={busy || !current || !dirty}>
            {busy ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </CButton>
        </div>
      </div>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {notice ? <CAlert color="info" dismissible onClose={() => setNotice(null)}>{notice}</CAlert> : null}

      {plans.length === 0 ? (
        <CCard>
          <CCardBody className="text-center py-5">
            <p className="text-body-secondary">아직 올린 도면이 없습니다.</p>
            <p className="small text-body-secondary mb-1">
              올린 뒤 <b>축척 → 벽 → 방 → 문·창 → 기기</b> 순서로 직접 그립니다.
            </p>
            <p className="small text-body-secondary">
              벽을 <b>자동으로 인식하지는 않습니다</b> — 도면마다 축척·선 두께가 달라 고치는 편이 더 오래 걸립니다.
              34평 기준 3~5분이면 끝납니다. JPG · PNG · WebP (20MB 이하), PDF 는 이미지로 내보내 주세요.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="d-none"
              onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
            />
            <CButton color="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              도면 올리기
            </CButton>
          </CCardBody>
        </CCard>
      ) : null}

      {current ? (
        <>
          <CCard className="mb-3">
            <CCardBody className="py-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                {plans.length > 1 ? (
                  <CFormSelect
                    size="sm"
                    style={{ width: 'auto' }}
                    value={current.id}
                    onChange={(e) => setCurrent(plans.find((p) => p.id === Number(e.target.value)) ?? null)}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.originalName || `도면 ${p.id}`}
                      </option>
                    ))}
                  </CFormSelect>
                ) : null}

                <CButtonGroup size="sm">
                  {([
                    ['scale', '축척'],
                    ['wall', '벽'],
                    ['room', '방'],
                    ['opening', '문·창'],
                    ['device', '기기'],
                    ['select', '선택'],
                  ] as [Mode, string][]).map(([m, label]) => (
                    <CButton
                      key={m}
                      color={mode === m ? 'primary' : 'secondary'}
                      variant={mode === m ? undefined : 'outline'}
                      onClick={() => setMode(m)}
                    >
                      {label}
                    </CButton>
                  ))}
                </CButtonGroup>

                {mode === 'opening' ? (
                  <CButtonGroup size="sm">
                    <CButton
                      color={openingKind === 'DOOR' ? 'warning' : 'secondary'}
                      variant={openingKind === 'DOOR' ? undefined : 'outline'}
                      onClick={() => setOpeningKind('DOOR')}
                    >
                      문
                    </CButton>
                    <CButton
                      color={openingKind === 'WINDOW' ? 'info' : 'secondary'}
                      variant={openingKind === 'WINDOW' ? undefined : 'outline'}
                      onClick={() => setOpeningKind('WINDOW')}
                    >
                      창
                    </CButton>
                  </CButtonGroup>
                ) : null}

                <CButton
                  size="sm"
                  color="info"
                  variant="outline"
                  disabled={autoBusy}
                  onClick={() => void runDetect(current.id, current.imageWidth ?? 0, current.imageHeight ?? 0)}
                >
                  {autoBusy ? '찾는 중…' : '도면 자동 인식'}
                </CButton>

                <span className="ms-auto d-flex align-items-center gap-2">
                  <span className="small text-body-secondary">벽 높이</span>
                  <CFormInput
                    size="sm"
                    type="number"
                    style={{ width: '6rem' }}
                    value={wallHeightMm}
                    onChange={(e) => { setWallHeightMm(Number(e.target.value)); setDirty(true) }}
                  />
                  <CFormSwitch
                    label="3D"
                    checked={show3d}
                    onChange={(e) => setShow3d(e.target.checked)}
                  />
                  <CFormSwitch
                    label="이름표"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                  />
                </span>
              </div>

              {/* 축척을 찍은 직후 실제 길이를 받는다 */}
              {pendingScale ? (
                <div className="d-flex align-items-center gap-2 mt-2">
                  <span className="small">찍은 두 점의 실제 길이(mm)</span>
                  <CFormInput
                    size="sm"
                    type="number"
                    autoFocus
                    style={{ width: '8rem' }}
                    value={scaleMm}
                    onChange={(e) => setScaleMm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyScale()}
                    placeholder="예: 4200"
                  />
                  <CButton size="sm" color="primary" onClick={applyScale}>확정</CButton>
                  <CButton size="sm" color="secondary" variant="outline" onClick={() => setPendingScale(null)}>
                    취소
                  </CButton>
                </div>
              ) : null}

              {/* 지금 어느 단계이고 무엇이 끝났는지. 눌러서 그 단계로 바로 간다. */}
              <div className="plan-steps mt-2">
                {STEPS.map((st) => {
                  const done =
                    st.mode === 'scale' ? view.scaled
                      : st.mode === 'wall' ? geometry.walls.length > 0
                      : st.mode === 'room' ? geometry.rooms.length > 0
                      : st.mode === 'opening' ? geometry.openings.length > 0
                      : devices.length > 0
                  return (
                    <button
                      key={st.mode}
                      type="button"
                      className={
                        'plan-step' + (mode === st.mode ? ' on' : '') + (done ? ' done' : '')
                      }
                      onClick={() => setMode(st.mode)}
                    >
                      <span className="plan-step-no">{done ? '✓' : st.no}</span>
                      {st.label}
                    </button>
                  )
                })}

                <div className="ms-auto d-flex gap-1">
                  {/* 방 이름은 도면에 적혀 있거나 기구로 알아볼 수 있다. 사람이 다시 칠 일이 아니다. */}
                  <CButton
                    size="sm"
                    color="primary"
                    variant="outline"
                    disabled={nameBusy || geometry.rooms.length === 0}
                    onClick={() => void autoNameRooms()}
                    title="도면을 읽어 방 이름을 채웁니다"
                  >
                    {nameBusy ? <CSpinner size="sm" /> : '방 이름 읽기'}
                  </CButton>
                </div>

                {/* 되돌리기는 단축키만으로 두면 아무도 모른다. 눈에 보이게 둔다. */}
                <div className="d-flex gap-1">
                  <CButton
                    size="sm"
                    color="secondary"
                    variant="outline"
                    disabled={histDepth.undo === 0}
                    onClick={undo}
                    title="되돌리기 (Ctrl+Z)"
                  >
                    ↶ 되돌리기
                  </CButton>
                  <CButton
                    size="sm"
                    color="secondary"
                    variant="outline"
                    disabled={histDepth.redo === 0}
                    onClick={redo}
                    title="다시 하기 (Ctrl+Shift+Z)"
                  >
                    ↷
                  </CButton>
                </div>
              </div>

              <div className="small mt-2">
                {mode === 'select' ? (
                  <span className="text-body-secondary">
                    벽·방·문창·기기를 클릭하면 오른쪽에서 고치거나 지울 수 있습니다.
                  </span>
                ) : (
                  <span className={view.scaled || mode === 'scale' ? 'text-body-secondary' : 'text-danger'}>
                    {STEPS.find((x) => x.mode === mode)?.hint}
                    {!view.scaled && mode !== 'scale' ? ' — 먼저 ① 축척을 잡아야 3D 로 섭니다.' : ''}
                  </span>
                )}
              </div>

              {autoNote ? (
                <div className="small mt-2 p-2 rounded bg-body-tertiary">
                  <div className="text-body-secondary">{autoNote}</div>
                  {extent ? (
                    <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                      <span className="fw-semibold">도면 전체 가로</span>
                      <CFormInput
                        size="sm"
                        type="number"
                        step="0.01"
                        style={{ width: '7rem' }}
                        value={totalWidthM}
                        onChange={(e) => setTotalWidthM(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && applyTotalWidth()}
                        placeholder="예: 14.62"
                      />
                      <span>m</span>
                      <CButton size="sm" color="primary" onClick={applyTotalWidth}>
                        축척 맞추기
                      </CButton>
                      <span className="text-body-secondary">
                        도면에 적힌 전체 폭을 넣으면 크기가 정확해집니다. 모양은 이미 맞습니다.
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {view.scaled ? (
                <div className="small text-body-secondary mt-1">
                  벽 {geometry.walls.length}개 · 방 {geometry.rooms.length}개 · 기기 {devices.length}점
                  {current.derived?.scaled && !dirty
                    ? ` · 총 벽 ${(current.derived.wallTotalMm / 1000).toFixed(1)}m · 바닥 ${current.derived.floorAreaM2}㎡`
                    : ' · 길이·면적은 저장하면 계산됩니다'}
                </div>
              ) : null}
            </CCardBody>
          </CCard>

          <CRow className="g-3">
            <CCol xs={12} xl={show3d ? 7 : 12}>
              <CCard>
                <CCardBody className="p-2">
                  <PlanEditor
                    imageUrl={`/api/admin/floorplans/${current.id}/image`}
                    geometry={geometry}
                    devices={devices}
                    scale={scale}
                    mode={mode}
                    paletteItem={paletteItem}
                    openingKind={openingKind}
                    wallHeightMm={wallHeightMm}
                    mmPerUnitX={mmX}
                    mmPerUnitY={mmY}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onGeometry={(g) => change({ geometry: g })}
                    onDevices={(d) => change({ devices: d })}
                    onScalePoints={(a, b) => setPendingScale({ a, b })}
                  />
                </CCardBody>
              </CCard>
            </CCol>

            {show3d ? (
              <CCol xs={12} xl={5}>
                <CCard>
                  <CCardHeader className="py-2 small">
                    3D — 끌어서 돌리고, 휠로 확대합니다
                  </CCardHeader>
                  <CCardBody className="p-0">
                    {view.scaled ? (
                      <PlanView3D
                        geometry={geometry}
                        devices={devices}
                        wallHeightMm={wallHeightMm}
                        mmPerUnitX={mmX}
                        mmPerUnitY={mmY}
                        showLabels={showLabels}
                      />
                    ) : (
                      <div className="plan-3d d-flex align-items-center justify-content-center text-body-secondary small">
                        축척을 먼저 잡아 주세요
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>
            ) : null}
          </CRow>

          <CRow className="g-3 mt-1">
            <CCol xs={12} lg={7}>
              <CCard>
                <CCardHeader className="py-2 small d-flex justify-content-between">
                  <span>기기 팔레트</span>
                  <span className="text-body-secondary">고르고 도면을 클릭하면 놓입니다</span>
                </CCardHeader>
                <CCardBody className="d-flex flex-wrap gap-2">
                  {palette.length === 0 ? (
                    <span className="small text-body-secondary">필요사항 시트를 불러오지 못했습니다.</span>
                  ) : (
                    palette.map((p) => {
                      const done = p.placed >= p.need
                      const on = paletteItem === p.item
                      return (
                        <CButton
                          key={p.item}
                          size="sm"
                          color={on ? 'primary' : done ? 'success' : 'secondary'}
                          variant={on ? undefined : 'outline'}
                          onClick={() => { setPaletteItem(p.item); setMode('device') }}
                        >
                          <span
                            className="d-inline-block rounded-circle me-2"
                            style={{ width: 10, height: 10, background: styleOf(p.item).color }}
                          />
                          {p.item}
                          <CBadge color={done ? 'success' : 'danger'} className="ms-2">
                            {p.placed}/{p.need}
                          </CBadge>
                        </CButton>
                      )
                    })
                  )}
                </CCardBody>
              </CCard>
            </CCol>

            <CCol xs={12} lg={5}>
              <CCard>
                <CCardHeader className="py-2 small">고른 것</CCardHeader>
                <CCardBody>
                  {!selectedId ? (
                    <p className="small text-body-secondary mb-0">
                      <b>선택</b> 모드에서 벽·방·기기를 누르면 여기서 고칠 수 있습니다.
                    </p>
                  ) : (
                    <>
                      {selectedRoom ? (
                        <>
                          <label className="form-label small text-body-secondary">방 이름</label>
                          <CFormInput
                            size="sm"
                            value={selectedRoom.name}
                            onChange={(e) =>
                              change({
                                geometry: {
                                  ...geometry,
                                  rooms: geometry.rooms.map((r) =>
                                    r.id === selectedRoom.id ? { ...r, name: e.target.value } : r,
                                  ),
                                },
                              })
                            }
                          />
                          <div className="room-names mt-2">
                            {ROOM_NAMES.map((n) => (
                              <button
                                key={n}
                                type="button"
                                className={
                                  // "침실 2" 처럼 번호가 붙어도 같은 종류로 본다.
                                  'room-name' + (selectedRoom.name.replace(/ \d+$/, '') === n ? ' on' : '')
                                }
                                onClick={() => setRoomName(selectedRoom.id, n)}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {selectedOpening ? (
                        <CRow className="g-2">
                          <CCol xs={6}>
                            <label className="form-label small text-body-secondary">폭(mm)</label>
                            <CFormInput
                              size="sm"
                              type="number"
                              value={selectedOpening.widthMm}
                              onChange={(e) => patchOpening(selectedOpening.id, { widthMm: Number(e.target.value) })}
                            />
                          </CCol>
                          <CCol xs={6}>
                            <label className="form-label small text-body-secondary">높이(mm)</label>
                            <CFormInput
                              size="sm"
                              type="number"
                              value={selectedOpening.heightMm}
                              onChange={(e) => patchOpening(selectedOpening.id, { heightMm: Number(e.target.value) })}
                            />
                          </CCol>
                          <CCol xs={6}>
                            <label className="form-label small text-body-secondary">아랫변 높이(mm)</label>
                            <CFormInput
                              size="sm"
                              type="number"
                              value={selectedOpening.sillMm}
                              onChange={(e) => patchOpening(selectedOpening.id, { sillMm: Number(e.target.value) })}
                            />
                          </CCol>
                        </CRow>
                      ) : null}

                      {selectedDevice ? (
                        <>
                          <div className="small mb-2">{selectedDevice.item}</div>
                          <label className="form-label small text-body-secondary">설치 높이(mm)</label>
                          <CFormInput
                            size="sm"
                            type="number"
                            value={selectedDevice.mountMm}
                            onChange={(e) =>
                              change({
                                devices: devices.map((d) =>
                                  d.id === selectedDevice.id ? { ...d, mountMm: Number(e.target.value) } : d,
                                ),
                              })
                            }
                          />
                          <label className="form-label small text-body-secondary mt-2">메모</label>
                          <CFormInput
                            size="sm"
                            value={selectedDevice.note ?? ''}
                            placeholder="예: 중성선 없음"
                            onChange={(e) =>
                              change({
                                devices: devices.map((d) =>
                                  d.id === selectedDevice.id ? { ...d, note: e.target.value } : d,
                                ),
                              })
                            }
                          />
                        </>
                      ) : null}

                      <CButton size="sm" color="danger" variant="outline" className="mt-3" onClick={removeSelected}>
                        지우기
                      </CButton>
                    </>
                  )}
                </CCardBody>
              </CCard>

              <div className="d-flex gap-2 mt-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="d-none"
                  onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
                />
                <CButton size="sm" color="secondary" variant="outline" onClick={() => fileRef.current?.click()}>
                  도면 추가
                </CButton>
                <CButton size="sm" color="danger" variant="ghost" onClick={() => void removePlan()}>
                  이 도면 지우기
                </CButton>
              </div>
            </CCol>
          </CRow>
        </>
      ) : null}
    </>
  )

  function patchOpening(oid: string, patch: Partial<(typeof geometry.openings)[number]>) {
    change({
      geometry: {
        ...geometry,
        openings: geometry.openings.map((o) => (o.id === oid ? { ...o, ...patch } : o)),
      },
    })
  }
}
