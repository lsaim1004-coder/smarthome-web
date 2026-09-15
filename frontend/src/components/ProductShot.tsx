import type { ReactNode } from 'react'
import type { ShotKind } from '../data/products'

/**
 * 제품 일러스트.
 *
 * 제조사 제품 사진은 저작권이 있어 그대로 쓸 수 없다. 파트너 자산을 정식으로 받거나
 * 실물을 촬영하기 전까지는 형태만 알아볼 수 있게 직접 그린 그림을 쓴다.
 * 사진으로 교체할 때는 이 컴포넌트만 <img> 로 바꾸면 된다.
 */

const BODY = '#ffffff'
const EDGE = '#cbd5e1'
const FACE = '#f1f5f9'
const DEEP = '#e2e8f0'
const ACCENT = '#f5b544'

function Shot({ children }: { children: ReactNode }) {
  return (
    <svg className="shot" viewBox="0 0 120 100" role="img" aria-hidden="true">
      <rect width="120" height="100" rx="14" fill="#eef2f7" />
      <ellipse cx="60" cy="90" rx="30" ry="4" fill="#0f172a" opacity="0.07" />
      {/* 제품이 배경 대비 작아 보여 가운데 기준으로 키운다 */}
      <g transform="translate(60 50) scale(1.25) translate(-60 -50)">{children}</g>
    </svg>
  )
}

export default function ProductShot({ kind }: { kind: ShotKind }) {
  if (kind === 'station') {
    return (
      <Shot>
        <rect x="38" y="30" width="44" height="44" rx="13" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="60" cy="50" r="14" fill={FACE} stroke={DEEP} strokeWidth="1.2" />
        <circle cx="60" cy="50" r="5.5" fill={DEEP} />
        <rect x="52" y="66" width="16" height="3" rx="1.5" fill={DEEP} />
        <circle cx="60" cy="67.5" r="1.6" fill={ACCENT} />
      </Shot>
    )
  }
  if (kind === 'switch2') {
    return (
      <Shot>
        <rect x="39" y="22" width="42" height="54" rx="7" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="45" y="29" width="13" height="40" rx="3.5" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <rect x="62" y="29" width="13" height="40" rx="3.5" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <circle cx="51.5" cy="63" r="1.7" fill={ACCENT} />
        <circle cx="68.5" cy="63" r="1.7" fill={DEEP} />
      </Shot>
    )
  }
  if (kind === 'motion') {
    return (
      <Shot>
        <rect x="45" y="34" width="30" height="32" rx="9" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="60" cy="47" r="7.5" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <circle cx="60" cy="47" r="3" fill={DEEP} />
        <rect x="52" y="66" width="16" height="5" rx="2.5" fill={DEEP} />
        <path d="M74 40a10 10 0 0 1 0 12M79 36a15 15 0 0 1 0 20" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
      </Shot>
    )
  }
  if (kind === 'door') {
    return (
      <Shot>
        <rect x="40" y="32" width="23" height="34" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="67" y="38" width="11" height="28" rx="5" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="51.5" cy="41" r="1.8" fill={ACCENT} />
        <rect x="46" y="48" width="11" height="2.4" rx="1.2" fill={DEEP} />
        <rect x="46" y="54" width="7" height="2.4" rx="1.2" fill={DEEP} />
      </Shot>
    )
  }
  if (kind === 'temp') {
    return (
      <Shot>
        <rect x="43" y="30" width="34" height="38" rx="9" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="49" y="38" width="22" height="15" rx="3" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <rect x="52" y="42" width="10" height="3" rx="1.5" fill="#94a3b8" />
        <rect x="52" y="47" width="14" height="2.4" rx="1.2" fill={DEEP} />
        <circle cx="60" cy="61" r="2" fill={ACCENT} />
      </Shot>
    )
  }
  if (kind === 'leak') {
    return (
      <Shot>
        <rect x="40" y="38" width="40" height="21" rx="10.5" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="60" cy="48.5" r="5" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <rect x="48" y="59" width="4" height="7" rx="2" fill={DEEP} />
        <rect x="68" y="59" width="4" height="7" rx="2" fill={DEEP} />
        <path d="M60 26c3.4 4.2 5 6.9 5 9a5 5 0 0 1-10 0c0-2.1 1.6-4.8 5-9z" fill={ACCENT} opacity="0.85" />
      </Shot>
    )
  }
  if (kind === 'plug') {
    return (
      <Shot>
        <rect x="43" y="26" width="34" height="46" rx="11" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="60" cy="44" r="10" fill={FACE} stroke={DEEP} strokeWidth="1.2" />
        <circle cx="56" cy="44" r="1.9" fill="#94a3b8" />
        <circle cx="64" cy="44" r="1.9" fill="#94a3b8" />
        <rect x="53" y="61" width="14" height="4" rx="2" fill={DEEP} />
        <circle cx="60" cy="63" r="1.4" fill={ACCENT} />
      </Shot>
    )
  }
  if (kind === 'curtain') {
    return (
      <Shot>
        <rect x="22" y="26" width="76" height="4.5" rx="2.2" fill="#94a3b8" />
        <path d="M30 31v34c4-2.2 4-8.4 0-11M42 31v34c-4-2.2-4-8.4 0-11" fill="none" stroke={DEEP} strokeWidth="2" strokeLinecap="round" />
        <path d="M90 31v34c-4-2.2-4-8.4 0-11" fill="none" stroke={DEEP} strokeWidth="2" strokeLinecap="round" />
        <rect x="52" y="33" width="20" height="28" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="57" cy="29" r="3.4" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <circle cx="67" cy="29" r="3.4" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
        <rect x="57" y="43" width="10" height="2.6" rx="1.3" fill={DEEP} />
        <circle cx="62" cy="52" r="1.8" fill={ACCENT} />
      </Shot>
    )
  }
  if (kind === 'hubm3') {
    return (
      <Shot>
        <rect x="41" y="30" width="38" height="38" rx="10" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="60" cy="43" r="9" fill={FACE} stroke={DEEP} strokeWidth="1.2" />
        <circle cx="60" cy="43" r="3.4" fill={DEEP} />
        <circle cx="52" cy="59" r="1.7" fill="#94a3b8" />
        <circle cx="60" cy="59" r="1.7" fill="#94a3b8" />
        <circle cx="68" cy="59" r="1.7" fill={ACCENT} />
        <path d="M84 38a12 12 0 0 1 0 16" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" />
      </Shot>
    )
  }
  if (kind === 'mesh') {
    return (
      <Shot>
        <rect x="36" y="34" width="20" height="34" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="64" y="34" width="20" height="34" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <circle cx="46" cy="60" r="1.7" fill={ACCENT} />
        <circle cx="74" cy="60" r="1.7" fill={ACCENT} />
        <path d="M41 46h10M69 46h10" stroke={DEEP} strokeWidth="2" strokeLinecap="round" />
        <path d="M56 28a18 18 0 0 1 8 0" fill="none" stroke={DEEP} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M52 22a30 30 0 0 1 16 0" fill="none" stroke={DEEP} strokeWidth="1.6" strokeLinecap="round" opacity="0.6" />
      </Shot>
    )
  }
  if (kind === 'minipc') {
    return (
      <Shot>
        <rect x="32" y="40" width="56" height="26" rx="6" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="38" y="47" width="18" height="2.6" rx="1.3" fill={DEEP} />
        <rect x="38" y="53" width="12" height="2.6" rx="1.3" fill={DEEP} />
        <circle cx="80" cy="53" r="2.2" fill={ACCENT} />
        <rect x="38" y="66" width="6" height="4" rx="1.5" fill={DEEP} />
        <rect x="76" y="66" width="6" height="4" rx="1.5" fill={DEEP} />
      </Shot>
    )
  }
  return (
    <Shot>
      <rect x="45" y="18" width="30" height="62" rx="9" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
      <rect x="51" y="25" width="18" height="22" rx="3" fill={FACE} stroke={DEEP} strokeWidth="1.1" />
      <circle cx="56" cy="32" r="1.6" fill="#94a3b8" />
      <circle cx="60" cy="32" r="1.6" fill="#94a3b8" />
      <circle cx="64" cy="32" r="1.6" fill="#94a3b8" />
      <circle cx="56" cy="39" r="1.6" fill="#94a3b8" />
      <circle cx="60" cy="39" r="1.6" fill="#94a3b8" />
      <circle cx="64" cy="39" r="1.6" fill="#94a3b8" />
      <rect x="52" y="54" width="16" height="4" rx="2" fill={DEEP} />
      <circle cx="60" cy="68" r="3" fill={ACCENT} opacity="0.9" />
    </Shot>
  )
}
