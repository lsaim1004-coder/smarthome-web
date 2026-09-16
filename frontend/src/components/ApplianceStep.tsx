import { useEffect, useRef } from 'react'
import {
  APPLIANCE_KINDS,
  BRANDS,
  MAX_PHOTOS_PER_APPLIANCE,
  MAX_PHOTO_BYTES,
  PURCHASED,
  findKind,
} from '../data/inquiryOptions'

/**
 * 보유 가전 입력.
 *
 * 신청자가 아는 만큼만 적으면 된다 — 종류만 골라도 접수된다.
 * 모델명을 모르면 <b>라벨이 보이는 사진</b>을 받는다. 모델명만 읽히면 앱 연동이 되는 기종인지
 * 바로 가려지기 때문에, 사진 안내는 "가전 전체"가 아니라 "모델명 스티커"를 찍도록 유도한다.
 */

export type PickedPhoto = { file: File; url: string }

export type ApplianceDraft = {
  /** 로컬 식별자. 제출 시 배열 순번이 서버의 가전 id 와 짝지어진다. */
  key: number
  kind: string
  brand: string
  modelName: string
  purchased: string
  photos: PickedPhoto[]
}

export function newDraft(kind: string, key: number): ApplianceDraft {
  return { key, kind, brand: '', modelName: '', purchased: '', photos: [] }
}

function Card({
  draft,
  onPatch,
  onRemove,
  roomLeft,
}: {
  draft: ApplianceDraft
  onPatch: (patch: Partial<ApplianceDraft>) => void
  onRemove: () => void
  roomLeft: number
}) {
  const kind = findKind(draft.kind)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = Math.min(MAX_PHOTOS_PER_APPLIANCE - draft.photos.length, roomLeft)
    const picked: PickedPhoto[] = []
    for (const file of Array.from(list)) {
      if (picked.length >= room) break
      if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_BYTES) continue
      picked.push({ file, url: URL.createObjectURL(file) })
    }
    if (picked.length > 0) onPatch({ photos: [...draft.photos, ...picked] })
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url)
    onPatch({ photos: draft.photos.filter((p) => p.url !== url) })
  }

  const full = draft.photos.length >= MAX_PHOTOS_PER_APPLIANCE || roomLeft <= 0

  return (
    <article className="appl">
      <header className="appl-head">
        <h4>{kind?.label ?? draft.kind}</h4>
        <button type="button" className="appl-del" onClick={onRemove} aria-label="이 가전 지우기">
          지우기
        </button>
      </header>

      <div className="appl-row">
        <label className="field">
          브랜드
          <select value={draft.brand} onChange={(e) => onPatch({ brand: e.target.value })}>
            <option value="">고르지 않음</option>
            {BRANDS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          모델명 <small>라벨에 적힌 그대로 (모르면 비워 두세요)</small>
          <input
            value={draft.modelName}
            onChange={(e) => onPatch({ modelName: e.target.value })}
            maxLength={120}
            placeholder="예: RF85C90D1AP"
          />
        </label>
      </div>

      <div className="q">
        <p className="q-label">
          구매 시기 <small>대략이면 됩니다</small>
        </p>
        <div className="chip-set">
          {PURCHASED.map((o) => (
            <label key={o.code} className={draft.purchased === o.code ? 'chip-opt on' : 'chip-opt'}>
              <input
                type="radio"
                name={`purchased-${draft.key}`}
                checked={draft.purchased === o.code}
                onChange={() => onPatch({ purchased: o.code })}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="appl-photo">
        <p className="q-label">
          사진 <small>모델명이 보이게 한 장이면 충분합니다</small>
        </p>
        <p className="appl-spot">
          <b>라벨 위치</b> {kind?.labelSpot}
        </p>

        {draft.photos.length > 0 ? (
          <ul className="shots">
            {draft.photos.map((p) => (
              <li key={p.url}>
                <img src={p.url} alt={p.file.name} />
                <button type="button" onClick={() => removePhoto(p.url)} aria-label="사진 빼기">
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          className="btn btn-outline dark btn-sm"
          disabled={full}
          onClick={() => fileRef.current?.click()}
        >
          {full ? '더 올릴 수 없습니다' : draft.photos.length > 0 ? '사진 더 고르기' : '사진 고르기'}
        </button>
      </div>
    </article>
  )
}

export default function ApplianceStep({
  drafts,
  onChange,
  totalPhotoRoom,
}: {
  drafts: ApplianceDraft[]
  onChange: (next: ApplianceDraft[]) => void
  totalPhotoRoom: number
}) {
  // 화면을 떠날 때 미리보기 URL 을 돌려준다
  useEffect(() => {
    return () => {
      for (const d of drafts) for (const p of d.photos) URL.revokeObjectURL(p.url)
    }
    // 언마운트 시 한 번만 정리한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function add(kind: string) {
    const key = drafts.reduce((max, d) => Math.max(max, d.key), 0) + 1
    onChange([...drafts, newDraft(kind, key)])
  }

  function patch(key: number, p: Partial<ApplianceDraft>) {
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...p } : d)))
  }

  function remove(key: number) {
    const target = drafts.find((d) => d.key === key)
    if (target) for (const p of target.photos) URL.revokeObjectURL(p.url)
    onChange(drafts.filter((d) => d.key !== key))
  }

  const used = drafts.reduce((n, d) => n + d.photos.length, 0)
  const core = APPLIANCE_KINDS.filter((k) => k.core)
  const extra = APPLIANCE_KINDS.filter((k) => !k.core)

  function countOf(code: string) {
    return drafts.filter((d) => d.kind === code).length
  }

  return (
    <>
      <p className="fstep-sub">
        갖고 계신 가전을 눌러 추가해 주세요. 같은 종류가 여러 대면 여러 번 누르시면 됩니다. 종류만 골라도 접수됩니다.
      </p>

      <div className="q">
        <p className="q-label">거의 모든 집에 있는 것</p>
        <div className="chip-set">
          {core.map((k) => (
            <button key={k.code} type="button" className="chip-add" onClick={() => add(k.code)}>
              {k.label}
              {countOf(k.code) > 0 ? <em>{countOf(k.code)}</em> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="q">
        <p className="q-label">그 밖에</p>
        <div className="chip-set">
          {extra.map((k) => (
            <button key={k.code} type="button" className="chip-add" onClick={() => add(k.code)}>
              {k.label}
              {countOf(k.code) > 0 ? <em>{countOf(k.code)}</em> : null}
            </button>
          ))}
        </div>
      </div>

      <p className="shot-guide">
        <b>사진은 모델명이 보이게 찍어 주세요.</b> 가전 전체를 찍은 사진보다, 옆면이나 문 안쪽에 붙은{' '}
        <b>모델명 스티커를 가까이서 찍은 한 장</b>이 훨씬 쓸모 있습니다. 모델명만 읽히면 앱으로 바로 묶이는
        기종인지, 리모컨 허브가 필요한 구형인지 그 자리에서 가려집니다. 사진은 상담에만 쓰고 상담이 끝나면
        지웁니다.
      </p>

      {drafts.length === 0 ? (
        <p className="q-hint">아직 고르신 가전이 없습니다. 위에서 눌러 추가해 주세요.</p>
      ) : (
        <div className="appl-list">
          {drafts.map((d) => (
            <Card
              key={d.key}
              draft={d}
              onPatch={(p) => patch(d.key, p)}
              onRemove={() => remove(d.key)}
              roomLeft={totalPhotoRoom - used + d.photos.length}
            />
          ))}
        </div>
      )}

      {used > 0 ? (
        <p className="q-hint">
          사진 {used}장 선택됨 (신청당 {totalPhotoRoom}장까지)
        </p>
      ) : null}
    </>
  )
}
