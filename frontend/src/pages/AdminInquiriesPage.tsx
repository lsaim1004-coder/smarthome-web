import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import { findPackage, priceLabel } from '../data/packages'
import {
  ALL_INTERESTS,
  BRANDS,
  BUILD_STAGES,
  HOME_TYPES,
  ROOM_COUNTS,
  WINDOW_COUNTS,
  labelFor,
  labelsFor,
} from '../data/inquiryOptions'
import AppliancePanel from '../components/AppliancePanel'
import { formatTime } from './WelcomePage'

type Inquiry = {
  id: number
  name: string
  phone: string
  email: string | null
  region: string | null
  areaPyeong: number | null
  homeType: string | null
  roomCount: string | null
  buildStage: string | null
  interests: string | null
  windowCount: string | null
  brands: string | null
  packageCode: string | null
  moveIn: string | null
  channel: string | null
  message: string | null
  status: string
  memo: string | null
  userId: number | null
  createdAt: string | null
  updatedAt: string | null
}

type ListResponse = { items: Inquiry[]; total: number; statuses: string[] }

const STATUS_LABEL: Record<string, string> = {
  NEW: '접수',
  CONTACTED: '연락함',
  QUOTED: '견적발송',
  WON: '계약',
  LOST: '무산',
}

function packageText(code: string | null): string {
  const found = findPackage(code)
  if (!found) return '미정'
  return `${found.name} · ${priceLabel(found.price)}`
}

/** 집 정보 한 줄. 빈 값은 건너뛴다. */
function homeText(row: Inquiry): string {
  const parts = [
    labelFor(row.homeType, HOME_TYPES),
    labelFor(row.roomCount, ROOM_COUNTS),
    labelFor(row.buildStage, BUILD_STAGES),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '-'
}

/** 코드 묶음을 태그로 보여 준다. 없으면 아무것도 그리지 않는다. */
function TagRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="inq-tags">
      <dt>{label}</dt>
      <dd>
        {items.map((t) => (
          <span key={t} className="inq-tag">
            {t}
          </span>
        ))}
      </dd>
    </div>
  )
}

export default function AdminInquiriesPage() {
  const { user, loading } = useAuth()
  const [items, setItems] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [statuses, setStatuses] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [memoDraft, setMemoDraft] = useState<Record<number, string>>({})

  const load = useCallback(async (status: string) => {
    setBusy(true)
    setError('')
    try {
      const query = status ? `?status=${status}` : ''
      const res = await api<ListResponse>(`/api/admin/inquiries${query}`)
      setItems(res.items)
      setTotal(res.total)
      setStatuses(res.statuses)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && user) {
      void load(filter)
    } else if (!loading && !user) {
      setBusy(false)
    }
  }, [filter, load, loading, user])

  async function patch(id: number, body: { status?: string; memo?: string }) {
    try {
      const updated = await api<Inquiry>(`/api/admin/inquiries/${id}`, { method: 'PATCH', json: body })
      setItems((prev) => prev.map((row) => (row.id === id ? updated : row)))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  if (loading) return null

  if (!user) {
    return (
      <section className="flow">
        <div className="flow-head">
          <h2>로그인이 필요합니다</h2>
          <p>
            <Link to="/login?next=/admin/inquiries">로그인</Link> 후 다시 열어 주세요.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flow admin">
      <div className="flow-head">
        <p className="kicker">관리</p>
        <h2>상담 신청 {total}건</h2>
      </div>

      <div className="filters">
        <button type="button" className={filter === '' ? 'chip on' : 'chip'} onClick={() => setFilter('')}>
          전체
        </button>
        {(statuses.length ? statuses : Object.keys(STATUS_LABEL)).map((s) => (
          <button key={s} type="button" className={filter === s ? 'chip on' : 'chip'} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {error ? <p className="alert err">{error}</p> : null}
      {busy ? <p className="muted-line">불러오는 중…</p> : null}
      {!busy && !error && items.length === 0 ? <p className="muted-line">아직 신청이 없습니다.</p> : null}

      <div className="inq-list">
        {items.map((row) => (
          <article key={row.id} className="inq">
            <div className="inq-head">
              <div>
                <h3>
                  {row.name} <span className="inq-phone">{row.phone}</span>
                </h3>
                <p className="inq-meta">
                  #{row.id} · {row.createdAt ? formatTime(row.createdAt) : '-'}
                  {row.userId ? ' · 회원' : ''}
                </p>
              </div>
              <select
                className={`status-select s-${row.status}`}
                value={row.status}
                onChange={(e) => void patch(row.id, { status: e.target.value })}
              >
                {(statuses.length ? statuses : Object.keys(STATUS_LABEL)).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>
            </div>

            <dl className="inq-grid">
              <div>
                <dt>관심 패키지</dt>
                <dd>{packageText(row.packageCode)}</dd>
              </div>
              <div>
                <dt>집</dt>
                <dd>{homeText(row)}</dd>
              </div>
              <div>
                <dt>지역</dt>
                <dd>{row.region ?? '-'}</dd>
              </div>
              <div>
                <dt>예정 시기</dt>
                <dd>{row.moveIn ?? '-'}</dd>
              </div>
              <div>
                <dt>경로</dt>
                <dd>{row.channel ?? '-'}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{row.email ?? '-'}</dd>
              </div>
            </dl>

            <dl className="inq-taglist">
              <TagRow label="원하는 것" items={labelsFor(row.interests, ALL_INTERESTS)} />
              <TagRow
                label="커튼 창 수"
                items={row.windowCount ? [labelFor(row.windowCount, WINDOW_COUNTS) ?? ''] : []}
              />
              <TagRow label="가전 브랜드" items={labelsFor(row.brands, BRANDS)} />
            </dl>

            <details className="inq-appl">
              <summary>보유 가전 · 사진 보기</summary>
              <AppliancePanel inquiryId={row.id} />
            </details>

            {row.message ? <p className="inq-message">{row.message}</p> : null}

            <label className="field memo">
              메모
              <textarea
                rows={2}
                value={memoDraft[row.id] ?? row.memo ?? ''}
                onChange={(e) => setMemoDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                onBlur={(e) => {
                  const next = e.target.value
                  if (next !== (row.memo ?? '')) void patch(row.id, { memo: next })
                }}
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  )
}
