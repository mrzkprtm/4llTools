import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { dart, estimatePi, isInside, standardError, type Target } from './montecarlo'

const W = 800
const H = 460
const SX = 24
const SY = 30
const SS = 400
const LAYER = 800
const IN = PALETTE[1]
const OUT = PALETTE[0]
const CH = { x0: 500, x1: 780, y0: 50, y1: 400, lo: 2.7, hi: 3.6 }
const RECENT = 160

interface Recent {
  x: number
  y: number
  inside: boolean
  age: number
}

/** Darts per frame (at 60 fps) for a speed slider value 0–100: 0.1 … 2000 on a log scale. */
const rateOf = (v: number) => 10 ** ((v / 100) * 4.3 - 1)
const countLabel = (n: number) => (n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}k` : String(n))

export default function MonteCarloPi() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [target, setTarget] = useState<Target>('quarter')
  const [rate, setRate] = useState(45)
  const [stats, setStats] = useState({ total: 0, inside: 0 })
  const sim = useRef({ inside: 0, total: 0, random: rng(1), recent: [] as Recent[], hist: [] as [number, number][], nextRec: 1 })
  const layer = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null)

  function getLayer() {
    if (!layer.current) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = LAYER
      layer.current = { canvas, ctx: canvas.getContext('2d')! }
    }
    return layer.current
  }

  function reset(t: Target = target) {
    sim.current = { inside: 0, total: 0, random: rng((Date.now() % 1e9) + 1), recent: [], hist: [], nextRec: 1 }
    if (layer.current) layer.current.ctx.clearRect(0, 0, LAYER, LAYER)
    setStats({ total: 0, inside: 0 })
    setTarget(t)
  }

  function throwN(n: number) {
    const s = sim.current
    const { ctx } = getLayer()
    const ins = new Path2D()
    const outs = new Path2D()
    const dot = n > 2000 ? 1.6 : 2.4
    for (let i = 0; i < n; i++) {
      const [x, y] = dart(s.random, target)
      const inside = isInside(x, y)
      s.total++
      if (inside) s.inside++
      const u = target === 'quarter' ? x : (x + 1) / 2
      const v = target === 'quarter' ? y : (y + 1) / 2
      ;(inside ? ins : outs).rect(u * LAYER - dot / 2, (1 - v) * LAYER - dot / 2, dot, dot)
      if (n - i <= RECENT) {
        s.recent.push({ x: u, y: v, inside, age: 0 })
        if (s.recent.length > RECENT) s.recent.shift()
      }
      if (s.total >= s.nextRec) {
        s.hist.push([s.total, estimatePi(s.inside, s.total)])
        s.nextRec = Math.max(s.total + 1, Math.ceil(s.total * 1.02))
      }
    }
    ctx.fillStyle = alpha(IN, 0.55)
    ctx.fill(ins)
    ctx.fillStyle = alpha(OUT, 0.55)
    ctx.fill(outs)
  }

  const est = estimatePi(stats.inside, stats.total)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`${stats.total} random darts, ${stats.inside} inside the circle, estimating pi as ${fmt(est, 4)}.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0) {
                // Fractional rates below one dart per frame accumulate over frames.
                const per = rateOf(rate) * f.dt * 60
                throwN(Math.floor(per) + (Math.random() < per % 1 ? 1 : 0))
              }
              for (const r of s.recent) r.age += 1 / 60
              clear(ctx, W, H, theme.sunken)

              // Target square and circle.
              rrect(ctx, SX, SY, SS, SS, 2, theme.surface, alpha(theme.text, 0.5), 1.5)
              ctx.beginPath()
              if (target === 'quarter') ctx.arc(SX, SY + SS, SS, -Math.PI / 2, 0)
              else ctx.arc(SX + SS / 2, SY + SS / 2, SS / 2, 0, Math.PI * 2)
              ctx.fillStyle = alpha(IN, 0.07)
              if (target === 'full') ctx.fill()
              else {
                ctx.lineTo(SX, SY + SS)
                ctx.closePath()
                ctx.fill()
              }
              ctx.strokeStyle = alpha(theme.text, 0.6)
              ctx.lineWidth = 1.5
              ctx.stroke()
              if (layer.current) ctx.drawImage(layer.current.canvas, SX, SY, SS, SS)
              for (const r of s.recent) {
                const a = Math.max(0, 1 - r.age / 1.2)
                if (a <= 0) continue
                circle(ctx, SX + r.x * SS, SY + (1 - r.y) * SS, 3 + 5 * a, alpha(r.inside ? IN : OUT, 0.25 + 0.6 * a), alpha(theme.surface, a), 1)
              }
              text(ctx, target === 'quarter' ? 'area ratio = π/4' : 'circle / square = π/4', SX + SS / 2, SY + SS + 22, { color: theme.muted, size: 13, align: 'center' })

              // Convergence chart: estimate against samples (log scale) with a ±1 standard error funnel.
              const maxLog = Math.max(2, Math.ceil(Math.log10(Math.max(1, s.total)) + 0.15))
              const X = (n: number) => CH.x0 + (Math.log10(Math.max(1, n)) / maxLog) * (CH.x1 - CH.x0)
              const Y = (v: number) => CH.y1 - ((Math.min(CH.hi, Math.max(CH.lo, v)) - CH.lo) / (CH.hi - CH.lo)) * (CH.y1 - CH.y0)
              rrect(ctx, CH.x0, CH.y0, CH.x1 - CH.x0, CH.y1 - CH.y0, 4, theme.surface, theme.border)
              ctx.beginPath()
              for (let k = 0; k <= maxLog + 1e-9; k += 0.05) ctx.lineTo(X(10 ** k), Y(Math.PI + standardError(10 ** k)))
              for (let k = maxLog; k >= -1e-9; k -= 0.05) ctx.lineTo(X(10 ** k), Y(Math.PI - standardError(10 ** k)))
              ctx.closePath()
              ctx.fillStyle = alpha(theme.accent, 0.12)
              ctx.fill()
              for (const v of [2.8, 3.0, 3.2, 3.4]) {
                line(ctx, CH.x0, Y(v), CH.x1, Y(v), alpha(theme.border, 0.8))
                text(ctx, v.toFixed(1), CH.x0 - 6, Y(v) + 4, { color: theme.muted, size: 12, align: 'right' })
              }
              for (let k = 0; k <= maxLog; k++) text(ctx, countLabel(10 ** k), X(10 ** k), CH.y1 + 16, { color: theme.muted, size: 12, align: 'center' })
              line(ctx, CH.x0, Y(Math.PI), CH.x1, Y(Math.PI), theme.text, 1.5, [6, 4])
              text(ctx, 'π', CH.x1 + 4, Y(Math.PI) + 5, { color: theme.text, size: 14, weight: 700 })
              if (s.hist.length > 1) {
                ctx.beginPath()
                s.hist.forEach(([n, v], i) => (i ? ctx.lineTo(X(n), Y(v)) : ctx.moveTo(X(n), Y(v))))
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 2
                ctx.lineJoin = 'round'
                ctx.stroke()
                const [ln, lv] = s.hist[s.hist.length - 1]
                circle(ctx, X(ln), Y(lv), 4.5, theme.accent)
              }
              text(ctx, `π ≈ ${s.total ? estimatePi(s.inside, s.total).toFixed(5) : '?'}`, CH.x0 + 10, CH.y0 - 14, { color: theme.text, size: 17, weight: 700 })
              text(ctx, 'darts thrown (log scale)', (CH.x0 + CH.x1) / 2, CH.y1 + 36, { color: theme.muted, size: 12, align: 'center' })

              if (f.frame % 6 === 0 && (stats.total !== s.total || stats.inside !== s.inside)) setStats({ total: s.total, inside: s.inside })
            }}
          />
          <Legend items={[[IN, 'Inside the circle'], [OUT, 'Outside'], [alpha(theme.accent, 0.35), '±1 standard error, 1.64/√n']]} />
          <Readout
            items={[
              ['Samples', fmt(stats.total, 0)],
              ['Inside', fmt(stats.inside, 0)],
              ['Estimate of π', stats.total ? est.toFixed(5) : '—'],
              ['Error', stats.total ? `${est - Math.PI >= 0 ? '+' : '−'}${Math.abs(est - Math.PI).toFixed(5)}` : '—'],
              ['Typical error', stats.total ? `±${standardError(stats.total).toFixed(4)}` : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <div className="row sim-bar">
        {[1, 100, 10000].map((n) => (
          <button key={n} type="button" className="btn" onClick={() => throwN(n)}>
            Throw {n.toLocaleString('en-US')}
          </button>
        ))}
      </div>
      <Choice label="Target" value={target} options={[['quarter', 'Quarter circle'], ['full', 'Full circle']]} onChange={(t) => reset(t)} />
      <Slider label="Throwing speed" value={rate} min={0} max={100} format={(v) => `${fmt(rateOf(v) * 60, 0)} darts/s`} onChange={setRate} />
      <Hint>Every dart lands at a random spot in the square. The circle covers π/4 of it, so four times the fraction inside estimates π. The error shrinks like 1/√n: a hundred times more darts buys only one more correct digit.</Hint>
    </SimLayout>
  )
}
