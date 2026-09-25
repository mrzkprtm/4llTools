import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt, gaussian } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { ALGORITHMS, type HullAlgo, type HullStep, type Pt } from './hull'

const W = 800
const H = 500
type Dist = 'uniform' | 'circle' | 'gaussian'

const NAMES: Record<HullAlgo, string> = { jarvis: 'Gift wrapping (Jarvis march)', graham: 'Graham scan', monotone: 'Monotone chain (Andrew)', quickhull: 'Quickhull' }

function scatter(n: number, dist: Dist): Pt[] {
  return Array.from({ length: n }, () => {
    if (dist === 'circle') {
      const a = Math.random() * TAU
      const r = 190 * Math.sqrt(0.75 + 0.25 * Math.random())
      return { x: W / 2 + Math.cos(a) * r * 1.35, y: H / 2 + Math.sin(a) * r }
    }
    if (dist === 'gaussian') return { x: clamp(W / 2 + gaussian() * 120, 20, W - 20), y: clamp(H / 2 + gaussian() * 80, 20, H - 40) }
    return { x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 100) }
  })
}

export default function ConvexHull() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<HullAlgo>('graham')
  const [dist, setDist] = useState<Dist>('uniform')
  const [count, setCount] = useState(30)
  const [sps, setSps] = useState(6)
  const [, setTick] = useState(0)
  const points = useRef<Pt[]>(scatter(30, 'uniform'))
  const run = useRef({ gen: null as Generator<HullStep> | null, step: null as HullStep | null, steps: 0, tests: 0, acc: 0 })
  const drag = useRef<number | null>(null)
  const bump = () => setTick((t) => t + 1)

  function restart(a = algo) {
    // The algorithms use y-up maths coordinates, so flip the screen's y.
    const math = points.current.map((p) => ({ x: p.x, y: -p.y }))
    run.current = { gen: ALGORITHMS[a](math), step: null, steps: 0, tests: 0, acc: 0 }
  }

  function advance() {
    const r = run.current
    if (!r.gen) restart()
    const res = run.current.gen!.next()
    if (res.done) return false
    run.current.step = res.value
    run.current.steps++
    if (res.value.test) run.current.tests++
    return !res.value.done
  }

  function newPoints(n = count, d = dist) {
    points.current = scatter(n, d)
    restart()
    bump()
  }

  function onPointer(p: SimPointer) {
    const P = points.current
    if (p.type === 'down') {
      const i = P.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 12)
      if (i >= 0 && (p.button === 2 || p.shift)) {
        P.splice(i, 1)
        restart()
        return bump()
      }
      if (i >= 0) drag.current = i
      else {
        P.push({ x: p.x, y: p.y })
        drag.current = P.length - 1
      }
      restart()
      bump()
    } else if (drag.current !== null && p.down) {
      P[drag.current] = { x: clamp(p.x, 5, W - 5), y: clamp(p.y, 5, H - 5) }
      restart()
    }
    if (p.type === 'up') {
      drag.current = null
      bump()
    }
  }

  const st = run.current.step
  const P = points.current

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`${P.length} points; ${NAMES[algo]} ${st?.done ? `found a hull of ${st.hull.length} points` : 'is running'}.`}
            onFrame={(ctx, f) => {
              const r = run.current
              if (!r.gen) restart()
              if (drag.current !== null) {
                // While dragging, show the finished hull live.
                while (advance()) void 0
              } else if (f.dt > 0 && !r.step?.done) {
                r.acc += f.dt * sps
                let n = Math.min(5000, Math.floor(r.acc))
                r.acc -= n
                while (n-- > 0 && advance()) void 0
              }
              const s = run.current.step
              const pts = points.current
              clear(ctx, W, H, theme.sunken)

              // Quickhull's triangle and focus set; Graham's angular order.
              if (s?.tri) {
                const [a, b, c] = s.tri.map((i) => pts[i])
                ctx.beginPath()
                ctx.moveTo(a.x, a.y)
                ctx.lineTo(b.x, b.y)
                ctx.lineTo(c.x, c.y)
                ctx.closePath()
                ctx.fillStyle = alpha(PALETTE[4], 0.18)
                ctx.fill()
              }
              if (s?.order && algo === 'graham' && !s.done) {
                const pv = pts[s.order[0]]
                for (const i of s.order.slice(1)) line(ctx, pv.x, pv.y, pts[i].x, pts[i].y, alpha(theme.text, 0.07), 1)
              }
              // Hull or stack so far.
              const hull = s?.hull ?? []
              if (s?.done && hull.length > 2) {
                ctx.beginPath()
                hull.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)))
                ctx.closePath()
                ctx.fillStyle = alpha(theme.accent, 0.12)
                ctx.fill()
              }
              if (hull.length > 1) {
                ctx.beginPath()
                hull.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)))
                if (s?.done || algo === 'quickhull') ctx.closePath()
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 3
                ctx.lineJoin = 'round'
                ctx.stroke()
              }
              if (s?.edge) {
                const [a, b] = s.edge
                line(ctx, pts[a].x, pts[a].y, pts[b].x, pts[b].y, PALETTE[1], 2.5, [8, 6])
              }
              // The turn test a → b → c.
              if (s?.test) {
                const { a, b, c, cross } = s.test
                const left = cross > 0
                const col = algo === 'jarvis' ? (cross < 0 ? theme.danger : theme.ok) : left ? theme.ok : theme.danger
                line(ctx, pts[a].x, pts[a].y, pts[b].x, pts[b].y, alpha(col, 0.6), 2)
                line(ctx, pts[b].x, pts[b].y, pts[c].x, pts[c].y, col, 2.5)
                circle(ctx, pts[c].x, pts[c].y, 9, undefined, col, 2.5)
                const label = `cross ${cross > 0 ? '+' : cross < 0 ? '−' : '±'}${fmt(Math.abs(cross), 0)} → ${cross > 0 ? 'left turn' : cross < 0 ? 'right turn' : 'straight'}`
                const tx = clamp(pts[c].x + 14, 10, W - 200)
                const ty = clamp(pts[c].y - 12, 20, H - 50)
                rrect(ctx, tx - 4, ty - 14, label.length * 7.4 + 8, 20, 5, alpha(theme.surface, 0.9))
                text(ctx, label, tx, ty, { color: col, size: 12, weight: 700 })
              }
              // Points; label the ones that matter right now.
              const focus = new Set(s?.focus && algo === 'quickhull' ? s.focus : [])
              const onHull = new Set(hull)
              const labelled = new Set([...hull, ...(s?.test ? [s.test.a, s.test.b, s.test.c] : []), ...(s?.edge ?? [])])
              pts.forEach((p, i) => {
                const isHull = onHull.has(i)
                circle(ctx, p.x, p.y, isHull ? 6 : 4.5, isHull ? theme.accent : focus.has(i) ? PALETTE[4] : alpha(theme.text, 0.55), theme.surface, 1.5)
                if (labelled.has(i) && pts.length <= 120) text(ctx, String(i), p.x + 8, p.y - 7, { color: theme.muted, size: 12 })
              })
              // Stack strip along the bottom.
              if (algo === 'graham' || algo === 'monotone') {
                rrect(ctx, 10, H - 40, W - 20, 30, 6, alpha(theme.surface, 0.85), theme.border)
                const shown = hull.slice(-24)
                text(ctx, hull.length > shown.length ? 'stack …' : 'stack', 20, H - 20, { color: theme.muted, size: 12, weight: 700 })
                shown.forEach((i, k) => {
                  const x = 80 + k * 29
                  rrect(ctx, x, H - 36, 26, 22, 4, k === shown.length - 1 ? theme.accent : alpha(theme.text, 0.1))
                  text(ctx, String(i), x + 13, H - 21, { color: k === shown.length - 1 ? '#fff' : theme.text, size: 12, align: 'center' })
                })
              }
              if (s) text(ctx, s.note, 14, 24, { color: s.done ? theme.ok : theme.text, size: 14, weight: 600, mono: false })
              if (f.frame % 8 === 0 && (running || drag.current !== null)) bump()
            }}
          />
          <Readout
            items={[
              ['Points', P.length],
              ['Hull points', st?.done ? st.hull.length : st ? `${st.hull.length}…` : '—'],
              ['Steps', fmt(run.current.steps)],
              ['Turn tests', fmt(run.current.tests)],
              ['Last cross', st?.test ? (st.test.cross > 0 ? '+ (left)' : st.test.cross < 0 ? '− (right)' : '0 (straight)') : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={(v) => { if (v && run.current.step?.done) restart(); setRunning(v) }} onStep={() => { if (run.current.step?.done) restart(); advance(); bump() }} onReset={() => { restart(); bump() }} />
      <Choice label="Algorithm" value={algo} options={[['jarvis', 'Jarvis'], ['graham', 'Graham'], ['monotone', 'Monotone'], ['quickhull', 'Quickhull']]} onChange={(a) => { setAlgo(a); restart(a); bump() }} />
      <Slider label="Speed" value={sps} min={1} max={60} unit=" steps/s" onChange={setSps} />
      <Slider label="Random points" value={count} min={3} max={300} onChange={(n) => { setCount(n); newPoints(n) }} />
      <Choice label="Distribution" value={dist} options={[['uniform', 'Uniform'], ['circle', 'Circle'], ['gaussian', 'Gaussian']]} onChange={(d) => { setDist(d); newPoints(count, d) }} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => newPoints()}>New points</button>
        <button type="button" className="btn" onClick={() => { points.current = []; restart(); bump() }}>Clear</button>
      </div>
      <Hint>Click to add points and drag them around; shift-click removes one. Each turn test is a cross product: positive means a left turn (keep going), negative a right turn, which a counter-clockwise hull must never make.</Hint>
    </SimLayout>
  )
}
