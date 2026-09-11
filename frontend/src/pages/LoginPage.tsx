import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, errorMessage, isApiError } from '../api'
import { useAuth, type MeResponse } from '../auth/AuthContext'

type LoginState = { email?: string; message?: string } | null

export default function LoginPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const initial = (location.state as LoginState) ?? null

  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [info] = useState<string | null>(initial?.message ?? null)
  const [error, setError] = useState<string | null>(null)
  const [needVerify, setNeedVerify] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/me" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNeedVerify(false)
    setBusy(true)
    try {
      const me = await api<MeResponse>('/api/auth/login', { method: 'POST', json: { email: email.trim(), password } })
      setUser(me.user)
      navigate('/me', { replace: true })
    } catch (err) {
      if (isApiError(err) && err.error === 'EMAIL_NOT_VERIFIED') {
        setNeedVerify(true)
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-card">
        <p className="kicker">로그인</p>
        <h1>다시 만나서 반갑습니다</h1>
        <p className="auth-sub">이메일 인증을 마친 계정만 로그인할 수 있습니다.</p>

        {info ? <p className="alert ok">{info}</p> : null}

        <form className="form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <label className="field">
            <span>이메일</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              inputMode="email"
              required
            />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="alert err" role="alert">
              {error}
              {needVerify ? (
                <>
                  {' '}
                  <Link to="/verify" state={{ email: email.trim() }}>
                    인증번호 입력하기
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>

        <p className="auth-links">
          계정이 없으신가요? <Link to="/register">회원가입</Link>
          <span className="sep">·</span>
          <Link to="/verify">이메일 인증</Link>
        </p>
      </div>
    </section>
  )
}
