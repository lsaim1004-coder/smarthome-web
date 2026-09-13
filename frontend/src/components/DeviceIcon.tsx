import type { DeviceKind } from '../data/packages'

/**
 * 기기 라인업용 아이콘. 제조사 제품 사진은 저작권 문제가 있어 직접 그린 선화를 쓴다.
 * 실제 촬영본이 생기면 이 컴포넌트만 이미지로 교체하면 된다.
 */
export default function DeviceIcon({ kind }: { kind: DeviceKind }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  return (
    <svg className="dev-icon" viewBox="0 0 32 32" aria-hidden="true">
      {kind === 'hub' && (
        <g {...common}>
          <rect x="9" y="13" width="14" height="12" rx="3" />
          <circle cx="16" cy="19" r="2.2" />
          <path d="M11 9.5a7 7 0 0 1 10 0" />
          <path d="M13.4 12a3.7 3.7 0 0 1 5.2 0" />
        </g>
      )}
      {kind === 'switch' && (
        <g {...common}>
          <rect x="8" y="6" width="16" height="20" rx="2.5" />
          <rect x="11.5" y="10" width="9" height="5" rx="1.4" />
          <rect x="11.5" y="17.5" width="9" height="5" rx="1.4" />
          <path d="M13.8 12.5h4.4" />
        </g>
      )}
      {kind === 'motion' && (
        <g {...common}>
          <rect x="10" y="7" width="12" height="12" rx="6" />
          <circle cx="16" cy="13" r="2.4" />
          <path d="M9 24.5c2.2-1.6 4.6-2.4 7-2.4s4.8.8 7 2.4" />
        </g>
      )}
      {kind === 'door' && (
        <g {...common}>
          <path d="M10 5.5h9a1.5 1.5 0 0 1 1.5 1.5v19H10z" />
          <path d="M23.5 26.5H8.5" />
          <circle cx="17.6" cy="16" r="1" fill="currentColor" stroke="none" />
          <path d="M24 12v8" />
        </g>
      )}
      {kind === 'plug' && (
        <g {...common}>
          <rect x="7" y="9" width="18" height="14" rx="3.5" />
          <circle cx="13" cy="16" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="19" cy="16" r="1.3" fill="currentColor" stroke="none" />
          <path d="M16 23v4" />
        </g>
      )}
      {kind === 'curtain' && (
        <g {...common}>
          <path d="M6 7h20" />
          <path d="M10 7v18c2.4-1.2 2.4-4.6 0-6" />
          <path d="M22 7v18c-2.4-1.2-2.4-4.6 0-6" />
          <path d="M14 7v18M18 7v18" opacity="0.45" />
          <path d="M7 25h18" />
        </g>
      )}
      {kind === 'leak' && (
        <g {...common}>
          <path d="M16 5.5c4 5.2 6 8.7 6 11.6a6 6 0 0 1-12 0c0-2.9 2-6.4 6-11.6z" />
          <path d="M13.4 17.4a2.8 2.8 0 0 0 2.6 3" />
        </g>
      )}
      {kind === 'server' && (
        <g {...common}>
          <rect x="6" y="10" width="20" height="12" rx="2.5" />
          <path d="M10 14.5h5M10 17.5h3" />
          <circle cx="22" cy="16" r="1.2" fill="currentColor" stroke="none" />
          <path d="M11 22v3M21 22v3" />
        </g>
      )}
    </svg>
  )
}
