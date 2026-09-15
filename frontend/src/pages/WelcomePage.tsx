import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import IotArchitecture from '../components/IotArchitecture'
import ServiceFlow from '../components/ServiceFlow'
import { PACKAGES, priceLabel } from '../data/packages'

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
}

function PackageTeaser() {
  return (
    <section className="teaser">
      <div className="teaser-head">
        <h2>패키지 5단계</h2>
        <Link to="/packages" className="teaser-more">
          구성 자세히 보기
        </Link>
      </div>
      <ul className="teaser-list">
        {PACKAGES.map((p) => (
          <li key={p.code} className={p.featured ? 'on' : undefined}>
            <b>{p.name}</b>
            <span>{p.tagline}</span>
            <em>{priceLabel(p.price)}</em>
          </li>
        ))}
      </ul>
      <p className="teaser-note">기기값과 설계 · 설치 · 자동화 · 교육을 포함한 가격입니다(부가세 포함).</p>
    </section>
  )
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
        <p className="hero-actions">
          {loading ? null : user ? (
            <span className="hero-greet">{user.name || user.email} 님, 반갑습니다.</span>
          ) : null}
          <Link to="/contact" className="btn">
            상담 신청
          </Link>
          <Link to="/packages" className="btn btn-outline">
            패키지 보기
          </Link>
        </p>
      </section>

      <PackageTeaser />
      <IotArchitecture />
      <ServiceFlow />
    </>
  )
}
