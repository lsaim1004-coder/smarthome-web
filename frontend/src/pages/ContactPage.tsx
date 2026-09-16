import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import { PACKAGES, findPackage, priceLabel } from '../data/packages'

type CreateResponse = { ok: boolean; message: string }

export default function ContactPage() {
  const { user } = useAuth()
  const [params] = useSearchParams()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [region, setRegion] = useState('')
  const [packageCode, setPackageCode] = useState('UNDECIDED')
  const [moveIn, setMoveIn] = useState('')
  const [channel, setChannel] = useState('')
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)
  const [company, setCompany] = useState('') // 봇 유인용 숨김 필드
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // 로그인 상태면 이름·이메일을 채워 준다
  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || '')
      setEmail((prev) => prev || user.email)
    }
  }, [user])

  // /contact?package=STANDARD 로 들어오면 선택된 상태로 시작
  useEffect(() => {
    const requested = params.get('package')
    if (requested && findPackage(requested)) {
      setPackageCode(requested)
    }
  }, [params])

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
          packageCode,
          moveIn: moveIn || null,
          channel: channel || null,
          message: message || null,
          agree,
          company,
        },
      })
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
          <p className="contact-sub">
            공사 일정이 이미 잡혀 있다면 전기공사 전에 연락 주시는 편이 좋습니다. 그때가 스위치 · 센서 위치와
            통신선을 함께 설계할 수 있는 시점입니다.
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
        <h2>어떤 집인지 알려 주세요</h2>
        <p>
          방 구성과 공사 일정만 알려 주시면 가능한 구성과 예상 비용을 먼저 정리해 드립니다. 영업일 기준 1~2일 안에
          연락드립니다.
        </p>
      </div>

      <form className="contact-card form" onSubmit={onSubmit}>
        {error ? <p className="alert err">{error}</p> : null}

        <div className="field-row">
          <label className="field">
            성함
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} autoComplete="name" />
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
            지역 <small>예: 수원 영통 · 아파트</small>
            <input value={region} onChange={(e) => setRegion(e.target.value)} maxLength={60} />
          </label>
        </div>

        <label className="field">
          관심 패키지
          <select value={packageCode} onChange={(e) => setPackageCode(e.target.value)}>
            <option value="UNDECIDED">아직 정하지 못했습니다</option>
            {PACKAGES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} · {p.tagline} · {priceLabel(p.price)}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            입주 · 공사 예정 시기 <small>예: 2026년 11월</small>
            <input value={moveIn} onChange={(e) => setMoveIn(e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            알게 된 경로 <small>인테리어 업체명 등 (선택)</small>
            <input value={channel} onChange={(e) => setChannel(e.target.value)} maxLength={80} />
          </label>
        </div>

        <label className="field">
          문의 내용 <small>쓰시는 가전, 원하는 자동화, 궁금한 점</small>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="LG 에어컨과 로봇청소기를 쓰고 있는데 같이 묶을 수 있는지 궁금합니다."
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

        <button type="submit" className="btn btn-block" disabled={busy || !agree}>
          {busy ? '보내는 중…' : '상담 신청하기'}
        </button>
      </form>
    </section>
  )
}
