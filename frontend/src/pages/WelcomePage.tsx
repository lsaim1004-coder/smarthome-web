import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import ProductShot from '../components/ProductShot'
import IotArchitecture from '../components/IotArchitecture'
import ServiceFlow from '../components/ServiceFlow'
import { PACKAGES, priceLabel } from '../data/packages'
import { PRODUCTS } from '../data/products'

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
}

/** 실적 숫자가 아직 없으므로 서비스를 정의하는 숫자만 쓴다. 없는 실적을 지어내지 않는다. */
const FACTS = [
  { label: '한 화면에 묶는 브랜드', value: '5+', note: '삼성 · LG · 샤오미 · Aqara · SwitchBot' },
  { label: '표준으로 짜 드리는 생활 장면', value: '8종', note: '외출 · 귀가 · 취침 · 청소 · 아침 · 보안 · 커튼 · 음성' },
  { label: '표준 구성 커미셔닝', value: '7h', note: '설계 협의부터 사용 교육까지' },
]

function Hero() {
  const { user, loading } = useAuth()
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true">
        <img src="/images/living.jpg" alt="" />
      </div>
      <div className="hero-inner">
        <p className="eyebrow">Smart Home Option Service · 시범 운영</p>
        <h1>
          입주하는 날,
          <br />
          스마트홈이 완성되어 있습니다.
        </h1>
        <p className="lead">
          인테리어 공사 단계에서 함께 설계하고, 기기를 골라 드리고, 집이 실제로 동작하게 만들어 드립니다. 설치는
          인테리어 업체 전기팀이 맡고, <b>저희는 설계와 프로그램 설치를 책임집니다.</b>
        </p>
        <p className="hero-actions">
          <Link to="/contact" className="btn btn-lg">
            상담 신청
          </Link>
          <Link to="/packages" className="btn btn-outline btn-lg">
            패키지 보기
          </Link>
        </p>
        {!loading && user ? <p className="hero-greet">{user.name || user.email} 님, 반갑습니다.</p> : null}
      </div>
    </section>
  )
}

function Facts() {
  return (
    <section className="facts">
      {FACTS.map((f) => (
        <article key={f.value} className="fact">
          <p className="fact-label">{f.label}</p>
          <p className="fact-value">{f.value}</p>
          <p className="fact-note">{f.note}</p>
        </article>
      ))}
    </section>
  )
}

function Problem() {
  return (
    <section className="problem">
      <div className="problem-inner">
        <p className="kicker amber">왜 필요한가</p>
        <h2>
          집은 스마트해졌는데,
          <br />
          앱은 네 개가 됐습니다.
        </h2>
        <p className="problem-lead">
          삼성 가전은 SmartThings, LG 는 ThinQ, 샤오미는 미홈, 커튼은 또 다른 앱. 기기를 사는 건 누구나 할 수 있지만
          <b> 서로 말이 통하게 만드는 일</b>이 남습니다. 다른 곳은 브랜드를 맞추라고 하고, 저희는 이미 쓰시는 걸 그대로
          씁니다.
        </p>
        <div className="problem-grid">
          <figure className="problem-card">
            <img src="/images/door.jpg" alt="현관에서 휴대폰으로 문을 여는 모습" loading="lazy" />
            <figcaption>
              <b>“다녀올게”</b> 한 마디에 도어락이 잠기고, 조명과 에어컨이 꺼지고, 커튼이 닫힙니다. 앱 네 개를 여는 대신
              장면 하나를 부릅니다.
            </figcaption>
          </figure>
          <ul className="problem-list">
            <li>
              <b>기기를 파는 게 아닙니다.</b> 입주하는 날 이미 돌아가고 있는 집을 드립니다.
            </li>
            <li>
              <b>공사 전에 들어갑니다.</b> 전기공사 단계에 스위치·센서 위치와 통신선을 함께 설계합니다. 공사가 끝난
              뒤에는 선택지가 줄어듭니다.
            </li>
            <li>
              <b>쓰던 가전을 그대로 씁니다.</b> 제조사가 외부 연동을 막아 둔 모델만 아니면, 브랜드가 섞여 있어도 한
              화면에 들어옵니다.
            </li>
            <li>
              <b>입주 후 한 달을 같이 봅니다.</b> 자동화는 살아 보면서 고치는 것입니다.
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

function Roles() {
  return (
    <section className="roles">
      <div className="roles-head">
        <p className="kicker">역할</p>
        <h2>설치는 업체 전기팀, 설계와 프로그램은 저희가</h2>
        <p>
          인테리어 업체는 이미 전기팀과 면허를 갖고 있습니다. 벽을 여는 일은 그쪽이 훨씬 잘합니다. 저희는 그 위에서 집이
          동작하게 만드는 일에 집중합니다.
        </p>
      </div>
      <div className="roles-grid">
        <article className="role ours">
          <p className="role-tag">저희가 합니다</p>
          <ul>
            <li>상담과 설계 — 제품 선정, 배치, 전기공사에 반영할 사항</li>
            <li>기기 공급 — 브랜드를 5개 이내로 고정해 A/S 를 줄입니다</li>
            <li>프로그램 설치 — 허브 등록, 공간 구성, 생활 장면 자동화</li>
            <li>브랜드 통합 — 삼성 · LG · 샤오미를 한 화면으로</li>
            <li>사용 교육과 설정 A/S</li>
          </ul>
        </article>
        <article className="role theirs">
          <p className="role-tag">업체 전기팀이 합니다</p>
          <ul>
            <li>스위치 교체와 결선</li>
            <li>커튼 모터 · 도어락 부착</li>
            <li>배선 · 타공</li>
            <li>중성선 공사가 필요한 세대의 판단과 시공</li>
            <li>물리 시공에 대한 하자 책임</li>
          </ul>
        </article>
      </div>
      <p className="roles-note">
        견적서에는 저희 청구액과 시공비를 <b>분리해서</b> 적습니다. 총액을 나중에 알게 되는 일이 없도록.
      </p>
    </section>
  )
}

function Products() {
  return (
    <section className="products">
      <div className="devices-head">
        <p className="kicker">제품 라인업</p>
        <h2>실제로 들어가는 제품들</h2>
        <p>
          모든 브랜드를 다 다루지 않습니다. 아래 열다섯 가지로 고정해 두면 설치가 빨라지고, 고장이 줄고, 몇 년 뒤
          부품을 구하기도 쉽습니다. 기기값과 서비스비는 견적서에서 분리해 보여 드립니다.
        </p>
      </div>
      <div className="prod-grid">
        {PRODUCTS.map((p) => (
          <article key={p.kind} className="prod">
            <ProductShot kind={p.kind} />
            <div className="prod-body">
              <p className="prod-brand">
                {p.brand}
                <span className="prod-from">{p.from} 이상</span>
              </p>
              <h3>{p.model}</h3>
              <p className="prod-role">{p.role}</p>
              <p className="prod-link">{p.link}</p>
              <p className="prod-note">{p.note}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="prod-foot">
        제품 그림은 실물 사진이 아니라 직접 그린 것입니다. 모델명과 규격은 2026년 9월 기준이며, 단종이나 품절이 생기면
        같은 급으로 대체하고 견적서에 명시합니다.
      </p>
    </section>
  )
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
      <p className="teaser-note">
        설계 · 기기 · 프로그램 설치를 포함한 저희 청구액입니다(부가세 포함). 시공비는 업체 견적에 별도로 들어갑니다.
      </p>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="closing">
      <h2>공사 일정이 잡히기 전이 가장 좋습니다</h2>
      <p>
        방 구성과 일정만 알려 주시면 가능한 구성과 예상 비용을 먼저 정리해 드립니다. 영업일 기준 1~2일 안에
        연락드립니다.
      </p>
      <Link to="/contact" className="btn btn-lg">
        상담 신청
      </Link>
    </section>
  )
}

export default function WelcomePage() {
  return (
    <>
      <Hero />
      <Facts />
      <Problem />
      <Roles />
      <Products />
      <PackageTeaser />
      <IotArchitecture />
      <ServiceFlow />
      <ClosingCta />
    </>
  )
}
