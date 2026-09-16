import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import { ApplianceCard, type AdminAppliance } from '../components/AppliancePanel'
import { IOT_STATUSES } from '../data/inquiryOptions'

/**
 * IoT 연동 후보 목록.
 *
 * 신청자들이 올린 가전을 한자리에 모아 놓고 사진의 모델명을 읽어 판정한다.
 * 판정이 끝나면 "앱 연동" 과 "리모컨 허브" 가 곧 묶을 수 있는 후보군이고,
 * "연동 불가" 는 교체 제안 대상이다.
 */

type Candidate = {
  appliance: AdminAppliance
  inquiryName: string | null
  inquiryRegion: string | null
  inquiryStatus: string | null
}

type Tab = { key: string; label: string; query: string }

const TABS: Tab[] = [
  { key: 'pending', label: '판정 대기', query: 'pending=true' },
  { key: 'APP', label: '앱 연동', query: 'iotStatus=APP' },
  { key: 'IR', label: '리모컨 허브', query: 'iotStatus=IR' },
  { key: 'NONE', label: '연동 불가', query: 'iotStatus=NONE' },
  { key: 'UNKNOWN', label: '확인 필요', query: 'iotStatus=UNKNOWN' },
  { key: 'all', label: '판정 완료 전체', query: '' },
]

export default function AdminDevicesPage() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  const load = useCallback(async (key: string) => {
    setBusy(true)
    setError('')
    const found = TABS.find((t) => t.key === key)
    try {
      const query = found?.query ? `?${found.query}` : ''
      setItems(await api<Candidate[]>(`/api/admin/appliances${query}`))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && user) {
      void load(tab)
    } else if (!loading && !user) {
      setBusy(false)
    }
  }, [load, loading, tab, user])

  if (loading) return null

  if (!user) {
    return (
      <section className="flow">
        <div className="flow-head">
          <h2>로그인이 필요합니다</h2>
          <p>
            <Link to="/login?next=/admin/devices">로그인</Link> 후 다시 열어 주세요.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="flow admin">
      <div className="flow-head">
        <p className="kicker">관리</p>
        <h2>IoT 연동 후보 {items.length}대</h2>
        <p>
          신청자가 올린 가전입니다. 사진의 모델명을 읽어 연식과 연동 경로를 정하면 그대로 후보 목록이 됩니다.
          판정은 언제든 고칠 수 있습니다.
        </p>
      </div>

      <div className="filters">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? 'chip on' : 'chip'}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="alert err">{error}</p> : null}
      {busy ? <p className="muted-line">불러오는 중…</p> : null}
      {!busy && !error && items.length === 0 ? (
        <p className="muted-line">
          {tab === 'pending' ? '판정을 기다리는 가전이 없습니다.' : '해당하는 가전이 없습니다.'}
        </p>
      ) : null}

      <div className="appl-admin-list wide">
        {items.map((row) => (
          <ApplianceCard
            key={row.appliance.id}
            item={row.appliance}
            showOwner={[row.inquiryName, row.inquiryRegion].filter(Boolean).join(' · ') || undefined}
            onSaved={(next) =>
              setItems((prev) =>
                prev.map((x) => (x.appliance.id === next.id ? { ...x, appliance: next } : x)),
              )
            }
          />
        ))}
      </div>

      <p className="q-hint">
        판정 값은 {IOT_STATUSES.map((s) => s.label).join(' · ')} 입니다. 사진을 따로 분석해 채워 넣을 때는{' '}
        <code>PATCH /api/admin/appliances/&#123;id&#125;</code> 에 detectedModel · era · iotStatus ·
        analysisNote 를 보내면 됩니다.
      </p>
    </section>
  )
}
