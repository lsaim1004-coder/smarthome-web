import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import IotArchitecture from '../components/IotArchitecture'
import ServiceFlow from '../components/ServiceFlow'

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
}

export default function WelcomePage() {
  const { user, loading } = useAuth()

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Smart Home Option Service · 시범 운영</p>
        <h1>입주하는 날, 스마트홈이 완성되어 있습니다.</h1>
        <p className="lead">
          인테리어 + 네트워크 + IoT + 자동화를 한 번에. 인테리어 공사 단계에서 스마트홈을 함께 설계하고, 기기 연동부터
          입주 후 세팅 · A/S까지 한 곳에서 책임집니다.
        </p>
        {loading ? null : user ? (
          <p className="hero-actions">
            <span className="hero-greet">{user.name || user.email} 님, 반갑습니다.</span>
            <Link to="/me" className="btn btn-outline">
              내 정보
            </Link>
          </p>
        ) : (
          <p className="hero-actions">
            <Link to="/register" className="btn">
              회원가입
            </Link>
            <Link to="/login" className="btn btn-outline">
              로그인
            </Link>
          </p>
        )}
      </section>

      <IotArchitecture />
      <ServiceFlow />
    </>
  )
}
