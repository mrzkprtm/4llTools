import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { deg, fmt, pushCap, rad, rk4 } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { exactPeriod, pendulumDeriv, pendulumEnergy, smallAnglePeriod } from './pendulum'

const W = 800
const H = 480
const PX = 290
const PY = 40
const PPM = 115
const GRAVITY = [['9.81', 'Earth'], ['1.62', 'Moon'], ['3.71', 'Mars'], ['24.79', 'Jupiter'], ['0.6', 'Pluto']] as const

export default function PendulumLab() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [L, setL] = useState(2)
  const [g, setG] = useState<(typeof GRAVITY)[number][0]>('9.81')
  const [damping, setDamping] = useState(0.02)
  const [mass, setMass] = useState(1)
  const [amp, setAmp] = useState(40)
  const [trail, setTrail] = useState(true)
  const [readout, setReadout] = useState({ angle: 40, measured: 0 })
  const sim = useRef({ th: rad(40), w: 0, t: 0, trail: [] as [number, number][], phase: [] as [number, number][], lastTurn: -1, measured: 0, energy: [] as number[] })
  const dragging = useRef(false)
  const gv = Number(g)

  function reset(a = amp) {
    Object.assign(sim.current, { th: rad(a), w: 0, t: 0, trail: [], phase: [], lastTurn: -1, measured: 0, energy: [] })
  }

  function onPointer(p: SimPointer) {
    const s = sim.current
    const bx = PX + Math.sin(s.th) * L * PPM
    const by = PY + Math.cos(s.th) * L * PPM
    if (p.type === 'down' && Math.hypot(p.x - bx, p.y - by) < 40) dragging.current = true
    if (!dragging.current) return
    s.th = Math.atan2(p.x - PX, p.y - PY)
    s.w = 0
    s.trail = []
    s.lastTurn = -1
    if (p.type === 'up') {
      dragging.current = false
      setAmp(Math.round(deg(s.th)))
    }
  }

  const T0 = smallAnglePeriod(L, gv)
  const T = exactPeriod(L, gv, rad(readout.angle))

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`Pendulum of length ${L} metres swinging under gravity ${gv} metres per second squared.`}
            onPointer={onPointer}
            cursor="grab"
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0 && !dragging.current) {
                const n = 8
                for (let i = 0; i < n; i++) {
                  const prevW = s.w
                  ;[s.th, s.w] = rk4(pendulumDeriv(gv, L, damping), s.t, [s.th, s.w], f.dt / n)
                  s.t += f.dt / n
                  // A turning point on the right side marks one full period since the last one.
                  if (prevW > 0 && s.w <= 0) {
                    if (s.lastTurn >= 0) s.measured = s.t - s.lastTurn
                    s.lastTurn = s.t
                  }
                }
              }
              const bx = PX + Math.sin(s.th) * L * PPM
              const by = PY + Math.cos(s.th) * L * PPM
              if (f.dt > 0) {
                pushCap(s.trail, [bx, by], 90)
                pushCap(s.phase, [s.th, s.w], 600)
              }
              const e = pendulumEnergy(mass, gv, L, s.th, s.w)

              clear(ctx, W, H, theme.sunken)
              // Phase space: angle vs angular velocity.
              const px = 560
              const py = 30
              const pw = 210
              const ph = 190
              rrect(ctx, px, py, pw, ph, 8, theme.surface, theme.border)
              line(ctx, px, py + ph / 2, px + pw, py + ph / 2, theme.border)
              line(ctx, px + pw / 2, py, px + pw / 2, py + ph, theme.border)
              const maxTh = Math.max(0.3, rad(Math.abs(amp)) * 1.1)
              const maxW = Math.max(0.3, maxTh * Math.sqrt(gv / L) * 1.1)
              ctx.beginPath()
              s.phase.forEach(([a, w], i) => {
                const x = px + pw / 2 + (a / maxTh) * (pw / 2 - 6)
                const y = py + ph / 2 - (w / maxW) * (ph / 2 - 6)
                if (i) ctx.lineTo(x, y)
                else ctx.moveTo(x, y)
              })
              ctx.strokeStyle = theme.accent
              ctx.lineWidth = 1.5
              ctx.stroke()
              text(ctx, 'phase space  θ → ω ↑', px + 8, py + 16, { color: theme.muted, size: 12 })

              // Energy bars.
              const ey = 260
              text(ctx, 'energy', px, ey, { color: theme.muted, size: 12 })
              const maxE = Math.max(e.total, pendulumEnergy(mass, gv, L, rad(amp), 0).total, 1e-6)
              const bars: [string, number, string][] = [['kinetic', e.kinetic, '#1c7ed6'], ['potential', e.potential, '#2f9e44'], ['total', e.total, theme.accent]]
              bars.forEach(([name, v, c], i) => {
                const y = ey + 14 + i * 34
                rrect(ctx, px, y, pw, 22, 5, theme.surface, theme.border)
                rrect(ctx, px, y, Math.max(0, (v / maxE) * pw), 22, 5, alpha(c, 0.8))
                text(ctx, `${name} ${fmt(v, 2)} J`, px + 8, y + 16, { color: theme.text, size: 12 })
              })
              pushCap(s.energy, e.total, 300)
              chart(ctx, px, 390, pw, 60, [{ data: s.energy, color: theme.accent }], { min: 0, max: maxE, axis: theme.border, span: 300, label: 'total energy over time', labelColor: theme.muted })

              // The pendulum is drawn last so it passes over the panels.
              ctx.beginPath()
              ctx.arc(PX, PY, L * PPM, Math.PI / 2 - rad(Math.abs(amp)), Math.PI / 2 + rad(Math.abs(amp)))
              ctx.strokeStyle = alpha(theme.text, 0.12)
              ctx.setLineDash([4, 6])
              ctx.lineWidth = 1.5
              ctx.stroke()
              ctx.setLineDash([])
              line(ctx, PX, PY, PX, PY + L * PPM + 20, alpha(theme.text, 0.15), 1, [2, 4])
              if (trail)
                s.trail.forEach(([x, y], i) => circle(ctx, x, y, 2 + (i / s.trail.length) * 5, alpha(theme.accent, (i / s.trail.length) * 0.35)))
              rrect(ctx, PX - 60, PY - 12, 120, 12, 3, theme.text)
              line(ctx, PX, PY, bx, by, theme.text, 2.5)
              circle(ctx, PX, PY, 5, theme.surface, theme.text, 2)
              circle(ctx, bx, by, 12 + mass * 4, theme.accent, theme.surface, 3)
              text(ctx, `${fmt(deg(s.th), 1)}°`, PX + 12, PY + 34, { color: theme.muted, size: 13 })

              if (f.frame % 8 === 0) setReadout({ angle: Math.abs(amp), measured: s.measured })
            }}
          />
          <Readout
            items={[
              ['Small-angle period', `${fmt(T0, 3)} s`],
              ['Exact period', `${fmt(T, 3)} s`],
              ['Measured period', readout.measured ? `${fmt(readout.measured, 3)} s` : '…'],
              ['Frequency', `${fmt(1 / T, 3)} Hz`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <Slider label="Length" value={L} min={0.2} max={3} step={0.05} unit=" m" onChange={(v) => { setL(v); sim.current.trail = []; sim.current.lastTurn = -1 }} />
      <Slider label="Release angle" value={amp} min={-170} max={170} unit="°" onChange={(v) => { setAmp(v); reset(v) }} />
      <Select label="Gravity" value={g} options={GRAVITY} onChange={setG} />
      <Slider label="Damping" value={damping} min={0} max={1} step={0.01} onChange={setDamping} />
      <Slider label="Mass" value={mass} min={0.2} max={3} step={0.1} unit=" kg" onChange={setMass} />
      <Toggle label="Show trail" checked={trail} onChange={setTrail} />
      <Hint>Drag the bob to release it from any angle. Mass changes the energy but not the period; big swings take longer than the small-angle formula 2π√(L/g) predicts.</Hint>
    </SimLayout>
  )
}
