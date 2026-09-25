import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, deg, fmt, rad } from '../../sim/math'
import { alpha } from '../../sim/theme'
import { closedPeriod, gcd, lissajousPoint, piLabel, ratioLabel } from './lissajous'

const W = 800
const H = 520
const R = 185
const CX = 355
const CY = 310
const TOP = [18, 104] as const
const LEFT = [18, 142] as const
const SPAN = 4
const DRIFT = 0.12
const RATE = 1.2
const X_COL = '#4dabf7'
const Y_COL = '#69db7c'
const PEN = '#ffc53d'
const INK = '#f1efe8'
const DIM = '#8f8a7e'

const PRESETS = [
  ['1:1', '1 : 1 circle'],
  ['1:2', '1 : 2 figure eight'],
  ['3:2', '3 : 2 pretzel'],
  ['3:4', '3 : 4 knot'],
  ['5:4', '5 : 4 weave'],
  ['harmonograph', 'Harmonograph spiral'],
  ['custom', 'Custom'],
] as const
type Preset = (typeof PRESETS)[number][0]
const SETTINGS: Record<Exclude<Preset, 'custom'>, [number, number, number, number, boolean]> = {
  '1:1': [1, 1, 90, 0, false],
  '1:2': [1, 2, 0, 0, false],
  '3:2': [3, 2, 90, 0, false],
  '3:4': [3, 4, 90, 0, false],
  '5:4': [5, 4, 90, 0, false],
  harmonograph: [2, 3, 30, 0.02, true],
}

export default function LissajousCurves() {
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<Preset>('3:2')
  const [a, setA] = useState(3)
  const [b, setB] = useState(2)
  const [delta, setDelta] = useState(90)
  const [drift, setDrift] = useState(false)
  const [damping, setDamping] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [amp, setAmp] = useState(1)
  const sim = useRef({ t: 0, ph: rad(90) })
  const drag = useRef<{ x: number; ph: number } | null>(null)

  const g = gcd(a, b)
  const custom = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPreset('custom')
  }
  const setPhase = (d: number) => {
    sim.current.ph = rad(d)
    setDelta(d)
  }

  function load(p: Preset) {
    setPreset(p)
    if (p === 'custom') return
    const [na, nb, nd, nk, nDrift] = SETTINGS[p]
    setA(na)
    setB(nb)
    setPhase(nd)
    setDamping(nk)
    setDrift(nDrift)
    sim.current.t = 0
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') drag.current = { x: p.x, ph: sim.current.ph }
    const d = drag.current
    if (!d) return
    sim.current.ph = (((d.ph + (p.x - d.x) / 90) % TAU) + TAU) % TAU
    setDelta(Math.round(deg(sim.current.ph)))
    setPreset('custom')
    if (p.type === 'up') drag.current = null
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            className="sim-dark"
            cursor="ew-resize"
            onPointer={onPointer}
            label={`Lissajous figure with frequency ratio ${ratioLabel(a, b)} and phase ${delta} degrees.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0) {
                s.t += f.dt * RATE
                if (drift && !drag.current) s.ph = (s.ph + DRIFT * f.dt * RATE) % TAU
                if (damping > 0 && Math.exp(-damping * s.t) < 0.03) s.t = 0
              }
              const t = s.t
              const P = (tau: number) => lissajousPoint(tau, { a, b, delta: s.ph - (drift ? DRIFT * (t - tau) : 0), damping })
              clear(ctx, W, H, '#0d0c0b')

              // Plot frame, axes and the two strips.
              rrect(ctx, CX - R - 8, CY - R - 8, 2 * R + 16, 2 * R + 16, 8, '#15130f', '#2f2d28')
              line(ctx, CX - R, CY, CX + R, CY, '#2f2d28')
              line(ctx, CX, CY - R, CX, CY + R, '#2f2d28')
              rrect(ctx, CX - R - 8, TOP[0], 2 * R + 16, TOP[1] - TOP[0], 8, '#15130f', '#2f2d28')
              rrect(ctx, LEFT[0], CY - R - 8, LEFT[1] - LEFT[0], 2 * R + 16, 8, '#15130f', '#2f2d28')

              // Driving waves: x(t) scrolls up out of the top strip, y(t) scrolls left out of the side strip.
              const steps = 240
              ctx.lineWidth = 2
              ctx.beginPath()
              for (let i = 0; i <= steps; i++) {
                const age = (i / steps) * SPAN
                const [x] = P(t - age)
                const py = TOP[1] - 6 - (age / SPAN) * (TOP[1] - TOP[0] - 12)
                if (i) ctx.lineTo(CX + x * R, py)
                else ctx.moveTo(CX + x * R, py)
              }
              ctx.strokeStyle = X_COL
              ctx.stroke()
              ctx.beginPath()
              for (let i = 0; i <= steps; i++) {
                const age = (i / steps) * SPAN
                const [, y] = P(t - age)
                const px = LEFT[1] - 6 - (age / SPAN) * (LEFT[1] - LEFT[0] - 12)
                if (i) ctx.lineTo(px, CY - y * R)
                else ctx.moveTo(px, CY - y * R)
              }
              ctx.strokeStyle = Y_COL
              ctx.stroke()

              // The figure: one closed period, or the whole decaying history, fading with age.
              const len = damping > 0 ? Math.min(t, 200) : closedPeriod(a, b)
              const n = Math.min(4000, Math.ceil(len / Math.min(0.02, 0.12 / Math.max(a, b))))
              const chunks = 30
              ctx.lineCap = ctx.lineJoin = 'round'
              for (let c = 0; c < chunks; c++) {
                ctx.beginPath()
                const i0 = Math.floor((c * n) / chunks)
                const i1 = Math.floor(((c + 1) * n) / chunks)
                for (let i = i0; i <= i1; i++) {
                  const [x, y] = P(t - len + (i / n) * len)
                  if (i === i0) ctx.moveTo(CX + x * R, CY - y * R)
                  else ctx.lineTo(CX + x * R, CY - y * R)
                }
                ctx.strokeStyle = alpha(PEN, 0.08 + 0.92 * ((c + 1) / chunks) ** 1.5)
                ctx.lineWidth = 2.2
                ctx.stroke()
              }

              const [x, y] = P(t)
              const dx = CX + x * R
              const dy = CY - y * R
              line(ctx, dx, dy, dx, TOP[1] - 6, alpha(X_COL, 0.55), 1, [3, 4])
              line(ctx, dx, dy, LEFT[1] - 6, dy, alpha(Y_COL, 0.55), 1, [3, 4])
              circle(ctx, dx, TOP[1] - 6, 4.5, X_COL)
              circle(ctx, LEFT[1] - 6, dy, 4.5, Y_COL)
              circle(ctx, dx, dy, 12, alpha(PEN, 0.18))
              circle(ctx, dx, dy, 5.5, INK)

              // Side panel: formulas and the two phase dials.
              const RX = 575
              text(ctx, `x = sin(${a === 1 ? '' : a}t + ${fmt(deg(s.ph), 0)}°)`, RX, 40, { color: X_COL, size: 16, weight: 700 })
              text(ctx, `y = sin(${b === 1 ? '' : b}t)`, RX, 66, { color: Y_COL, size: 16, weight: 700 })
              if (damping > 0) text(ctx, `× e^(−${damping}t)`, RX, 90, { color: DIM, size: 13 })
              const dial = (cy: number, angle: number, col: string, label: string) => {
                const r = 46
                const ox = RX + 60
                circle(ctx, ox, cy, r, undefined, '#3a372f', 1.5)
                line(ctx, ox, cy, ox + r * Math.cos(angle), cy - r * Math.sin(angle), col, 2.5)
                circle(ctx, ox + r * Math.cos(angle), cy - r * Math.sin(angle), 4, col)
                text(ctx, label, ox + r + 16, cy + 5, { color: DIM, size: 13 })
              }
              dial(180, a * t + s.ph, X_COL, `${a}× speed`)
              dial(310, b * t, Y_COL, `${b}× speed`)
              text(ctx, ratioLabel(a, b).replace(':', ' : '), RX + 60, 440, { color: INK, size: 36, weight: 700, align: 'center' })
              text(ctx, 'frequency ratio', RX + 60, 466, { color: DIM, size: 13, align: 'center' })
              text(ctx, 'drag sideways to shift the phase', CX, H - 6, { color: DIM, size: 12, align: 'center' })

              if (f.frame % 8 === 0) {
                setAmp(damping > 0 ? Math.exp(-damping * t) : 1)
                if (drift) setDelta(Math.round(deg(s.ph)))
              }
            }}
          />
          <Readout
            items={[
              ['Ratio a : b', ratioLabel(a, b)],
              ['Period', piLabel(2, g)],
              ['Touches side × top', `${a / g} × ${b / g}`],
              ['Phase δ', `${delta}°`],
              ['Amplitude', `${fmt(amp * 100, 0)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (sim.current.t = 0)} resetLabel="Restart" />
      <Select label="Preset" value={preset} options={PRESETS} onChange={load} />
      <Slider label="x frequency a" value={a} min={1} max={10} onChange={custom(setA)} />
      <Slider label="y frequency b" value={b} min={1} max={10} onChange={custom(setB)} />
      <Slider label="Phase δ" value={delta} min={0} max={359} unit="°" onChange={custom(setPhase)} />
      <Toggle label="Let the phase drift" checked={drift} onChange={custom(setDrift)} />
      <Slider label="Damping" value={damping} min={0} max={0.1} step={0.002} onChange={custom(setDamping)} />
      <Slider label="Speed" value={speed} min={0.2} max={5} step={0.1} unit="×" onChange={setSpeed} />
      <Hint>The dot moves sideways with the blue wave and up and down with the green one. Whole-number ratios close into a loop, and the curve touches the sides a times and the top b times; turn on damping for harmonograph spirals.</Hint>
    </SimLayout>
  )
}
