import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { arrow, chart, circle, clear, line, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt, pushCap, rk4, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { createEco, equilibrium, estimatePeriod, grassCover, lotkaVolterra, lvInvariant, lvOrbit, stepEco, type Eco } from './predator'

const W = 820
const H = 500
const FX = 10
const FY = 10
const CELL = 10
const COLS = 48
const ROWS = 48
const PREY = '#1c7ed6'
const PRED = '#e8590c'
const PATH = '#ae3ec9'
const SPAN = 600

type Mode = 'agents' | 'ode'

export default function PredatorPrey() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('agents')
  // Lotka–Volterra parameters.
  const [a, setA] = useState(1)
  const [b, setB] = useState(0.1)
  const [g, setG] = useState(1.5)
  const [d, setD] = useState(0.075)
  const [ic, setIc] = useState<[number, number]>([10, 5])
  const [odeSpeed, setOdeSpeed] = useState(1.5)
  // Agent-world parameters.
  const [rabbitBirth, setRabbitBirth] = useState(4)
  const [foxBirth, setFoxBirth] = useState(5)
  const [regrow, setRegrow] = useState(30)
  const [foxGain, setFoxGain] = useState(20)
  const [ticksPerSec, setTicksPerSec] = useState(20)
  const [info, setInfo] = useState({ prey: 0, pred: 0, grass: 0, period: NaN, t: 0, v: 0 })

  const lv = { alpha: a, beta: b, gamma: g, delta: d }
  const eco = { rabbitBirth: rabbitBirth / 100, foxBirth: foxBirth / 100, regrow, rabbitGain: 4, foxGain }
  const random = useRef(rng(11))
  const world = useRef<Eco>(null as unknown as Eco)
  if (!world.current) world.current = createEco(COLS, ROWS, 100, 50, eco, random.current)
  const ode = useRef({ x: 10, y: 5, t: 0, acc: 0, trail: [] as [number, number][] })
  const hist = useRef({ prey: [] as number[], pred: [] as number[] })
  const acc = useRef(0)
  const dragging = useRef(false)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)

  const orbit = useMemo(() => lvOrbit({ alpha: a, beta: b, gamma: g, delta: d }, ic[0], ic[1], 0.005, 200), [a, b, g, d, ic])
  const [ex, ey] = equilibrium(lv)
  let xmax = ex * 1.3
  let ymax = ey * 1.3
  for (const [x, y] of orbit.path) (xmax = Math.max(xmax, x * 1.12)), (ymax = Math.max(ymax, y * 1.12))

  function reset(m = mode) {
    hist.current = { prey: [], pred: [] }
    if (m === 'agents') world.current = createEco(COLS, ROWS, 100, 50, eco, random.current)
    else ode.current = { x: ic[0], y: ic[1], t: 0, acc: 0, trail: [] }
  }

  /** Changing a rate keeps the populations where they are and redraws the orbit through them. */
  function setRate(set: (v: number) => void, v: number) {
    set(v)
    setIc([ode.current.x, ode.current.y])
    ode.current.trail = []
  }

  // Phase-plane box for the ODE view.
  const P = { x: 70, y: 22, w: 400, h: 420 }
  const toPx = (x: number, y: number): [number, number] => [P.x + (x / xmax) * P.w, P.y + P.h - (y / ymax) * P.h]

  function onPointer(p: SimPointer) {
    if (mode === 'agents') {
      if (p.type !== 'down' || p.x > FX + COLS * CELL) return
      const fox = p.button === 2 || p.shift
      const w = world.current
      for (let i = 0; i < (fox ? 3 : 8); i++) {
        const an = { x: clamp((p.x - FX) / CELL + (random.current() - 0.5) * 3, 0, COLS - 0.01), y: clamp((p.y - FY) / CELL + (random.current() - 0.5) * 3, 0, ROWS - 0.01), a: random.current() * 6.28, e: fox ? 20 : 6 }
        if (fox) w.foxes.push(an)
        else w.rabbits.push(an)
      }
      return
    }
    if (p.type === 'down') dragging.current = p.x > P.x - 20 && p.x < P.x + P.w + 10 && p.y > P.y - 10 && p.y < P.y + P.h + 20
    if (!dragging.current) return
    const x = clamp(((p.x - P.x) / P.w) * xmax, 0.2, xmax)
    const y = clamp(((P.y + P.h - p.y) / P.h) * ymax, 0.2, ymax)
    ode.current = { x, y, t: 0, acc: 0, trail: [] }
    hist.current = { prey: [], pred: [] }
    if (p.type === 'up') {
      dragging.current = false
      setIc([x, y])
    }
  }

  function drawSeries(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string) {
    const hs = hist.current
    rrect(ctx, x, y, w, h, 6, theme.surface, theme.border)
    const hi = Math.max(1, ...hs.prey, ...hs.pred) * 1.1
    chart(ctx, x + 6, y + 22, w - 12, h - 30, [{ data: hs.prey, color: PREY, width: 2 }, { data: hs.pred, color: PRED, width: 2 }], { min: 0, max: hi, span: SPAN })
    text(ctx, title, x + 10, y + 16, { color: theme.muted, size: 12 })
    text(ctx, `max ${Math.round(hi)}`, x + w - 8, y + 16, { color: theme.muted, size: 12, align: 'right' })
  }

  function drawPhaseAgents(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const hs = hist.current
    rrect(ctx, x, y, w, h, 6, theme.surface, theme.border)
    const px = Math.max(10, ...hs.prey) * 1.1
    const py = Math.max(5, ...hs.pred) * 1.1
    const ix = x + 36
    const iy = y + 10
    const iw = w - 46
    const ih = h - 40
    line(ctx, ix, iy + ih, ix + iw, iy + ih, theme.border)
    line(ctx, ix, iy, ix, iy + ih, theme.border)
    const n = hs.prey.length
    for (let i = 1; i < n; i++) {
      const t = i / n
      line(ctx, ix + (hs.prey[i - 1] / px) * iw, iy + ih - (hs.pred[i - 1] / py) * ih, ix + (hs.prey[i] / px) * iw, iy + ih - (hs.pred[i] / py) * ih, alpha(PATH, 0.1 + t * 0.8), 1.5)
    }
    if (n) circle(ctx, ix + (hs.prey[n - 1] / px) * iw, iy + ih - (hs.pred[n - 1] / py) * ih, 5, PATH, theme.surface, 2)
    text(ctx, 'rabbits →', ix + iw, iy + ih + 18, { color: PREY, size: 12, align: 'right' })
    text(ctx, 'foxes ↑', ix, iy + ih + 18, { color: PRED, size: 12 })
    text(ctx, String(Math.round(py)), ix - 4, iy + 10, { color: theme.muted, size: 12, align: 'right' })
  }

  function frameAgents(ctx: CanvasRenderingContext2D, dt: number) {
    const w = world.current
    const hs = hist.current
    if (dt > 0) {
      acc.current += dt * ticksPerSec
      let k = 0
      while (acc.current >= 1 && k++ < 6) {
        acc.current -= 1
        stepEco(w, eco, random.current)
        pushCap(hs.prey, w.rabbits.length, SPAN)
        pushCap(hs.pred, w.foxes.length, SPAN)
      }
      acc.current = Math.min(acc.current, 1)
    }
    if (!buf.current) buf.current = makeBuffer(COLS, ROWS)
    const bf = buf.current
    for (let i = 0; i < COLS * ROWS; i++) {
      const t = w.grass[i] === 0 ? 1 : 0.25 * (1 - w.grass[i] / regrow)
      bf.data[i * 4] = 205 - t * 100
      bf.data[i * 4 + 1] = 180 + t * 38
      bf.data[i * 4 + 2] = 130 - t * 20
      bf.data[i * 4 + 3] = 255
    }
    bf.flush()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bf.canvas, FX, FY, COLS * CELL, ROWS * CELL)
    ctx.imageSmoothingEnabled = true
    ctx.beginPath()
    for (const r of w.rabbits) {
      ctx.moveTo(FX + r.x * CELL + 3, FY + r.y * CELL)
      ctx.arc(FX + r.x * CELL, FY + r.y * CELL, 3, 0, Math.PI * 2)
    }
    ctx.fillStyle = PREY
    ctx.fill()
    for (const f of w.foxes) {
      const x = FX + f.x * CELL
      const y = FY + f.y * CELL
      ctx.beginPath()
      ctx.moveTo(x + Math.cos(f.a) * 7, y + Math.sin(f.a) * 7)
      ctx.lineTo(x + Math.cos(f.a + 2.4) * 5, y + Math.sin(f.a + 2.4) * 5)
      ctx.lineTo(x + Math.cos(f.a - 2.4) * 5, y + Math.sin(f.a - 2.4) * 5)
      ctx.closePath()
      ctx.fillStyle = PRED
      ctx.fill()
      ctx.strokeStyle = '#3b1d0a'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    rrect(ctx, FX, FY, COLS * CELL, ROWS * CELL, 0, undefined, theme.border)
    const msg = w.foxes.length === 0 ? (w.rabbits.length === 0 ? 'Everything died out. Press Reset.' : 'Foxes died out. Right-click to add some.') : w.rabbits.length === 0 ? 'Rabbits died out. Click to add some.' : ''
    if (msg) {
      rrect(ctx, FX + 40, FY + 212, 400, 40, 8, alpha('#000', 0.7))
      text(ctx, msg, FX + 240, FY + 237, { color: '#fff', size: 14, align: 'center' })
    }
    drawSeries(ctx, 505, 10, 305, 240, 'population over time (ticks)')
    drawPhaseAgents(ctx, 505, 262, 305, 228)
  }

  function frameOde(ctx: CanvasRenderingContext2D, dt: number) {
    const o = ode.current
    const hs = hist.current
    if (dt > 0) {
      const f = lotkaVolterra(lv)
      const total = dt * odeSpeed
      const n = Math.ceil(total / 0.005)
      for (let i = 0; i < n; i++) {
        ;[o.x, o.y] = rk4(f, o.t, [o.x, o.y], total / n)
        o.t += total / n
        o.acc += total / n
        if (o.acc >= 0.05) {
          o.acc -= 0.05
          pushCap(hs.prey, o.x, SPAN)
          pushCap(hs.pred, o.y, SPAN)
          pushCap(o.trail, [o.x, o.y], 400)
        }
      }
    }
    rrect(ctx, 10, 10, 480, 480, 6, theme.surface, theme.border)
    // Direction field.
    const f = lotkaVolterra(lv)
    for (let i = 0; i < 14; i++)
      for (let j = 0; j < 14; j++) {
        const x = ((i + 0.5) / 14) * xmax
        const y = ((j + 0.5) / 14) * ymax
        const [dx, dy] = f(0, [x, y])
        const sx = (dx / xmax) * P.w
        const sy = (-dy / ymax) * P.h
        const len = Math.hypot(sx, sy) || 1
        const [px, py] = toPx(x, y)
        arrow(ctx, px - (sx / len) * 7, py - (sy / len) * 7, px + (sx / len) * 7, py + (sy / len) * 7, alpha(theme.text, 0.2), 1, 5)
      }
    const [qx, qy] = toPx(ex, ey)
    line(ctx, qx, P.y, qx, P.y + P.h, alpha(PRED, 0.5), 1, [5, 5])
    line(ctx, P.x, qy, P.x + P.w, qy, alpha(PREY, 0.5), 1, [5, 5])
    ctx.beginPath()
    orbit.path.forEach(([x, y], i) => (i ? ctx.lineTo(...toPx(x, y)) : ctx.moveTo(...toPx(x, y))))
    ctx.closePath()
    ctx.strokeStyle = alpha(theme.text, 0.35)
    ctx.lineWidth = 1.5
    ctx.stroke()
    for (let i = 1; i < o.trail.length; i++) {
      const [x1, y1] = toPx(...o.trail[i - 1])
      const [x2, y2] = toPx(...o.trail[i])
      line(ctx, x1, y1, x2, y2, alpha(PATH, 0.15 + (i / o.trail.length) * 0.85), 2.5)
    }
    circle(ctx, qx, qy, 4, theme.muted)
    const [cx, cy] = toPx(o.x, o.y)
    circle(ctx, cx, cy, 7, PATH, theme.surface, 2)
    line(ctx, P.x, P.y + P.h, P.x + P.w, P.y + P.h, theme.muted)
    line(ctx, P.x, P.y, P.x, P.y + P.h, theme.muted)
    text(ctx, 'prey x (rabbits) →', P.x + P.w, P.y + P.h + 22, { color: PREY, size: 13, align: 'right' })
    text(ctx, fmt(xmax, 0), P.x + P.w, P.y + P.h + 40, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, '0', P.x, P.y + P.h + 16, { color: theme.muted, size: 12, align: 'center' })
    ctx.save()
    ctx.translate(P.x - 14, P.y + P.h / 2)
    ctx.rotate(-Math.PI / 2)
    text(ctx, 'predators y (foxes) →', 0, 0, { color: PRED, size: 13, align: 'center' })
    ctx.restore()
    text(ctx, fmt(ymax, 0), P.x - 6, P.y + 10, { color: theme.muted, size: 12, align: 'right' })

    drawSeries(ctx, 505, 10, 305, 240, 'population over time')
    const lines = [
      ['dx/dt = αx − βxy', theme.text],
      ['dy/dt = δxy − γy', theme.text],
      [`equilibrium (${fmt(ex, 1)}, ${fmt(ey, 1)})`, theme.muted],
      [`V = δx − γ ln x + βy − α ln y`, theme.muted],
      [`  = ${lvInvariant(o.x, o.y, lv).toFixed(5)}`, PATH],
      [`period ≈ ${fmt(orbit.period, 2)} time units`, theme.muted],
      [`small-swing 2π/√(αγ) = ${fmt((2 * Math.PI) / Math.sqrt(a * g), 2)}`, theme.muted],
    ] as const
    lines.forEach(([s, c], i) => text(ctx, s, 512, 282 + i * 28, { color: c, size: 13 }))
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={mode === 'agents' ? `A field with ${info.prey} rabbits and ${info.pred} foxes, with population and phase plots.` : `Lotka–Volterra phase plane with prey ${fmt(info.prey, 1)} and predators ${fmt(info.pred, 1)}.`}
            onFrame={(ctx, f) => {
              clear(ctx, W, H, theme.sunken)
              if (mode === 'agents') frameAgents(ctx, f.dt)
              else frameOde(ctx, f.dt)
              if (f.frame % 10 === 0) {
                const hs = hist.current
                if (mode === 'agents') {
                  const w = world.current
                  setInfo({ prey: w.rabbits.length, pred: w.foxes.length, grass: grassCover(w), period: estimatePeriod(hs.prey, 1), t: w.tick, v: 0 })
                } else {
                  const o = ode.current
                  setInfo({ prey: o.x, pred: o.y, grass: 0, period: orbit.period, t: o.t, v: lvInvariant(o.x, o.y, lv) })
                }
              }
            }}
          />
          <Legend items={[[PREY, 'Rabbits (prey)'], [PRED, 'Foxes (predators)'], [PATH, 'Phase path']]} />
          <Readout
            items={
              mode === 'agents'
                ? [['Rabbits', info.prey], ['Foxes', info.pred], ['Grass cover', `${Math.round(info.grass * 100)}%`], ['Cycle period', Number.isFinite(info.period) ? `${Math.round(info.period)} ticks` : '…'], ['Ticks', info.t]]
                : [['Prey x', fmt(info.prey, 2)], ['Predators y', fmt(info.pred, 2)], ['V (conserved)', info.v.toFixed(4)], ['Cycle period', fmt(info.period, 2)], ['Time', fmt(info.t, 1)]]
            }
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <Choice label="Model" value={mode} options={[['agents', 'Agents'], ['ode', 'Equations']]} onChange={(m) => { setMode(m); reset(m) }} />
      {mode === 'agents' ? (
        <>
          <Slider label="Speed" value={ticksPerSec} min={2} max={60} unit=" ticks/s" onChange={setTicksPerSec} />
          <Slider label="Rabbit birth chance" value={rabbitBirth} min={1} max={15} unit="% / tick" onChange={setRabbitBirth} />
          <Slider label="Fox birth chance" value={foxBirth} min={1} max={15} unit="% / tick" onChange={setFoxBirth} />
          <Slider label="Energy a fox gets per rabbit" value={foxGain} min={4} max={50} onChange={setFoxGain} />
          <Slider label="Grass regrowth time" value={regrow} min={5} max={80} unit=" ticks" onChange={setRegrow} />
          <Hint>Every tick each animal burns 1 energy and starves at zero. Click the field to drop rabbits, right-click (or Shift-click) to drop foxes. Watch the fox peaks lag behind the rabbit peaks.</Hint>
        </>
      ) : (
        <>
          <Slider label="Time speed" value={odeSpeed} min={0.2} max={6} step={0.1} unit="×" onChange={setOdeSpeed} />
          <Slider label="α prey birth rate" value={a} min={0.2} max={2} step={0.05} onChange={(v) => setRate(setA, v)} />
          <Slider label="β predation rate" value={b} min={0.02} max={0.4} step={0.005} onChange={(v) => setRate(setB, v)} />
          <Slider label="γ predator death rate" value={g} min={0.2} max={3} step={0.05} onChange={(v) => setRate(setG, v)} />
          <Slider label="δ predator growth per prey" value={d} min={0.01} max={0.3} step={0.005} onChange={(v) => setRate(setD, v)} />
          <Hint>Drag in the phase plane to pick starting populations. Every start traces its own closed loop around the equilibrium, because V never changes.</Hint>
        </>
      )}
    </SimLayout>
  )
}
