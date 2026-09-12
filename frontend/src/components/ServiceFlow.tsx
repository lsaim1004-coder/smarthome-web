type Owner = 'interior' | 'ours' | 'customer' | 'both'

type Step = { n: number; title: string; owner: Owner; who: string }

const STEPS: Step[] = [
  { n: 1, title: '인테리어 상담', owner: 'interior', who: '인테리어 업체' },
  { n: 2, title: '스마트홈 옵션 선택', owner: 'both', who: '업체 + 스마트홈' },
  { n: 3, title: '전기 · 통신 설계', owner: 'ours', who: '스마트홈 담당' },
  { n: 4, title: '인테리어 공사', owner: 'interior', who: '인테리어 업체' },
  { n: 5, title: 'IoT 설치 · 배선', owner: 'ours', who: '스마트홈 담당' },
  { n: 6, title: '가전 입고', owner: 'customer', who: '고객' },
  { n: 7, title: '계정 연동 · 통합', owner: 'ours', who: '스마트홈 담당' },
  { n: 8, title: '입주', owner: 'customer', who: '고객' },
  { n: 9, title: '자동화 세팅 · 교육', owner: 'ours', who: '스마트홈 담당' },
  { n: 10, title: 'A/S · 스마트홈 케어', owner: 'ours', who: '스마트홈 담당' },
]

export default function ServiceFlow() {
  return (
    <section className="flow" aria-labelledby="flow-title">
      <div className="flow-head">
        <p className="kicker">서비스 흐름</p>
        <h2 id="flow-title">인테리어 업체가 제안하고, 스마트홈 전문업체가 끝까지 책임집니다</h2>
        <p>
          인테리어 견적에 옵션 한 줄을 더하는 것으로 시작합니다. 제품 선정부터 설치 · 연동 · 입주 후 A/S까지는 스마트홈
          전문업체가 맡아, 업체는 새 기술을 배우거나 관리할 필요가 없습니다.
        </p>
      </div>

      {/* 3자 관계 그림 */}
      <div className="actors">
        <article className="actor">
          <span className="actor-tag">인테리어 업체</span>
          <h3>스마트홈 옵션 제안</h3>
          <p>기존 고객 상담 흐름 안에서</p>
          <ul>
            <li>고객에게 옵션 3종 제안</li>
            <li>견적서에 옵션 항목 반영</li>
            <li>공정 일정 공유</li>
          </ul>
        </article>
        <article className="actor main">
          <span className="arrow-label">옵션 의뢰</span>
          <span className="actor-tag">스마트홈 전문업체</span>
          <h3>설계부터 A/S까지</h3>
          <p>IoT 기술 · 시공 · 후처리를 한 곳에서</p>
          <ul>
            <li>사전 설계 · 제품 선정</li>
            <li>Wi-Fi · 네트워크 구축</li>
            <li>IoT 설치 · 계정 연동</li>
            <li>자동화 · 장면 설정</li>
            <li>입주 후 세팅 · 교육</li>
            <li>A/S · 유지관리</li>
          </ul>
        </article>
        <article className="actor customer">
          <span className="arrow-label">완성 인도</span>
          <span className="actor-tag">고객</span>
          <h3>입주하는 날 완성</h3>
          <p>기기 사서 직접 연결할 필요 없이</p>
          <ul>
            <li>모든 가전이 한 화면에</li>
            <li>외출 · 귀가 · 취침 자동화</li>
            <li>문제 생기면 한 곳에 연락</li>
          </ul>
        </article>
      </div>

      {/* 단계 그림 */}
      <h3 className="steps-title">상담부터 A/S까지 10단계</h3>
      <ol className="steps">
        {STEPS.map((s) => (
          <li key={s.n} className={`step ${s.owner}`}>
            <b>{s.n}</b>
            <span>{s.title}</span>
            <em>{s.who}</em>
          </li>
        ))}
      </ol>
      <div className="legend">
        <span className="l-int">
          <i />
          인테리어 업체
        </span>
        <span className="l-our">
          <i />
          스마트홈 담당
        </span>
        <span className="l-cus">
          <i />
          고객
        </span>
      </div>

      {/* 후처리 · A/S */}
      <div className="aftercare">
        <div className="care">
          <span className="care-tag">후처리 1</span>
          <h4>입주 후 세팅 · 교육</h4>
          <p>입주 첫 주 생활 패턴에 맞춰 장면을 다듬고, 가족 모두 앱 · 음성 사용법을 익히도록 안내합니다.</p>
        </div>
        <div className="care">
          <span className="care-tag">후처리 2</span>
          <h4>A/S</h4>
          <p>연결 끊김 · 자동화 오동작은 원격으로 먼저 점검하고, 필요하면 방문합니다. 기기 교체도 함께 처리합니다.</p>
        </div>
        <div className="care">
          <span className="care-tag">후처리 3</span>
          <h4>스마트홈 케어</h4>
          <p>연 1회 네트워크 · 연결 · 자동화 점검, 새 가전 연동, Wi-Fi 음영 개선까지 유지관리로 이어갑니다.</p>
        </div>
      </div>
    </section>
  )
}
