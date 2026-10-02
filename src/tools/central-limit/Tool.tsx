import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { BINS, HI, LO, RunningStats, makeSource, sampleMean, type Kind } from './clt'

const W = 800
const H = 560
const X0 = 50
const X1 = 770
const SRC = { top: 44, bottom: 190 }
const STRIP = 238
const MEANS = { top: 300, bottom: 520 }
const MBINS = 100
const DOT = PALETTE[1]
const MEAN = PALETTE[0]
const CURVE = PALETTE[2]
const KINDS = [['uniform', 'Uniform'], ['exponential', 'Exponential (skewed)'], ['dice', 'Dice roll'], ['bimodal', 'Two humps'], ['custom', 'Custom (drag the bars)']] as const

const X = (v: number) => X0 + ((v - LO) / (HI - LO)) * (X1 - X0)

interface Draw {
  values: number[]
  mean: number
  t: number
  delays: number[]
  /** Already counted (fast mode just shows the latest sample). */
  recorded: boolean
}

/** Samples per second for a slider value 0–100: 0.5 … 200 on a log scale. */
const speedOf = (v: number) => 0.5 * 400 ** (v / 100)

export default function CentralLimit() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [kind, setKind] = useState<Kind>('exponential')
  const [custom, setCustom] = useState<number[]>(() => Array.from({ length: BINS }, (_, i) => (i < 8 ? 3 : i > 30 ? 1.5 : 0.4)))
  const [n, setN] = useState(5)
  const [speedV, setSpeedV] = useState(35)
  const [info, setInfo] = useState({ count: 0, mean: 0, sd: 0 })
  const source = useMemo(() => makeSource(kind, custom), [kind, custom])
  const sim = useRef({ bins: new Array<number>(MBINS).fill(0), stats: new RunningStats(), draw: null as Draw | null, acc: 0, random: Math.random })
  const paint = useRef<{ shape: number[]; last: number; lastH: number } | null>(null)

  function clearMeans() {
    sim.current.bins = new Array(MBINS).fill(0)
    sim.current.stats = new RunningStats()
    sim.current.draw = null
    setInfo({ count: 0, mean: 0, sd: 0 })
  }

  function record(mean: number) {
    const s = sim.current
    s.bins[clamp(Math.floor(((mean - LO) / (HI - LO)) * MBINS), 0, MBINS - 1)]++
    s.stats.push(mean)
  }

  function drawMany(count: number) {
    for (let i = 0; i < count; i++) record(sampleMean(source, n, sim.current.random).mean)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      const inside = p.y < SRC.bottom + 10 && p.y > SRC.top - 20
      paint.current = inside ? { shape: (kind === 'custom' ? custom : source.shape).slice(), last: -1, lastH: 0 } : null
    }
    const pt = paint.current
    if (!pt) return
    if (p.type === 'up') {
      paint.current = null
      return
    }
    // Dragging on the top chart paints a custom distribution, starting from the current shape.
    const i = clamp(Math.floor(((p.x - X0) / (X1 - X0)) * BINS), 0, BINS - 1)
    const h = clamp((SRC.bottom - p.y) / (SRC.bottom - SRC.top), 0, 1)
    const from = pt.last < 0 ? i : pt.last
    const steps = Math.abs(i - from)
    for (let k = 0; k <= steps; k++) {
      const j = from + Math.sign(i - from) * k
      pt.shape[j] = steps ? pt.lastH + ((h - pt.lastH) * k) / steps : h
    }
    pt.last = i
    pt.lastH = h
    if (pt.shape.every((v) => v <= 0)) pt.shape[i] = 0.02
    setCustom(pt.shape.slice())
    setKind('custom')
    clearMeans()
  }

  const theorySd = source.sd / Math.sqrt(n)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Sampling distribution of the mean for samples of ${n} from a ${kind} distribution; ${info.count} samples so far.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              const speed = speedOf(speedV)
              const animate = speed <= 4
              const dur = 1.6 / speed
              if (f.dt > 0) {
                if (animate) {
                  if (!s.draw || s.draw.recorded) {
                    const { values, mean } = sampleMean(source, n, s.random)
                    s.draw = { values, mean, t: 0, delays: values.map(() => Math.random() * 0.3), recorded: false }
                  }
                  s.draw.t += f.dt / dur
                  if (s.draw.t >= 1) {
                    record(s.draw.mean)
                    s.draw = null
                  }
                } else {
                  s.acc += f.dt * speed
                  let last: { values: number[]; mean: number } | null = null
                  while (s.acc >= 1) {
                    s.acc -= 1
                    last = sampleMean(source, n, s.random)
                    record(last.mean)
                  }
                  if (last) s.draw = { ...last, t: 0.6, delays: last.values.map(() => 0), recorded: true }
                }
              }
              clear(ctx, W, H, theme.surface)

              // Source distribution.
              text(ctx, 'Population', X0, SRC.top - 16, { color: theme.text, size: 14, weight: 700 })
              text(ctx, `μ = ${fmt(source.mean, 2)}, σ = ${fmt(source.sd, 2)}`, X1, SRC.top - 16, { color: theme.muted, size: 13, align: 'right' })
              const bw = (X1 - X0) / BINS
              source.shape.forEach((v, i) => {
                if (v <= 0) return
                const h = v * (SRC.bottom - SRC.top)
                if (source.discrete) rrect(ctx, X(LO + (i * (HI - LO)) / BINS) - 7, SRC.bottom - h, 14, h, 3, alpha(DOT, 0.55))
                else rrect(ctx, X0 + i * bw + 1, SRC.bottom - h, bw - 2, h, 2, alpha(DOT, kind === 'custom' ? 0.6 : 0.4))
              })
              line(ctx, X0, SRC.bottom, X1, SRC.bottom, alpha(theme.text, 0.5), 1.5)
              line(ctx, X(source.mean), SRC.top - 4, X(source.mean), SRC.bottom, theme.text, 1.5, [5, 4])
              for (let v = 0; v <= 10; v += 2) text(ctx, String(v), X(v), SRC.bottom + 15, { color: theme.muted, size: 12, align: 'center' })

              // The current sample: dots fall from the population into the strip, then their mean drops.
              const d = s.draw
              line(ctx, X0, STRIP + 8, X1, STRIP + 8, alpha(theme.border, 0.9), 1)
              text(ctx, `sample of ${n}`, X0, STRIP + 26, { color: theme.muted, size: 12 })
              if (d) {
                const fallT = clamp(d.t / 0.55, 0, 1)
                d.values.forEach((v, i) => {
                  const u = clamp((fallT - d.delays[i]) / (1 - 0.3), 0, 1)
                  const y = SRC.bottom + (STRIP - SRC.bottom) * u * u
                  circle(ctx, X(v), y, 4.5, alpha(DOT, 0.85), theme.surface, 1)
                })
                if (d.t > 0.5) {
                  const m = clamp((d.t - 0.5) / 0.2, 0, 1)
                  d.values.forEach((v) => line(ctx, X(v), STRIP, X(d.mean), STRIP, alpha(MEAN, 0.3 * (1 - m) + 0.1), 1))
                  const drop = clamp((d.t - 0.7) / 0.3, 0, 1)
                  const my = STRIP + (MEANS.bottom - 10 - STRIP) * drop * drop
                  ctx.save()
                  ctx.translate(X(d.mean), my)
                  ctx.rotate(Math.PI / 4)
                  ctx.fillStyle = MEAN
                  ctx.fillRect(-6, -6, 12, 12)
                  ctx.restore()
                  if (drop < 0.3) text(ctx, `mean ${fmt(d.mean, 2)}`, X(d.mean), STRIP - 12, { color: MEAN, size: 13, weight: 700, align: 'center' })
                }
              }

              // Sampling distribution of the mean, with the normal curve the CLT predicts.
              text(ctx, 'Sample means', X0, MEANS.top - 12, { color: theme.text, size: 14, weight: 700 })
              text(ctx, `normal curve: mean ${fmt(source.mean, 2)}, sd σ/√n = ${fmt(theorySd, 3)}`, X1, MEANS.top - 12, { color: CURVE, size: 13, align: 'right' })
              const total = s.stats.n
              const mw = (X1 - X0) / MBINS
              const binW = (HI - LO) / MBINS
              const peak = total * binW * (1 / (theorySd * Math.sqrt(2 * Math.PI)))
              const top = Math.max(1, ...s.bins, peak) * 1.08
              const Yc = (c: number) => MEANS.bottom - (c / top) * (MEANS.bottom - MEANS.top)
              s.bins.forEach((c, i) => {
                if (c) rrect(ctx, X0 + i * mw + 0.5, Yc(c), mw - 1, MEANS.bottom - Yc(c), 1.5, alpha(MEAN, 0.75))
              })
              line(ctx, X0, MEANS.bottom, X1, MEANS.bottom, alpha(theme.text, 0.5), 1.5)
              if (total > 0 && theorySd > 0) {
                ctx.beginPath()
                for (let px = X0; px <= X1; px += 2) {
                  const v = LO + ((px - X0) / (X1 - X0)) * (HI - LO)
                  const dens = Math.exp(-0.5 * ((v - source.mean) / theorySd) ** 2) / (theorySd * Math.sqrt(2 * Math.PI))
                  const y = Yc(total * binW * dens)
                  if (px === X0) ctx.moveTo(px, y)
                  else ctx.lineTo(px, y)
                }
                ctx.strokeStyle = CURVE
                ctx.lineWidth = 2.5
                ctx.stroke()
              }
              for (let v = 0; v <= 10; v += 2) text(ctx, String(v), X(v), MEANS.bottom + 16, { color: theme.muted, size: 12, align: 'center' })
              if (f.frame % 8 === 0 && (info.count !== total || info.mean !== s.stats.mean)) setInfo({ count: total, mean: s.stats.mean, sd: s.stats.sd })
            }}
          />
          <Legend items={[[DOT, 'Population and sample values'], [MEAN, 'Sample means'], [CURVE, 'Normal curve N(μ, σ/√n)']]} />
          <Readout
            items={[
              ['Samples', fmt(info.count, 0)],
              ['Mean of means', info.count ? fmt(info.mean, 3) : '—'],
              ['Population μ', fmt(source.mean, 3)],
              ['SD of means', info.count > 1 ? fmt(info.sd, 3) : '—'],
              ['Theory σ/√n', fmt(theorySd, 3)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={clearMeans} resetLabel="Clear">
        <button type="button" className="btn" onClick={() => drawMany(1000)}>
          Draw 1000
        </button>
      </PlayBar>
      <Select<Kind> label="Population" value={kind} options={KINDS} onChange={(k) => { setKind(k); clearMeans() }} />
      <Slider label="Sample size n" value={n} min={1} max={50} onChange={(v) => { setN(v); clearMeans() }} />
      <Slider label="Speed" value={speedV} min={0} max={100} format={(v) => `${fmt(speedOf(v), 1)} samples/s`} onChange={setSpeedV} />
      <Hint>Each tick takes n values from the population on top and drops their average into the chart below. Whatever the population looks like, the averages pile up into a bell curve, and it narrows like σ/√n as n grows. Drag on the top chart to draw your own population.</Hint>
    </SimLayout>
  )
}
