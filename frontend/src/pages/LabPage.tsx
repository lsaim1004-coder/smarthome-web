import { useEffect } from 'react'

/**
 * 지인에게 "첫 세 집이 되어 주시겠어요" 라고 부탁하는 화면.
 *
 * 처음엔 "댁을 한 달만 빌려주시겠어요" 로 썼다가 **표현이 과하다**는 말을 들었다.
 * 집을 통째로 내놓으라는 말처럼 들리는데, 실제로는 한 달 정도 상의해 가며 몇 번 들르는
 * 일이다. 받는 사람이 부담을 느끼면 부탁 자체가 실패한다.
 *
 * 파는 화면이 아니라 **부탁하는 화면**이다. 그래서 톤이 다르다 — 사이트의 다른 페이지가
 * 밝은 바탕에 가격을 보여준다면 여기는 어두운 바탕에 솔직한 말을 한다.
 * 헤더가 이미 네이비+앰버라 위아래가 자연스럽게 이어진다.
 *
 * 한 화면에 한 가지씩 넘어가게 스크롤 스냅을 걸되, 이 페이지에 있는 동안만 건다
 * (html 에 직접 걸면 다른 페이지까지 따라간다).
 */
export default function LabPage() {
  useEffect(() => {
    document.documentElement.classList.add('lab-on')
    return () => document.documentElement.classList.remove('lab-on')
  }, [])

  // 카카오톡은 아이디로 바로 여는 링크가 없다. 눌러서 복사하는 게 폰에서 제일 빠르다.
  useEffect(() => {
    const btn = document.getElementById('lab-kakao-copy')
    const hint = document.getElementById('lab-kakao-hint')
    if (!btn || !hint) return
    const onClick = async () => {
      try {
        await navigator.clipboard.writeText('lsaim')
        hint.textContent = '복사했습니다. 카카오톡 친구 추가에 붙여 넣으세요'
      } catch {
        hint.textContent = '아이디는 lsaim 입니다'
      }
    }
    btn.addEventListener('click', onClick)
    return () => btn.removeEventListener('click', onClick)
  }, [])

  return (
    <div className="lab">
      <section className="lab-s">
        <span className="lab-eye">부탁 하나 드립니다</span>
        <h1 className="lab-h1">
          첫 세 집을
          <br />
          찾습니다
        </h1>
        <p className="lab-lead">
          집에 있는 가전과 조명을 <b>하나로 묶어서 알아서 돌아가게</b> 만드는 일을 사업으로
          준비하고 있습니다. 제 집에는 몇 년째 해두고 쓰는데, <b>남의 집에 해본 적이 없습니다.</b>
        </p>
        <p className="lab-lead">
          한 달쯤 <b>상의해 가며 몇 번 들르는</b> 일입니다. 시간은 편하신 때로 맞춥니다.
        </p>
        <p className="lab-cue">↓ 넘기시면 무슨 얘긴지 나옵니다</p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">왜 부탁드리나</span>
        <h2 className="lab-h2">
          제 집에서 되는 게
          <br />
          댁에서도 될지는 모릅니다
        </h2>
        <p>
          집마다 인터넷 공유기가 다르고, 가전 브랜드가 다르고, 앱 계정이 누구 이름으로 돼 있는지도
          다릅니다. 제 집에서 30분이면 끝나는 일이 댁에서는 세 시간이 걸릴 수도 있습니다.
        </p>
        <p>
          <b>그걸 모르는 채로 남한테 돈을 받으면 안 된다고 생각합니다.</b>
        </p>
        <p>
          그래서 세 집만, <em>옆에서 시간을 재면서</em> 해보려 합니다. 무엇이 걸리는지, 실제로 몇
          시간이 드는지 알아야 그다음에 값을 매길 수 있습니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">그게 뭔데요</span>
        <h2 className="lab-h2">어려운 얘기 아닙니다</h2>
        <p className="lab-lead">
          집에 있는 것들이 <b>서로 말이 통하게</b> 만드는 일입니다. 그러면 하나씩 켜고 끄지 않아도
          집이 알아서 합니다.
        </p>
        <dl className="lab-plain">
          <dt>허브</dt>
          <dd>손바닥만 한 상자 하나. 브랜드가 다른 기기들 사이에서 통역을 합니다.</dd>
          <dt>센서</dt>
          <dd>손가락만 한 것들. 사람이 지나가면 알고, 문이 열리면 알고, 물이 새면 알려 줍니다.</dd>
          <dt>스마트 플러그</dt>
          <dd>콘센트와 코드 사이에 끼우는 것. 멀리서 끄고 켤 수 있고, 전기를 얼마나 쓰는지도 보입니다.</dd>
        </dl>
        <p className="lab-note">
          새 가전을 사시라는 얘기가 아닙니다. <b>지금 쓰시는 것 그대로 두고</b> 위의 것들을 얹는
          겁니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">가장 하고 싶은 일</span>
        <h2 className="lab-h2">
          손에 든 건 폰 하나인데
          <br />
          앱은 일곱 개입니다
        </h2>
        <div className="lab-chores">
          {[
            ['에어컨 끄기', 'LG ThinQ'],
            ['세탁 끝났나 보기', '삼성 SmartThings'],
            ['청소기 돌리기', '샤오미 미홈'],
            ['공기청정기 켜기', '또 다른 앱'],
            ['문 잠갔나 확인', '도어락 앱'],
            ['커튼 닫기', '커튼 앱'],
            ['거실 불 끄기', '일어나서 스위치'],
          ].map(([todo, app]) => (
            <div className="lab-chore" key={todo}>
              <span>{todo}</span>
              <span className="lab-app">{app}</span>
            </div>
          ))}
        </div>
        <p className="lab-verdict">앱을 찾다가 그냥 일어나서 하게 됩니다.</p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">그래서 이걸 합니다</span>
        <h2 className="lab-h2">
          브랜드가 달라도
          <br />
          화면 하나로 묶습니다
        </h2>
        <div className="lab-one">
          <h3>삼성 · LG · 샤오미 · 그 밖에 뭐가 있든</h3>
          <p>
            에어컨도 세탁기도 청소기도 조명도 커튼도 <b>한 화면</b>에 있습니다. 폰으로도 보고,
            원하시면 거실 벽에 태블릿을 하나 붙여 거기서도 봅니다. <em>“잘게” 한마디</em>면 여러
            개가 한꺼번에 움직입니다.
          </p>
        </div>
        <p>
          <b>브랜드를 맞추시라는 말은 하지 않습니다.</b> 다른 곳은 “저희 제품으로 통일하세요” 라고
          합니다. 저는 지금 쓰시는 걸 그대로 씁니다. 그게 제가 제일 자신 있는 부분입니다.
        </p>
        <figure className="lab-fig">
          <a href="/images/ha-dashboard.jpg" target="_blank" rel="noreferrer">
            <img
              src="/images/ha-dashboard.jpg"
              width="1400"
              height="1183"
              alt="한 화면에 모인 거실·안방 온습도, LG 에어컨 네 대, 커튼과 블라인드, 공기청정기, 셋탑박스와 TV, 플러그, 로봇청소기, 전력 그래프"
            />
          </a>
          <figcaption className="lab-cap">
            저희 집 화면입니다. LG 에어컨 · LG TV · U+ 셋탑 · 구글 네스트허브 · 공기청정기 ·
            커튼 · 플러그 · 로봇청소기 — <b>만든 회사가 전부 다른데 한 화면에 있습니다.</b>{' '}
            <span className="lab-zoom">사진을 누르면 크게 보입니다</span>
          </figcaption>
        </figure>
        <p className="lab-note">
          제조사 한 곳이 만든 앱으로는 원래 안 되는 일입니다. 저 화면을 만드는 게 제 일입니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">그다음이 진짜입니다</span>
        <h2 className="lab-h2">
          누르지 않아도
          <br />
          알아서 됩니다
        </h2>
        <div className="lab-scenes">
          <div className="lab-scene">
            <span className="lab-scene-n">나갈 때</span>
            <span className="lab-scene-f">
              <b>문 잠그면</b> → 거실 불 꺼짐 → 에어컨 꺼짐 → 커튼 닫힘 → 안 쓰는 코드 차단
            </span>
          </div>
          <div className="lab-scene">
            <span className="lab-scene-n">들어올 때</span>
            <span className="lab-scene-f">
              <b>문 열면</b> → 현관 불 → 거실 불 → 커튼 열림
            </span>
          </div>
          <div className="lab-scene">
            <span className="lab-scene-n">잘 때</span>
            <span className="lab-scene-f">
              <b>“잘게”</b> 한마디 → 불 전부 꺼짐 → 커튼 닫힘 → 에어컨 수면 온도
            </span>
          </div>
          <div className="lab-scene">
            <span className="lab-scene-n">청소</span>
            <span className="lab-scene-f">
              아무도 없는 게 <b>확인되면</b> 로봇청소기 시작
            </span>
          </div>
          <div className="lab-scene">
            <span className="lab-scene-n">전기</span>
            <span className="lab-scene-f">
              나가면 대기전력 차단 → 월말에 <b>이번 달 얼마 썼는지</b> 알림
            </span>
          </div>
        </div>
        <p className="lab-note">
          댁의 생활에 맞춰 만들어 드리고, 한 달 동안 안 맞는 건 고칩니다.{' '}
          <b>기기를 파는 게 아니라 이걸 만들어 드리는 일입니다.</b>
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">말보다 보는 게 빠릅니다</span>
        <h2 className="lab-h2">
          남이 해놓은 걸
          <br />
          한번 보세요
        </h2>
        <p>
          제가 백 마디 하는 것보다 3분짜리 영상 하나가 낫습니다. 집이 어떻게 움직이는지
          감이 잡히실 겁니다.
        </p>
        <div className="lab-links">
          <a
            className="lab-link"
            href="https://www.youtube.com/watch?v=3PbYr8lJKJE"
            target="_blank"
            rel="noreferrer"
          >
            <span className="lab-link-t">모든 게 자동으로 움직이는 집, 직접 가봤습니다</span>
            <span className="lab-link-s">유튜브 · 테킷</span>
          </a>
          <a
            className="lab-link"
            href="https://www.youtube.com/watch?v=hWP0frQPQsk"
            target="_blank"
            rel="noreferrer"
          >
            <span className="lab-link-t">자동화 하나 만드는 데 몇 분 안 걸립니다</span>
            <span className="lab-link-s">유튜브 · 삼성전자 공식</span>
          </a>
        </div>
        <p className="lab-note">
          첫 영상은 <b>끝까지 다 해놓은 집</b>이라 좀 화려합니다. 저렇게까지 할 필요는 없습니다 —
          다음 장에 <b>얼마면 되는지</b> 적어 뒀습니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">제일 많이 물어보시는 것</span>
        <h2 className="lab-h2">
          생각보다
          <br />
          비싸지 않습니다
        </h2>
        <p>
          스마트홈 하면 수백만 원짜리를 떠올리시는데, 그건 집 전체를 다 할 때 얘기입니다.
          <b> 하고 싶은 것 하나씩만 하면 몇 만 원입니다.</b>
        </p>
        <div className="lab-price">
          <div className="lab-price-r">
            <span className="lab-price-w">욕실 환풍기 자동으로</span>
            <span className="lab-price-d">스위치 54,900 + 모션센서 9,900</span>
            <span className="lab-price-v">64,800원</span>
          </div>
          <div className="lab-price-r">
            <span className="lab-price-w">나가면 대기전력 차단</span>
            <span className="lab-price-d">스마트 플러그 15,210 × 2개</span>
            <span className="lab-price-v">30,420원</span>
          </div>
          <div className="lab-price-r">
            <span className="lab-price-w">옛날 에어컨·TV 도 폰으로</span>
            <span className="lab-price-d">리모컨 학습 허브 1대</span>
            <span className="lab-price-v">38,800원</span>
          </div>
          <div className="lab-price-r">
            <span className="lab-price-w">문 열리면 폰으로 알림</span>
            <span className="lab-price-d">문·창문 센서</span>
            <span className="lab-price-v">12,900원</span>
          </div>
          <div className="lab-price-r">
            <span className="lab-price-w">물 새면 바로 알림</span>
            <span className="lab-price-d">누수 센서</span>
            <span className="lab-price-v">9,900원</span>
          </div>
        </div>
        <p className="lab-note">
          여기에 <b>허브 한 대 36,000원</b>이 한 번만 듭니다. 기기들이 서로 말이 통하게 해주는
          그 상자입니다. 나중에 뭘 더 붙여도 허브는 그대로 씁니다.
        </p>
        <p>
          <em>허브 하나에 하고 싶은 것 두세 개</em>면 <b>10만 원 안쪽</b>으로 시작됩니다.
          기기는 <b>같이 보고 골라서 직접 사시면 됩니다.</b> 제가 파는 게 아니라 같이 고르는
          것이고, 설계·설치·설정·교육은 <b>값을 받지 않습니다.</b>
        </p>
        <p className="lab-note">
          가격은 2026년 9월에 제가 직접 찾아본 값이라 조금씩 달라집니다. 그리고 집에 따라
          허브가 하나 더 필요할 수 있는데, <b>그런 게 있는지 확인하는 것도 이번에 제가
          알아보려는 것</b>입니다. 필요하면 미리 말씀드리고 정합니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">예를 하나만 더 · 이건 모든 집이 겪습니다</span>
        <h2 className="lab-h2">
          욕실 곰팡이는
          <br />
          환풍기를 안 켜서 생깁니다
        </h2>
        <p>
          샤워하고 나오면서 환풍기 켜는 사람 드뭅니다. 켜도 <b>끄는 걸 잊습니다.</b> 습기가 그대로
          남으면 실리콘 줄눈부터 검게 올라옵니다.
        </p>
        <div className="lab-tl">
          <div className="lab-tl-r">
            <span className="lab-tl-t">0분</span>
            <span>욕실에 들어감 — 천장 센서가 사람을 알아챔</span>
            <span className="lab-tl-s on">환풍기 켜짐</span>
          </div>
          <div className="lab-tl-r">
            <span className="lab-tl-t">15분</span>
            <span>샤워 끝, 나옴</span>
            <span className="lab-tl-s on">계속 돎</span>
          </div>
          <div className="lab-tl-r">
            <span className="lab-tl-t">75분</span>
            <span>한 시간째 아무도 안 들어옴</span>
            <span className="lab-tl-s off">스스로 꺼짐</span>
          </div>
        </div>
        <p>
          <em>손댈 일이 한 번도 없습니다.</em> 스위치를 켜지도, 끄러 다시 가지도 않습니다. 습기가
          남아 있는 시간이 줄어드니 곰팡이가 덜 핍니다.
        </p>
        <p className="lab-note">
          환풍기는 벽 안에 전선으로 붙어 있어서 플러그로는 안 되고 <b>스위치를 바꿔야</b> 합니다.
          제가 직접 합니다 — 여러 번 해본 일이고, 작업하는 동안은 차단기를 내립니다.{' '}
          <b>떼어낸 기존 스위치는 보관해 두었다가</b> 원하시면 그대로 되돌려 드립니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">저희 집에서 실제로 잰 숫자 · 2026년 9월</span>
        <h2 className="lab-h2">전기가 기기별로 보입니다</h2>
        <div className="lab-chart">
          {[
            ['거실 에어컨', 100, '44.2', false],
            ['안방 에어컨', 48.4, '21.4', false],
            ['전기레인지', 24.2, '10.7', true],
            ['작은방 에어컨', 17.6, '7.8', false],
            ['정수기', 11.1, '4.9', true],
            ['컴퓨터방 에어컨', 9.7, '4.3', false],
          ].map(([name, pct, val, cool]) => (
            <div className="lab-bar" key={name as string}>
              <span className="lab-bar-n">{name as string}</span>
              <span className="lab-bar-t">
                <span
                  className={'lab-bar-f' + (cool ? ' cool' : '')}
                  style={{ width: `${pct as number}%` }}
                />
              </span>
              <span className="lab-bar-v">{val as string}</span>
            </div>
          ))}
        </div>
        <div className="lab-axis">
          <span>0</span>
          <span>한 달 사용량 (kWh · 요금 고지서에 찍히는 그 단위) · 최대 44.2</span>
        </div>
        <div className="lab-stats">
          <div>
            <span className="lab-stat-n">
              93.3<small> kWh</small>
            </span>
            <span className="lab-stat-l">여섯 대 합계</span>
          </div>
          <div>
            <span className="lab-stat-n">
              83<small> %</small>
            </span>
            <span className="lab-stat-l">그중 에어컨</span>
          </div>
          <div>
            <span className="lab-stat-n">
              42<small> W</small>
            </span>
            <span className="lab-stat-l">새벽 3시, 아무도 안 쓸 때</span>
          </div>
        </div>
        <figure className="lab-fig">
          <a href="/images/ha-energy.jpg" target="_blank" rel="noreferrer">
            <img
              src="/images/ha-energy.jpg"
              width="1400"
              height="1110"
              alt="9월 한 달 전기 사용량 화면 — 날짜별 막대와 기기별 색 구분, 거실 에어컨·안방 에어컨·전기레인지·정수기·컴퓨터 등이 따로 표시됨"
              loading="lazy"
            />
          </a>
          <figcaption className="lab-cap">
            날짜별로, 그리고 <b>기기별로 색이 나뉘어</b> 쌓입니다. 어느 날 왜 많이 나왔는지
            바로 짚입니다. <span className="lab-zoom">사진을 누르면 크게 보입니다</span>
          </figcaption>
        </figure>
        <p className="lab-note">
          <b>42W</b> 가 제일 재미있습니다. 아무도 안 쓰는데 계속 나가는 전기고, 플러그를 늘릴수록
          그게 뭐 때문인지 더 잘게 쪼개집니다. <b>어디서 새는지를 알아야 줄일 수 있습니다.</b>
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">정직하게 말씀드리면</span>
        <h2 className="lab-h2">다 보이지는 않습니다</h2>
        <div className="lab-two">
          <div>
            <span className="lab-col yes">보이는 것</span>
            <ul>
              <li>플러그에 꽂는 기기 — 지금 쓰는 전기와 이번 달 누적</li>
              <li>
                LG·삼성 가전이 스스로 알려주는 사용량 <small>(추가 비용 없음)</small>
              </li>
              <li>아무도 안 쓸 때 나가는 전기</li>
            </ul>
          </div>
          <div>
            <span className="lab-col no">안 보이는 것</span>
            <ul>
              <li>벽에 매립된 조명과 인덕션 — 플러그를 낄 데가 없습니다</li>
              <li>집 전체 합계 — 두꺼비집을 만져야 해서 전기기사가 필요합니다</li>
              <li>
                가전에 따라 <b>월 합계만</b> 주고 실시간은 안 주는 것도 있습니다
              </li>
            </ul>
          </div>
        </div>
        <p className="lab-note">
          가전이 알려주는 숫자가 <b>산 뒤로 쓴 전체 누적</b>인 경우가 있어서 첫 달에는 숫자가
          이상하게 나옵니다. 미리 말씀드립니다.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">어디까지 하나</span>
        <h2 className="lab-h2">
          어디까지 하고
          <br />
          어디서 멈추는지
        </h2>
        <p>
          <b>있는 전선은 그대로 씁니다.</b> 스위치를 같은 자리에서 바꾸는 것까지는 하고, 새로 전선을
          끌거나 두꺼비집을 만지는 일은 하지 않습니다. 벽에 구멍도 내지 않습니다.
        </p>
        <div className="lab-two">
          <div>
            <span className="lab-col yes">하는 것</span>
            <ul>
              <li>허브 놓고 인터넷 상태 봐 드리기</li>
              <li>
                플러그와 센서 설치 <small>(꽂고 붙이는 것뿐입니다)</small>
              </li>
              <li>
                <b>스위치 교체</b> <small>(욕실 환풍기, 조명 — 있는 전선 그대로)</small>
              </li>
              <li>지금 쓰시는 앱 계정들 하나로 묶기</li>
              <li>리모컨으로만 되는 옛날 에어컨·TV 도 폰으로</li>
              <li>생활 장면 만들기와 사용법 알려 드리기</li>
            </ul>
          </div>
          <div>
            <span className="lab-col no">안 하는 것</span>
            <ul>
              <li>새 전선 끌기 · 두꺼비집(분전반) 작업 · 타공</li>
              <li>전동 커튼 모터 달기</li>
              <li>도어락 교체</li>
              <li>
                현관 인터폰(월패드) 연동 <small>(2022년 이후 아파트는 막혀 있습니다)</small>
              </li>
            </ul>
          </div>
        </div>
        <p className="lab-note">
          스위치를 바꿀 때는 <b>차단기를 내리고</b> 하고, 떼어낸 것은 보관합니다. 원하시면 언제든
          원래대로 돌려 드립니다. 전세나 월세라면 <b>집주인 동의</b>를 먼저 받아 주세요.
        </p>
      </section>

      <section className="lab-s">
        <span className="lab-eye">주고받는 것</span>
        <h2 className="lab-h2">
          드리는 것과
          <br />
          부탁드리는 것
        </h2>
        <div className="lab-deal">
          <div className="lab-card give">
            <h3>제가 드리는 것</h3>
            <ul>
              <li>
                <b>돈은 저한테 한 푼도 안 오갑니다.</b> 기기는 같이 골라 직접 사시고,
                설계·설치·설정·교육은 제가 합니다
              </li>
              <li>
                한 달이 지나도 <b>그대로 두고 갑니다</b>
              </li>
              <li>한 달간 안 되는 건 멀리서 고쳐 드립니다</li>
              <li>
                마음에 안 드시면 <b>원래대로 되돌려</b> 드립니다
              </li>
            </ul>
          </div>
          <div className="lab-card ask">
            <h3>부탁드리는 것</h3>
            <ul>
              <li>
                한 달쯤 <b>상의해 가며 몇 번 들르는 것</b>을 허락해 주세요. 날짜는 맞춰서 갑니다
              </li>
              <li>인터넷 회사와 가전 목록을 미리 알려 주세요</li>
              <li>
                제가 옆에서 <b>시간을 재도</b> 이해해 주세요
              </li>
              <li>
                불편한 건 <b>불편하다고</b> 말씀해 주세요. 그게 제일 필요합니다
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="lab-s">
        <span className="lab-eye">이렇게 진행됩니다</span>
        <h2 className="lab-h2">
          한 달쯤
          <br />
          오가면서 맞춥니다
        </h2>
        <ol className="lab-steps">
          <li>
            <span className="lab-step-n">1</span>
            <span>
              전화로 10분<small>인터넷·가전·평소 불편한 점을 여쭙니다</small>
            </span>
          </li>
          <li>
            <span className="lab-step-n">2</span>
            <span>
              뭘 놓을지 같이 정합니다
              <small>제가 후보와 가격을 정리해 드리고, 고르시면 구매는 직접 하시면 됩니다</small>
            </span>
          </li>
          <li>
            <span className="lab-step-n">3</span>
            <span>
              첫 방문 — 설치하고 묶기<small>반나절, 편하신 날로</small>
            </span>
          </li>
          <li>
            <span className="lab-step-n">4</span>
            <span>
              일주일쯤 써보시고 말씀해 주세요
              <small>멀리서 고칠 수 있는 건 들르지 않고 고칩니다</small>
            </span>
          </li>
          <li>
            <span className="lab-step-n">5</span>
            <span>
              생활에 안 맞는 게 있으면 한 번 더<small>필요할 때만, 상의해서</small>
            </span>
          </li>
          <li>
            <span className="lab-step-n">6</span>
            <span>
              한 달쯤 되면 마무리<small>그대로 두고 갑니다</small>
            </span>
          </li>
        </ol>
        <p className="lab-cta">세 분만 모십니다</p>
        <div className="lab-kakao">
          <span className="lab-kakao-l">카카오톡에서 찾아 주세요</span>
          <button type="button" className="lab-btn" id="lab-kakao-copy">
            lsaim
          </button>
          <span className="lab-kakao-h" id="lab-kakao-hint">
            누르면 아이디가 복사됩니다
          </span>
        </div>
        <p className="lab-foot">
          전기 사용량은 2026년 9월 저희 집에서 실제로 잰 값입니다
          <br />
          놓을 기기와 금액은 댁의 가전과 구조에 따라 달라집니다
        </p>
      </section>
    </div>
  )
}
