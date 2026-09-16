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
import type { Partner } from '../data/types'

/**
 * 시공·상담을 맡는 업체.
 *
 * 여기에 담당자 이메일을 적어 두는 것이 곧 초대다 — 그 주소로만 관리자 계정을 만들 수 있다.
 * 업체 계정으로 로그인하면 자기 업체가 담당인 신청만 보인다.
 */

const EMPTY: Partner = {
  id: 0,
  code: '',
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  region: '',
  memo: '',
  active: true,
  inquiryCount: 0,
  accountJoined: false,
  createdAt: '',
}

export default function PartnersPage() {
  const [rows, setRows] = useState<Partner[] | null>(null)
  const [editing, setEditing] = useState<Partner | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api<Partner[]>('/api/admin/partners')
      .then((d) => {
        setRows(d)
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
        await api('/api/admin/partners', { method: 'POST', json: editing })
      } else {
        await api(`/api/admin/partners/${editing.id}`, { method: 'PUT', json: editing })
      }
      setEditing(null)
      setNotice('저장했습니다. 담당자는 적어 주신 이메일로 계정을 만들 수 있습니다.')
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (!rows) return error ? <CAlert color="danger">{error}</CAlert> : <CSpinner color="primary" />

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 mb-0">업체</h1>
        <CButton
          color="primary"
          onClick={() => {
            setEditing({ ...EMPTY })
            setIsNew(true)
          }}
        >
          업체 등록
        </CButton>
      </div>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {notice ? <CAlert color="success">{notice}</CAlert> : null}

      <CCard>
        <CCardBody className="table-wrap">
          <CTable hover align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>코드</CTableHeaderCell>
                <CTableHeaderCell>업체명</CTableHeaderCell>
                <CTableHeaderCell>담당자</CTableHeaderCell>
                <CTableHeaderCell>담당 지역</CTableHeaderCell>
                <CTableHeaderCell>담당 건</CTableHeaderCell>
                <CTableHeaderCell>계정</CTableHeaderCell>
                <CTableHeaderCell>상태</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                    등록된 업체가 없습니다.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                rows.map((p) => (
                  <CTableRow key={p.id}>
                    <CTableDataCell className="fw-semibold">{p.code}</CTableDataCell>
                    <CTableDataCell>{p.name}</CTableDataCell>
                    <CTableDataCell className="small">
                      {p.contactName ?? '-'}
                      <div className="text-body-secondary">{p.contactEmail ?? '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{p.region ?? '-'}</CTableDataCell>
                    <CTableDataCell>{p.inquiryCount}</CTableDataCell>
                    <CTableDataCell>
                      {p.accountJoined ? (
                        <CBadge color="success">가입함</CBadge>
                      ) : (
                        <CBadge color="light" textColor="dark">
                          대기
                        </CBadge>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      {p.active ? <CBadge color="primary">거래중</CBadge> : <CBadge color="secondary">중지</CBadge>}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
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
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CModal visible={editing !== null} onClose={() => setEditing(null)} alignment="center" size="lg">
        <CModalHeader>
          <CModalTitle>{isNew ? '업체 등록' : '업체 수정'}</CModalTitle>
        </CModalHeader>
        {editing ? (
          <CModalBody>
            <CRow className="g-3">
              <CCol xs={12} sm={4}>
                <label className="form-label small text-body-secondary">업체 코드</label>
                <CFormInput
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                />
                <div className="form-text">영문 대문자·숫자·밑줄</div>
              </CCol>
              <CCol xs={12} sm={8}>
                <label className="form-label small text-body-secondary">업체명</label>
                <CFormInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">담당자 이름</label>
                <CFormInput
                  value={editing.contactName ?? ''}
                  onChange={(e) => setEditing({ ...editing, contactName: e.target.value })}
                />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">담당자 이메일</label>
                <CFormInput
                  type="email"
                  value={editing.contactEmail ?? ''}
                  onChange={(e) => setEditing({ ...editing, contactEmail: e.target.value })}
                />
                <div className="form-text">이 주소로만 관리자 계정을 만들 수 있습니다.</div>
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">연락처</label>
                <CFormInput
                  value={editing.contactPhone ?? ''}
                  onChange={(e) => setEditing({ ...editing, contactPhone: e.target.value })}
                />
              </CCol>
              <CCol xs={12} sm={6}>
                <label className="form-label small text-body-secondary">담당 지역</label>
                <CFormInput
                  value={editing.region ?? ''}
                  onChange={(e) => setEditing({ ...editing, region: e.target.value })}
                />
              </CCol>
              <CCol xs={12}>
                <label className="form-label small text-body-secondary">메모</label>
                <CFormTextarea
                  rows={3}
                  value={editing.memo ?? ''}
                  onChange={(e) => setEditing({ ...editing, memo: e.target.value })}
                />
              </CCol>
              <CCol xs={12}>
                <CFormCheck
                  id="partner-active"
                  label="거래중 (끄면 담당자가 로그인할 수 없습니다)"
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
