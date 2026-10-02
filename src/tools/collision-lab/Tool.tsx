import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, text } from '../../sim/draw'
import { collide1D, fmt, rng } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'

const W = 800
const H = 460
const PPM = 100
const TRACK = 330

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  m: number
  r: number
  color: string
}

type Mode = '1d' | '2d'
const PRESETS: Record<string, [number, number, number, number][]> = {
  'Equal masses': [[1, 200, 1, 0]],
  'Heavy hits light': [[4, 150, 1, 0]],
  'Light hits heavy': [[1, 250, 4, 0]],
  'Head-on': [[2, 200, 2, -200]],
}

function make1D(preset: string): Ball[] {
  const [[m1, v1, m2, v2]] = PRESETS[preset]
  const r = (m: number) => 18 + Math.sqrt(m) * 12
  return [
    { x: 180, y: TRACK - r(m1), vx: v1, vy: 0, m: m1, r: r(m1), color: PALETTE[0] },
    { x: 520, y: TRACK - r(m2), vx: v2, vy: 0, m: m2, r: r(m2), color: PALETTE[1] },
  ]
}

function make2D(n: number, seed: number): Ball[] {
  const random = rng(seed)
  const balls: Ball[] = []
  for (let i = 0; i < n * 20 && balls.length < n; i++) {
    const m = 0.5 + random() * (random() < 0.2 ? 5 : 2)
    const r = 10 + Math.sqrt(m) * 10
    const x = r + random() * (W - 2 * r)
    const y = r + random() * (H - 2 * r)
    if (balls.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + r + 2)) continue
    const a = random() * Math.PI * 2
    const v = 60 + random() * 160
    balls.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, m, r, color: PALETTE[balls.length % PALETTE.length] })
  }
  return balls
}

const totals = (balls: Ball[]) => ({
  px: balls.reduce((s, b) => s + (b.m * b.vx) / PPM, 0),
  py: balls.reduce((s, b) => s + (b.m * b.vy) / PPM, 0),
  ke: balls.reduce((s, b) => s + 0.5 * b.m * ((b.vx / PPM) ** 2 + (b.vy / PPM) ** 2), 0),
})

export default function CollisionLab() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('1d')
  const [preset, setPreset] = useState('Equal masses')
  const [count, setCount] = useState(12)
  const [e, setE] = useState(1)
  const [gravity, setGravity] = useState(false)
  const [vectors, setVectors] = useState(true)
  const [stats, setStats] = useState({ px: 0, py: 0, ke: 0, ke0: 0, hits: 0 })
  const balls = useRef<Ball[]>(make1D('Equal masses'))
  const ke0 = useRef(totals(balls.current).ke)
  const hits = useRef(0)
  const held = useRef<{ b: Ball; lx: number; ly: number; lt: number } | null>(null)

  function reset(next: Mode = mode, p = preset, n = count) {
    balls.current = next === '1d' ? make1D(p) : make2D(n, Math.floor(Math.random() * 1e9))
    ke0.current = totals(balls.current).ke
    hits.current = 0
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      const b = balls.current.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + 6)
      if (b) held.current = { b, lx: p.x, ly: p.y, lt: performance.now() }
      return
    }
    const h = held.current
    if (!h) return
    const now = performance.now()
    const dt = Math.max(0.008, (now - h.lt) / 1000)
    h.b.vx = (p.x - h.lx) / dt
    h.b.vy = mode === '1d' ? 0 : (p.y - h.ly) / dt
    h.b.x = p.x
    if (mode === '2d') h.b.y = p.y
    Object.assign(h, { lx: p.x, ly: p.y, lt: now })
    if (p.type === 'up') {
      const cap = 900
      const sp = Math.hypot(h.b.vx, h.b.vy)
      if (sp > cap) {
        h.b.vx *= cap / sp
        h.b.vy *= cap / sp
      }
      held.current = null
      ke0.current = totals(balls.current).ke
    }
  }

  function step(dt: number) {
    const bs = balls.current
    for (const b of bs) {
      if (held.current?.b === b) continue
      if (gravity && mode === '2d') b.vy += 400 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.x < b.r) [b.x, b.vx] = [b.r, Math.abs(b.vx) * e]
      if (b.x > W - b.r) [b.x, b.vx] = [W - b.r, -Math.abs(b.vx) * e]
      if (b.y < b.r) [b.y, b.vy] = [b.r, Math.abs(b.vy) * e]
      if (b.y > H - b.r) [b.y, b.vy] = [H - b.r, -Math.abs(b.vy) * e]
    }
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i]
        const b = bs[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        if (d === 0 || d >= a.r + b.r) continue
        const nx = dx / d
        const ny = dy / d
        const va = a.vx * nx + a.vy * ny
        const vb = b.vx * nx + b.vy * ny
        if (va - vb > 0) {
          const [na, nb] = collide1D(a.m, va, b.m, vb, e)
          a.vx += (na - va) * nx
          a.vy += (na - va) * ny
          b.vx += (nb - vb) * nx
          b.vy += (nb - vb) * ny
          hits.current++
        }
        const push = (a.r + b.r - d) / (a.m + b.m)
        a.x -= nx * push * b.m
        a.y -= ny * push * b.m
        b.x += nx * push * a.m
        b.y += ny * push * a.m
      }
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
            label={`${balls.current.length} balls colliding with restitution ${e}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) for (let i = 0; i < 4; i++) step(f.dt / 4)
              clear(ctx, W, H, theme.sunken)
              if (mode === '1d') {
                line(ctx, 0, TRACK, W, TRACK, theme.border, 2)
                for (let x = 0; x < W; x += PPM) text(ctx, `${x / PPM} m`, x + 4, TRACK + 18, { color: theme.muted, size: 12 })
                // Momentum bars: each ball's m·v, and their sum, which never changes.
                const bs = balls.current
                const ps = bs.map((b) => (b.m * b.vx) / PPM)
                const total = ps.reduce((a, b) => a + b, 0)
                const scale = 150 / Math.max(1, ...ps.map(Math.abs), Math.abs(total))
                const rows: [string, number, string][] = [...bs.map((b, i) => [`p${i + 1}`, ps[i], b.color] as [string, number, string]), ['total', total, theme.text]]
                line(ctx, W / 2, 24, W / 2, 30 + rows.length * 30, theme.border)
                rows.forEach(([name, v, c], i) => {
                  const y = 30 + i * 30
                  ctx.fillStyle = alpha(c, name === 'total' ? 0.5 : 0.8)
                  ctx.fillRect(Math.min(W / 2, W / 2 + v * scale), y, Math.abs(v * scale), 18)
                  text(ctx, `${name} = ${fmt(v, 2)} kg·m/s`, W / 2 + (v >= 0 ? -8 : 8), y + 14, { color: theme.muted, size: 12, align: v >= 0 ? 'right' : 'left' })
                })
              }
              for (const b of balls.current) {
                circle(ctx, b.x, b.y, b.r, alpha(b.color, 0.85), theme.surface, 2)
                text(ctx, `${fmt(b.m, 1)}`, b.x, b.y + 4, { color: '#fff', size: 12, align: 'center', weight: 700 })
                if (vectors) arrow(ctx, b.x, b.y, b.x + b.vx * 0.25, b.y + b.vy * 0.25, theme.text, 2, 8)
              }
              if (f.frame % 6 === 0) setStats({ ...totals(balls.current), ke0: ke0.current, hits: hits.current })
            }}
          />
          <Readout
            items={[
              ['Momentum x', `${fmt(stats.px, 2)} kg·m/s`],
              ...(mode === '2d' ? ([['Momentum y', `${fmt(stats.py, 2)} kg·m/s`]] as const) : []),
              ['Kinetic energy', `${fmt(stats.ke, 2)} J`],
              ['Energy kept', stats.ke0 ? `${fmt((stats.ke / stats.ke0) * 100, 1)}%` : '—'],
              ['Collisions', stats.hits],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <Choice label="Mode" value={mode} options={[['1d', '1D track'], ['2d', '2D box']]} onChange={(m) => { setMode(m); reset(m) }} />
      {mode === '1d' ? (
        <div className="sim-field">
          <span className="sim-label">Scenario</span>
          <div className="row" style={{ margin: 0, gap: 4 }}>
            {Object.keys(PRESETS).map((k) => (
              <button key={k} type="button" className={`btn ${k === preset ? 'primary' : ''}`} style={{ padding: '5px 9px', fontSize: '0.8rem' }} onClick={() => { setPreset(k); reset('1d', k) }}>
                {k}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Slider label="Balls" value={count} min={2} max={40} onChange={(n) => { setCount(n); reset('2d', preset, n) }} />
          <Toggle label="Gravity" checked={gravity} onChange={setGravity} />
        </>
      )}
      <Slider label="Restitution e" value={e} min={0} max={1} step={0.05} format={(v) => (v === 1 ? '1 (elastic)' : v === 0 ? '0 (sticky)' : String(v))} onChange={setE} />
      <Toggle label="Show velocity arrows" checked={vectors} onChange={setVectors} />
      <Hint>Grab a ball and throw it. Total momentum stays the same in every collision; kinetic energy is only kept when e = 1. The number on each ball is its mass in kg.</Hint>
    </SimLayout>
  )
}
