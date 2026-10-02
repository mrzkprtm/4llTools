import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint, Readout } from '../../sim/controls'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { coverage, makeGrid, paintDot, paintLine, type Grid } from './logic'
import './tool.css'

interface Touch {
  id: number
  n: number
  x: number
  y: number
  color: string
  pressure: number
  w: number
  h: number
  type: string
}

interface TrailPt {
  x: number
  y: number
  t: number
  color: string
  n: number
}

const CELL = 24

export default function TouchTester() {
  const th = useTheme()
  const [mode, setMode] = useState<'draw' | 'cover'>('draw')
  const [active, setActive] = useState<Touch[]>([])
  const [max, setMax] = useState(0)
  const [pct, setPct] = useState(0)
  const [full, setFull] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const touches = useRef(new Map<number, Touch>())
  const trail = useRef<TrailPt[]>([])
  const grid = useRef<Grid | null>(null)
  const counter = useRef(0)
  const live = useRef({ th, mode })
  live.current = { th, mode }

  const sync = () => {
    const list = [...touches.current.values()]
    setActive(list)
    setMax((m) => Math.max(m, list.length))
  }

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    let raf = 0
    let size = ''
    const still = reducedMotion()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth
      const h = c.clientHeight
      if (`${w}x${h}` !== size) {
        size = `${w}x${h}`
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
        grid.current = makeGrid(w, h, CELL)
        setPct(0)
      }
      const ctx = c.getContext('2d')
      if (!ctx) return
      const { th: T, mode: M } = live.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const g = grid.current
      if (M === 'cover' && g) {
        for (let r = 0; r < g.rows; r++)
          for (let col = 0; col < g.cols; col++) {
            const on = g.cells[r * g.cols + col]
            ctx.fillStyle = on ? alpha(T.ok, 0.55) : alpha(T.danger, 0.12)
            ctx.fillRect(col * g.cell + 1, r * g.cell + 1, g.cell - 2, g.cell - 2)
          }
      }
      const tr = trail.current
      while (tr.length && now - tr[0].t > 1200) tr.shift()
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i]
        const b = tr[i - 1]
        if (a.n !== b.n) continue
        const k = 1 - (now - a.t) / 1200
        ctx.strokeStyle = alpha(a.color, Math.max(0, k))
        ctx.lineWidth = 2 + k * 6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(a.x, a.y)
        ctx.stroke()
      }
      for (const t of touches.current.values()) {
        const r = 34 + (still ? 0 : Math.sin(now / 180) * 3)
        ctx.strokeStyle = t.color
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = alpha(t.color, 0.18)
        ctx.fill()
        ctx.strokeStyle = alpha(T.text, 0.25)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, t.y); ctx.lineTo(w, t.y)
        ctx.moveTo(t.x, 0); ctx.lineTo(t.x, h)
        ctx.stroke()
        ctx.fillStyle = T.text
        ctx.font = '600 13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`#${t.n}`, t.x, t.y - r - 8)
      }
      if (!touches.current.size && !tr.length && M === 'draw') {
        ctx.fillStyle = T.muted
        ctx.font = '15px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Put one or more fingers here', w / 2, h / 2)
      }
    }
    raf = requestAnimationFrame(loop)
    const onFs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])

  function pos(e: RPE<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function onDown(e: RPE<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const n = ++counter.current
    const { x, y } = pos(e)
    touches.current.set(e.pointerId, { id: e.pointerId, n, x, y, color: PALETTE[(n - 1) % PALETTE.length], pressure: e.pressure, w: e.width, h: e.height, type: e.pointerType })
    if (grid.current) { paintDot(grid.current, x, y, CELL * 0.6); setPct(coverage(grid.current)) }
    sync()
  }

  function onMove(e: RPE<HTMLCanvasElement>) {
    const t = touches.current.get(e.pointerId)
    if (!t) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    const r = e.currentTarget.getBoundingClientRect()
    const now = performance.now()
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const x = ev.clientX - r.left
      const y = ev.clientY - r.top
      if (grid.current) paintLine(grid.current, t.x, t.y, x, y, CELL * 0.6)
      t.x = x
      t.y = y
      trail.current.push({ x, y, t: now, color: t.color, n: t.n })
    }
    t.pressure = e.pressure
    t.w = e.width
    t.h = e.height
    if (grid.current) setPct(coverage(grid.current))
    sync()
  }

  function onUp(e: RPE<HTMLCanvasElement>) {
    touches.current.delete(e.pointerId)
    sync()
  }

  function clear() {
    trail.current = []
    const c = canvas.current
    if (c) grid.current = makeGrid(c.clientWidth, c.clientHeight, CELL)
    setPct(0)
    setMax(touches.current.size)
  }

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else wrap.current?.requestFullscreen?.().catch(() => {})
  }

  const first = active[0]
  const pressure = first && first.pressure > 0 && first.pressure !== 0.5 ? first.pressure.toFixed(2) : first ? 'n/a' : '–'
  const size = first && first.w > 1 ? `${first.w.toFixed(0)}×${first.h.toFixed(0)} px` : first ? 'n/a' : '–'

  return (
    <div className="tt">
      <div className="row tt-top">
        <Choice value={mode} options={[['draw', 'Multi-touch'], ['cover', 'Dead zones']] as const} onChange={setMode} />
        <button type="button" className="btn" onClick={clear}>Clear</button>
        {typeof document !== 'undefined' && document.fullscreenEnabled && <button type="button" className="btn btn-icon" onClick={toggleFull}><Icon name="maximize" size={18} /> Full screen</button>}
      </div>

      <div ref={wrap} className={`tt-wrap ${full ? 'full' : ''}`}>
        <canvas
          ref={canvas}
          className="tt-canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
          role="img"
          aria-label="Touch area showing each finger as a colored ring"
        />
        <div className="tt-badge"><Roll>{String(active.length)}</Roll> touching · max <Roll>{String(max)}</Roll>{mode === 'cover' && <> · <Roll>{String(Math.round(pct * 100))}</Roll>% covered</>}</div>
        {full && <button type="button" className="btn tt-exit" onClick={toggleFull}>Exit</button>}
      </div>

      <Readout items={[['touching now', String(active.length)], ['most at once', String(max)], ['pressure', pressure], ['contact size', size], ['covered', `${Math.round(pct * 100)}%`]]} />

      <Hint>Put several fingers down to see how many touches your screen tracks at once. In Dead zones mode, slowly paint the whole area: red cells that refuse to turn green are spots where the screen does not register touch.</Hint>
    </div>
  )
}
