import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion.js'

// 優雅な進捗バー。外枠やハロー箱は描かず、生命感は「線の上」だけに置く。
//   - 細いバーが進捗まで満ち、フィル内をシルク状の光沢が走る
//   - 微細な粒子がフィル内を右へ流れ、進捗の先端へ吸い込まれる
//   - 先端に柔らかな発光点（呼吸＋微心拍）
// prefers-reduced-motion では canvas を使わず、静的な DOM バーにフォールバック。
const BLUE = '26,86,240'
const TAU = Math.PI * 2
const TRACK = '#edeef2'
const BH = 6

export function ProgressFlow({ value = 0, active = true, height = 20, className = '', style, ...rest }) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()
  const live = useRef({ value, active })
  live.current = { value, active }

  useEffect(() => {
    if (reduced) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    let W = 1
    let H = height
    const flow = []
    for (let i = 0; i < 10; i += 1) {
      flow.push({
        x: Math.random(),
        sp: 0.5 + Math.random() * 0.9,
        off: (Math.random() - 0.5) * 2.2,
        r: 0.5 + Math.random() * 0.7,
      })
    }

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, rect.width)
      H = Math.max(1, rect.height)
      canvas.width = Math.round(W * DPR)
      canvas.height = Math.round(H * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro) ro.observe(canvas)

    const rr = (x, y, w, h, r) => {
      const rad = Math.min(r, w / 2, h / 2)
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, rad)
      } else {
        ctx.moveTo(x + rad, y)
        ctx.arcTo(x + w, y, x + w, y + h, rad)
        ctx.arcTo(x + w, y + h, x, y + h, rad)
        ctx.arcTo(x, y + h, x, y, rad)
        ctx.arcTo(x, y, x + w, y, rad)
        ctx.closePath()
      }
    }

    let raf = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const st = live.current
      const prog = Math.max(0, Math.min(1, st.value / 100))
      const breath = (Math.sin(now / 1900) + 1) / 2
      const hp = (now % 3000) / 3000
      const hb = hp < 0.12
        ? Math.sin((hp / 0.12) * Math.PI)
        : (hp > 0.2 && hp < 0.32 ? 0.5 * Math.sin(((hp - 0.2) / 0.12) * Math.PI) : 0)

      ctx.clearRect(0, 0, W, H)
      const bx = 4
      const bw = Math.max(1, W - 8)
      const cy = H / 2
      const by = cy - BH / 2
      // track
      rr(bx, by, bw, BH, BH / 2)
      ctx.fillStyle = TRACK
      ctx.fill()
      // fill
      const fw = Math.max(BH, bw * prog)
      ctx.save()
      rr(bx, by, fw, BH, BH / 2)
      ctx.clip()
      ctx.fillStyle = `rgba(${BLUE},${(0.82 + breath * 0.16).toFixed(3)})`
      ctx.fillRect(bx, by, fw, BH)
      // silk shimmer along the fill
      if (st.active) {
        const sweep = bx + ((now / 1500) % 1) * (fw + 30) - 15
        const g = ctx.createLinearGradient(sweep - 22, 0, sweep + 22, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.5, 'rgba(255,255,255,0.40)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(bx, by, fw, BH)
      }
      ctx.restore()

      const head = bx + fw
      if (st.active) {
        // particles flowing toward the leading edge
        for (const p of flow) {
          p.x += 0.004 + p.sp * 0.004
          if (p.x >= 1) p.x -= 1
          const px = bx + p.x * fw
          if (px > head - 1) continue
          const prox = 1 - Math.min(1, (head - px) / 55)
          const alpha = (0.18 + prox * 0.5) * (0.7 + breath * 0.3)
          ctx.beginPath()
          ctx.arc(px, cy + p.off, p.r + prox * 0.6, 0, TAU)
          ctx.fillStyle = `rgba(${BLUE},${alpha.toFixed(3)})`
          ctx.fill()
        }
        // breathing glow head
        const R = 5 + breath * 3 + hb * 4
        const gg = ctx.createRadialGradient(head, cy, 0.5, head, cy, R)
        gg.addColorStop(0, `rgba(${BLUE},${(0.55 + hb * 0.3).toFixed(3)})`)
        gg.addColorStop(1, `rgba(${BLUE},0)`)
        ctx.beginPath()
        ctx.arc(head, cy, R, 0, TAU)
        ctx.fillStyle = gg
        ctx.fill()
        ctx.beginPath()
        ctx.arc(head, cy, 1.7 + hb * 1.2, 0, TAU)
        ctx.fillStyle = `rgba(${BLUE},0.95)`
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, height])

  const prog = Math.max(0, Math.min(100, Math.round(value)))
  const common = {
    className: `progress-flow ${className}`.trim(),
    role: 'progressbar',
    'aria-valuenow': prog,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    style: { height, ...style },
    ...rest,
  }

  if (reduced) {
    return (
      <div {...common}>
        <div className="pf-track"><div className="pf-fill" style={{ width: `${prog}%` }} /></div>
      </div>
    )
  }
  return (
    <div {...common}>
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  )
}
