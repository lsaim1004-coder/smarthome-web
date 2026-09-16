import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormInput,
  CFormLabel,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
} from '@coreui/react'
import { api, errorMessage, isApiError } from '../api'
import { useAuth } from '../auth/AuthContext'

/**
 * 관리자 로그인.
 *
 * 공개 사이트와 같은 방식 — 이메일로 인증번호를 받고 비밀번호를 정한다.
 * 다만 아무나 가입할 수 없다. 운영자 이메일이거나 등록된 업체의 담당자 이메일이어야 한다.
 */

type Mode = 'login' | 'join'
type CodeIssued = { email: string; message: string; devCode: string | null; expiresInMinutes: number }

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'form' | 'verify'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="login-shell">
        <CSpinner color="primary" />
      </div>
    )
  }
  if (user) return <Navigate to="/" replace />

  function switchMode(next: Mode) {
    setMode(next)
    setStage('form')
    setError(null)
    setNotice(null)
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      if (isApiError(err) && err.error === 'EMAIL_NOT_VERIFIED') {
        setMode('join')
        setStage('verify')
        setNotice('이메일 인증이 아직입니다. 받은 인증번호를 입력해 주세요.')
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<CodeIssued>('/api/auth/register', {
        method: 'POST',
        json: { email: email.trim(), password, name: name.trim() || null },
      })
      setStage('verify')
      setNotice(res.devCode ? `${res.message} (개발 모드 인증번호: ${res.devCode})` : res.message)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/api/auth/verify', { method: 'POST', json: { email: email.trim(), code: code.trim() } })
      await login(email.trim(), password)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    setBusy(true)
    setError(null)
    try {
      const res = await api<CodeIssued>('/api/auth/resend', { method: 'POST', json: { email: email.trim() } })
      setNotice(res.devCode ? `${res.message} (개발 모드 인증번호: ${res.devCode})` : res.message)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-shell">
      <CCard className="login-card shadow-sm">
        <CCardHeader>
          <div className="fw-semibold">스마트홈 옵션 관리자</div>
          <div className="small text-body-secondary">iot-admin.kiwan.kr</div>
        </CCardHeader>
        <CCardBody>
          <CNav variant="pills" className="mb-3">
            <CNavItem>
              <CNavLink role="button" active={mode === 'login'} onClick={() => switchMode('login')}>
                로그인
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink role="button" active={mode === 'join'} onClick={() => switchMode('join')}>
                계정 만들기
              </CNavLink>
            </CNavItem>
          </CNav>

          {error ? <CAlert color="danger">{error}</CAlert> : null}
          {notice ? <CAlert color="info">{notice}</CAlert> : null}

          {stage === 'verify' ? (
            <CForm onSubmit={onVerify}>
              <CFormLabel htmlFor="code">인증번호 6자리</CFormLabel>
              <CFormInput
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                required
              />
              <div className="d-flex gap-2 mt-3">
                <CButton type="submit" color="primary" disabled={busy}>
                  {busy ? '확인 중…' : '인증하고 들어가기'}
                </CButton>
                <CButton type="button" color="secondary" variant="outline" disabled={busy} onClick={() => void onResend()}>
                  다시 받기
                </CButton>
              </div>
            </CForm>
          ) : mode === 'login' ? (
            <CForm onSubmit={onLogin}>
              <CFormLabel htmlFor="email">이메일</CFormLabel>
              <CFormInput
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <CFormLabel htmlFor="password" className="mt-3">
                비밀번호
              </CFormLabel>
              <CFormInput
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <CButton type="submit" color="primary" className="mt-3 w-100" disabled={busy}>
                {busy ? '확인 중…' : '로그인'}
              </CButton>
            </CForm>
          ) : (
            <CForm onSubmit={onJoin}>
              <p className="small text-body-secondary">
                운영자 이메일이거나, 등록된 업체의 담당자 이메일만 계정을 만들 수 있습니다.
              </p>
              <CFormLabel htmlFor="join-email">이메일</CFormLabel>
              <CFormInput
                id="join-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <CFormLabel htmlFor="join-name" className="mt-3">
                이름
              </CFormLabel>
              <CFormInput id="join-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
              <CFormLabel htmlFor="join-password" className="mt-3">
                비밀번호 <span className="text-body-secondary small">8자 이상</span>
              </CFormLabel>
              <CFormInput
                id="join-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <CButton type="submit" color="primary" className="mt-3 w-100" disabled={busy}>
                {busy ? '보내는 중…' : '인증번호 받기'}
              </CButton>
            </CForm>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}
