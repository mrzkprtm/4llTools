import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line } from '../../sim/draw'
import { deg, fmt, rad, rk4 } from '../../sim/math'
import { alpha, hue, useTheme } from '../../sim/theme'
import { doubleDeriv, doubleEnergy, type DoubleParams } from './double'

const W = 800
const H = 520
const CX = 400
const CY = 250
const PPM = 110

interface Pend {
  y: number[]
  trail: Float32Array
  head: number
  len: number
}

export default function DoublePendulum() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState(3)
  const [exp, setExp] = useState(-3)
  const [a1, setA1] = useState(120)
  const [a2, setA2] = useState(-10)
  const [ratioM, setRatioM] = useState(1)
  const [ratioL, setRatioL] = useState(1)
  const [trailLen, setTrailLen] = useState(260)
  const [rods, setRods] = useState(true)
  const [info, setInfo] = useState({ t: 0, spread: 0, drift: 0 })
  const params: DoubleParams = { m1: 1, m2: ratioM, L1: 1, L2: ratioL, g: 9.81 }
  const pends = useRef<Pend[]>([])
  const start = useRef({ t: 0, e0: 0, sig: '' })
  const dragging = useRef<0 | 1 | null>(null)

  const sig = `${count}|${exp}|${a1}|${a2}|${ratioM}|${ratioL}`
  function init() {
    pends.current = Array.from({ length: count }, (_, i) => ({ y: [rad(a1), 0, rad(a2) + i * 10 ** exp, 0], trail: new Float32Array(1200), head: 0, len: 0 }))
    start.current = { t: 0, e0: doubleEnergy(params, pends.current[0]?.y ?? [0, 0, 0, 0]), sig }
  }
  if (start.current.sig !== sig) init()

  function onPointer(p: SimPointer) {
    const [t1, , t2] = pends.current[0].y
    const x1 = CX + Math.sin(t1) * params.L1 * PPM
    const y1 = CY + Math.cos(t1) * params.L1 * PPM
    const x2 = x1 + Math.sin(t2) * params.L2 * PPM
    const y2 = y1 + Math.cos(t2) * params.L2 * PPM
    if (p.type === 'down') dragging.current = Math.hypot(p.x - x2, p.y - y2) < 36 ? 1 : Math.hypot(p.x - x1, p.y - y1) < 36 ? 0 : null
    if (dragging.current === null) return
    if (dragging.current === 0) setA1(Math.round(deg(Math.atan2(p.x - CX, p.y - CY))))
    else setA2(Math.round(deg(Math.atan2(p.x - x1, p.y - y1))))
    if (p.type === 'up') dragging.current = null
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            cursor="grab"
            label={`${count} double pendulums that start almost identically and drift apart chaotically.`}
            onFrame={(ctx, f) => {
              const deriv = doubleDeriv(params)
              if (f.dt > 0 && dragging.current === null) {
                const n = 12
                for (const p of pends.current) for (let i = 0; i < n; i++) p.y = rk4(deriv, 0, p.y, f.dt / n)
                start.current.t += f.dt
              }
              clear(ctx, W, H, '#0d0c0b')
              pends.current.forEach((p, i) => {
                const [t1, , t2] = p.y
                const x1 = CX + Math.sin(t1) * params.L1 * PPM
                const y1 = CY + Math.cos(t1) * params.L1 * PPM
                const x2 = x1 + Math.sin(t2) * params.L2 * PPM
                const y2 = y1 + Math.cos(t2) * params.L2 * PPM
                const color = count === 1 ? theme.accent : hue(i, count, 62, 85)
                if (f.dt > 0) {
                  const cap = Math.min(trailLen, 600)
                  p.trail[(p.head % 600) * 2] = x2
                  p.trail[(p.head % 600) * 2 + 1] = y2
                  p.head++
                  p.len = Math.min(p.len + 1, cap)
                }
                ctx.lineCap = 'round'
                for (let k = 1; k < p.len; k++) {
                  const a = (p.head - p.len + k - 1 + 600) % 600
                  const b = (p.head - p.len + k + 600) % 600
                  line(ctx, p.trail[a * 2], p.trail[a * 2 + 1], p.trail[b * 2], p.trail[b * 2 + 1], alpha(color, (k / p.len) * 0.9), 1 + (k / p.len) * 1.5)
                }
                if (rods) {
                  line(ctx, CX, CY, x1, y1, alpha('#efebe2', 0.55), 2)
                  line(ctx, x1, y1, x2, y2, alpha('#efebe2', 0.55), 2)
                  circle(ctx, x1, y1, 6 * Math.cbrt(params.m1), alpha(color, 0.9))
                }
                circle(ctx, x2, y2, 7 * Math.cbrt(params.m2), color, '#0d0c0b', 2)
              })
              circle(ctx, CX, CY, 5, '#efebe2')
              if (f.frame % 10 === 0 && pends.current.length) {
                const first = pends.current[0].y
                const last = pends.current[pends.current.length - 1].y
                const e = doubleEnergy(params, first)
                setInfo({ t: start.current.t, spread: Math.abs(deg(first[2] - last[2])), drift: Math.abs((e - start.current.e0) / (Math.abs(start.current.e0) || 1)) * 100 })
              }
            }}
          />
          <Readout items={[['Time', `${fmt(info.t, 1)} s`], ['Spread (first vs last)', `${fmt(info.spread, 1)}°`], ['Energy drift', `${fmt(info.drift, 3)}%`]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={init} />
      <Slider label="Pendulums" value={count} min={1} max={10} onChange={setCount} />
      <Slider label="Starting difference" value={exp} min={-9} max={-1} format={(v) => `10^${v} rad`} onChange={setExp} />
      <Slider label="Upper angle" value={a1} min={-180} max={180} unit="°" onChange={setA1} />
      <Slider label="Lower angle" value={a2} min={-180} max={180} unit="°" onChange={setA2} />
      <Slider label="Mass ratio m₂/m₁" value={ratioM} min={0.2} max={3} step={0.1} onChange={setRatioM} />
      <Slider label="Length ratio L₂/L₁" value={ratioL} min={0.3} max={1.6} step={0.05} onChange={setRatioL} />
      <Slider label="Trail length" value={trailLen} min={0} max={600} step={10} onChange={setTrailLen} />
      <Toggle label="Show rods" checked={rods} onChange={setRods} />
      <Hint>Every pendulum starts a hair's width apart. For a while they move as one, then chaos takes over and they split. Drag the bobs to choose new starting angles.</Hint>
    </SimLayout>
  )
}
