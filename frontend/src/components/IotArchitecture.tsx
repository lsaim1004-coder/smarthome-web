type Device = { icon: string; name: string; via?: string }

const OWNED: Device[] = [
  { icon: '❄️', name: '에어컨 · 세탁기 · 정수기', via: 'LG ThinQ 계정' },
  { icon: '📺', name: 'TV · 냉장고 · 건조기', via: 'SmartThings 계정' },
  { icon: '🌬️', name: '공기청정기 · 로봇청소기 · 보조등', via: 'Mi Home 계정' },
  { icon: '🔐', name: '도어락 · 온습도계 · 기타 Wi-Fi 기기', via: '제조사 앱 계정' },
]

const ADDED: Device[] = [
  { icon: '📡', name: 'SmartThings 허브', via: 'Zigbee · Matter 중심' },
  { icon: '🪟', name: '전동 커튼 모터', via: 'Zigbee' },
  { icon: '🔘', name: '스마트 조명 스위치', via: 'Zigbee · 무중성선 대응' },
  { icon: '📍', name: '센서 · 스마트 플러그', via: '선택 사항' },
]

function DeviceList({ items }: { items: Device[] }) {
  return (
    <ul className="devices">
      {items.map((d) => (
        <li key={d.name}>
          <span className="dev-ico" aria-hidden="true">
            {d.icon}
          </span>
          <span className="dev-name">{d.name}</span>
          {d.via ? <span className="dev-via">{d.via}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export default function IotArchitecture() {
  return (
    <section className="iot" aria-labelledby="iot-title">
      <div className="flow-head">
        <p className="kicker">구성 원리</p>
        <h2 id="iot-title">이미 쓰는 가전은 그대로, 추가 구매는 최소로</h2>
        <p>
          SmartThings를 기본 플랫폼으로 두고 허브 · 전동 커튼 · 조명 스위치 정도만 더합니다. 삼성 · LG · 샤오미처럼 요즘
          구매하는 가전은 각 제조사 앱 계정을 연동해 <b>Home Assistant 한 화면</b>에서 함께 관리합니다.
        </p>
      </div>

      <div className="iot-diagram">
        {/* 1단: 입력 (기존 가전 / 추가 구매) */}
        <div className="iot-sources">
          <div className="iot-box owned">
            <span className="iot-tag">이미 갖고 있는 것</span>
            <h3>구매한 가전 그대로</h3>
            <DeviceList items={OWNED} />
            <p className="iot-link">앱 계정 연동 (클라우드)</p>
          </div>
          <div className="iot-box added">
            <span className="iot-tag">최소 추가 구매</span>
            <h3>허브 · 커튼 · 스위치</h3>
            <DeviceList items={ADDED} />
            <p className="iot-link">Zigbee · Matter (로컬)</p>
          </div>
        </div>

        <div className="iot-merge" aria-hidden="true">
          <span className="iot-merge-line" />
          <span className="iot-merge-arrow" />
        </div>

        {/* 2단: 통합 */}
        <div className="iot-box hub">
          <span className="iot-tag">통합 관리</span>
          <h3>Home Assistant 한 화면</h3>
          <ul className="iot-features">
            <li>모든 기기 · 모든 브랜드를 방 단위로 한곳에</li>
            <li>외출 · 귀가 · 취침 같은 생활 장면 자동화</li>
            <li>연결 상태 · 사용 기록 · 알림</li>
            <li>Matter 브릿지로 SmartThings 에도 그대로 노출</li>
          </ul>
        </div>

        <div className="iot-down" aria-hidden="true">
          <span className="iot-down-line" />
          <span className="iot-down-arrow" />
          <span className="iot-down-label">Matter 브릿지</span>
        </div>

        {/* 3단: 일상 조작 */}
        <div className="iot-box daily">
          <span className="iot-tag">가족의 일상 조작</span>
          <div className="daily-items">
            <span>📱 SmartThings 앱</span>
            <span>🗣️ 음성 (빅스비 · Google)</span>
            <span>🔘 벽 스위치 · 버튼</span>
            <span>⏰ 자동 실행</span>
          </div>
        </div>
      </div>

      <p className="iot-note">
        핵심은 기기를 더 사는 것이 아니라 <b>연결을 완성하는 것</b>입니다. 브랜드마다 흩어진 앱을 한 화면으로 모으고, 새 가전이
        들어와도 계정 연동만으로 같은 자동화에 포함됩니다.
      </p>
    </section>
  )
}
