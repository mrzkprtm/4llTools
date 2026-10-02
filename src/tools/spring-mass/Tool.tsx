import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, pushCap, rk4 } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { dampingRatio, dampingRegime, naturalFrequency, springDeriv, steadyAmplitude } from './spring'

const W = 800
const H = 480
const AX = 150
const TOP = 40
const REST = 250
const PPM = 200

function coil(ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number, color: string) {
  const turns = 14
  const seg = (y2 - y1 - 30) / (turns * 2)
  ctx.beginPath()
  ctx.moveTo(x, y1)
  ctx.lineTo(x, y1 + 15)
  for (let i = 0; i < turns * 2; i++) ctx.lineTo(x + (i % 2 ? -22 : 22), y1 + 15 + seg * (i + 0.5))
  ctx.lineTo(x, y2 - 15)
  ctx.lineTo(x, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  ctx.stroke()
}

export default function SpringMass() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [k, setK] = useState(20)
  const [m, setM] = useState(1)
  const [c, setC] = useState(0.4)
  const [F, setF] = useState(0)
  const [wd, setWd] = useState(4)
  const [amp, setAmp] = useState(0)
  const sim = useRef({ x: 0.5, v: 0, t: 0, xs: [] as number[], ke: [] as number[], pe: [] as number[] })
  const dragging = useRef(false)
  const p = { k, m, c, F, wd }
  const w0 = naturalFrequency(k, m)

  function onPointer(e: SimPointer) {
    const s = sim.current
    const my = REST + s.x * PPM
    if (e.type === 'down' && Math.abs(e.x - AX) < 70 && Math.abs(e.y - my) < 50) dragging.current = true
    if (!dragging.current) return
    s.x = clamp((e.y - REST) / PPM, -0.9, 0.9)
    s.v = 0
    if (e.type === 'up') dragging.current = false
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Mass on a spring, ${dampingRegime(k, m, c)}, natural frequency ${fmt(w0 / (2 * Math.PI))} hertz.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0 && !dragging.current) {
                for (let i = 0; i < 8; i++) {
                  ;[s.x, s.v] = rk4(springDeriv(p), s.t, [s.x, s.v], f.dt / 8)
                  s.t += f.dt / 8
                }
                if (Math.abs(s.x) > 3) s.x = Math.sign(s.x) * 3
              }
              if (f.dt > 0 || dragging.current) {
                pushCap(s.xs, s.x, 400)
                pushCap(s.ke, 0.5 * m * s.v * s.v, 400)
                pushCap(s.pe, 0.5 * k * s.x * s.x, 400)
              }
              clear(ctx, W, H, theme.sunken)
              rrect(ctx, AX - 70, TOP - 16, 140, 16, 3, theme.text)
              const my = REST + s.x * PPM
              const size = 40 + Math.sqrt(m) * 18
              // Equilibrium marker and driving arrow.
              line(ctx, AX - 90, REST, AX + 90, REST, alpha(theme.text, 0.25), 1, [4, 5])
              text(ctx, 'rest', AX + 94, REST + 4, { color: theme.muted, size: 12 })
              coil(ctx, AX, TOP, my - size / 2, theme.text)
              rrect(ctx, AX - size / 2, my - size / 2, size, size, 8, theme.accent, theme.surface, 3)
              text(ctx, `${m} kg`, AX, my + 5, { color: '#fff', size: 13, align: 'center', weight: 700 })
              if (F > 0) {
                const fy = F * Math.cos(wd * s.t)
                line(ctx, AX + size / 2 + 12, my, AX + size / 2 + 12, my + fy * 8, '#1c7ed6', 3)
              }
              // Position graph scrolling to the left.
              const gx = 300
              const gw = 470
              rrect(ctx, gx, 30, gw, 250, 8, theme.surface, theme.border)
              line(ctx, gx, 155, gx + gw, 155, theme.border)
              const peak = Math.max(0.2, ...s.xs.map(Math.abs))
              chart(ctx, gx + 6, 36, gw - 12, 238, [{ data: s.xs, color: theme.accent, width: 2 }], { min: -peak * 1.1, max: peak * 1.1, span: 400 })
              text(ctx, 'displacement over time', gx + 10, 50, { color: theme.muted, size: 12 })
              line(ctx, gx + gw - 6, 155 + (s.x / (peak * 1.1)) * 119, AX + size / 2, my, alpha(theme.accent, 0.25), 1, [3, 4])
              // Energy graph.
              rrect(ctx, gx, 300, gw, 150, 8, theme.surface, theme.border)
              const eMax = Math.max(1e-6, ...s.ke.map((v, i) => v + s.pe[i]))
              chart(ctx, gx + 6, 306, gw - 12, 138, [{ data: s.ke.map((v, i) => v + s.pe[i]), color: alpha(theme.text, 0.5) }, { data: s.ke, color: '#1c7ed6' }, { data: s.pe, color: '#2f9e44' }], { min: 0, max: eMax * 1.1, span: 400 })
              text(ctx, 'kinetic', gx + 10, 322, { color: '#1c7ed6', size: 12 })
              text(ctx, 'potential', gx + 72, 322, { color: '#2f9e44', size: 12 })
              text(ctx, 'total', gx + 150, 322, { color: theme.muted, size: 12 })
              if (f.frame % 10 === 0) setAmp(peak)
            }}
          />
          <Readout
            items={[
              ['Natural frequency', `${fmt(w0 / (2 * Math.PI), 3)} Hz`],
              ['Period', `${fmt((2 * Math.PI) / w0, 3)} s`],
              ['Damping ratio ζ', fmt(dampingRatio(k, m, c), 3)],
              ['Regime', dampingRegime(k, m, c)],
              ['Recent amplitude', `${fmt(amp, 2)} m`],
              ...(F > 0 ? ([['Steady amplitude', `${fmt(steadyAmplitude(p), 3)} m`]] as const) : []),
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => Object.assign(sim.current, { x: 0.5, v: 0, t: 0, xs: [], ke: [], pe: [] })} />
      <Slider label="Stiffness k" value={k} min={1} max={100} unit=" N/m" onChange={setK} />
      <Slider label="Mass" value={m} min={0.1} max={5} step={0.1} unit=" kg" onChange={setM} />
      <Slider label="Damping c" value={c} min={0} max={20} step={0.1} unit=" N·s/m" onChange={setC} />
      <Slider label="Driving force" value={F} min={0} max={10} step={0.5} unit=" N" onChange={setF} />
      <Slider label="Driving frequency" value={wd} min={0.5} max={15} step={0.1} format={(v) => `${fmt(v / (2 * Math.PI), 2)}`} unit=" Hz" onChange={setWd} />
      <button type="button" className="btn" onClick={() => setWd(Math.round(w0 * 10) / 10)} disabled={F === 0}>
        Match natural frequency
      </button>
      <Hint>Drag the mass to stretch the spring. Turn on a driving force and match its frequency to the natural frequency to see resonance; damping of ζ = 1 returns fastest without overshooting.</Hint>
    </SimLayout>
  )
}
