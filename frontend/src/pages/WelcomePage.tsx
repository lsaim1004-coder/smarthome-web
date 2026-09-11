import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type Welcome = {
  service: string
  message: string
  serverTime: string
  backend: { framework: string; java: string; hostname: string; startedAt: string; uptimeSeconds: number }
  database: { status: 'UP' | 'DOWN'; engine: string; version: string | null; visits: number; error: string | null }
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ok'; data: Welcome; fetchedAt: Date }
  | { phase: 'error'; message: string }

type Status = 'UP' | 'DOWN' | 'CHECKING'

function formatUptime(total: number): string {
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}일 ${h}시간 ${m}분`
  if (h > 0) return `${h}시간 ${m}분`
  if (m > 0) return `${m}분 ${s}초`
  return `${s}초`
}

export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
}

type CardProps = {
  step: number
  title: string
  subtitle: string
  status: Status
  rows: Array<[string, string]>
  note?: string | null
}

function StackCard({ step, title, subtitle, status, rows, note }: CardProps) {
  const label = status === 'UP' ? '정상' : status === 'DOWN' ? '연결 안 됨' : '확인 중'
  return (
    <li className={`card status-${status.toLowerCase()}`}>
      <div className="card-head">
        <span className="step">{step}</span>
        <div>
          <h3>{title}</h3>
          <p className="subtitle">{subtitle}</p>
        </div>
        <span className="state">
          <span className="dot" />
          {label}
        </span>
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="note">{note}</p> : null}
    </li>
  )
}

export default function WelcomePage() {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const { user, loading: authLoading } = useAuth()

  const load = useCallback(async () => {
    setState((s) => (s.phase === 'ok' ? s : { phase: 'loading' }))
    try {
      const res = await fetch('/api/welcome', { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`백엔드 응답 코드 ${res.status}`)
      const data = (await res.json()) as Welcome
      setState({ phase: 'ok', data, fetchedAt: new Date() })
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const data = state.phase === 'ok' ? state.data : null
  const backendStatus: Status = state.phase === 'loading' ? 'CHECKING' : state.phase === 'ok' ? 'UP' : 'DOWN'
  const dbStatus: Status = state.phase === 'loading' ? 'CHECKING' : data?.database.status === 'UP' ? 'UP' : 'DOWN'
  const allUp = backendStatus === 'UP' && dbStatus === 'UP'

  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          <span className={`pulse ${allUp ? 'ok' : ''}`} />
          {data?.service ?? 'Smart Home Option Service'}
        </p>
        <h1>{data?.message ?? '입주하는 날, 스마트홈이 완성되어 있습니다.'}</h1>
        <p className="lead">
          인테리어 + 네트워크 + IoT + 자동화를 한 번에. 지금은 서비스 준비를 위한 웰컴 페이지로, 프론트엔드부터
          데이터베이스까지 연결 상태를 보여줍니다.
        </p>
        {authLoading ? null : user ? (
          <p className="hero-actions">
            <span className="hero-greet">{user.name || user.email} 님, 반갑습니다.</span>
            <Link to="/me" className="btn btn-outline">
              내 정보
            </Link>
          </p>
        ) : (
          <p className="hero-actions">
            <Link to="/register" className="btn">
              회원가입
            </Link>
            <Link to="/login" className="btn btn-outline">
              로그인
            </Link>
          </p>
        )}
      </section>

      <section className="stack" aria-labelledby="stack-title">
        <div className="stack-head">
          <h2 id="stack-title">연결 상태</h2>
          <button type="button" className="btn" onClick={() => void load()} disabled={state.phase === 'loading'}>
            {state.phase === 'loading' ? '확인 중…' : '다시 확인'}
          </button>
        </div>

        <ol className="chain">
          <StackCard
            step={1}
            title="Frontend"
            subtitle="React 18 · TypeScript · Vite"
            status="UP"
            rows={[
              ['서빙', 'nginx 1.27 (Docker)'],
              ['빌드 모드', import.meta.env.MODE],
              ['화면 폭', typeof window !== 'undefined' ? `${window.innerWidth}px` : '-'],
            ]}
          />
          <StackCard
            step={2}
            title="Backend"
            subtitle={data?.backend.framework ?? 'Spring Boot'}
            status={backendStatus}
            rows={
              data
                ? [
                    ['런타임', data.backend.java],
                    ['컨테이너', data.backend.hostname],
                    ['가동 시간', formatUptime(data.backend.uptimeSeconds)],
                    ['서버 시각', formatTime(data.serverTime)],
                  ]
                : [['경로', '/api/welcome']]
            }
            note={state.phase === 'error' ? state.message : null}
          />
          <StackCard
            step={3}
            title="Database"
            subtitle={data?.database.engine ?? 'PostgreSQL'}
            status={dbStatus}
            rows={
              data && data.database.status === 'UP'
                ? [
                    ['버전', data.database.version ?? '-'],
                    ['방문 카운터', `${data.database.visits.toLocaleString('ko-KR')} 회`],
                  ]
                : [['상태', data?.database.status ?? '-']]
            }
            note={data?.database.error ?? null}
          />
        </ol>

        <p className="meta">
          {state.phase === 'ok'
            ? `마지막 확인 ${formatTime(state.fetchedAt)} · 방문 카운터는 페이지를 열 때마다 DB에서 1씩 증가합니다.`
            : state.phase === 'error'
              ? '백엔드에 연결할 수 없습니다. 컨테이너 상태를 확인해 주세요.'
              : '백엔드에 연결하는 중입니다.'}
        </p>
      </section>
    </>
  )
}
