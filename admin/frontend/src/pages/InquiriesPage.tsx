import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { api, errorMessage, stamp } from '../api'
import { STATUS_COLORS, STATUS_LABELS, labelOf } from '../data/labels'
import type { InquiryList } from '../data/types'

/** 상담 신청 목록. 상태로 거르고 이름·연락처로 찾는다. */
export default function InquiriesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [typed, setTyped] = useState('')
  const [data, setData] = useState<InquiryList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setBusy(true)
    const params = new URLSearchParams({ limit: '200' })
    if (status) params.set('status', status)
    if (q) params.set('q', q)
    api<InquiryList>('/api/admin/inquiries?' + params.toString())
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(false))
  }, [status, q])

  useEffect(load, [load])

  return (
    <>
      <h1 className="h4 mb-3">상담 신청</h1>

      <CCard className="mb-3">
        <CCardBody>
          <CRow className="g-2 align-items-end">
            <CCol xs={12} sm={4} lg={3}>
              <label className="form-label small text-body-secondary">상태</label>
              <CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">전체</option>
                {(data?.statuses ?? []).map((s) => (
                  <option key={s} value={s}>
                    {labelOf(STATUS_LABELS, s)} ({data?.counts?.[s] ?? 0})
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={5} lg={5}>
              <label className="form-label small text-body-secondary">검색 (이름·연락처·지역·이메일)</label>
              <CFormInput
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setQ(typed.trim())
                }}
                placeholder="예: 홍길동 / 010 / 성남"
              />
            </CCol>
            <CCol xs={12} sm={3} lg={2}>
              <CButton color="primary" className="w-100" onClick={() => setQ(typed.trim())} disabled={busy}>
                찾기
              </CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color="danger">{error}</CAlert> : null}

      <CCard>
        <CCardHeader>
          전체 {data?.total ?? 0}건
          {busy ? <CSpinner size="sm" className="ms-2" /> : null}
        </CCardHeader>
        <CCardBody className="table-wrap">
          <CTable hover align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>접수</CTableHeaderCell>
                <CTableHeaderCell>이름</CTableHeaderCell>
                <CTableHeaderCell>연락처</CTableHeaderCell>
                <CTableHeaderCell>지역</CTableHeaderCell>
                <CTableHeaderCell>패키지</CTableHeaderCell>
                <CTableHeaderCell>담당 업체</CTableHeaderCell>
                <CTableHeaderCell>상태</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {(data?.items ?? []).length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
                    해당하는 신청이 없습니다.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                (data?.items ?? []).map((row) => (
                  <CTableRow key={row.id} className="row-link" onClick={() => navigate(`/inquiries/${row.id}`)}>
                    <CTableDataCell className="text-nowrap small">{stamp(row.createdAt)}</CTableDataCell>
                    <CTableDataCell className="fw-semibold">{row.name}</CTableDataCell>
                    <CTableDataCell className="text-nowrap">{row.phone}</CTableDataCell>
                    <CTableDataCell>{row.region ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.packageCode ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.partnerName ?? '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={STATUS_COLORS[row.status] ?? 'secondary'}>
                        {labelOf(STATUS_LABELS, row.status)}
                      </CBadge>
                    </CTableDataCell>
                  </CTableRow>
                ))
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}
