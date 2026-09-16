import { useCallback, useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
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
import type { Account, AuditRow } from '../data/types'

const ROLE_LABELS: Record<string, string> = {
  OWNER: '운영자',
  PARTNER: '업체',
  USER: '일반',
}

const ACTION_LABELS: Record<string, string> = {
  INQUIRY_UPDATE: '신청 수정',
  INQUIRY_DELETE: '신청 삭제',
  APPLIANCE_ANALYZE: '가전 판별 수정',
  PHOTO_PURGE: '사진 폐기',
  PACKAGE_CREATE: '패키지 추가',
  PACKAGE_UPDATE: '패키지 수정',
  PACKAGE_DELETE: '패키지 삭제',
  COMPARISON_CREATE: '비교표 추가',
  COMPARISON_UPDATE: '비교표 수정',
  COMPARISON_DELETE: '비교표 삭제',
  PRODUCT_CREATE: '제품 추가',
  PRODUCT_UPDATE: '제품 수정',
  PRODUCT_DELETE: '제품 삭제',
  PARTNER_CREATE: '업체 등록',
  PARTNER_UPDATE: '업체 수정',
  ACCOUNT_ENABLE: '계정 사용',
  ACCOUNT_DISABLE: '계정 중지',
}

/** 관리자 계정과 최근 변경 기록. */
export default function AccountsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api<Account[]>('/api/admin/accounts')
      .then((d) => {
        setAccounts(d)
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
    api<AuditRow[]>('/api/admin/audit?limit=80').then(setAudit).catch(() => setAudit([]))
  }, [])

  useEffect(load, [load])

  async function toggle(id: number, value: boolean) {
    try {
      await api(`/api/admin/accounts/${id}/active?value=${value}`, { method: 'PUT' })
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (!accounts) return error ? <CAlert color="danger">{error}</CAlert> : <CSpinner color="primary" />

  return (
    <>
      <h1 className="h4 mb-3">계정·기록</h1>
      {error ? <CAlert color="danger">{error}</CAlert> : null}

      <CCard className="mb-4">
        <CCardHeader>관리자 계정 {accounts.length}개</CCardHeader>
        <CCardBody className="table-wrap">
          <CTable hover align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>이메일</CTableHeaderCell>
                <CTableHeaderCell>이름</CTableHeaderCell>
                <CTableHeaderCell>역할</CTableHeaderCell>
                <CTableHeaderCell>마지막 로그인</CTableHeaderCell>
                <CTableHeaderCell>상태</CTableHeaderCell>
                <CTableHeaderCell />
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {accounts.map((a) => (
                <CTableRow key={a.id}>
                  <CTableDataCell>{a.email}</CTableDataCell>
                  <CTableDataCell>{a.name ?? '-'}</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={a.role === 'OWNER' ? 'dark' : 'info'}>{ROLE_LABELS[a.role] ?? a.role}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="small">{stamp(a.lastLoginAt)}</CTableDataCell>
                  <CTableDataCell>
                    {a.active ? <CBadge color="success">사용</CBadge> : <CBadge color="secondary">중지</CBadge>}
                  </CTableDataCell>
                  <CTableDataCell className="text-end">
                    {user?.id === a.id ? (
                      <span className="small text-body-secondary">내 계정</span>
                    ) : (
                      <CButton
                        size="sm"
                        color={a.active ? 'danger' : 'success'}
                        variant="outline"
                        onClick={() => void toggle(a.id, !a.active)}
                      >
                        {a.active ? '중지' : '사용'}
                      </CButton>
                    )}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader>최근 변경 기록</CCardHeader>
        <CCardBody className="table-wrap">
          <CTable small align="middle" className="mb-0">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>시각</CTableHeaderCell>
                <CTableHeaderCell>누가</CTableHeaderCell>
                <CTableHeaderCell>무엇을</CTableHeaderCell>
                <CTableHeaderCell>대상</CTableHeaderCell>
                <CTableHeaderCell>내용</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {audit.length === 0 ? (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center text-body-secondary py-4">
                    아직 기록이 없습니다.
                  </CTableDataCell>
                </CTableRow>
              ) : (
                audit.map((row) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell className="text-nowrap small">{stamp(row.createdAt)}</CTableDataCell>
                    <CTableDataCell className="small">{row.actor}</CTableDataCell>
                    <CTableDataCell className="small">{ACTION_LABELS[row.action] ?? row.action}</CTableDataCell>
                    <CTableDataCell className="small">{row.target ?? '-'}</CTableDataCell>
                    <CTableDataCell className="small text-body-secondary">{row.detail ?? '-'}</CTableDataCell>
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
