import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { BRANDS, ERAS, IOT_STATUSES, PURCHASED, findKind, labelFor } from '../data/inquiryOptions'

/**
 * 관리자용 보유 가전 패널.
 *
 * 신청자가 적어 준 종류·모델명·구매 시기와 올린 사진을 보여 주고, 판정을 채워 넣는다.
 * 사진에서 모델명을 읽어 여기에 적으면 그 행이 곧 IoT 연동 후보 목록의 한 줄이 된다.
 */

export type AdminPhoto = {
  id: number
  inquiryId: number
  applianceId: number | null
  originalName: string | null
  contentType: string
  sizeBytes: number
  createdAt: string | null
}

export type AdminAppliance = {
  id: number
  inquiryId: number
  kind: string
  brand: string | null
  modelName: string | null
  purchased: string | null
  note: string | null
  detectedModel: string | null
  era: string | null
  iotStatus: string | null
  analysisNote: string | null
  analyzedAt: string | null
  createdAt: string | null
  photos: AdminPhoto[]
}

export function iotLabel(code: string | null): string {
  return labelFor(code, IOT_STATUSES) ?? '미판정'
}

export function ApplianceCard({
  item,
  onSaved,
  showOwner,
}: {
  item: AdminAppliance
  onSaved: (next: AdminAppliance) => void
  showOwner?: string
}) {
  const [detectedModel, setDetectedModel] = useState(item.detectedModel ?? '')
  const [era, setEra] = useState(item.era ?? '')
  const [iotStatus, setIotStatus] = useState(item.iotStatus ?? '')
  const [analysisNote, setAnalysisNote] = useState(item.analysisNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const kind = findKind(item.kind)
  const dirty =
    detectedModel !== (item.detectedModel ?? '') ||
    era !== (item.era ?? '') ||
    iotStatus !== (item.iotStatus ?? '') ||
    analysisNote !== (item.analysisNote ?? '')

  async function save() {
    setBusy(true)
    setError('')
    try {
      const next = await api<AdminAppliance>(`/api/admin/appliances/${item.id}`, {
        method: 'PATCH',
        json: {
          detectedModel: detectedModel || null,
          era: era || null,
          iotStatus: iotStatus || null,
          analysisNote: analysisNote || null,
        },
      })
      onSaved(next)
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={item.analyzedAt ? 'appl-admin done' : 'appl-admin'}>
      <header>
        <h4>
          {kind?.label ?? item.kind}
          {item.brand ? <span className="appl-brand">{labelFor(item.brand, BRANDS)}</span> : null}
        </h4>
        <span className={`iot-badge s-${item.iotStatus ?? 'NONE_SET'}`}>{iotLabel(item.iotStatus)}</span>
      </header>

      {showOwner ? <p className="appl-owner">{showOwner}</p> : null}

      <dl className="appl-said">
        <div>
          <dt>적어 주신 모델명</dt>
          <dd>{item.modelName ?? '-'}</dd>
        </div>
        <div>
          <dt>구매 시기</dt>
          <dd>{labelFor(item.purchased, PURCHASED) ?? '-'}</dd>
        </div>
      </dl>

      {item.photos.length > 0 ? (
        <ul className="shots admin">
          {item.photos.map((p) => (
            <li key={p.id}>
              <a href={`/api/admin/photos/${p.id}/file`} target="_blank" rel="noreferrer">
                <img src={`/api/admin/photos/${p.id}/file`} alt={p.originalName ?? '가전 사진'} loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="q-hint">사진 없음</p>
      )}

      <div className="appl-verdict">
        <label className="field">
          사진에서 읽은 모델명
          <input
            value={detectedModel}
            onChange={(e) => setDetectedModel(e.target.value)}
            maxLength={120}
            placeholder="라벨에서 읽은 그대로"
          />
        </label>

        <div className="field-row">
          <label className="field">
            연식
            <select value={era} onChange={(e) => setEra(e.target.value)}>
              <option value="">미정</option>
              {ERAS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            연동 경로
            <select value={iotStatus} onChange={(e) => setIotStatus(e.target.value)}>
              <option value="">미정</option>
              {IOT_STATUSES.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          판정 메모
          <textarea
            rows={2}
            value={analysisNote}
            onChange={(e) => setAnalysisNote(e.target.value)}
            maxLength={1000}
            placeholder="예: 2014년형, Wi-Fi 없음. Tapo H110 으로 IR 학습 필요"
          />
        </label>

        {error ? <p className="alert err">{error}</p> : null}
        <button type="button" className="btn btn-sm" onClick={() => void save()} disabled={busy || !dirty}>
          {busy ? '저장 중…' : saved && !dirty ? '저장됨' : '판정 저장'}
        </button>
      </div>
    </article>
  )
}

/** 상담 신청 한 건에 붙은 가전들. 펼칠 때 불러온다. */
export default function AppliancePanel({ inquiryId }: { inquiryId: number }) {
  const [items, setItems] = useState<AdminAppliance[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setItems(await api<AdminAppliance[]>(`/api/admin/inquiries/${inquiryId}/appliances`))
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [inquiryId])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <p className="alert err">{error}</p>
  if (items === null) return <p className="muted-line">가전 정보를 불러오는 중…</p>
  if (items.length === 0) return <p className="q-hint">적어 주신 가전이 없습니다.</p>

  return (
    <div className="appl-admin-list">
      {items.map((item) => (
        <ApplianceCard
          key={item.id}
          item={item}
          onSaved={(next) => setItems((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)))}
        />
      ))}
    </div>
  )
}
