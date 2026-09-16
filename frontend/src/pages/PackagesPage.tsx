import { Link } from 'react-router-dom'
import { priceLabel, totalLabel } from '../data/packages'
import { useCatalog } from '../data/catalog'

function Cell({ value }: { value: number | string }) {
  if (typeof value === 'string') return <>{value}</>
  if (value === 0) return <span className="cell-none">—</span>
  return <>{value}</>
}

export default function PackagesPage() {
  const { packages: PACKAGES, comparison: COMPARISON } = useCatalog()

  return (
    <>
      <section className="page-head">
        <p className="kicker amber">패키지</p>
        <h1>패키지 5단계</h1>
        <p>
          표시된 금액은 <b>설계 · 기기 · 프로그램 설치</b>를 포함한 저희 청구액입니다(부가세 포함). 벽을 여는 시공은
          인테리어 업체 전기팀이 맡고, 그 비용은 업체 견적에 들어갑니다. 아래에 시공비와 총부담을 함께 적어 두었습니다.
        </p>
      </section>

      <section className="flow packages">
        <div className="pkg-grid">
          {PACKAGES.map((p) => (
            <article key={p.code} className={p.featured ? 'pkg featured' : 'pkg'}>
              {p.featured ? <span className="pkg-flag">가장 많이 선택</span> : null}
              <h3>{p.name}</h3>
              <p className="pkg-tagline">{p.tagline}</p>
              <p className="pkg-price">{priceLabel(p.price)}</p>
              <dl className="pkg-split">
                <div>
                  <dt>시공비 (업체 견적)</dt>
                  <dd>+ {priceLabel(p.installFee)}</dd>
                </div>
                <div className="total">
                  <dt>고객 총부담</dt>
                  <dd>{totalLabel(p)}</dd>
                </div>
              </dl>
              <p className="pkg-summary">{p.summary}</p>

              <p className="pkg-label">공급하는 기기</p>
              <ul className="pkg-list">
                {p.devices.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>

              <p className="pkg-label">프로그램 설치</p>
              <ul className="pkg-list work">
                {p.commissioning.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>

              <p className="pkg-label">포함되는 생활 장면</p>
              <ul className="pkg-list scenes">
                {p.scenes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>

              <p className="pkg-hours">{p.hours}</p>
              <Link to={`/contact?package=${p.code}`} className="btn btn-pkg">
                이 구성으로 상담
              </Link>
            </article>
          ))}
        </div>

        <h2 className="compare-title">구성 비교</h2>
        <div className="compare-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">항목</th>
                {PACKAGES.map((p) => (
                  <th key={p.code} scope="col" className={p.featured ? 'is-featured' : undefined}>
                    {p.name}
                    <small>{priceLabel(p.price)}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={PACKAGES[i].code} className={PACKAGES[i].featured ? 'is-featured' : undefined}>
                      <Cell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="row-sum">
                <th scope="row">시공비 (업체 견적)</th>
                {PACKAGES.map((p) => (
                  <td key={p.code} className={p.featured ? 'is-featured' : undefined}>
                    {priceLabel(p.installFee)}
                  </td>
                ))}
              </tr>
              <tr className="row-sum strong">
                <th scope="row">고객 총부담</th>
                {PACKAGES.map((p) => (
                  <td key={p.code} className={p.featured ? 'is-featured' : undefined}>
                    {totalLabel(p)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="care">
          <div>
            <p className="kicker amber">선택</p>
            <h2>스마트홈 케어</h2>
            <p>
              설치가 끝이 아닙니다. 가전을 새로 들이거나, 가구 배치가 바뀌거나, 앱이 업데이트되면 자동화는 손을 봐야
              합니다.
            </p>
          </div>
          <div className="care-card">
            <p className="care-price">
              월 19,000<span>원</span>
            </p>
            <ul>
              <li>원격 점검 연 2회</li>
              <li>자동화 수정 무제한</li>
              <li>신규 기기 연 2대 등록</li>
              <li>장애 원격 대응</li>
            </ul>
            <p className="care-note">방문 점검은 포함되지 않습니다(회원 할인가 적용).</p>
          </div>
        </div>

        <div className="pkg-notes">
          <h2>미리 알려드리는 것</h2>
          <ul>
            <li>
              <b>시공은 저희가 하지 않습니다.</b> 스위치 교체 · 커튼 모터 부착 · 배선은 인테리어 업체 전기팀이 맡습니다.
              업체에 전기팀이 없으면 시공 채널을 소개해 드립니다. 설정과 연동 하자는 저희가, 물리 시공 하자는 업체가
              책임집니다.
            </li>
            <li>
              <b>스위치 박스에 중성선이 없는 세대</b>가 있습니다. 무중성선 스위치로 대부분 해결하지만, 저와트 LED 는
              깜빡임이 생길 수 있어 현장 확인 후 결선 추가 공사가 업체 견적에 별도로 잡힐 수 있습니다.
            </li>
            <li>
              <b>가전은 기존 제품을 그대로 씁니다.</b> 삼성 · LG · 샤오미처럼 앱이 다른 제품도 한 화면에서 쓰도록 묶는
              것이 저희 일입니다. 다만 제조사가 외부 연동을 막아 둔 모델은 연동 범위가 제한됩니다.
            </li>
            <li>
              <b>들어가는 시점이 중요합니다.</b> 전기공사 전에 협의하면 스위치 · 센서 위치와 통신선을 함께 설계할 수
              있고, 공사가 끝난 뒤에는 선택지가 줄어듭니다.
            </li>
            <li>
              <b>방 수와 조명 개수에 따라 달라집니다.</b> 위 금액은 거실 · 주방 · 현관 · 안방 · 침실 2 구성을 기준으로
              잡은 값이며, 상담 후 현장 기준으로 확정합니다.
            </li>
          </ul>
          <p className="pkg-cta">
            <Link to="/contact" className="btn btn-lg">
              상담 신청하기
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
