import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
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
import { useAuth } from '../auth/AuthContext'
import { STATUS_COLORS, STATUS_LABELS, labelOf } from '../data/labels'
import type { InquiryList } from '../data/types'

/** 첫 화면. 지금 무엇이 밀려 있는지만 보여 준다. */
export default function DashboardPage() {
  const { user, owner } = useAuth()
  const [data, setData] = useState<InquiryList | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<InquiryList>('/api/admin/inquiries?limit=8')
      .then(setData)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <CAlert color="danger">{error}</CAlert>
  if (!data) return <CSpinner color="primary" />

  const counts = data.counts ?? {}

  return (
    <>
      <h1 className="h4 mb-3">
        {user?.name || user?.email} 님, 안녕하세요
        {owner ? null : <span className="ms-2 small text-body-secondary">담당 건만 보입니다</span>}
      </h1>

      <CRow className="g-3 mb-4">
        {['NEW', 'CONTACTED', 'QUOTED', 'WON'].map((s) => (
          <CCol key={s} xs={6} lg={3}>
            <CCard className="h-100">
              <CCardBody>
                <div className="text-body-secondary small">{labelOf(STATUS_LABELS, s)}</div>
                <div className="fs-3 fw-semibold">{counts[s] ?? 0}</div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>최근 상담 신청</span>
          <Link to="/inquiries" className="small">
            전체 보기
          </Link>
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
                <CTableHeaderCell>상태</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {data.items.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={6} className="text-center text-body-secondary py-4">
                    아직 들어온 신청이 없습니다.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                data.items.map((row) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell className="text-nowrap small">{stamp(row.createdAt)}</CTableDataCell>
                    <CTableDataCell>
                      <Link to={`/inquiries/${row.id}`}>{row.name}</Link>
                    </CTableDataCell>
                    <CTableDataCell className="text-nowrap">{row.phone}</CTableDataCell>
                    <CTableDataCell>{row.region ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.packageCode ?? '-'}</CTableDataCell>
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
