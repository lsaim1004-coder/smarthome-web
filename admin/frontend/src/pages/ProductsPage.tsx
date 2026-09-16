import { useCallback, useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
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
import { api, errorMessage } from '../api'
import CopyText from '../components/CopyText'
import { SHOT_KINDS } from '../data/labels'
import type { Catalog, ProductRow } from '../data/types'

/**
 * 표준 스택 제품.
 *
 * 공개 사이트가 "무엇을 쓰는지" 를 보여 줄 때 읽는 목록이다. 단가는 여기에 없다 —
 * 기기값과 서비스비를 나눠 적는 것은 견적서에서 한다.
 */

const EMPTY: ProductRow = {
  id: 0,
  kind: 'station',
  brand: '',
  model: '',
  role: '',
  link: '',
  fromPackage: 'START',
  note: '',
  active: true,
  sortOrder: 0,
}

export default function ProductsPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  async function save() {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      if (isNew) {
        await api('/api/admin/catalog/products', { method: 'POST', json: editing })
      } else {
        await api(`/api/admin/catalog/products/${editing.id}`, { method: 'PUT', json: editing })
      }
      setEditing(null)
      setNotice('저장했습니다.')
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('이 제품을 목록에서 지웁니다.')) return
    try {
      await api(`/api/admin/catalog/products/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!catalog) return error ? <CAlert color="danger">{error}</CAlert> : <CSpinner color="primary" />

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 mb-0">표준 제품</h1>
        <CButton
          color="primary"
          onClick={() => {
            setEditing({ ...EMPTY, sortOrder: (catalog.products.length + 1) * 10 })
            setIsNew(true)
          }}
        >
          제품 추가
        </CButton>
      </div>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {notice ? <CAlert color="success">{notice}</CAlert> : null}

      <CCard>
        <CCardBody className="table-wrap">
          <CTable hover align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>순서</CTableHeaderCell>
                <CTableHeaderCell>브랜드</CTableHeaderCell>
                <CTableHeaderCell>모델</CTableHeaderCell>
                <CTableHeaderCell>역할</CTableHeaderCell>
                <CTableHeaderCell>연결</CTableHeaderCell>
                <CTableHeaderCell>포함 시작</CTableHeaderCell>
                <CTableHeaderCell>노출</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {catalog.products.map((p) => (
                <CTableRow key={p.id}>
                  <CTableDataCell className="text-body-secondary">{p.sortOrder}</CTableDataCell>
                  <CTableDataCell>{p.brand}</CTableDataCell>
                  <CTableDataCell>
                    {p.model}
                    <CopyText value={p.model} label="제품 모델명" />
                    <div className="small text-body-secondary">{p.kind}</div>
                  </CTableDataCell>
                  <CTableDataCell className="small">{p.role}</CTableDataCell>
                  <CTableDataCell className="small">{p.link}</CTableDataCell>
                  <CTableDataCell>{p.fromPackage ?? '-'}</CTableDataCell>
                  <CTableDataCell>
                    {p.active ? <CBadge color="success">노출</CBadge> : <CBadge color="secondary">숨김</CBadge>}
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
                    <CButton size="sm" color="danger" variant="ghost" className="ms-1" onClick={() => void remove(p.id)}>
                      삭제
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={editing !== null} onClose={() => setEditing(null)} size="lg" alignment="center">
        <CModalHeader>
          <CModalTitle>{isNew ? '제품 추가' : '제품 수정'}</CModalTitle>
        </CModalHeader>
        {editing ? (
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">브랜드</label>
                <CFormInput value={editing.brand} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">모델명</label>
                <CFormInput value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">일러스트 종류</label>
                <CFormSelect value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                  {SHOT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </CFormSelect>
                <div className="form-text">공개 사이트의 그림과 짝이 맞아야 합니다.</div>
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">어느 패키지부터</label>
                <CFormSelect
                  value={editing.fromPackage ?? ''}
                  onChange={(e) => setEditing({ ...editing, fromPackage: e.target.value })}
                >
                  <option value="">-</option>
                  {catalog.packages.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">집에서 하는 일</label>
                <CFormInput
                  value={editing.role ?? ''}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">연결 규격</label>
                <CFormInput
                  value={editing.link ?? ''}
                  onChange={(e) => setEditing({ ...editing, link: e.target.value })}
                />
              </CCol>
              <CCol xs={12}>
                <label className="form-label small text-body-secondary">설명</label>
                <CFormTextarea
                  rows={3}
                  value={editing.note ?? ''}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">노출 순서</label>
                <CFormInput
                  type="number"
                  value={editing.sortOrder}
                  onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
                />
              </CCol>
              <CCol xs={12} sm={6} className="d-flex align-items-end">
                <CFormCheck
                  id="product-active"
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
          <CButton color="primary" onClick={() => void save()} disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}
