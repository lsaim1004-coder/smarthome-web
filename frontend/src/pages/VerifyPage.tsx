import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage, isApiError } from '../api'

type CodeIssued = { email: string; message: string; devCode: string | null; expiresInMinutes: number }
type VerifyState = { email?: string; devCode?: string | null; message?: string; expiresInMinutes?: number } | null

export default function VerifyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initial = (location.state as VerifyState) ?? null

  const [email, setEmail] = useState(initial?.email ?? params.get('email') ?? '')
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<string | null>(initial?.message ?? null)
  const [devCode, setDevCode] = useState<string | null>(initial?.devCode ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(initial?.devCode !== undefined || initial?.message ? 60 : 0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  async function onVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(code)) {
      setError('인증번호 6자리를 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      await api('/api/auth/verify', { method: 'POST', json: { email: email.trim(), code } })
      navigate('/login', { state: { email: email.trim(), message: '이메일 인증이 완료되었습니다. 로그인해 주세요.' } })
    } catch (err) {
      setError(errorMessage(err))
      if (isApiError(err) && (err.error === 'CODE_EXPIRED' || err.error === 'TOO_MANY_ATTEMPTS')) {
        setCode('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    setError(null)
    if (!email.trim()) {
      setError('이메일을 입력해 주세요.')
      return
    }
    setBusy(true)
    try {
      const issued = await api<CodeIssued>('/api/auth/resend', { method: 'POST', json: { email: email.trim() } })
      setInfo(issued.message)
      setDevCode(issued.devCode)
      setCode('')
      setCooldown(60)
    } catch (err) {
      setError(errorMessage(err))
      if (isApiError(err) && err.error === 'RESEND_COOLDOWN') {
        const m = /(\d+)초/.exec(err.message)
        if (m) setCooldown(Number(m[1]))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-card">
        <p className="kicker">이메일 인증</p>
        <h1>인증번호 입력</h1>
        <p className="auth-sub">이메일로 보낸 숫자 6자리를 입력해 주세요. 인증번호는 {initial?.expiresInMinutes ?? 10}분 동안 유효합니다.</p>

        {info ? <p className="alert info">{info}</p> : null}
        {devCode ? (
          <p className="alert dev">
            개발 모드: 메일 서버가 설정되지 않아 인증번호를 여기 표시합니다. <b>{devCode}</b>
          </p>
        ) : null}

        <form className="form" onSubmit={(e) => void onVerify(e)} noValidate>
          <label className="field">
            <span>이메일</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <label className="field">
            <span>인증번호</span>
            <input
              type="text"
              name="code"
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              pattern="\d{6}"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              required
            />
          </label>

          {error ? (
            <p className="alert err" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? '확인 중…' : '인증하기'}
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={() => void onResend()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `인증번호 다시 받기 (${cooldown}초)` : '인증번호 다시 받기'}
          </button>
        </form>

        <p className="auth-links">
          <Link to="/login">로그인으로</Link>
          <span className="sep">·</span>
          <Link to="/register">회원가입</Link>
        </p>
      </div>
    </section>
  )
}
