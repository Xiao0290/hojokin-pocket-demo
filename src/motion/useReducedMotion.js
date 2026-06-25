import { useEffect, useState } from 'react'

// prefers-reduced-motion を購読するフック。
// OS 設定が変わったら再レンダリングし、各モーション部品は即時表示/停止へ降級する。
const QUERY = '(prefers-reduced-motion: reduce)'

function read() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(read)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    onChange()
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  return reduced
}
