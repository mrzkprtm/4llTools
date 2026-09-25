import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, lerp, rng } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { centroid, fractionWithin, rmsDistance, stepAll, stepMoments, theoryRms, theoryWithin, type WalkMode } from './walk'

const W = 800
const H = 500
const MAX_STEPS = 3000
const TRAILS_1D = 30
const TRAILS_2D = 8
const TRAIL_LEN = 200
// 1D layout: time runs left to right, the histogram sits on the right.
const PL = 44
const PR = 610
const HX = 628
const Y0 = H / 2

function makeState(count: number) {
  return {
    xs: new Float64Array(count),
    ys: new Float64Array(count),
    steps: 0,
    hist: Array.from({ length: Math.min(count, TRAILS_1D) }, () => new Float32Array(MAX_STEPS + 1)),
    trails: Array.from({ length: Math.min(count, TRAILS_2D) }, () => [0, 0] as number[]),
    rms: [0] as number[],
    random: rng((Math.random() * 1e9) | 0),
    acc: 0,
    scale: 1,
  }
}

export default function RandomWalk() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<WalkMode>('1d')
  const [count, setCount] = useState(200)
  const [step, setStep] = useState(4)
  const [bias, setBias] = useState(0)
  const [rate, setRate] = useState(40)
  const [info, setInfo] = useState({ n: 0, mean: 0, rms: 0 })
  const sim = useRef(makeState(200))
  const hover = useRef<{ x: number; y: number } | null>(null)

  function reset(c = count) {
    sim.current = makeState(c)
    setInfo({ n: 0, mean: 0, rms: 0 })
  }

  function advance(k: number) {
    const s = sim.current
    for (let j = 0; j < k && s.steps < MAX_STEPS; j++) {
      stepAll(mode, s.xs, s.ys, step, bias, s.random)
      s.steps++
      s.hist.forEach((h, i) => (h[s.steps] = s.xs[i]))
      s.trails.forEach((t, i) => {
        t.push(s.xs[i], s.ys[i])
        if (t.length > TRAIL_LEN * 2) t.splice(0, 2)
      })
      s.rms.push(rmsDistance(s.xs, s.ys))
    }
  }

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
  }

  const theory = theoryRms(info.n, mode, step, bias)
  const is1D = mode === '1d'

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`${count} random walkers in ${is1D ? 'one dimension' : mode === 'lattice' ? 'a 2D lattice' : '2D Brownian motion'} after ${info.n} steps.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0) {
                s.acc += f.dt * rate
                const k = Math.floor(s.acc)
                s.acc -= k
                advance(Math.min(k, 60))
              }
              const n = s.steps
              const { mx, m2 } = stepMoments(mode, step, bias)
              const sigma = Math.sqrt(m2 - mx * mx)
              const th = theoryRms(n, mode, step, bias)
              clear(ctx, W, H, theme.sunken)
              let within: [number, number, number] | null = null

              if (is1D) {
                const span = Math.max(200, n)
                const X = (k: number) => PL + (k / span) * (PR - PL)
                const far = Math.max(theoryRms(span, mode, step, bias) * 2.4, Math.abs(span * mx) + 2.5 * Math.sqrt(span) * sigma)
                const target = Math.min(1.5, (H / 2 - 16) / Math.max(far, 1))
                s.scale = f.frame === 0 ? target : lerp(s.scale, target, 0.1)
                const Y = (v: number) => Y0 - v * s.scale
                // Shaded ±1σ and ±2σ envelopes around the drift line.
                for (const [m, a] of [[2, 0.08], [1, 0.12]] as const) {
                  ctx.beginPath()
                  for (let k = 0; k <= span; k += Math.max(1, span / 120)) ctx.lineTo(X(k), Y(k * mx + m * Math.sqrt(k) * sigma))
                  for (let k = span; k >= 0; k -= Math.max(1, span / 120)) ctx.lineTo(X(k), Y(k * mx - m * Math.sqrt(k) * sigma))
                  ctx.fillStyle = alpha(theme.accent, a)
                  ctx.fill()
                }
                line(ctx, PL, Y0, PR, Y0, theme.border, 1)
                line(ctx, X(0), Y(0), X(span), Y(span * mx), alpha(theme.accent, 0.6), 1.5, [5, 5])
                text(ctx, '±√n·σ', PL + 6, 20, { color: theme.muted, size: 12 })
                text(ctx, `steps → ${span}`, PR - 4, H - 10, { color: theme.muted, size: 12, align: 'right' })
                // Fanning paths of the first walkers, then a dot for every walker.
                const every = Math.max(1, Math.floor(n / 400))
                s.hist.forEach((h, i) => {
                  ctx.beginPath()
                  for (let k = 0; k <= n; k += every) ctx.lineTo(X(k), Y(h[k]))
                  ctx.lineTo(X(n), Y(h[n]))
                  ctx.strokeStyle = alpha(PALETTE[i % PALETTE.length], 0.55)
                  ctx.lineWidth = 1.2
                  ctx.stroke()
                })
                ctx.fillStyle = alpha(theme.text, 0.35)
                for (let i = 0; i < s.xs.length; i++) {
                  ctx.beginPath()
                  ctx.arc(X(n) + ((i * 7) % 11) - 5, Y(s.xs[i]), 2.4, 0, Math.PI * 2)
                  ctx.fill()
                }
                // Sideways histogram of the current positions with the normal curve on top.
                rrect(ctx, HX, 8, W - HX - 8, H - 16, 8, theme.surface, theme.border)
                // Bins are a whole number of 2·step wide and centred on reachable sites, so parity never leaves gaps.
                const range = (H / 2 - 16) / s.scale
                const bw = 2 * step * Math.max(1, Math.ceil(range / 16 / (2 * step)))
                const off = (n % 2) * step
                const jm = Math.ceil(range / bw) + 1
                const counts = new Array<number>(2 * jm + 1).fill(0)
                for (let i = 0; i < s.xs.length; i++) {
                  const j = Math.round((s.xs[i] - off) / bw) + jm
                  if (j >= 0 && j < counts.length) counts[j]++
                }
                const peak = Math.max(4, ...counts)
                const hw = W - HX - 30
                const lo = -range
                ctx.save()
                ctx.beginPath()
                ctx.rect(HX, 10, W - HX - 10, H - 20)
                ctx.clip()
                ctx.fillStyle = alpha(theme.accent, 0.75)
                counts.forEach((c, j) => {
                  const mid = off + (j - jm) * bw
                  ctx.fillRect(HX + 10, Y(mid + bw / 2), (c / peak) * hw, Math.max(1, bw * s.scale - 1))
                })
                if (n > 0) {
                  // Expected count per bin from the normal approximation (the lattice only hits every other bin width 2·step).
                  const sd = Math.sqrt(n) * sigma
                  ctx.beginPath()
                  for (let v = lo; v <= -lo; v += bw / 3) {
                    const e = (s.xs.length * bw * Math.exp(-((v - n * mx) ** 2) / (2 * sd * sd))) / (sd * Math.sqrt(2 * Math.PI))
                    ctx.lineTo(HX + 10 + Math.min(1.1, e / peak) * hw, Y(v))
                  }
                  ctx.strokeStyle = theme.text
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }
                ctx.restore()
                text(ctx, 'final positions', HX + 12, 26, { color: theme.muted, size: 12 })
                const hv = hover.current
                if (hv && hv.x < PR) {
                  const d = Math.abs(Y0 - hv.y) / s.scale
                  line(ctx, PL, Y(d), PR, Y(d), theme.text, 1, [3, 4])
                  line(ctx, PL, Y(-d), PR, Y(-d), theme.text, 1, [3, 4])
                  within = [d, fractionWithin(mode, s.xs, s.ys, d), theoryWithin(mode, n, step, bias, d)]
                }
              } else {
                const cx = W / 2 - 60
                const cy = H / 2
                const [gx, gy] = centroid(s.xs, s.ys)
                const far = Math.max(th * 2.2, 40, Math.hypot(gx, gy) + th * 1.6)
                const target = Math.min(1.5, (H / 2 - 14) / far)
                s.scale = f.frame === 0 ? target : lerp(s.scale, target, 0.08)
                const sc = s.scale
                if (mode === 'lattice' && step * sc >= 6) {
                  ctx.beginPath()
                  const g = step * sc
                  for (let x = cx % g; x < W; x += g) ctx.rect(x, 0, 0, H)
                  for (let y = cy % g; y < H; y += g) ctx.rect(0, y, W, 0)
                  ctx.strokeStyle = alpha(theme.border, 0.7)
                  ctx.lineWidth = 1
                  ctx.stroke()
                }
                line(ctx, cx - 10, cy, cx + 10, cy, theme.muted, 1.5)
                line(ctx, cx, cy - 10, cx, cy + 10, theme.muted, 1.5)
                circle(ctx, cx, cy, th * sc, alpha(theme.accent, 0.08), theme.accent, 1.5)
                ctx.setLineDash([6, 5])
                circle(ctx, cx, cy, s.rms[n] * sc, undefined, theme.text, 1.5)
                ctx.setLineDash([])
                text(ctx, 'theory √n·step', cx + th * sc * 0.72 + 6, cy - th * sc * 0.72 - 4, { color: theme.accent, size: 12 })
                ctx.fillStyle = alpha(theme.text, 0.45)
                for (let i = 0; i < s.xs.length; i++) {
                  ctx.beginPath()
                  ctx.arc(cx + s.xs[i] * sc, cy - s.ys[i] * sc, 2.2, 0, Math.PI * 2)
                  ctx.fill()
                }
                s.trails.forEach((t, i) => {
                  const c = PALETTE[i % PALETTE.length]
                  const pts = t.length / 2
                  // Draw the trail in chunks so older parts fade out.
                  for (let a = 0; a < pts - 1; a += 20) {
                    ctx.beginPath()
                    for (let k = a; k <= Math.min(pts - 1, a + 20); k++) ctx.lineTo(cx + t[k * 2] * sc, cy - t[k * 2 + 1] * sc)
                    ctx.strokeStyle = alpha(c, 0.1 + 0.8 * ((a + 20) / pts) ** 1.5)
                    ctx.lineWidth = 1.6
                    ctx.stroke()
                  }
                  circle(ctx, cx + s.xs[i] * sc, cy - s.ys[i] * sc, 4.5, c, theme.surface, 1.5)
                })
                circle(ctx, cx + gx * sc, cy - gy * sc, 4, undefined, theme.danger, 2)
                // RMS distance against √n.
                const px = W - 214
                const py = H - 134
                rrect(ctx, px, py, 204, 124, 8, alpha(theme.surface, 0.92), theme.border)
                const span = Math.max(100, n)
                const theo = Array.from({ length: 61 }, (_, i) => theoryRms((i / 60) * span, mode, step, bias))
                const meas = s.rms.filter((_, i) => i % Math.max(1, Math.ceil(span / 300)) === 0)
                const top = Math.max(theo[60], ...s.rms) * 1.05
                chart(ctx, px + 10, py + 26, 184, 88, [{ data: theo, color: theme.accent, width: 2 }], { min: 0, max: top, axis: theme.border })
                chart(ctx, px + 10, py + 26, (184 * n) / span, 88, [{ data: meas, color: theme.text, width: 1.5 }], { min: 0, max: top })
                text(ctx, 'RMS vs steps', px + 10, py + 18, { color: theme.muted, size: 12 })
                const hv = hover.current
                if (hv && !(hv.x > px && hv.y > py)) {
                  const d = Math.hypot(hv.x - cx, hv.y - cy) / sc
                  ctx.setLineDash([3, 4])
                  circle(ctx, cx, cy, d * sc, undefined, theme.muted, 1)
                  ctx.setLineDash([])
                  within = [d, fractionWithin(mode, s.xs, s.ys, d), theoryWithin(mode, n, step, bias, d)]
                }
              }
              if (within) {
                const [d, got, want] = within
                const label = `within ${fmt(d, 1)}: ${Math.round(got * 100)}%` + (Number.isFinite(want) ? ` (theory ${Math.round(want * 100)}%)` : '')
                rrect(ctx, 10, H - 36, label.length * 7.6 + 16, 26, 6, alpha(theme.surface, 0.92), theme.border)
                text(ctx, label, 18, H - 18, { color: theme.text, size: 12 })
              }
              if (n >= MAX_STEPS) text(ctx, 'max steps reached — press Reset', is1D ? PL + 6 : 14, 40, { color: theme.danger, size: 12 })
              if (f.frame % 8 === 0 && (n !== info.n || f.frame === 0)) {
                const [gx, gy] = centroid(s.xs, s.ys)
                setInfo({ n, mean: is1D ? gx : Math.hypot(gx, gy), rms: s.rms[n] })
              }
            }}
          />
          <Readout
            items={[
              ['Steps n', info.n],
              ['Mean displacement', fmt(info.mean, 2)],
              ['RMS distance', fmt(info.rms, 2)],
              [bias ? 'Theory (with drift)' : 'Theory √n·step', fmt(theory, 2)],
              ['Measured ÷ theory', info.n ? fmt(info.rms / theory, 3) : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} onStep={() => advance(1)} />
      <Choice label="Walk" value={mode} options={[['1d', '1D'], ['lattice', '2D lattice'], ['brownian', 'Brownian']]} onChange={(m) => { setMode(m); reset() }} />
      <Slider label="Walkers" value={count} min={1} max={500} onChange={(v) => { setCount(v); reset(v) }} />
      <Slider label="Step size" value={step} min={1} max={12} step={0.5} onChange={(v) => { setStep(v); reset() }} />
      <Slider label="Drift (bias)" value={bias} min={-0.5} max={0.5} step={0.05} format={(v) => (v > 0 ? `+${v}` : String(v))} onChange={(v) => { setBias(v); reset() }} />
      <Slider label="Speed" value={rate} min={1} max={240} unit=" steps/s" onChange={setRate} />
      <Hint>Every walker flips a coin each step, yet the cloud spreads in a predictable way: the RMS distance grows like √n, not n. Hover over the stage to see what share of walkers stays within that distance.</Hint>
    </SimLayout>
  )
}
