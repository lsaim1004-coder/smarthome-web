import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
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
import { api, errorMessage, won } from '../api'
import CopyText from './CopyText'
import type { RequirementSheet as Sheet } from '../data/types'

/**
 * 상담 준비 시트.
 *
 * 신청서에 모인 것과 가전 자동판별 결과를 "무엇이 얼마나 필요한가 / 무엇을 더 물어봐야 하는가"로
 * 바꿔 한 장에 담는다. 전화를 걸기 전에 여기만 보면 되게 하는 것이 목적이라,
 * 수량마다 근거를 같이 적는다 — 견적의 출발점이 되는 자리이기 때문이다.
 */

const VERDICT: Record<string, { color: string; label: string }> = {
  MATCH: { color: 'success', label: '패키지 적합' },
  ROOM: { color: 'info', label: '여유 있음' },
  SHORT: { color: 'danger', label: '패키지 부족' },
  MISSING: { color: 'warning', label: '패키지 미선택' },
}

export default function RequirementSheetCard({ inquiryId }: { inquiryId: number | string }) {
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<Sheet>(`/api/admin/inquiries/${inquiryId}/requirements`)
      .then((d) => {
        if (alive) setSheet(d)
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e))
      })
    return () => {
      alive = false
    }
  }, [inquiryId])

  if (error) return <CAlert color="danger">필요사항 정리를 불러오지 못했습니다 — {error}</CAlert>
  if (!sheet) {
    return (
      <CCard className="mb-3">
        <CCardBody className="text-center py-4">
          <CSpinner size="sm" /> <span className="ms-2 text-body-secondary">정리하는 중…</span>
        </CCardBody>
      </CCard>
    )
  }

  const v = VERDICT[sheet.fit.verdict] ?? { color: 'secondary', label: sheet.fit.verdict }

  return (
    <CCard className="mb-3 border-primary-subtle">
      <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span className="fw-semibold">필요사항 정리</span>
        <span className="d-flex align-items-center gap-2">
          <CBadge color={v.color}>{v.label}</CBadge>
          {/* 전화 상담 전에 그대로 읽을 수 있게 전문을 복사한다 */}
          <CopyText value={sheet.plainText} label="상담 준비 전문" className="fs-6" />
        </span>
      </CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small mb-3">{sheet.headline}</p>

        <CRow className="g-3 mb-3">
          <CCol xs={12} md={6}>
            <div className="border rounded p-3 h-100">
              <div className="small text-body-secondary">예상 금액 · {sheet.money.packageCode}</div>
              <div className="fs-4 fw-semibold">{won(sheet.money.total)}</div>
              <div className="small text-body-secondary">
                서비스 {won(sheet.money.price)} + 시공 {won(sheet.money.installFee)}
              </div>
              <div className="small mt-2">{sheet.money.note}</div>
            </div>
          </CCol>
          <CCol xs={12} md={6}>
            <div className="border rounded p-3 h-100">
              <div className="small text-body-secondary">보유 가전 {sheet.appliances.total}대</div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                <CBadge color="success">앱 연동 {sheet.appliances.app}</CBadge>
                <CBadge color="warning">리모컨 허브 {sheet.appliances.ir}</CBadge>
                <CBadge color="secondary">불가 {sheet.appliances.none}</CBadge>
                <CBadge color="light" textColor="dark">
                  미확인 {sheet.appliances.unknown}
                </CBadge>
              </div>
              <div className="small mt-2">{sheet.fit.note}</div>
            </div>
          </CCol>
        </CRow>

        {sheet.questions.length > 0 ? (
          <CAlert color="warning" className="py-2">
            <div className="fw-semibold mb-1">확인할 것 {sheet.questions.length}가지</div>
            <ul className="mb-0 ps-3 small">
              {sheet.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </CAlert>
        ) : null}

        <CRow className="g-3">
          <CCol xs={12} lg={7}>
            <div className="fw-semibold small mb-2">필요한 기기</div>
            <div className="table-wrap">
              <CTable small align="middle" className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>품목</CTableHeaderCell>
                    <CTableHeaderCell className="text-end">수량</CTableHeaderCell>
                    <CTableHeaderCell>근거</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {sheet.devices.map((d) => (
                    <CTableRow key={d.item}>
                      <CTableDataCell className="text-nowrap">{d.item}</CTableDataCell>
                      <CTableDataCell className="text-end text-nowrap fw-semibold">
                        {d.count}
                        {d.unit}
                      </CTableDataCell>
                      <CTableDataCell className="small text-body-secondary">{d.why}</CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>
            </div>
          </CCol>
          <CCol xs={12} lg={5}>
            <div className="fw-semibold small mb-2">작업</div>
            <ul className="small ps-3">
              {sheet.works.map((w) => (
                <li key={w.item}>
                  {w.item}
                  <span className="text-body-secondary"> — {w.why}</span>
                </li>
              ))}
            </ul>
          </CCol>
        </CRow>

        {sheet.cautions.length > 0 ? (
          <>
            <div className="fw-semibold small mt-3 mb-2">미리 알릴 것</div>
            <ul className="small ps-3 mb-0 text-body-secondary">
              {sheet.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        ) : null}
      </CCardBody>
    </CCard>
  )
}
