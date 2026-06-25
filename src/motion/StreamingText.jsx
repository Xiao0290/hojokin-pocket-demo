import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion.js'

// テキストを一文字ずつ「冒出」させる。AIが結果を語っているような体験。
// cps = chars per second。caret は既存の .caret クラスを流用。
// prefers-reduced-motion では全文を即時表示し、onDone を即時に呼ぶ。
export function StreamingText({
  text = '',
  cps = 42,
  startDelay = 0,
  caret = true,
  onDone,
  className,
  style,
  tag: Tag = 'span',
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? text.length : 0)
  const rafRef = useRef(0)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (reduced) {
      setShown(text.length)
      if (onDoneRef.current) onDoneRef.current()
      return undefined
    }
    setShown(0)
    doneRef.current = false
    let begin = 0
    const step = (now) => {
      if (!begin) begin = now + startDelay
      const elapsed = Math.max(0, now - begin)
      const chars = Math.min(text.length, Math.floor((elapsed / 1000) * cps))
      setShown(chars)
      if (chars < text.length) {
        rafRef.current = requestAnimationFrame(step)
      } else if (!doneRef.current) {
        doneRef.current = true
        if (onDoneRef.current) onDoneRef.current()
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cps, startDelay, reduced])

  const typing = shown < text.length
  return (
    <Tag className={className} style={style}>
      {text.slice(0, shown)}
      {caret && typing && <span className="caret" />}
    </Tag>
  )
}
