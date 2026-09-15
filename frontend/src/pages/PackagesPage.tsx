import { Link } from 'react-router-dom'
import { COMPARISON, PACKAGES, priceLabel } from '../data/packages'

function Cell({ value }: { value: number | string }) {
  if (typeof value === 'string') return <>{value}</>
  if (value === 0) return <span className="cell-none">—</span>
  return <>{value}</>
}

export default function PackagesPage() {
  return (
    <section className="flow packages">
      <div className="flow-head">
        <p className="kicker">패키지</p>
        <h2>패키지 5단계</h2>
        <p>
          기기값과 설계·설치·자동화·교육을 모두 포함한 가격입니다(부가세 포함). 거실 · 주방 · 현관 · 안방 · 침실 2
          구성을 기준으로 잡았고, 방 수와 조명 개수, 기존 배선 상태에 따라 달라질 수 있어 상담 후 현장 기준으로
          확정합니다.
        </p>
      </div>

      <div className="pkg-grid">
        {PACKAGES.map((p) => (
          <article key={p.code} className={p.featured ? 'pkg featured' : 'pkg'}>
            {p.featured ? <span className="pkg-flag">가장 많이 선택</span> : null}
            <h3>{p.name}</h3>
            <p className="pkg-tagline">{p.tagline}</p>
            <p className="pkg-price">{priceLabel(p.price)}</p>
            <p className="pkg-summary">{p.summary}</p>

            <p className="pkg-label">구성</p>
            <ul className="pkg-list">
              {p.highlights.map((h) => (
                <li key={h}>{h}</li>
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

      <h3 className="compare-title">구성 비교</h3>
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
          </tbody>
        </table>
      </div>

      <div className="pkg-notes">
        <h3>미리 알려드리는 것</h3>
        <ul>
          <li>
            <b>스위치 박스에 중성선이 없는 세대</b>가 있습니다. 무중성선 스위치로 대부분 해결하지만, 저와트 LED 는
            깜빡임이 생길 수 있어 현장 확인 후 결선 추가 공사를 별도 견적으로 안내합니다.
          </li>
          <li>
            <b>가전은 기존 제품을 그대로 씁니다.</b> 삼성 · LG · 샤오미처럼 앱이 다른 제품도 한 화면에서 쓰도록
            묶는 것이 저희 일입니다. 다만 제조사가 외부 연동을 막아 둔 모델은 연동 범위가 제한됩니다.
          </li>
          <li>
            <b>들어가는 시점이 중요합니다.</b> 전기공사 전에 협의하면 스위치 · 센서 위치와 통신선을 함께 설계할 수
            있고, 공사가 끝난 뒤에는 선택지가 줄어듭니다.
          </li>
        </ul>
        <p className="pkg-cta">
          <Link to="/contact" className="btn">
            상담 신청하기
          </Link>
        </p>
      </div>
    </section>
  )
}
