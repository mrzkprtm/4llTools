import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { useTheme } from '../../sim/theme'
import { pollingRate, wheelSteps } from './logic'

/** Mouse outline with the five buttons lighting up while held. */
export function MouseSvg({ held, counts }: { held: boolean[]; counts: number[] }) {
  const f = (i: number) => (held[i] ? 'var(--accent)' : 'var(--surface)')
  return (
    <svg viewBox="0 0 120 170" className="mt-mouse" role="img" aria-label="Mouse buttons">
      <path d="M60 6 C28 6 12 30 12 64 V112 C12 144 34 164 60 164 C86 164 108 144 108 112 V64 C108 30 92 6 60 6 Z" fill="var(--sunken)" stroke="var(--text)" strokeWidth={2} />
      <path d="M58 8 C30 9 14 30 14 62 H58 Z" fill={f(0)} stroke="var(--text)" strokeWidth={1.5} />
      <path d="M62 8 C90 9 106 30 106 62 H62 Z" fill={f(2)} stroke="var(--text)" strokeWidth={1.5} />
      <rect x={53} y={20} width={14} height={28} rx={7} fill={f(1)} stroke="var(--text)" strokeWidth={1.5} />
      <rect x={6} y={76} width={10} height={18} rx={4} fill={f(4)} stroke="var(--text)" strokeWidth={1.5} />
      <rect x={6} y={98} width={10} height={18} rx={4} fill={f(3)} stroke="var(--text)" strokeWidth={1.5} />
      <text x={36} y={46} textAnchor="middle" fontSize={11} fill="var(--text)">{counts[0]}</text>
      <text x={84} y={46} textAnchor="middle" fontSize={11} fill="var(--text)">{counts[2]}</text>
      <text x={60} y={62} textAnchor="middle" fontSize={9} fill="var(--muted)">{counts[1]}</text>
      <text x={24} y={89} fontSize={9} fill="var(--muted)">fwd {counts[4]}</text>
      <text x={24} y={111} fontSize={9} fill="var(--muted)">back {counts[3]}</text>
    </svg>
  )
}

/** Scroll here: direction arrow, notch counts and raw deltas. */
export function WheelTest() {
  const ref = useRef<HTMLDivElement>(null)
  const [up, setUp] = useState(0)
  const [down, setDown] = useState(0)
  const [side, setSide] = useState(0)
  const [last, setLast] = useState<{ dy: number; dx: number; mode: number; dir: 'up' | 'down' | 'left' | 'right'; n: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Native listener so preventDefault can stop the page scrolling while testing.
    const on = (e: WheelEvent) => {
      e.preventDefault()
      const s = wheelSteps(e.deltaY, e.deltaMode)
      if (s < 0) setUp((u) => u - s)
      if (s > 0) setDown((d) => d + s)
      const sx = wheelSteps(e.deltaX, e.deltaMode)
      if (sx) setSide((x) => x + Math.abs(sx))
      const dir = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? (e.deltaX < 0 ? 'left' : 'right') : e.deltaY < 0 ? 'up' : 'down'
      setLast((l) => ({ dy: e.deltaY, dx: e.deltaX, mode: e.deltaMode, dir, n: (l?.n ?? 0) + 1 }))
    }
    el.addEventListener('wheel', on, { passive: false })
    return () => el.removeEventListener('wheel', on)
  }, [])

  const rot = { up: 0, right: 90, down: 180, left: 270 }[last?.dir ?? 'up']
  return (
    <div ref={ref} className="mt-wheel" tabIndex={0} aria-label="Scroll wheel test area">
      <div className="mt-arrow" key={last?.n ?? 0} style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
        <svg viewBox="0 0 40 40" width={52} height={52}><path d="M20 4 L34 22 H25 V36 H15 V22 H6 Z" fill={last ? 'var(--accent)' : 'var(--border)'} /></svg>
      </div>
      <div className="mt-wheel-stats">
        <span>Up <b><Roll>{String(up)}</Roll></b></span>
        <span>Down <b><Roll>{String(down)}</Roll></b></span>
        <span>Tilt <b><Roll>{String(side)}</Roll></b></span>
      </div>
      <p className="muted mt-small">{last ? `deltaY ${last.dy.toFixed(1)} · deltaX ${last.dx.toFixed(1)} · ${['pixels', 'lines', 'pages'][last.mode]}` : 'Scroll inside this box. One notch should count as one step; skipped or reversed steps mean a worn encoder.'}</p>
    </div>
  )
}

/** Movement trail with a polling-rate estimate from raw pointer timestamps. */
export function TrailTest() {
  const th = useTheme()
  const canvas = useRef<HTMLCanvasElement>(null)
  const pts = useRef<{ x: number; y: number; t: number }[]>([])
  const stamps = useRef<number[]>([])
  const [rate, setRate] = useState({ hz: 0, raw: 0 })
  const [raw, setRaw] = useState(false)
  const thRef = useRef(th)
  thRef.current = th

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const hasRaw = 'onpointerrawupdate' in c
    setRaw(hasRaw)
    const add = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = c.getBoundingClientRect()
      const list = !hasRaw && e.getCoalescedEvents ? e.getCoalescedEvents() : []
      for (const ev of list.length ? list : [e]) {
        stamps.current.push(ev.timeStamp)
        pts.current.push({ x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() })
      }
      if (stamps.current.length > 400) stamps.current.splice(0, stamps.current.length - 400)
    }
    const type = hasRaw ? 'pointerrawupdate' : 'pointermove'
    c.addEventListener(type, add as EventListener)
    let raf = 0
    let lastUi = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const p = pts.current
      while (p.length && now - p[0].t > 900) p.shift()
      for (let i = 1; i < p.length; i++) {
        const a = 1 - (now - p[i].t) / 900
        ctx.strokeStyle = thRef.current.accent
        ctx.globalAlpha = Math.max(0, a)
        ctx.lineWidth = 1 + a * 3
        ctx.beginPath()
        ctx.moveTo(p[i - 1].x, p[i - 1].y)
        ctx.lineTo(p[i].x, p[i].y)
        ctx.stroke()
        ctx.fillStyle = thRef.current.text
        ctx.fillRect(p[i].x - 1, p[i].y - 1, 2, 2)
      }
      ctx.globalAlpha = 1
      if (now - lastUi > 400) {
        lastUi = now
        const recent = stamps.current.filter((s) => now - s < 1000)
        if (recent.length > 10) setRate(pollingRate(recent))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      c.removeEventListener(type, add as EventListener)
    }
  }, [])

  return (
    <div className="mt-trail-wrap">
      <canvas ref={canvas} className="mt-trail" role="img" aria-label="Mouse movement trail; each dot is one reported position" />
      <div className="mt-rate">
        <b><Roll>{rate.hz ? String(rate.hz) : '–'}</Roll></b> Hz polling
        <span className="muted"> {rate.hz ? `(measured ${Math.round(rate.raw)} Hz${raw ? ', raw updates' : ''})` : '· move the mouse quickly in circles'}</span>
      </div>
    </div>
  )
}
