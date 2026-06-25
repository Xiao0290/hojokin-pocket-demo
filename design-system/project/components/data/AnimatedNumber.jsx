import React from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ===== slot-machine digit reel: rolls 0-9 and lands on `digit` ===== */
function SlotDigit({ digit, duration, delay, cycles }) {
  const finalIndex = cycles * 10 + digit
  const [y, setY] = React.useState(0)
  React.useEffect(() => {
    if (prefersReduced()) {
      setY(finalIndex)
      return
    }
    let r2
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setY(finalIndex))
    })
    return () => {
      cancelAnimationFrame(r1)
      cancelAnimationFrame(r2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit])

  const cells = []
  for (let c = 0; c < cycles; c++) for (let n = 0; n < 10; n++) cells.push(n)
  for (let n = 0; n <= digit; n++) cells.push(n)

  return (
    <span
      style={{
        display: 'inline-block',
        height: '1em',
        lineHeight: '1em',
        overflow: 'hidden',
        verticalAlign: 'baseline',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          display: 'block',
          transform: `translateY(-${y}em)`,
          transition: `transform ${duration}ms cubic-bezier(.16,.84,.30,1) ${delay}ms`,
        }}
      >
        {cells.map((n, i) => (
          <span key={i} style={{ display: 'block', height: '1em', lineHeight: '1em' }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  )
}

function format(value, fmt, decimals) {
  if (fmt === 'yen') return '¥' + Math.round(value).toLocaleString('en-US')
  if (fmt === 'percent') return (decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))) + '%'
  if (fmt === 'comma') return decimals > 0 ? Number(value.toFixed(decimals)).toLocaleString('en-US') : Math.round(value).toLocaleString('en-US')
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
}

/**
 * AnimatedNumber — figures that move into place.
 * variant="count" (default): smooth count-up from `from` to `value`.
 * variant="slot": slot-machine digit reels roll and settle left→right.
 */
export function AnimatedNumber({
  value,
  format: fmt = 'plain',
  decimals = 0,
  duration = 1000,
  from = 0,
  prefix = '',
  suffix = '',
  variant = 'count',
  cycles = 2,
  style,
}) {
  // ----- slot-machine variant -----
  if (variant === 'slot') {
    const text = format(value, fmt, decimals)
    let digitOrder = 0
    const total = (text.match(/\d/g) || []).length
    return (
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...style }}>
        {prefix}
        {text.split('').map((ch, i) => {
          if (ch >= '0' && ch <= '9') {
            const order = digitOrder++
            // rightmost reels spin a touch longer for an odometer feel
            const delay = order * 70
            const dur = duration + (total - 1 - order) * 60
            return <SlotDigit key={i} digit={Number(ch)} duration={dur} delay={delay} cycles={cycles} />
          }
          return <span key={i}>{ch}</span>
        })}
        {suffix}
      </span>
    )
  }

  // ----- count-up variant -----
  const reduce = prefersReduced()
  const [display, setDisplay] = React.useState(reduce ? value : from)
  const raf = React.useRef(0)
  const fromRef = React.useRef(from)

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }
    const startVal = fromRef.current
    const target = value
    const startTime = performance.now()
    cancelAnimationFrame(raf.current)
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(startVal + (target - startVal) * eased)
      if (t < 1) {
        raf.current = requestAnimationFrame(tick)
      } else {
        setDisplay(target)
        fromRef.current = target
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}
      {format(display, fmt, decimals)}
      {suffix}
    </span>
  )
}
