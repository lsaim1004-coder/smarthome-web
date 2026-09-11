import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatTime } from './WelcomePage'

export default function MePage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <section className="auth">
        <div className="auth-card">
          <p className="auth-sub">로그인 상태를 확인하는 중입니다…</p>
        </div>
      </section>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  async function onLogout() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <section className="auth">
      <div className="auth-card">
        <p className="kicker">내 정보</p>
        <h1>{user.name || user.email} 님</h1>
        <p className="auth-sub">이메일 인증을 마친 계정으로 로그인되어 있습니다.</p>

        <dl className="info-list">
          <div>
            <dt>이메일</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>이름</dt>
            <dd>{user.name || '-'}</dd>
          </div>
          <div>
            <dt>이메일 인증</dt>
            <dd>{user.emailVerifiedAt ? `완료 · ${formatTime(user.emailVerifiedAt)}` : '미완료'}</dd>
          </div>
          <div>
            <dt>가입일</dt>
            <dd>{user.createdAt ? formatTime(user.createdAt) : '-'}</dd>
          </div>
          <div>
            <dt>최근 로그인</dt>
            <dd>{user.lastLoginAt ? formatTime(user.lastLoginAt) : '-'}</dd>
          </div>
        </dl>

        <div className="form">
          <Link to="/" className="btn btn-outline btn-block">
            웰컴 페이지로
          </Link>
          <button type="button" className="btn btn-block" onClick={() => void onLogout()}>
            로그아웃
          </button>
        </div>
      </div>
    </section>
  )
}
