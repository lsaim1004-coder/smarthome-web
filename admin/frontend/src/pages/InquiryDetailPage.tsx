import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import { api, errorMessage, stamp } from '../api'
import { useAuth } from '../auth/AuthContext'
import {
  ANALYSIS_SOURCES,
  APPLIANCE_KINDS,
  BRANDS,
  BUILD_STAGES,
  ERAS,
  HOME_TYPES,
  INTERESTS,
  IOT_COLORS,
  IOT_STATUSES,
  PURCHASED,
  ROOM_COUNTS,
  STATUS_COLORS,
  STATUS_LABELS,
  WINDOW_COUNTS,
  labelList,
  labelOf,
} from '../data/labels'
import type { Appliance, Catalog, InquiryDetail, Partner } from '../data/types'

/**
 * 신청 한 건.
 *
 * 전화로 들은 내용을 그 자리에서 고칠 수 있어야 해서 거의 모든 칸이 편집 가능하다.
 * 아래쪽 가전 목록은 자동판별 결과이고, 틀리면 사람이 덮어쓴다.
 */
export default function InquiryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { owner } = useAuth()

  const [data, setData] = useState<InquiryDetail | null>(null)
  const [partners, setPartners] = useState<Partner[]>([])
  const [packages, setPackages] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [form, setForm] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<string[]>([])

  const load = useCallback(() => {
    api<InquiryDetail>(`/api/admin/inquiries/${id}`)
      .then((d) => {
        setData(d)
        const i = d.inquiry
        setForm({
          name: i.name ?? '',
          phone: i.phone ?? '',
          email: i.email ?? '',
          region: i.region ?? '',
          homeType: i.homeType ?? '',
          roomCount: i.roomCount ?? '',
          buildStage: i.buildStage ?? '',
          windowCount: i.windowCount ?? '',
          packageCode: i.packageCode ?? '',
          moveIn: i.moveIn ?? '',
          channel: i.channel ?? '',
          message: i.message ?? '',
          status: i.status ?? 'NEW',
          memo: i.memo ?? '',
          partnerId: i.partnerId ? String(i.partnerId) : '',
        })
        setPicked((i.interests ?? '').split(',').map((s) => s.trim()).filter(Boolean))
        setError(null)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  useEffect(load, [load])

  useEffect(() => {
    api<Partner[]>('/api/admin/partners').then(setPartners).catch(() => setPartners([]))
    api<Catalog>('/api/admin/catalog')
      .then((c) => setPackages(c.packages.map((p) => p.code)))
      .catch(() => setPackages([]))
  }, [])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleInterest(code: string) {
    setPicked((list) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]))
  }

  async function save() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      // 빈 칸은 "안 바꿈"이 아니라 "비움"으로 보이면 곤란하다.
      // 백엔드가 null 을 "안 바꿈"으로 보므로, 비운 칸은 공백 한 칸 대신 그대로 둔다.
      const body: Record<string, unknown> = {
        status: form.status || null,
        memo: form.memo || null,
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
        region: form.region || null,
        homeType: form.homeType || null,
        roomCount: form.roomCount || null,
        buildStage: form.buildStage || null,
        windowCount: form.windowCount || null,
        packageCode: form.packageCode || null,
        moveIn: form.moveIn || null,
        channel: form.channel || null,
        message: form.message || null,
        interests: picked,
      }
      if (owner) {
        // 담당을 떼려면 0 을 보낸다 (null 은 "안 바꿈").
        body.partnerId = form.partnerId ? Number(form.partnerId) : 0
      }
      await api(`/api/admin/inquiries/${id}`, { method: 'PATCH', json: body })
      setNotice('저장했습니다.')
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function purgePhotos() {
    if (!confirm('이 신청에 올라온 사진 원본을 모두 지웁니다. 되돌릴 수 없습니다.')) return
    setBusy(true)
    try {
      const res = await api<{ removed: number }>(`/api/admin/inquiries/${id}/photos`, { method: 'DELETE' })
      setNotice(`사진 ${res.removed}장을 지웠습니다.`)
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeInquiry() {
    if (!confirm('이 신청을 지웁니다. 사진과 가전 기록도 함께 사라집니다.')) return
    setBusy(true)
    try {
      await api(`/api/admin/inquiries/${id}`, { method: 'DELETE' })
      navigate('/inquiries')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  if (error && !data) return <CAlert color="danger">{error}</CAlert>
  if (!data) return <CSpinner color="primary" />

  const i = data.inquiry

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h1 className="h4 mb-0">
          #{i.id} {i.name}
          <CBadge color={STATUS_COLORS[i.status] ?? 'secondary'} className="ms-2">
            {labelOf(STATUS_LABELS, i.status)}
          </CBadge>
        </h1>
        <div className="d-flex gap-2">
          <CButton color="secondary" variant="outline" onClick={() => navigate('/inquiries')}>
            목록
          </CButton>
          <CButton color="primary" onClick={() => void save()} disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </CButton>
        </div>
      </div>

      {error ? <CAlert color="danger">{error}</CAlert> : null}
      {notice ? <CAlert color="success">{notice}</CAlert> : null}

      <CRow className="g-3">
        <CCol xs={12} lg={7}>
          <CCard className="mb-3">
            <CCardHeader>신청자</CCardHeader>
            <CCardBody>
              <CRow className="g-3">
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">성함</label>
                  <CFormInput value={form.name} onChange={(e) => set('name', e.target.value)} />
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">연락처</label>
                  <CFormInput value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">이메일</label>
                  <CFormInput value={form.email} onChange={(e) => set('email', e.target.value)} />
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">지역</label>
                  <CFormInput value={form.region} onChange={(e) => set('region', e.target.value)} />
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>

          <CCard className="mb-3">
            <CCardHeader>집</CCardHeader>
            <CCardBody>
              <CRow className="g-3">
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">주거 형태</label>
                  <CFormSelect value={form.homeType} onChange={(e) => set('homeType', e.target.value)}>
                    <option value="">-</option>
                    {Object.entries(HOME_TYPES).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">방 개수</label>
                  <CFormSelect value={form.roomCount} onChange={(e) => set('roomCount', e.target.value)}>
                    <option value="">-</option>
                    {Object.entries(ROOM_COUNTS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">공사 상태</label>
                  <CFormSelect value={form.buildStage} onChange={(e) => set('buildStage', e.target.value)}>
                    <option value="">-</option>
                    {Object.entries(BUILD_STAGES).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">커튼 창 수</label>
                  <CFormSelect value={form.windowCount} onChange={(e) => set('windowCount', e.target.value)}>
                    <option value="">-</option>
                    {Object.entries(WINDOW_COUNTS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </CFormSelect>
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">입주·공사 예정</label>
                  <CFormInput value={form.moveIn} onChange={(e) => set('moveIn', e.target.value)} />
                </CCol>
                <CCol xs={12} sm={6}>
                  <label className="form-label small text-body-secondary">알게 된 경로</label>
                  <CFormInput value={form.channel} onChange={(e) => set('channel', e.target.value)} />
                </CCol>
              </CRow>
            </CCardBody>
          </CCard>

          <CCard className="mb-3">
            <CCardHeader>원하는 것</CCardHeader>
            <CCardBody>
              <div className="d-flex flex-wrap gap-3">
                {Object.entries(INTERESTS).map(([code, label]) => (
                  <CFormCheck
                    key={code}
                    id={`interest-${code}`}
                    label={label}
                    checked={picked.includes(code)}
                    onChange={() => toggleInterest(code)}
                  />
                ))}
              </div>
              <div className="mt-3">
                <label className="form-label small text-body-secondary">문의 내용</label>
                <CFormTextarea rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} />
              </div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xs={12} lg={5}>
          <CCard className="mb-3">
            <CCardHeader>진행</CCardHeader>
            <CCardBody>
              <label className="form-label small text-body-secondary">상태</label>
              <CFormSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </CFormSelect>

              <label className="form-label small text-body-secondary mt-3">관심 패키지</label>
              <CFormSelect value={form.packageCode} onChange={(e) => set('packageCode', e.target.value)}>
                <option value="">-</option>
                <option value="UNDECIDED">미정 / 추천받기</option>
                {packages.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </CFormSelect>

              <label className="form-label small text-body-secondary mt-3">담당 업체</label>
              <CFormSelect
                value={form.partnerId}
                onChange={(e) => set('partnerId', e.target.value)}
                disabled={!owner}
              >
                <option value="">배정 안 함</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </CFormSelect>
              {owner ? null : (
                <div className="form-text">담당 배정은 운영자만 바꿀 수 있습니다.</div>
              )}

              <label className="form-label small text-body-secondary mt-3">내부 메모</label>
              <CFormTextarea rows={5} value={form.memo} onChange={(e) => set('memo', e.target.value)} />

              <dl className="row small mt-3 mb-0">
                <dt className="col-5 text-body-secondary">접수</dt>
                <dd className="col-7">{stamp(i.createdAt)}</dd>
                <dt className="col-5 text-body-secondary">마지막 수정</dt>
                <dd className="col-7">{stamp(i.updatedAt)}</dd>
                <dt className="col-5 text-body-secondary">보유 가전 브랜드</dt>
                <dd className="col-7">{labelList(BRANDS, i.brands)}</dd>
              </dl>
            </CCardBody>
          </CCard>

          <CCard className="mb-3">
            <CCardHeader>정리</CCardHeader>
            <CCardBody className="d-flex flex-column gap-2">
              <CButton color="warning" variant="outline" onClick={() => void purgePhotos()} disabled={busy}>
                사진 원본 모두 지우기
              </CButton>
              <div className="form-text">
                모델명을 읽어낸 뒤에는 사진을 들고 있을 이유가 없습니다. 자동판별이 끝나면 저절로 지워지고,
                남은 것이 있으면 여기서 지웁니다.
              </div>
              {owner ? (
                <>
                  <CButton color="danger" variant="outline" onClick={() => void removeInquiry()} disabled={busy}>
                    이 신청 지우기
                  </CButton>
                  <div className="form-text">신청·가전·사진 기록이 함께 사라집니다.</div>
                </>
              ) : null}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <h2 className="h5 mt-4 mb-3">보유 가전 {data.appliances.length}대</h2>
      {data.appliances.length === 0 ? (
        <CAlert color="secondary">적어 주신 가전이 없습니다.</CAlert>
      ) : (
        <CRow className="g-3">
          {data.appliances.map((a) => (
            <CCol xs={12} xl={6} key={a.id}>
              <ApplianceCard appliance={a} onSaved={load} />
            </CCol>
          ))}
        </CRow>
      )}
    </>
  )
}

/** 가전 한 대. 자동판별 결과를 보여 주고, 틀리면 그 자리에서 고친다. */
function ApplianceCard({ appliance, onSaved }: { appliance: Appliance; onSaved: () => void }) {
  const [detectedModel, setDetectedModel] = useState(appliance.detectedModel ?? '')
  const [era, setEra] = useState(appliance.era ?? '')
  const [iotStatus, setIotStatus] = useState(appliance.iotStatus ?? '')
  const [note, setNote] = useState(appliance.analysisNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await api(`/api/admin/appliances/${appliance.id}`, {
        method: 'PATCH',
        json: {
          detectedModel: detectedModel || null,
          era: era || null,
          iotStatus: iotStatus || null,
          analysisNote: note || null,
        },
      })
      onSaved()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const live = appliance.photos.filter((p) => !p.purgedAt)
  const gone = appliance.photos.filter((p) => p.purgedAt)

  return (
    <CCard className="h-100">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold">{labelOf(APPLIANCE_KINDS, appliance.kind)}</span>
        <span>
          {appliance.iotStatus ? (
            <CBadge color={IOT_COLORS[appliance.iotStatus] ?? 'secondary'}>
              {labelOf(IOT_STATUSES, appliance.iotStatus)}
            </CBadge>
          ) : (
            <CBadge color="light" textColor="dark">
              판별 대기
            </CBadge>
          )}
        </span>
      </CCardHeader>
      <CCardBody>
        {error ? <CAlert color="danger">{error}</CAlert> : null}

        <dl className="row small mb-3">
          <dt className="col-4 text-body-secondary">신청자 기재</dt>
          <dd className="col-8">
            {labelOf(BRANDS, appliance.brand)} {appliance.modelName || '(모델명 없음)'}
            <span className="text-body-secondary"> · {labelOf(PURCHASED, appliance.purchased)}</span>
          </dd>
          <dt className="col-4 text-body-secondary">판별 근거</dt>
          <dd className="col-8">
            {appliance.analysisSource ? labelOf(ANALYSIS_SOURCES, appliance.analysisSource) : '-'}
            {appliance.confidence != null ? (
              <span className="text-body-secondary"> · 확신도 {Math.round(appliance.confidence * 100)}%</span>
            ) : null}
            {appliance.analyzedAt ? (
              <span className="text-body-secondary"> · {stamp(appliance.analyzedAt)}</span>
            ) : null}
          </dd>
        </dl>

        {appliance.photos.length > 0 ? (
          <div className="shot-grid mb-3">
            {live.map((p) => (
              <a key={p.id} href={`/api/admin/photos/${p.id}/file`} target="_blank" rel="noreferrer">
                <img src={`/api/admin/photos/${p.id}/file`} alt={p.originalName ?? '가전 사진'} />
              </a>
            ))}
            {gone.map((p) => (
              <div key={p.id} className="shot-gone">
                판별 후 원본 삭제됨
                <br />
                {stamp(p.purgedAt)}
              </div>
            ))}
          </div>
        ) : null}

        <CRow className="g-2">
          <CCol xs={12}>
            <label className="form-label small text-body-secondary">확인된 모델명</label>
            <CFormInput value={detectedModel} onChange={(e) => setDetectedModel(e.target.value)} />
          </CCol>
          <CCol xs={6}>
            <label className="form-label small text-body-secondary">연식</label>
            <CFormSelect value={era} onChange={(e) => setEra(e.target.value)}>
              <option value="">-</option>
              {Object.entries(ERAS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol xs={6}>
            <label className="form-label small text-body-secondary">연동 가능성</label>
            <CFormSelect value={iotStatus} onChange={(e) => setIotStatus(e.target.value)}>
              <option value="">-</option>
              {Object.entries(IOT_STATUSES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol xs={12}>
            <label className="form-label small text-body-secondary">메모</label>
            <CFormTextarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </CCol>
        </CRow>

        <CButton color="primary" variant="outline" size="sm" className="mt-3" onClick={() => void save()} disabled={busy}>
          {busy ? '저장 중…' : '판별 저장'}
        </CButton>
      </CCardBody>
    </CCard>
  )
}
