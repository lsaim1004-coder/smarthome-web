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

      {/*
        리모델링 중인 고객에게만 팔 수 있는 것들. 패키지(기기)와 성격이 달라 따로 뗐다.
        천장이 닫히고 벽이 마감되면 이 항목들은 값이 몇 배가 되거나 아예 못 한다.
      */}
      <section className="page-head">
        <p className="kicker amber">지금 공사 중이시라면</p>
        <h1>기기보다 먼저 정해야 하는 것</h1>
        <p>
          스마트 기기는 몇 년 뒤에도 바꿀 수 있습니다. <b>전기 배선은 못 바꿉니다.</b> 천장이 닫히고 도배가 끝나면
          다시 뜯어야 하고, 그때는 비용이 몇 배가 됩니다.
        </p>
      </section>

      <section className="flow">
        <div className="wrap">
          <div className="pre-grid">
            <article className="pre-card accent">
              <h3>중성선 미리 넣기</h3>
              <p className="pre-price">
                지금 <b>개소당 몇 천 원</b>
              </p>
              <p>
                스마트 스위치는 대부분 중성선이 필요한데, 국내 아파트 스위치 박스에는 대개 없습니다. 전기 공사할 때
                선 하나만 같이 넣어 두면 끝나는 일입니다.
              </p>
              <p className="pre-vs">
                나중에 하면 <b>개소당 5~10만원 + 벽 해체 + 도배</b>
                <br />
                스위치 10개소 기준으로 지금 5만원, 나중에 50~100만원입니다.
              </p>
            </article>

            <article className="pre-card">
              <h3>조명 · 전기 설계 검토</h3>
              <p className="pre-price">15만원</p>
              <p>도면을 보고 스위치 · 센서 · 콘센트 위치와 회로 구성을 잡아 드립니다. 내놓는 것은 종이 네 장입니다.</p>
              <ol className="pre-steps">
                <li>평면도</li>
                <li>제품 배치도</li>
                <li>
                  <b>배선도</b>
                </li>
                <li>설치 순서</li>
              </ol>
              <p className="pre-note">
                인테리어 사장님은 커튼 전원 · 콘센트 위치 · 목공 준비를 알아야 하고, 전기팀은 중성선 · Driver · 채널 ·
                병렬 연결을 알아야 합니다. <b>모두가 같은 그림을 보게 만드는 문서입니다.</b>
              </p>
            </article>

            <article className="pre-card">
              <h3>간접조명 · 다운라이트 구간 설계</h3>
              <p className="pre-price">10만원</p>
              <p>
                간접조명은 등만 사서 되는 게 아닙니다. SMPS 용량과 Driver 채널, 조광 회로 분리를 먼저 정해야 천장을
                닫을 수 있습니다.
              </p>
              <p className="pre-note">
                이 부분은 공사가 끝난 뒤에 바꿀 수 없는 대표적인 항목입니다.
              </p>
            </article>

            <article className="pre-card">
              <h3>기기 사전 검수 · 라벨링</h3>
              <p className="pre-price">12만원</p>
              <p>
                기기를 받는 즉시 검수하고, 가능한 것은 미리 페어링해 두고, <b>어느 방 어느 자리에 들어갈 것인지 라벨을
                붙여</b> 다시 포장해 현장에 넘깁니다.
              </p>
              <p className="pre-note">
                시공 당일에는 아무도 설명서를 읽을 시간이 없습니다. "안방 스위치 어디 있나요?" 한 번에 작업이
                멈춥니다.
              </p>
            </article>

            <article className="pre-card">
              <h3>전기 시공 당일 입회</h3>
              <p className="pre-price">20만원 / 1일</p>
              <p>
                배선도대로 시공되는지 현장에서 함께 봅니다. Driver 채널이 바뀌거나 병렬 연결이 다르게 들어가면 나중에
                확인하기 어렵습니다.
              </p>
              <p className="pre-note">전기팀과 미리 배선도를 맞춰 두기 때문에 현장에서 다투는 일이 없습니다.</p>
            </article>

            <article className="pre-card small">
              <h3>먼저 하나만 해보고 싶으시면</h3>
              <p className="pre-price">7만 5천원 · 2시간</p>
              <p>
                <b>욕실 환풍기 자동화</b> — 들어가면 켜지고, 나가고 한 시간 뒤에 저절로 꺼집니다. 욕실 곰팡이는
                환풍기를 안 켜서, 켜도 끄는 걸 잊어서 생깁니다.
              </p>
              <p className="pre-note">마음에 안 드시면 원래 스위치로 되돌려 드립니다.</p>
            </article>
          </div>

          <p className="pkg-cta">
            <Link to="/contact" className="btn btn-lg">
              공사 일정부터 상담하기
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
