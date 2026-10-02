import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, line, rrect, text } from '../../sim/draw'
import { fmt, rad } from '../../sim/math'
import { collatz, coral, stoppingTime } from './collatz'

const W = 800
const H = 520
const BG = '#0d0c0b'
const EVEN = '#4dabf7'
const ODD = '#ff922b'
const GL = 56 // chart left
const GR = W - 20
const GT = 46
const GB = H - 40
const BUCKETS = 32

type View = 'sequence' | 'tree'
const depthColor = (u: number, a = 1) => `hsl(${Math.round(35 + 230 * u)} 85% ${Math.round(60 - 8 * u)}% / ${a})`

export default function CollatzConjecture() {
  const [running, setRunning] = useRunning()
  const [view, setView] = useState<View>('sequence')
  const [n, setN] = useState(27)
  const [input, setInput] = useState('27')
  const [rate, setRate] = useState(12)
  const [logScale, setLogScale] = useState(false)
  const [N, setBigN] = useState(2000)
  const [even, setEven] = useState(8)
  const [odd, setOdd] = useState(16)
  const [shownView, setShownView] = useState(0)
  const shown = useRef(0)
  const hover = useRef<{ x: number; y: number } | null>(null)

  const seq = useMemo(() => collatz(n), [n])
  const peak = Math.max(...seq)
  const evens = seq.slice(0, -1).filter((v) => v % 2 === 0).length
  const tree = useMemo(() => coral(N, rad(even), rad(odd)), [N, even, odd])
  const fit = useMemo(() => {
    let a = Infinity
    let b = Infinity
    let c = -Infinity
    let d = -Infinity
    for (let i = 0; i < tree.x.length; i++) {
      a = Math.min(a, tree.x[i])
      c = Math.max(c, tree.x[i])
      b = Math.min(b, tree.y[i])
      d = Math.max(d, tree.y[i])
    }
    const s = Math.min((W - 40) / Math.max(1, c - a), (H - 40) / Math.max(1, d - b))
    return { s, ox: W / 2 - ((a + c) / 2) * s, oy: H / 2 - ((b + d) / 2) * s }
  }, [tree])
  // The start ≤ N with the most steps.
  const longest = useMemo(() => {
    let best = 1
    let steps = 0
    for (let i = 0; i < tree.values.length; i++)
      if (tree.values[i] <= N && tree.depth[i] > steps) {
        steps = tree.depth[i]
        best = tree.values[i]
      }
    return { best, steps }
  }, [tree, N])

  function pick(v: number) {
    const k = Math.max(1, Math.min(1e8, Math.round(v)))
    setN(k)
    setInput(String(k))
    shown.current = 0
    setRunning(true)
  }

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
    if (view === 'sequence' && p.type === 'down') {
      // Click a bar to jump the animation to that step.
      const k = Math.floor(((p.x - GL) / (GR - GL)) * seq.length)
      if (k >= 0 && k < seq.length) {
        shown.current = k + 1
        setRunning(false)
      }
    }
  }

  const seqStats: [string, string | number][] = [
    ['Steps to reach 1', seq.length - 1],
    ['Peak', fmt(peak, 0)],
    ['Even steps (÷2)', evens],
    ['Odd steps (3n+1)', seq.length - 1 - evens],
    ['Drops below n after', n > 1 ? `${stoppingTime(n)} steps` : '—'],
  ]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            label={view === 'sequence' ? `Hailstone sequence of ${n}: ${seq.length - 1} steps, peak ${peak}.` : `Collatz coral of the numbers 1 to ${N}.`}
            onFrame={(ctx, f) => {
              ctx.fillStyle = BG
              ctx.fillRect(0, 0, W, H)
              const total = view === 'sequence' ? seq.length : tree.maxDepth + 1
              if (f.dt > 0 && shown.current < total) shown.current = Math.min(total, shown.current + f.dt * (view === 'sequence' ? rate : rate * 3))
              const hv = hover.current

              if (view === 'sequence') {
                const k = Math.max(1, Math.floor(shown.current))
                const bw = (GR - GL) / seq.length
                const Yv = (v: number) => GB - (logScale ? Math.log(v) / Math.log(Math.max(2, peak)) : v / peak) * (GB - GT)
                line(ctx, GL, GB, GR, GB, 'rgba(255,255,255,0.3)')
                line(ctx, GL, GT, GL, GB, 'rgba(255,255,255,0.3)')
                for (const frac of [0.25, 0.5, 0.75, 1]) {
                  const v = logScale ? Math.max(2, peak) ** frac : peak * frac
                  line(ctx, GL, Yv(v), GR, Yv(v), 'rgba(255,255,255,0.07)')
                  text(ctx, fmt(v, 0), GL - 6, Yv(v) + 4, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
                }
                for (let i = 0; i < k && i < seq.length; i++) {
                  const v = seq[i]
                  const cur = i === k - 1
                  ctx.fillStyle = v % 2 === 0 ? EVEN : ODD
                  ctx.globalAlpha = cur ? 1 : 0.6
                  ctx.fillRect(GL + i * bw + (bw > 4 ? 1 : 0), Yv(v), Math.max(1, bw - (bw > 4 ? 2 : 0)), GB - Yv(v))
                }
                ctx.globalAlpha = 1
                ctx.beginPath()
                for (let i = 0; i < k && i < seq.length; i++) ctx.lineTo(GL + (i + 0.5) * bw, Yv(seq[i]))
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'
                ctx.lineWidth = 1.5
                ctx.stroke()
                // Peak and the current step.
                const pi = seq.indexOf(peak)
                if (pi < k) {
                  line(ctx, GL, Yv(peak), GR, Yv(peak), 'rgba(255,255,255,0.35)', 1, [5, 5])
                  text(ctx, `peak ${fmt(peak, 0)} at step ${pi}`, Math.min(GR - 170, GL + (pi + 0.5) * bw + 8), Yv(peak) - 8, { color: '#fff', size: 12 })
                }
                const ci = Math.min(seq.length - 1, k - 1)
                const cx = GL + (ci + 0.5) * bw
                circle(ctx, cx, Yv(seq[ci]), 5, '#fff')
                const op = ci < seq.length - 1 ? (seq[ci] % 2 === 0 ? '÷ 2' : '× 3 + 1') : 'reached 1'
                const label = `step ${ci}: ${fmt(seq[ci], 0)}  ${op}`
                rrect(ctx, 12, 8, label.length * 7.7 + 18, 26, 6, 'rgba(255,255,255,0.1)')
                text(ctx, label, 20, 26, { color: '#fff', size: 13, weight: 700 })
                text(ctx, 'step →', GR, GB + 18, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
                if (hv && hv.x > GL && hv.x < GR && hv.y > GT - 20 && hv.y < GB) {
                  const i = Math.floor((hv.x - GL) / bw)
                  if (i >= 0 && i < k) {
                    const t = `#${i}: ${fmt(seq[i], 0)}`
                    const bx = Math.min(GR - 110, hv.x + 12)
                    rrect(ctx, bx, hv.y - 30, t.length * 7.7 + 14, 24, 6, 'rgba(0,0,0,0.85)', 'rgba(255,255,255,0.3)')
                    text(ctx, t, bx + 7, hv.y - 13, { color: '#fff', size: 12 })
                  }
                }
              } else {
                const { s, ox, oy } = fit
                const d = shown.current
                const full = Math.floor(d)
                const frac = d - full
                const paths = Array.from({ length: BUCKETS }, () => new Path2D())
                for (let i = 1; i < tree.values.length; i++) {
                  const dep = tree.depth[i]
                  if (dep > full + 1) continue
                  const p = tree.parent[i]
                  const u = dep > full ? frac : 1
                  const x0 = ox + tree.x[p] * s
                  const y0 = oy + tree.y[p] * s
                  const path = paths[Math.min(BUCKETS - 1, Math.floor((dep / (tree.maxDepth + 1)) * BUCKETS))]
                  path.moveTo(x0, y0)
                  path.lineTo(x0 + (tree.x[i] - tree.x[p]) * s * u, y0 + (tree.y[i] - tree.y[p]) * s * u)
                }
                ctx.lineCap = 'round'
                paths.forEach((path, b) => {
                  ctx.strokeStyle = depthColor(b / (BUCKETS - 1), 0.75)
                  ctx.lineWidth = Math.max(0.8, 2.2 - (b / BUCKETS) * 1.4)
                  ctx.stroke(path)
                })
                circle(ctx, ox, oy, 4, '#fff')
                text(ctx, '1', ox + 8, oy + 4, { color: '#fff', size: 12, weight: 700 })
                // Hover: highlight the whole route from the nearest number back to 1.
                if (hv) {
                  let best = -1
                  let bd = 14
                  for (let i = 0; i < tree.values.length; i++) {
                    if (tree.depth[i] > full) continue
                    const dd = Math.hypot(ox + tree.x[i] * s - hv.x, oy + tree.y[i] * s - hv.y)
                    if (dd < bd) {
                      bd = dd
                      best = i
                    }
                  }
                  if (best >= 0) {
                    ctx.beginPath()
                    for (let i = best; i >= 0; i = tree.parent[i]) ctx.lineTo(ox + tree.x[i] * s, oy + tree.y[i] * s)
                    ctx.strokeStyle = '#fff'
                    ctx.lineWidth = 2.5
                    ctx.stroke()
                    const bx = ox + tree.x[best] * s
                    const by = oy + tree.y[best] * s
                    circle(ctx, bx, by, 5, '#fff')
                    const t = `${fmt(tree.values[best], 0)}: ${tree.depth[best]} steps to 1`
                    const tx = Math.min(W - t.length * 7.7 - 24, bx + 12)
                    rrect(ctx, tx, by - 32, t.length * 7.7 + 14, 24, 6, 'rgba(0,0,0,0.85)', 'rgba(255,255,255,0.3)')
                    text(ctx, t, tx + 7, by - 15, { color: '#fff', size: 12 })
                  }
                }
                text(ctx, `depth ${Math.min(tree.maxDepth, full)} / ${tree.maxDepth}`, 14, 24, { color: 'rgba(255,255,255,0.6)', size: 12 })
              }
              if (f.frame % 8 === 0 && Math.floor(shown.current) !== shownView) setShownView(Math.floor(shown.current))
            }}
          />
          {view === 'sequence' && (
            <div className="sim-cells" aria-label="Sequence">
              {seq.slice(Math.max(0, shownView - 14), Math.max(1, shownView) + 6).map((v, i) => {
                const idx = Math.max(0, shownView - 14) + i
                return (
                  <span key={idx} className={idx === shownView - 1 ? 'on' : idx >= shownView ? 'dim' : ''}>
                    {v}
                  </span>
                )
              })}
            </div>
          )}
          {view === 'sequence' ? <Legend items={[[EVEN, 'even → halve'], [ODD, 'odd → 3n + 1']]} /> : null}
          <Readout
            items={
              view === 'sequence'
                ? seqStats
                : [
                    ['Numbers', `1 … ${fmt(N, 0)}`],
                    ['Branch points', fmt(tree.values.length, 0)],
                    ['Deepest path', `${tree.maxDepth} steps`],
                    ['Longest start ≤ N', `${fmt(longest.best, 0)} (${longest.steps})`],
                  ]
            }
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { shown.current = 0; setRunning(true) }} resetLabel="Replay" />
      <Choice label="View" value={view} options={[['sequence', 'Sequence'], ['tree', 'Coral tree']]} onChange={(v) => { setView(v); shown.current = 0 }} />
      {view === 'sequence' ? (
        <>
          <div className="sim-field">
            <label className="sim-label" htmlFor="collatz-n">Starting number n</label>
            <div className="row" style={{ gap: 6, margin: 0, flexWrap: 'nowrap' }}>
              <input id="collatz-n" type="number" min={1} max={100000000} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pick(Number(input) || 1)} />
              <button type="button" className="btn" onClick={() => pick(Number(input) || 1)}>
                Go
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 6, margin: 0 }}>
            <button type="button" className="btn" onClick={() => pick(1 + Math.floor(Math.random() * 9999))}>
              Random
            </button>
            <button type="button" className="btn" onClick={() => pick(27)}>
              27
            </button>
            <button type="button" className="btn" onClick={() => pick(871)}>
              871
            </button>
          </div>
          <Slider label="Speed" value={rate} min={1} max={60} unit=" steps/s" onChange={setRate} />
          <Toggle label="Log scale" checked={logScale} onChange={setLogScale} />
        </>
      ) : (
        <>
          <Slider label="Numbers 1 … N" value={N} min={10} max={10000} step={10} onChange={(v) => { setBigN(v); shown.current = 0 }} />
          <Slider label="Even turn (left)" value={even} min={0} max={30} step={0.5} unit="°" onChange={setEven} />
          <Slider label="Odd turn (right)" value={odd} min={0} max={40} step={0.5} unit="°" onChange={setOdd} />
          <Slider label="Growth speed" value={rate} min={1} max={60} onChange={setRate} />
        </>
      )}
      <Hint>
        {view === 'sequence'
          ? 'Halve even numbers, triple odd ones and add 1. Every start ever tested falls to 1, but some climb very high first: 27 takes 111 steps and peaks at 9232. Click a bar to jump there.'
          : 'Every sequence is drawn backwards from 1, bending left at even numbers and right at odd ones, so shared endings become shared branches. Hover to trace a number back to 1.'}
      </Hint>
    </SimLayout>
  )
}
