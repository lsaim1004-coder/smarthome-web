/** 관리자 API 응답 모양. 백엔드의 record 와 짝이 맞아야 한다. */

export type Inquiry = {
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
  partnerId: number | null
  partnerName: string | null
  createdAt: string
  updatedAt: string
}

export type Photo = {
  id: number
  inquiryId: number
  applianceId: number | null
  originalName: string | null
  contentType: string
  sizeBytes: number
  createdAt: string
  purgedAt: string | null
}

export type Appliance = {
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
  analysisSource: string | null
  confidence: number | null
  analyzedAt: string | null
  createdAt: string
  photos: Photo[]
}

export type InquiryList = {
  items: Inquiry[]
  total: number
  statuses: string[]
  counts: Record<string, number>
  canAssign: boolean
}

export type InquiryDetail = { inquiry: Inquiry; appliances: Appliance[] }

export type Candidate = {
  appliance: Appliance
  inquiryName: string
  inquiryRegion: string | null
  inquiryStatus: string
}

export type PackageRow = {
  code: string
  name: string
  tagline: string | null
  price: number
  installFee: number
  featured: boolean
  active: boolean
  sortOrder: number
  summary: string | null
  hours: string | null
  devices: string[]
  commissioning: string[]
  scenes: string[]
  updatedAt: string | null
  updatedBy: string | null
}

export type ComparisonRow = {
  id: number
  label: string
  /** 패키지 순서대로 한 칸씩. 숫자(개수)와 글자가 섞인다. 0 은 미포함. */
  values: (number | string)[]
  sortOrder: number
  active: boolean
}

export type ProductRow = {
  id: number
  kind: string
  brand: string
  model: string
  role: string | null
  link: string | null
  fromPackage: string | null
  note: string | null
  active: boolean
  sortOrder: number
}

export type Catalog = {
  packages: PackageRow[]
  comparison: ComparisonRow[]
  products: ProductRow[]
}

export type Partner = {
  id: number
  code: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  region: string | null
  memo: string | null
  active: boolean
  inquiryCount: number
  accountJoined: boolean
  createdAt: string
}

export type Account = {
  id: number
  email: string
  name: string | null
  admin: boolean
  role: string
  partnerId: number | null
  partnerName: string | null
  active: boolean
  emailVerifiedAt: string | null
  createdAt: string | null
  lastLoginAt: string | null
}

export type AuditRow = {
  id: number
  actor: string
  action: string
  target: string | null
  detail: string | null
  createdAt: string
}

// ---- 상담 준비 시트 (백엔드 RequirementDtos 와 짝) ----

export type Need = { item: string; count: number; unit: string; why: string }
export type Work = { item: string; why: string }

export type ApplianceRoll = {
  total: number
  app: number
  ir: number
  none: number
  unknown: number
  appList: string[]
  irList: string[]
  noneList: string[]
  unknownList: string[]
}

export type RequirementSheet = {
  inquiryId: number
  headline: string
  fit: { chosen: string | null; needed: string; verdict: string; note: string }
  devices: Need[]
  works: Work[]
  appliances: ApplianceRoll
  questions: string[]
  cautions: string[]
  money: { packageCode: string; price: number; installFee: number; total: number; note: string }
  /** 전화 상담용으로 그대로 복사해 쓰는 전문 */
  plainText: string
}
