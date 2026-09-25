import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { circularSpeed, leapfrog, mergeTouching, totalEnergy, type Body } from './orbit'

const W = 800
const H = 520
const G = 1
const SOFT = 4
const STAR = 4e6

interface Planet extends Body {
  color: string
  trail: number[]
}

const radius = (m: number) => 2 + m ** 0.22 * 0.5
const PRESETS = [['solar', 'Star with planets'], ['binary', 'Binary star'], ['figure8', 'Figure-eight three-body'], ['chaos', 'Random cluster'], ['empty', 'Lonely star']] as const
type Preset = (typeof PRESETS)[number][0]

function body(x: number, y: number, vx: number, vy: number, m: number, i: number): Planet {
  return { x, y, vx, vy, m, color: i === 0 && m > 1e5 ? '#f59f00' : PALETTE[i % PALETTE.length], trail: [] }
}

function build(p: Preset): Planet[] {
  const cx = W / 2
  const cy = H / 2
  if (p === 'binary') {
    const m = STAR / 2
    const d = 60
    const v = circularSpeed(G, m, 4 * d) // each star circles the barycentre at radius d
    const out = [body(cx - d, cy, 0, -v, m, 0), body(cx + d, cy, 0, v, m, 0)]
    out[1].color = '#e8590c'
    const r = 230
    out.push(body(cx, cy - r, circularSpeed(G, STAR, r), 0, 50, 1))
    return out
  }
  if (p === 'figure8') {
    const L = 170
    const m = 1.2e6
    const vs = Math.sqrt((G * m) / L)
    const pos = [[0.97000436, -0.24308753], [-0.97000436, 0.24308753], [0, 0]]
    const v3 = [-0.93240737, -0.86473146]
    const vel = [[-v3[0] / 2, -v3[1] / 2], [-v3[0] / 2, -v3[1] / 2], v3]
    return pos.map(([x, y], i) => body(cx + x * L, cy + y * L, vel[i][0] * vs, vel[i][1] * vs, m, i + 1))
  }
  const out = [body(cx, cy, 0, 0, STAR, 0)]
  if (p === 'solar') {
    ;[70, 120, 175, 235].forEach((r, i) => {
      const a = i * 1.7
      const v = circularSpeed(G, STAR, r)
      out.push(body(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, [60, 300, 800, 30000][i], i + 1))
    })
    const host = out[4]
    const v = circularSpeed(G, host.m, 14)
    out.push(body(host.x + 14, host.y, host.vx, host.vy + v, 0.5, 6))
  }
  if (p === 'chaos') {
    const random = rng(Math.floor(Math.random() * 1e9))
    for (let i = 0; i < 24; i++) {
      const r = 60 + random() * 190
      const a = random() * Math.PI * 2
      const v = circularSpeed(G, STAR, r) * (0.7 + random() * 0.5)
      out.push(body(cx + Math.cos(a) * r, cy + Math.sin(a) * r, -Math.sin(a) * v, Math.cos(a) * v, 10 + random() * 3000, i + 1))
    }
  }
  return out
}

export default function OrbitSimulator() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<Preset>('solar')
  const [mass, setMass] = useState(100)
  const [speed, setSpeed] = useState(1)
  const [trails, setTrails] = useState(true)
  const [merge, setMerge] = useState(true)
  const [follow, setFollow] = useState(false)
  const [info, setInfo] = useState({ n: 0, e: 0, t: 0 })
  const bodies = useRef<Planet[]>(build('solar'))
  const aim = useRef<{ x: number; y: number; ex: number; ey: number } | null>(null)
  const count = useRef(10)
  const time = useRef(0)
  const view = useRef({ ox: 0, oy: 0 })

  function load(p: Preset) {
    setPreset(p)
    bodies.current = build(p)
    time.current = 0
  }

  function onPointer(p: SimPointer) {
    const x = p.x + view.current.ox
    const y = p.y + view.current.oy
    if (p.type === 'down') aim.current = { x, y, ex: x, ey: y }
    if (!aim.current) return
    aim.current.ex = x
    aim.current.ey = y
    if (p.type === 'up') {
      const a = aim.current
      bodies.current.push(body(a.x, a.y, (a.ex - a.x) * 1.2, (a.ey - a.y) * 1.2, mass, count.current++))
      aim.current = null
    }
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
            onPointer={onPointer}
            label={`${bodies.current.length} bodies orbiting under gravity.`}
            onFrame={(ctx, f) => {
              let bs = bodies.current
              if (f.dt > 0) {
                const n = 8
                for (let i = 0; i < n; i++) leapfrog(bs, f.dt / n, G, SOFT)
                if (merge) bs = bodies.current = mergeTouching(bs, radius)
                // Drop bodies that fly far away.
                bs = bodies.current = bs.filter((b) => Math.abs(b.x - W / 2) < 6000 && Math.abs(b.y - H / 2) < 6000)
                time.current += f.dt
                if (trails)
                  for (const b of bs) {
                    b.trail.push(b.x, b.y)
                    if (b.trail.length > 800) b.trail.splice(0, 2)
                  }
              }
              if (follow && bs.length) {
                const M = bs.reduce((s, b) => s + b.m, 0)
                const cx = bs.reduce((s, b) => s + b.x * b.m, 0) / M
                const cy = bs.reduce((s, b) => s + b.y * b.m, 0) / M
                view.current = { ox: cx - W / 2, oy: cy - H / 2 }
              } else view.current = { ox: 0, oy: 0 }
              const { ox, oy } = view.current
              clear(ctx, W, H, '#0d0c0b')
              const stars = rng(7)
              for (let i = 0; i < 90; i++) circle(ctx, stars() * W, stars() * H, stars() * 1.2, 'rgba(255,255,255,0.35)')
              for (const b of bs) {
                if (trails && b.trail.length > 4) {
                  ctx.beginPath()
                  for (let i = 0; i < b.trail.length; i += 2) ctx.lineTo(b.trail[i] - ox, b.trail[i + 1] - oy)
                  ctx.strokeStyle = alpha(b.color, 0.45)
                  ctx.lineWidth = 1.2
                  ctx.stroke()
                }
              }
              for (const b of bs) {
                const r = radius(b.m)
                if (b.m > 1e5) circle(ctx, b.x - ox, b.y - oy, r * 2.2, alpha(b.color, 0.15))
                circle(ctx, b.x - ox, b.y - oy, r, b.color)
              }
              const a = aim.current
              if (a) {
                // Predict the new body's path, treating everything else as fixed in place.
                const ghost: Body[] = [...bs.map((b) => ({ ...b })), { x: a.x, y: a.y, vx: (a.ex - a.x) * 1.2, vy: (a.ey - a.y) * 1.2, m: 0.001 }]
                ctx.beginPath()
                ctx.moveTo(a.x - ox, a.y - oy)
                for (let i = 0; i < 400; i++) {
                  leapfrog(ghost, 1 / 60, G, SOFT)
                  const g = ghost[ghost.length - 1]
                  ctx.lineTo(g.x - ox, g.y - oy)
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.4)'
                ctx.setLineDash([4, 5])
                ctx.lineWidth = 1.5
                ctx.stroke()
                ctx.setLineDash([])
                circle(ctx, a.x - ox, a.y - oy, radius(mass), theme.accent)
                arrow(ctx, a.x - ox, a.y - oy, a.ex - ox, a.ey - oy, '#fff', 2)
              }
              if (f.frame % 15 === 0) setInfo({ n: bs.length, e: totalEnergy(bs, G, SOFT), t: time.current })
            }}
          />
          <Readout items={[['Bodies', info.n], ['Total energy', fmt(info.e / 1e6, 2) + ' M'], ['Elapsed', `${fmt(info.t, 0)} s`]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => load(preset)} />
      <Select label="Scenario" value={preset} options={PRESETS} onChange={load} />
      <Slider label="New body mass" value={mass} min={1} max={100000} step={1} format={(v) => fmt(v, 0)} onChange={setMass} />
      <Slider label="Time speed" value={speed} min={0.1} max={4} step={0.1} unit="×" onChange={setSpeed} />
      <Toggle label="Trails" checked={trails} onChange={(v) => { setTrails(v); bodies.current.forEach((b) => (b.trail = [])) }} />
      <Toggle label="Merge on collision" checked={merge} onChange={setMerge} />
      <Toggle label="Follow centre of mass" checked={follow} onChange={setFollow} />
      <Hint>Press and drag in space to launch a new body: the arrow sets its velocity and the dashed line predicts its path. Too slow and it falls in; too fast and it escapes.</Hint>
    </SimLayout>
  )
}
