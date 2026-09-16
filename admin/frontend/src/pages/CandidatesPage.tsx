import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
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
import {
  ANALYSIS_SOURCES,
  APPLIANCE_KINDS,
  BRANDS,
  ERAS,
  IOT_COLORS,
  IOT_STATUSES,
  labelOf,
} from '../data/labels'
import type { Candidate } from '../data/types'

/**
 * IoT 로 묶을 수 있는 후보군.
 *
 * 신청 건을 가로질러 "어떤 가전이 앱으로 묶이고, 어떤 것은 리모컨 허브가 필요한지" 를 본다.
 * 발주할 허브 수량이 여기서 나온다.
 */
export default function CandidatesPage() {
  const [filter, setFilter] = useState('APP')
  const [rows, setRows] = useState<Candidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setRows(null)
    const params = new URLSearchParams({ limit: '200' })
    if (filter === 'PENDING') params.set('pending', 'true')
    else if (filter) params.set('iotStatus', filter)
    api<Candidate[]>('/api/admin/appliances?' + params.toString())
      .then((d) => {
        setRows(d)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [filter])

  useEffect(load, [load])

  return (
    <>
      <h1 className="h4 mb-3">연동 후보</h1>

      <CCard className="mb-3">
        <CCardBody>
          <CRow className="g-2 align-items-end">
            <CCol xs={12} sm={6} lg={4}>
              <label className="form-label small text-body-secondary">판정</label>
              <CFormSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="APP">제조사 앱 연동</option>
                <option value="IR">리모컨 허브 필요</option>
                <option value="NONE">연동 불가</option>
                <option value="UNKNOWN">미확인</option>
                <option value="PENDING">아직 판별 안 됨</option>
                <option value="">판별 끝난 것 전부</option>
              </CFormSelect>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {!rows ? (
        <CSpinner color="primary" />
      ) : (
        <CCard>
          <CCardHeader>{rows.length}대</CCardHeader>
          <CCardBody className="table-wrap">
            <CTable hover align="middle" className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>신청자</CTableHeaderCell>
                  <CTableHeaderCell>지역</CTableHeaderCell>
                  <CTableHeaderCell>가전</CTableHeaderCell>
                  <CTableHeaderCell>모델명</CTableHeaderCell>
                  <CTableHeaderCell>연식</CTableHeaderCell>
                  <CTableHeaderCell>판정</CTableHeaderCell>
                  <CTableHeaderCell>근거</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
                      해당하는 가전이 없습니다.
                    </CTableDataCell>
                  </CTableRow>
                ) : (
                  rows.map((c) => (
                    <CTableRow key={c.appliance.id}>
                      <CTableDataCell>
                        <Link to={`/inquiries/${c.appliance.inquiryId}`}>{c.inquiryName}</Link>
                      </CTableDataCell>
                      <CTableDataCell>{c.inquiryRegion ?? '-'}</CTableDataCell>
                      <CTableDataCell>
                        {labelOf(APPLIANCE_KINDS, c.appliance.kind)}
                        <span className="text-body-secondary small"> · {labelOf(BRANDS, c.appliance.brand)}</span>
                      </CTableDataCell>
                      <CTableDataCell className="small">
                        {c.appliance.detectedModel || c.appliance.modelName || '-'}
                      </CTableDataCell>
                      <CTableDataCell>{labelOf(ERAS, c.appliance.era)}</CTableDataCell>
                      <CTableDataCell>
                        {c.appliance.iotStatus ? (
                          <CBadge color={IOT_COLORS[c.appliance.iotStatus] ?? 'secondary'}>
                            {labelOf(IOT_STATUSES, c.appliance.iotStatus)}
                          </CBadge>
                        ) : (
                          '-'
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">
                        {c.appliance.analysisSource ? labelOf(ANALYSIS_SOURCES, c.appliance.analysisSource) : '-'}
                        {c.appliance.analyzedAt ? <> · {stamp(c.appliance.analyzedAt)}</> : null}
                      </CTableDataCell>
                    </CTableRow>
                  ))
                )}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      )}
    </>
  )
}
