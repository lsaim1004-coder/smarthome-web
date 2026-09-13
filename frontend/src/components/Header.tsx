import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 15.5 16 5l12 10.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 13.5V27h17V13.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M11.5 20a6.4 6.4 0 0 1 9 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.8 22.6a3.2 3.2 0 0 1 4.4 0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="25.2" r="1.4" fill="currentColor" />
    </svg>
  )
}

export default function Header() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="top">
      <Link to="/" className="brand">
        <Logo />
        <span>
          Smart Home <b>Option</b>
        </span>
      </Link>
      <nav className="top-nav" aria-label="메뉴">
        <NavLink to="/packages" className="nav-link">
          패키지
        </NavLink>
        <a href="/docs/" className="nav-link nav-docs">
          자료
        </a>
        {user?.admin ? (
          <NavLink to="/admin/inquiries" className="nav-link nav-admin">
            신청관리
          </NavLink>
        ) : null}
        {loading ? null : user ? (
          <>
            <NavLink to="/me" className="nav-link nav-user" title={user.email}>
              {user.name || user.email}
            </NavLink>
            <button type="button" className="nav-btn ghost" onClick={() => void onLogout()}>
              로그아웃
            </button>
          </>
        ) : (
          <NavLink to="/login" className="nav-link">
            로그인
          </NavLink>
        )}
        <NavLink to="/contact" className="nav-btn">
          상담 신청
        </NavLink>
      </nav>
    </header>
  )
}
