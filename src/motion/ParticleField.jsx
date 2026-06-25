import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion.js'

// 「生きているAI」レイヤー。ブランド青の粒子フィールドを canvas で描く。
//   mode='ambient'     … ゆるやかに漂う環境粒子（生命感の常時表現）
//   mode='diagnosing'  … 核へ引き寄せ＋周回。core で呼吸する核を描画
//   mode='converge'    … 核へ強く凝集（診断完了直前の「息を止める」瞬間）
//   bloomKey を変化させると一度だけ「開花」（粒子が外へ放射＋同心円）。
// 親要素を position:relative にして上に重ねる。pointer-events:none でクリックは透過。
// prefers-reduced-motion では静止した淡いフレームのみ描画し rAF を回さない。
const BLUE = '26,86,240'
const TAU = Math.PI * 2

export function ParticleField({
  mode = 'ambient',
  bloomKey = 0,
  core = false,
  coreY = 0.42,
  anchorSelector = '',
  count = 56,
  intensity = 1,
  className = '',
  style,
}) {
  const canvasRef = useRef(null)
  const reduced = useReducedMotion()
  // 最新の props を rAF ループから読むための可変参照。
  const live = useRef({ mode, bloomKey, core, coreY, intensity, anchorSelector })
  live.current = { mode, bloomKey, core, coreY, intensity, anchorSelector }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
    let W = 1
    let H = 1
    let coreX = 0.5
    let coreYpx = 0
    const particles = []
    let rings = []
    let blooming = false
    let bloomStart = 0
    let seenBloom = live.current.bloomKey

    const seed = (ambient) => {
      particles.length = 0
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * (ambient ? 0.2 : 0.3),
          vy: (Math.random() - 0.5) * (ambient ? 0.2 : 0.3),
          r: Math.random() * 1.6 + 0.7,
          ph: Math.random() * TAU,
          life: 1,
        })
      }
    }

    const measure = () => {
      const rect = canvas.getBoundingClientRect()
      W = Math.max(1, rect.width)
      H = Math.max(1, rect.height)
      canvas.width = Math.round(W * DPR)
      canvas.height = Math.round(H * DPR)
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      coreX = W / 2
      coreYpx = H * live.current.coreY
      const sel = live.current.anchorSelector
      if (sel && canvas.parentElement) {
        const el = canvas.parentElement.querySelector(sel)
        if (el) {
          const er = el.getBoundingClientRect()
          coreX = er.left - rect.left + er.width / 2
          coreYpx = er.top - rect.top + er.height / 2
        }
      }
      if (!particles.length) seed(live.current.mode === 'ambient')
    }
    measure()

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro) ro.observe(canvas)

    if (reduced) {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, TAU)
        ctx.fillStyle = `rgba(${BLUE},0.12)`
        ctx.fill()
      }
      return () => { if (ro) ro.disconnect() }
    }

    let raf = 0
    const doBloom = () => {
      blooming = true
      bloomStart = 0
      for (const p of particles) {
        const angle = Math.atan2(p.y - coreYpx, p.x - coreX) + (Math.random() - 0.5) * 0.6
        const speed = 3.2 + Math.random() * 6
        p.vx = Math.cos(angle) * speed
        p.vy = Math.sin(angle) * speed
        p.life = 1
      }
      const span = Math.max(W, H)
      rings = [{ delay: 0, max: span * 0.75 }, { delay: 90, max: span * 0.55 }]
    }

    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const st = live.current
      if (seenBloom !== st.bloomKey) {
        seenBloom = st.bloomKey
        if (st.bloomKey) doBloom()
      }
      if (blooming && !bloomStart) bloomStart = now

      ctx.clearRect(0, 0, W, H)
      const breath = (Math.sin(now / 1700) + 1) / 2
      const hbp = (now % 3400) / 3400
      const heartbeat = hbp < 0.12
        ? Math.sin((hbp / 0.12) * Math.PI)
        : (hbp > 0.18 && hbp < 0.3 ? 0.6 * Math.sin(((hbp - 0.18) / 0.12) * Math.PI) : 0)
      const effMode = blooming ? 'bloom' : st.mode

      for (const p of particles) {
        if (effMode === 'diagnosing') {
          const dx = coreX - p.x
          const dy = coreYpx - p.y
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001
          const pull = 0.045 * (1 - Math.min(1, d / 260))
          p.vx += (dx / d) * pull - (dy / d) * 0.018
          p.vy += (dy / d) * pull + (dx / d) * 0.018
          p.vx *= 0.96
          p.vy *= 0.96
          p.x += p.vx + Math.sin(now / 2600 + p.ph) * 0.12
          p.y += p.vy + Math.cos(now / 3000 + p.ph) * 0.12
        } else if (effMode === 'converge') {
          const dx = coreX - p.x
          const dy = coreYpx - p.y
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001
          p.vx += (dx / d) * 0.22
          p.vy += (dy / d) * 0.22
          p.vx *= 0.86
          p.vy *= 0.86
          p.x += p.vx
          p.y += p.vy
        } else if (effMode === 'bloom') {
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.95
          p.vy *= 0.95
          p.life -= 0.018
        } else {
          p.x += p.vx + Math.sin(now / 2600 + p.ph) * 0.1
          p.y += p.vy + Math.cos(now / 3000 + p.ph) * 0.1
          if (p.x < -4) p.x = W + 4
          if (p.x > W + 4) p.x = -4
          if (p.y < -4) p.y = H + 4
          if (p.y > H + 4) p.y = -4
        }

        const tw = (Math.sin(now / 900 + p.ph) + 1) / 2
        let alpha
        if (effMode === 'bloom') {
          alpha = Math.max(0, p.life) * 0.5
        } else {
          const baseInt = effMode === 'ambient' ? 0.42 : 1
          alpha = (0.1 + tw * 0.22) * baseInt * st.intensity * (0.6 + breath * 0.4)
        }
        if (alpha <= 0) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, TAU)
        ctx.fillStyle = `rgba(${BLUE},${alpha.toFixed(3)})`
        ctx.fill()
      }

      if (st.core && (effMode === 'diagnosing' || effMode === 'converge')) {
        const grow = effMode === 'converge' ? 1 : 0
        const radius = 34 + breath * 14 + heartbeat * 9 + grow * 8
        const ca = 0.22 + breath * 0.16 + heartbeat * 0.16 + grow * 0.2
        const grad = ctx.createRadialGradient(coreX, coreYpx, 2, coreX, coreYpx, radius)
        grad.addColorStop(0, `rgba(${BLUE},${Math.min(0.8, ca).toFixed(3)})`)
        grad.addColorStop(0.55, `rgba(${BLUE},${(ca * 0.35).toFixed(3)})`)
        grad.addColorStop(1, `rgba(${BLUE},0)`)
        ctx.beginPath()
        ctx.arc(coreX, coreYpx, radius, 0, TAU)
        ctx.fillStyle = grad
        ctx.fill()
      }

      if (blooming) {
        for (const ring of rings) {
          const rt = (now - bloomStart - ring.delay) / 700
          if (rt < 0 || rt > 1) continue
          const eased = 1 - Math.pow(1 - rt, 3)
          ctx.beginPath()
          ctx.arc(coreX, coreYpx, eased * ring.max, 0, TAU)
          ctx.strokeStyle = `rgba(${BLUE},${((1 - rt) * 0.45).toFixed(3)})`
          ctx.lineWidth = 2.5 * (1 - rt) + 0.5
          ctx.stroke()
        }
        if (now - bloomStart > 1100) {
          blooming = false
          rings = []
          seed(true)
        }
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, count])

  return <canvas ref={canvasRef} className={`particle-field ${className}`.trim()} aria-hidden="true" style={style} />
}
