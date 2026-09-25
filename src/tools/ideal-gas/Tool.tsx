import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { bars, circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, gaussian, histogram } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { KB, mb2d, temperatureOf } from './gas'

const W = 800
const H = 560
const BOX = 380
const MAX = 700
const BINS = 32
const VMAX = 600

export default function IdealGas() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [light, setLight] = useState(180)
  const [heavy, setHeavy] = useState(0)
  const [temp, setTemp] = useState(300)
  const [collide, setCollide] = useState(true)
  const [gravity, setGravity] = useState(false)
  const [info, setInfo] = useState({ T: 300, P: 0, ratio: 0, V: 0 })
  const g = useRef({
    n: 0,
    x: new Float32Array(MAX),
    y: new Float32Array(MAX),
    vx: new Float32Array(MAX),
    vy: new Float32Array(MAX),
    m: new Float32Array(MAX),
    piston: W - 40,
    lastPiston: W - 40,
    pistonV: 0,
    impulse: [] as [number, number][],
    t: 0,
  })
  const drag = useRef(false)
  const lastTemp = useRef(temp)

  function sample(i: number, mass: number, T: number) {
    const s = g.current
    const sd = Math.sqrt((KB * T) / mass)
    s.x[i] = 10 + Math.random() * (s.piston - 20)
    s.y[i] = 10 + Math.random() * (BOX - 20)
    s.vx[i] = gaussian() * sd
    s.vy[i] = gaussian() * sd
    s.m[i] = mass
  }

  // Keep the particle count in step with the sliders without resetting the rest.
  const s = g.current
  const want = light + heavy
  const nLight = Array.from(s.m.subarray(0, s.n)).filter((m) => m === 1).length
  if (s.n !== want || nLight !== light) {
    const T = temperatureOf(s.vx, s.vy, s.m, s.n) || temp
    for (let i = 0; i < want; i++) if (i >= s.n || s.m[i] !== (i < light ? 1 : 4)) sample(i, i < light ? 1 : 4, T)
    s.n = want
  }

  function setTemperature(T: number) {
    const cur = temperatureOf(s.vx, s.vy, s.m, s.n)
    if (cur > 0) {
      const f = Math.sqrt(T / cur)
      for (let i = 0; i < s.n; i++) {
        s.vx[i] *= f
        s.vy[i] *= f
      }
    }
    lastTemp.current = T
    setTemp(T)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down' && Math.abs(p.x - s.piston) < 30 && p.y < BOX) drag.current = true
    if (!drag.current) return
    s.piston = clamp(p.x, 160, W - 10)
    if (p.type === 'up') drag.current = false
  }

  function step(dt: number) {
    const { x, y, vx, vy, m } = s
    let imp = 0
    const pv = s.pistonV
    for (let i = 0; i < s.n; i++) {
      if (gravity) vy[i] += 200 * dt
      x[i] += vx[i] * dt
      y[i] += vy[i] * dt
      const r = m[i] > 1 ? 5 : 3
      if (x[i] < r) {
        x[i] = r
        imp += 2 * m[i] * Math.abs(vx[i])
        vx[i] = Math.abs(vx[i])
      }
      if (x[i] > s.piston - r) {
        x[i] = s.piston - r
        // A moving piston does work on the gas: reflect in the piston's frame.
        const rel = vx[i] - pv
        if (rel > 0) {
          imp += 2 * m[i] * rel
          vx[i] = -rel + pv
        }
      }
      if (y[i] < r) {
        y[i] = r
        imp += 2 * m[i] * Math.abs(vy[i])
        vy[i] = Math.abs(vy[i])
      }
      if (y[i] > BOX - r) {
        y[i] = BOX - r
        imp += 2 * m[i] * Math.abs(vy[i])
        vy[i] = -Math.abs(vy[i])
      }
    }
    if (collide) {
      const cell = 12
      const cols = Math.ceil(W / cell)
      const grid = new Map<number, number[]>()
      for (let i = 0; i < s.n; i++) {
        const k = Math.floor(y[i] / cell) * cols + Math.floor(x[i] / cell)
        const list = grid.get(k)
        if (list) list.push(i)
        else grid.set(k, [i])
      }
      for (let i = 0; i < s.n; i++) {
        const cx = Math.floor(x[i] / cell)
        const cy = Math.floor(y[i] / cell)
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const list = grid.get((cy + oy) * cols + cx + ox)
            if (!list) continue
            for (const j of list) {
              if (j <= i) continue
              const dx = x[j] - x[i]
              const dy = y[j] - y[i]
              const rr = (m[i] > 1 ? 5 : 3) + (m[j] > 1 ? 5 : 3)
              const d2 = dx * dx + dy * dy
              if (d2 >= rr * rr || d2 === 0) continue
              const d = Math.sqrt(d2)
              const nx = dx / d
              const ny = dy / d
              const rel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny
              if (rel <= 0) continue
              const jimp = (2 * rel) / (1 / m[i] + 1 / m[j])
              vx[i] -= (jimp / m[i]) * nx
              vy[i] -= (jimp / m[i]) * ny
              vx[j] += (jimp / m[j]) * nx
              vy[j] += (jimp / m[j]) * ny
            }
          }
      }
    }
    s.t += dt
    s.impulse.push([s.t, imp])
    while (s.impulse.length && s.impulse[0][0] < s.t - 1.5) s.impulse.shift()
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Box of ${s.n} gas particles at about ${Math.round(info.T)} kelvin.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                s.pistonV = (s.piston - s.lastPiston) / Math.max(f.dt, 1e-3)
                for (let i = 0; i < 3; i++) step(f.dt / 3)
              }
              s.lastPiston = s.piston
              clear(ctx, W, H, theme.sunken)
              rrect(ctx, 0, 0, s.piston, BOX, 0, theme.surface)
              ctx.fillStyle = alpha(theme.text, 0.12)
              ctx.fillRect(s.piston, 0, W - s.piston, BOX)
              rrect(ctx, s.piston - 4, 0, 12, BOX, 3, theme.text)
              rrect(ctx, s.piston + 8, BOX / 2 - 30, 14, 60, 4, theme.accent)
              for (let i = 0; i < s.n; i++) {
                const sp = Math.hypot(s.vx[i], s.vy[i])
                const t = clamp(sp / 400, 0, 1)
                const color = s.m[i] > 1 ? `hsl(${260 - t * 60} 55% 45%)` : `hsl(${210 - t * 210} 80% 52%)`
                circle(ctx, s.x[i], s.y[i], s.m[i] > 1 ? 5 : 3, color)
              }
              line(ctx, 0, BOX, W, BOX, theme.border, 2)

              // Speed histogram against the Maxwell–Boltzmann curve.
              const T = temperatureOf(s.vx, s.vy, s.m, s.n)
              const speeds = new Float32Array(nLight)
              let k = 0
              for (let i = 0; i < s.n; i++) if (s.m[i] === 1) speeds[k++] = Math.hypot(s.vx[i], s.vy[i])
              const hx = 40
              const hy = BOX + 30
              const hw = W - 80
              const hh = H - hy - 30
              const hist = histogram(speeds, BINS, 0, VMAX)
              const bin = VMAX / BINS
              const scaleMax = Math.max(1, ...hist, nLight * bin * mb2d(Math.sqrt((KB * T) / 1), T, 1))
              bars(ctx, hx, hy, hw, hh, hist, alpha('#1c7ed6', 0.55), scaleMax)
              ctx.beginPath()
              for (let i = 0; i <= 120; i++) {
                const v = (i / 120) * VMAX
                const yv = hy + hh - ((nLight * bin * mb2d(v, T || 1, 1)) / scaleMax) * hh
                if (i) ctx.lineTo(hx + (v / VMAX) * hw, yv)
                else ctx.moveTo(hx, yv)
              }
              ctx.strokeStyle = theme.accent
              ctx.lineWidth = 2
              ctx.stroke()
              line(ctx, hx, hy + hh, hx + hw, hy + hh, theme.border)
              text(ctx, 'speed of light particles →  (bars: simulation, line: Maxwell–Boltzmann)', hx, H - 8, { color: theme.muted, size: 12 })

              if (f.frame % 10 === 0) {
                const span = s.impulse.length > 1 ? s.impulse[s.impulse.length - 1][0] - s.impulse[0][0] : 0
                const perimeter = 2 * (s.piston + BOX)
                const P = span > 0.2 ? s.impulse.reduce((a, [, v]) => a + v, 0) / span / perimeter : 0
                const V = s.piston * BOX
                setInfo({ T, P, V, ratio: T > 0 && s.n ? (P * V) / (s.n * KB * T) : 0 })
              }
            }}
          />
          <Readout
            items={[
              ['Particles N', s.n],
              ['Temperature', `${Math.round(info.T)} K`],
              ['Pressure', fmt(info.P, 1)],
              ['Area (volume)', `${fmt(info.V / 1000, 0)}k px²`],
              ['PV ÷ NkT', fmt(info.ratio, 2)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} />
      <Slider label="Light particles" value={light} min={0} max={500} step={10} onChange={setLight} />
      <Slider label="Heavy particles (4×)" value={heavy} min={0} max={200} step={10} onChange={setHeavy} />
      <Slider label="Temperature" value={temp} min={20} max={1500} step={10} unit=" K" onChange={setTemperature} />
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => setTemperature(clamp(Math.round(info.T * 1.25), 20, 1500))}>🔥 Heat</button>
        <button type="button" className="btn" onClick={() => setTemperature(clamp(Math.round(info.T * 0.8), 20, 1500))}>❄️ Cool</button>
      </div>
      <Slider label="Piston position" value={Math.round(s.piston)} min={160} max={W - 10} onChange={(v) => (s.piston = v)} />
      <Toggle label="Particles collide" checked={collide} onChange={setCollide} />
      <Toggle label="Gravity" checked={gravity} onChange={setGravity} />
      <Hint>Drag the piston handle to squeeze the gas. Pushing it in fast heats the gas (adiabatic compression). PV ÷ NkT stays near 1: that is the ideal gas law.</Hint>
    </SimLayout>
  )
}
