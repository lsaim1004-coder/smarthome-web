import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { priceLabel } from '../data/packages'
import { useCatalog } from '../data/catalog'
import ApplianceStep, { type ApplianceDraft } from '../components/ApplianceStep'
import {
  BUILD_STAGES,
  HOME_TYPES,
  INTEREST_GROUPS,
  MAX_PHOTOS_PER_INQUIRY,
  PACKAGE_UNDECIDED,
  ROOM_COUNTS,
  WINDOW_COUNTS,
  findInterest,
  findKind,
  recommendPackage,
  type Choice,
} from '../data/inquiryOptions'

type CreateResponse = {
  ok: boolean
  message: string
  id: number | null
  uploadToken: string | null
  /** 프런트가 보낸 순번 → 저장된 가전 id */
  applianceIds: Record<string, number> | null
}

type UploadResponse = { ok: boolean; stored: number; rejected: number; message: string }

/* ── 입력 부품 ────────────────────────────────────────────────── */

/** 하나만 고르는 칩 줄. */
function ChipRadio({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: Choice[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="chip-set">
      {options.map((o) => (
        <label key={o.code} className={value === o.code ? 'chip-opt on' : 'chip-opt'}>
          <input
            type="radio"
            name={name}
            value={o.code}
            checked={value === o.code}
            onChange={() => onChange(o.code)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}

/* ── 페이지 ───────────────────────────────────────────────────── */

export default function ContactPage() {
  const { packages: PACKAGES, findPackage } = useCatalog()

  const [params] = useSearchParams()

  // 1. 어떤 집인가
  const [homeType, setHomeType] = useState('')
  const [roomCount, setRoomCount] = useState('')
  const [buildStage, setBuildStage] = useState('')
  const [moveIn, setMoveIn] = useState('')

  // 2. 무엇을 바꾸고 싶은가
  const [interests, setInterests] = useState<string[]>([])
  const [windowCount, setWindowCount] = useState('')

  // 3. 지금 쓰는 가전
  const [appliances, setAppliances] = useState<ApplianceDraft[]>([])

  // 4. 패키지
  const [packageCode, setPackageCode] = useState(PACKAGE_UNDECIDED)
  const [packageTouched, setPackageTouched] = useState(false)

  // 5. 연락처
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [region, setRegion] = useState('')
  const [channel, setChannel] = useState('')
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)
  const [company, setCompany] = useState('') // 봇 유인용 숨김 필드

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [uploadNote, setUploadNote] = useState('')

  const recommended = useMemo(() => recommendPackage(interests), [interests])
  const wantsCurtain = interests.includes('CURTAIN')
  const selectedStage = BUILD_STAGES.find((s) => s.code === buildStage)

  // /contact?package=STANDARD 로 들어오면 그 패키지를 고른 상태로 시작한다
  useEffect(() => {
    const requested = params.get('package')
    if (requested && findPackage(requested)) {
      setPackageCode(requested)
      setPackageTouched(true)
    }
  }, [params])

  // 직접 고르기 전까지는 추천을 따라간다. 한 번이라도 손대면 그 선택을 존중한다.
  useEffect(() => {
    if (!packageTouched) {
      setPackageCode(recommended ? recommended.code : PACKAGE_UNDECIDED)
    }
  }, [recommended, packageTouched])

  // 커튼을 뺐으면 창 수도 지운다
  useEffect(() => {
    if (!wantsCurtain) setWindowCount('')
  }, [wantsCurtain])

  function toggle(list: string[], set: (next: string[]) => void, code: string) {
    set(list.includes(code) ? list.filter((c) => c !== code) : [...list, code])
  }

  /**
   * 사진은 접수가 끝난 뒤에 올린다. 신청 자체가 사진 때문에 막히면 안 되기 때문이다.
   * 업로드가 실패해도 접수는 유효하고, 실패했다는 사실만 화면에 알린다.
   */
  async function uploadPhotos(res: CreateResponse): Promise<string> {
    if (!res.id || !res.uploadToken) return ''
    const withPhotos = appliances.filter((d) => d.photos.length > 0)
    if (withPhotos.length === 0) return ''

    let stored = 0
    let failed = 0
    for (let i = 0; i < appliances.length; i++) {
      const draft = appliances[i]
      if (draft.photos.length === 0) continue
      const form = new FormData()
      for (const p of draft.photos) form.append('files', p.file, p.file.name)
      const applianceId = res.applianceIds?.[String(i)]
      const query = new URLSearchParams({ token: res.uploadToken })
      if (applianceId) query.set('applianceId', String(applianceId))
      try {
        const up = await api<UploadResponse>(`/api/inquiries/${res.id}/photos?${query}`, {
          method: 'POST',
          body: form,
        })
        stored += up.stored
        failed += up.rejected
      } catch {
        failed += draft.photos.length
      }
    }
    if (stored === 0) return '사진은 첨부되지 않았습니다. 상담 때 다시 받겠습니다.'
    return failed > 0
      ? `사진 ${stored}장이 함께 접수되었습니다. ${failed}장은 형식·용량 때문에 제외했습니다.`
      : `사진 ${stored}장이 함께 접수되었습니다.`
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api<CreateResponse>('/api/inquiries', {
        method: 'POST',
        json: {
          name,
          phone,
          email: email || null,
          region: region || null,
          areaPyeong: null,
          homeType: homeType || null,
          roomCount: roomCount || null,
          buildStage: buildStage || null,
          interests,
          windowCount: windowCount || null,
          appliances: appliances.map((d) => ({
            kind: d.kind,
            brand: d.brand || null,
            modelName: d.modelName || null,
            purchased: d.purchased || null,
            note: null,
          })),
          packageCode,
          moveIn: moveIn || null,
          channel: channel || null,
          message: message || null,
          agree,
          company,
        },
      })
      setUploadNote(await uploadPhotos(res))
      setDone(res.message)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section className="flow contact">
        <div className="contact-card done">
          <p className="kicker">상담 신청</p>
          <h2>접수되었습니다</h2>
          <p className="contact-sub">{done}</p>
          {uploadNote ? <p className="contact-sub">{uploadNote}</p> : null}
          <p className="contact-sub">
            골라 주신 항목을 먼저 보고, 지금 집에서 가능한 범위와 예상 비용을 정리해 연락드립니다. 공사 일정이 이미
            잡혀 있다면 전기공사 전이 가장 좋은 시점입니다.
          </p>
          <p className="pkg-cta">
            <Link to="/packages" className="btn btn-outline dark">
              패키지 다시 보기
            </Link>
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flow contact">
      <div className="flow-head">
        <p className="kicker">상담 신청</p>
        <h2>어떤 집인지, 무엇이 불편한지만 알려 주세요</h2>
        <p>
          기기 이름을 몰라도 됩니다. 아래에서 고르시면 어떤 구성이 맞는지 저희가 정리해 드립니다. 다 채우지 않으셔도
          접수됩니다. <b>연락처만 있으면 충분합니다.</b>
        </p>
      </div>

      <form className="contact-card form wizard" onSubmit={onSubmit}>
        {error ? <p className="alert err">{error}</p> : null}

        {/* 1 ─────────────────────────────────────────────── */}
        <fieldset className="fstep">
          <legend>
            <b>1</b> 어떤 집인가요
          </legend>

          <div className="q">
            <p className="q-label">주거 형태</p>
            <ChipRadio name="homeType" options={HOME_TYPES} value={homeType} onChange={setHomeType} />
          </div>

          <div className="q">
            <p className="q-label">
              방 개수 <small>거실 · 주방은 빼고 세어 주세요</small>
            </p>
            <ChipRadio name="roomCount" options={ROOM_COUNTS} value={roomCount} onChange={setRoomCount} />
          </div>

          <div className="q">
            <p className="q-label">지금 상태</p>
            <ChipRadio name="buildStage" options={BUILD_STAGES} value={buildStage} onChange={setBuildStage} />
            {selectedStage?.note ? <p className="q-hint">{selectedStage.note}</p> : null}
          </div>

          <label className="field">
            입주 · 공사 예정 시기 <small>예: 2026년 11월 (모르시면 비워 두세요)</small>
            <input value={moveIn} onChange={(e) => setMoveIn(e.target.value)} maxLength={40} />
          </label>
        </fieldset>

        {/* 2 ─────────────────────────────────────────────── */}
        <fieldset className="fstep">
          <legend>
            <b>2</b> 무엇을 바꾸고 싶으세요
          </legend>
          <p className="fstep-sub">여러 개 고르셔도 됩니다. 고르시면 아래에서 맞는 패키지를 알려 드립니다.</p>

          {INTEREST_GROUPS.map((group) => (
            <div key={group.key} className="q">
              <p className="q-label">
                {group.title} <small>{group.hint}</small>
              </p>
              <div className="want-grid">
                {group.items.map((item) => {
                  const on = interests.includes(item.code)
                  return (
                    <label key={item.code} className={on ? 'want on' : 'want'}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(interests, setInterests, item.code)}
                      />
                      <span className="want-body">
                        <b>{item.label}</b>
                        <em>{item.note}</em>
                      </span>
                      <span className="want-from">{item.from} 부터</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {wantsCurtain ? (
            <div className="q q-follow">
              <p className="q-label">
                커튼 · 블라인드를 달 창은 몇 개인가요 <small>창 개수가 비용을 가장 많이 좌우합니다</small>
              </p>
              <ChipRadio
                name="windowCount"
                options={WINDOW_COUNTS}
                value={windowCount}
                onChange={setWindowCount}
              />
            </div>
          ) : null}
        </fieldset>

        {/* 3 ─────────────────────────────────────────────── */}
        <fieldset className="fstep">
          <legend>
            <b>3</b> 지금 쓰는 가전
          </legend>
          <ApplianceStep
            drafts={appliances}
            onChange={setAppliances}
            totalPhotoRoom={MAX_PHOTOS_PER_INQUIRY}
          />
        </fieldset>

        {/* 4 ─────────────────────────────────────────────── */}
        <fieldset className="fstep">
          <legend>
            <b>4</b> 패키지
          </legend>

          {recommended ? (
            <p className="reco">
              고르신 항목이면 <b>{findPackage(recommended.code)?.name}</b> 부터 가능합니다.
              <span>
                {recommended.because.map((i) => i.label).join(' · ')} 때문입니다. 바꾸셔도 되고, 상담에서 다시
                맞춰 드립니다.
              </span>
            </p>
          ) : (
            <p className="fstep-sub">2번에서 항목을 고르시면 맞는 패키지를 알려 드립니다. 그냥 두셔도 됩니다.</p>
          )}

          <div className="pick-grid">
            <label className={packageCode === PACKAGE_UNDECIDED ? 'pick on' : 'pick'}>
              <input
                type="radio"
                name="packageCode"
                checked={packageCode === PACKAGE_UNDECIDED}
                onChange={() => {
                  setPackageCode(PACKAGE_UNDECIDED)
                  setPackageTouched(true)
                }}
              />
              <span className="pick-head">
                <b>추천받을게요</b>
              </span>
              <span className="pick-sub">고른 항목과 집 상태를 보고 저희가 구성을 짜 드립니다.</span>
            </label>

            {PACKAGES.map((p) => {
              const on = packageCode === p.code
              const isReco = recommended?.code === p.code
              return (
                <label key={p.code} className={on ? 'pick on' : 'pick'}>
                  <input
                    type="radio"
                    name="packageCode"
                    checked={on}
                    onChange={() => {
                      setPackageCode(p.code)
                      setPackageTouched(true)
                    }}
                  />
                  {isReco ? <span className="pick-flag">추천</span> : null}
                  <span className="pick-head">
                    <b>{p.name}</b>
                    <i>{priceLabel(p.price)}</i>
                  </span>
                  <span className="pick-sub">{p.tagline}</span>
                  <span className="pick-note">시공비 별도 {priceLabel(p.installFee)}</span>
                </label>
              )
            })}
          </div>
          <p className="q-hint">
            금액은 설계 · 기기 · 프로그램 설치를 포함한 저희 청구액입니다(부가세 포함). 벽을 여는 시공비는 인테리어
            업체 견적에 따로 들어갑니다. <Link to="/packages">구성 자세히 보기</Link>
          </p>
        </fieldset>

        {/* 5 ─────────────────────────────────────────────── */}
        <fieldset className="fstep">
          <legend>
            <b>5</b> 연락받으실 곳
          </legend>

          <div className="field-row">
            <label className="field">
              성함
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={50}
                autoComplete="name"
              />
            </label>
            <label className="field">
              연락처
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="010-0000-0000"
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
          </div>

          <label className="field">
            이메일 <small>접수 확인 메일을 받으실 주소 (선택)</small>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              autoComplete="email"
            />
          </label>

          <div className="field-row">
            <label className="field">
              지역 <small>예: 수원 영통</small>
              <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} />
            </label>
            <label className="field">
              알게 된 경로 <small>인테리어 업체명 등 (선택)</small>
              <input value={channel} onChange={(e) => setChannel(e.target.value)} maxLength={80} />
            </label>
          </div>

          <label className="field">
            더 하고 싶은 말 <small>위에서 못 고른 것, 걱정되는 점 (선택)</small>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="10년 된 LG 에어컨이 있는데 앱 등록이 안 됩니다. 이것도 묶을 수 있을까요?"
            />
          </label>

          {/* 봇 유인용. 사람 눈에 보이지 않고 탭 이동으로도 닿지 않는다 */}
          <div className="hp" aria-hidden="true">
            <label>
              회사명
              <input value={company} onChange={(e) => setCompany(e.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            <span>
              상담 회신을 위해 성함 · 연락처 · 이메일을 수집하는 데 동의합니다. 상담이 종료되면 파기하며, 다른 목적으로
              쓰지 않습니다.
            </span>
          </label>
        </fieldset>

        <Summary
          homeType={homeType}
          roomCount={roomCount}
          buildStage={buildStage}
          interests={interests}
          appliances={appliances}
          packageCode={packageCode}
        />

        <button type="submit" className="btn btn-block" disabled={busy || !agree}>
          {busy ? '보내는 중…' : '상담 신청하기'}
        </button>
      </form>
    </section>
  )
}

/* ── 제출 직전 요약 ───────────────────────────────────────────── */

function labelOf(list: Choice[], code: string): string | null {
  return list.find((c) => c.code === code)?.label ?? null
}

function Summary({
  homeType,
  roomCount,
  buildStage,
  interests,
  appliances,
  packageCode,
}: {
  homeType: string
  roomCount: string
  buildStage: string
  interests: string[]
  appliances: ApplianceDraft[]
  packageCode: string
}) {
  const { findPackage } = useCatalog()
  const home = [labelOf(HOME_TYPES, homeType), labelOf(ROOM_COUNTS, roomCount), labelOf(BUILD_STAGES, buildStage)]
    .filter(Boolean)
    .join(' · ')
  const wants = interests.map((c) => findInterest(c)?.label).filter(Boolean).join(' · ')
  const owned = appliances
    .map((d) => {
      const label = findKind(d.kind)?.label ?? d.kind
      return d.modelName ? `${label}(${d.modelName})` : label
    })
    .join(' · ')
  const shots = appliances.reduce((n, d) => n + d.photos.length, 0)
  const pkg = packageCode === PACKAGE_UNDECIDED ? '추천받기' : (findPackage(packageCode)?.name ?? '추천받기')

  if (!home && !wants && !owned) return null

  return (
    <div className="pick-summary">
      <p className="q-label">이렇게 보내집니다</p>
      <dl>
        {home ? (
          <div>
            <dt>집</dt>
            <dd>{home}</dd>
          </div>
        ) : null}
        {wants ? (
          <div>
            <dt>원하시는 것</dt>
            <dd>{wants}</dd>
          </div>
        ) : null}
        {owned ? (
          <div>
            <dt>쓰시는 가전</dt>
            <dd>
              {owned}
              {shots > 0 ? ` · 사진 ${shots}장` : ''}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>패키지</dt>
          <dd>{pkg}</dd>
        </div>
      </dl>
    </div>
  )
}
