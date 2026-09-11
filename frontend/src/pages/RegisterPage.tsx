import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, errorMessage, isApiError } from '../api'
import { useAuth } from '../auth/AuthContext'

type CodeIssued = { email: string; message: string; devCode: string | null; expiresInMinutes: number }

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/me" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.')
      return
    }
    setBusy(true)
    try {
      const issued = await api<CodeIssued>('/api/auth/register', {
        method: 'POST',
        json: { email: email.trim(), password, name: name.trim() || null },
      })
      navigate('/verify', {
        state: { email: issued.email, devCode: issued.devCode, message: issued.message, expiresInMinutes: issued.expiresInMinutes },
      })
    } catch (err) {
      if (isApiError(err) && err.error === 'EMAIL_TAKEN') {
        setError('이미 가입된 이메일입니다. 로그인해 주세요.')
      } else {
        setError(errorMessage(err))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-card">
        <p className="kicker">회원가입</p>
        <h1>이메일로 가입하기</h1>
        <p className="auth-sub">가입 후 이메일로 받은 인증번호를 입력해야 로그인할 수 있습니다.</p>

        <form className="form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <label className="field">
            <span>이메일</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              required
            />
          </label>
          <label className="field">
            <span>
              이름 <small>(선택)</small>
            </span>
            <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="name" />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </label>
          <label className="field">
            <span>비밀번호 확인</span>
            <input
              type="password"
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          {error ? (
            <p className="alert err" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-block" disabled={busy}>
            {busy ? '처리 중…' : '가입하고 인증번호 받기'}
          </button>
        </form>

        <p className="auth-links">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          <span className="sep">·</span>
          인증번호만 입력하려면 <Link to="/verify">이메일 인증</Link>
        </p>
      </div>
    </section>
  )
}
