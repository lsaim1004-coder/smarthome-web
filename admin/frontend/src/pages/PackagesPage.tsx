import { useCallback, useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { api, errorMessage, won } from '../api'
import type { Catalog, ComparisonRow, PackageRow } from '../data/types'

/**
 * 패키지 구성 편집.
 *
 * 값은 DB 에 있고 공개 사이트가 읽어 간다. 여기서 고치면 배포 없이 바로 바뀐다.
 * 목록형 항목(기기·커미셔닝·장면)은 순서가 곧 뜻이라 줄 단위로 적는다.
 */

const EMPTY: PackageRow = {
  code: '',
  name: '',
  tagline: '',
  price: 0,
  installFee: 0,
  featured: false,
  active: true,
  sortOrder: 0,
  summary: '',
  hours: '',
  devices: [],
  commissioning: [],
  scenes: [],
  updatedAt: null,
  updatedBy: null,
}

const lines = (list: string[]) => list.join('\n')
const parse = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean)

export default function PackagesPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<PackageRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<Catalog>('/api/admin/catalog')
      .then((c) => {
        setCatalog(c)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load])

  async function savePackage() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      const body = { ...editing }
      if (isNew) {
        await api('/api/admin/catalog/packages', { method: 'POST', json: body })
      } else {
        await api(`/api/admin/catalog/packages/${editing.code}`, { method: 'PUT', json: body })
      }
      setEditing(null)
      setNotice('저장했습니다. 공개 사이트에 바로 반영됩니다.')
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function removePackage(code: string) {
    if (!confirm(`${code} 패키지를 지웁니다. 지난 접수 건이 이 코드를 가리키고 있을 수 있습니다.`)) return
    try {
      await api(`/api/admin/catalog/packages/${code}`, { method: 'DELETE' })
      setNotice(`${code} 를 지웠습니다.`)
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!catalog) return error ? <CAlert color="danger">{error}</CAlert> : <CSpinner color="primary" />

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 mb-0">패키지 구성</h1>
        <CButton
          color="primary"
          onClick={() => {
            setEditing({ ...EMPTY, sortOrder: (catalog.packages.length + 1) * 10 })
            setIsNew(true)
          }}
        >
          패키지 추가
        </CButton>
      </div>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {notice ? <CAlert color="success">{notice}</CAlert> : null}

      <CCard className="mb-4">
        <CCardBody className="table-wrap">
          <CTable hover align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>순서</CTableHeaderCell>
                <CTableHeaderCell>코드</CTableHeaderCell>
                <CTableHeaderCell>이름</CTableHeaderCell>
                <CTableHeaderCell>서비스비</CTableHeaderCell>
                <CTableHeaderCell>시공비</CTableHeaderCell>
                <CTableHeaderCell>구성</CTableHeaderCell>
                <CTableHeaderCell>노출</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {catalog.packages.map((p) => (
                <CTableRow key={p.code}>
                  <CTableDataCell className="text-body-secondary">{p.sortOrder}</CTableDataCell>
                  <CTableDataCell>
                    <span className="fw-semibold">{p.code}</span>
                    {p.featured ? (
                      <CBadge color="warning" className="ms-2">
                        추천
                      </CBadge>
                    ) : null}
                  </CTableDataCell>
                  <CTableDataCell>
                    {p.name}
                    <div className="small text-body-secondary">{p.tagline}</div>
                  </CTableDataCell>
                  <CTableDataCell className="text-nowrap">{won(p.price)}</CTableDataCell>
                  <CTableDataCell className="text-nowrap">{won(p.installFee)}</CTableDataCell>
                  <CTableDataCell className="small text-body-secondary">
                    기기 {p.devices.length} · 커미셔닝 {p.commissioning.length} · 장면 {p.scenes.length}
                  </CTableDataCell>
                  <CTableDataCell>
                    {p.active ? (
                      <CBadge color="success">노출</CBadge>
                    ) : (
                      <CBadge color="secondary">숨김</CBadge>
                    )}
                  </CTableDataCell>
                  <CTableDataCell className="text-end text-nowrap">
                    <CButton
                      size="sm"
                      color="primary"
                      variant="outline"
                      onClick={() => {
                        setEditing({ ...p })
                        setIsNew(false)
                      }}
                    >
                      수정
                    </CButton>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="ghost"
                      className="ms-1"
                      onClick={() => void removePackage(p.code)}
                    >
                      삭제
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <ComparisonEditor rows={catalog.comparison} packages={catalog.packages} onChanged={load} />

      <CModal visible={editing !== null} onClose={() => setEditing(null)} size="lg" alignment="center" scrollable>
        <CModalHeader>
          <CModalTitle>{isNew ? '패키지 추가' : `${editing?.code} 수정`}</CModalTitle>
        </CModalHeader>
        {editing ? (
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">코드</label>
                <CFormInput
                  value={editing.code}
                  disabled={!isNew}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                />
                {isNew ? <div className="form-text">영문 대문자·숫자·밑줄</div> : null}
              </CCol>
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">이름</label>
                <CFormInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </CCol>
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">노출 순서</label>
                <CFormInput
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                />
              </CCol>
              <CCol xs={12}>
                <label className="form-label small text-body-secondary">한 줄 소개</label>
                <CFormInput
                  value={editing.tagline ?? ''}
                  onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                />
              </CCol>
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">서비스비 (원)</label>
                <CFormInput
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">시공비 (원)</label>
                <CFormInput
                  type="number"
                  value={editing.installFee}
                  onChange={(e) => setEditing({ ...editing, installFee: Number(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">작업 시간 표기</label>
                <CFormInput
                  value={editing.hours ?? ''}
                  onChange={(e) => setEditing({ ...editing, hours: e.target.value })}
                />
              </CCol>
              <CCol xs={12}>
                <label className="form-label small text-body-secondary">설명</label>
                <CFormTextarea
                  rows={2}
                  value={editing.summary ?? ''}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                />
              </CCol>
              <CCol xs={12} className="line-editor">
                <label className="form-label small text-body-secondary">들어가는 기기 (한 줄에 하나)</label>
                <CFormTextarea
                  value={lines(editing.devices)}
                  onChange={(e) => setEditing({ ...editing, devices: parse(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} md={6} className="line-editor">
                <label className="form-label small text-body-secondary">커미셔닝 (한 줄에 하나)</label>
                <CFormTextarea
                  value={lines(editing.commissioning)}
                  onChange={(e) => setEditing({ ...editing, commissioning: parse(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} md={6} className="line-editor">
                <label className="form-label small text-body-secondary">기본 장면 (한 줄에 하나)</label>
                <CFormTextarea
                  value={lines(editing.scenes)}
                  onChange={(e) => setEditing({ ...editing, scenes: parse(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} className="d-flex gap-4">
                <CFormCheck
                  id="pkg-featured"
                  label="추천 표시"
                  checked={editing.featured}
                  onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                />
                <CFormCheck
                  id="pkg-active"
                  label="공개 사이트에 노출"
                  checked={editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
              </CCol>
            </CRow>
          </CModalBody>
        ) : null}
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setEditing(null)}>
            취소
          </CButton>
          <CButton color="primary" onClick={() => void savePackage()} disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

/** 비교표의 한 칸을 글자로. 0 은 미포함이라 빈 칸으로 보인다. */
function cellText(value: number | string | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') return value === 0 ? '' : String(value)
  return value
}

/** 비교표. 열은 패키지 순서를 따르고, 칸은 개수·짧은 글자·체크(✓) 가 섞인다. */
function ComparisonEditor({
  rows,
  packages,
  onChanged,
}: {
  rows: ComparisonRow[]
  packages: PackageRow[]
  onChanged: () => void
}) {
  const [error, setError] = useState<string | null>(null)

  async function save(row: ComparisonRow) {
    try {
      await api(`/api/admin/catalog/comparison/${row.id}`, { method: 'PUT', json: row })
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function add() {
    try {
      await api('/api/admin/catalog/comparison', {
        method: 'POST',
        json: {
          label: '새 항목',
          values: packages.map(() => 0),
          sortOrder: (rows.length + 1) * 10,
          active: true,
        },
      })
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function remove(id: number) {
    if (!confirm('이 비교표 항목을 지웁니다.')) return
    try {
      await api(`/api/admin/catalog/comparison/${id}`, { method: 'DELETE' })
      onChanged()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span>패키지 비교표</span>
        <CButton size="sm" color="primary" variant="outline" onClick={() => void add()}>
          항목 추가
        </CButton>
      </CCardHeader>
      <CCardBody className="table-wrap">
        {error ? <CAlert color="danger">{error}</CAlert> : null}
        <CTable align="middle" className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell style={{ minWidth: '14rem' }}>항목</CTableHeaderCell>
              {packages.map((p) => (
                <CTableHeaderCell key={p.code} className="text-center">
                  {p.code}
                </CTableHeaderCell>
              ))}
              <CTableHeaderCell />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {rows.map((row) => (
              <CTableRow key={row.id}>
                <CTableDataCell>
                  {/* 타자마다 저장하면 시끄럽다. 칸을 벗어날 때 한 번 보낸다. */}
                  <CFormInput
                    size="sm"
                    key={row.label}
                    defaultValue={row.label}
                    onBlur={(e) => {
                      if (e.target.value !== row.label) void save({ ...row, label: e.target.value })
                    }}
                  />
                </CTableDataCell>
                {packages.map((p, i) => (
                  <CTableDataCell key={p.code} className="text-center">
                    {/* 칸에는 개수(3)도 글자("도어락·에어컨")도 ✓ 도 들어간다. 비우면 미포함. */}
                    <CFormInput
                      size="sm"
                      className="text-center"
                      key={String(row.values[i] ?? '')}
                      defaultValue={cellText(row.values[i])}
                      onBlur={(e) => {
                        const typed = e.target.value.trim()
                        const next: (number | string)[] = [...row.values]
                        while (next.length < packages.length) next.push(0)
                        next[i] = typed === '' ? 0 : /^[0-9]+$/.test(typed) ? Number(typed) : typed
                        if (String(next[i]) !== String(row.values[i] ?? 0)) void save({ ...row, values: next })
                      }}
                    />
                  </CTableDataCell>
                ))}
                <CTableDataCell className="text-end">
                  <CButton size="sm" color="danger" variant="ghost" onClick={() => void remove(row.id)}>
                    삭제
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCardBody>
    </CCard>
  )
}
