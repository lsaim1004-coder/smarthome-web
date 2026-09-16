import { useEffect, useRef, useState } from 'react'

/**
 * 모델명처럼 그대로 검색창에 넣을 값을 한 번에 복사한다.
 *
 * 관리자 화면에서 제일 자주 하는 일이 "이 모델명 뭐지" 하고 검색하는 것이라,
 * 드래그해서 고르는 수고를 없앤다. 값이 없으면 아무것도 그리지 않는다.
 *
 * HTTPS 가 아니면(예: LAN 으로 직접 접속) navigator.clipboard 가 없다 — 그때는 임시 textarea 로 떨어진다.
 */
export default function CopyText({
  value,
  label,
  className,
}: {
  value: string | null | undefined
  /** 버튼에 붙는 설명. 화면에는 안 보이고 읽어 주는 이름으로만 쓴다. */
  label?: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!value || !value.trim()) return null
  const text = value.trim()

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setDone(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setDone(false), 1400)
    } catch {
      // 복사를 막는 브라우저도 있다. 값은 화면에 그대로 있으니 조용히 넘어간다.
    }
  }

  return (
    <button
      type="button"
      className={'btn btn-sm btn-link p-0 ms-2 align-baseline copy-text' + (className ? ' ' + className : '')}
      onClick={() => void copy()}
      title={`${text} 복사`}
      aria-label={`${label ?? '값'} ${text} 복사`}
    >
      {done ? '복사됨' : '복사'}
    </button>
  )
}
