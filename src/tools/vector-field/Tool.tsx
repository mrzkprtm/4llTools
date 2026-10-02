import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { compile, curl, divergence, PRESETS, rk4Field, type Field } from './field'

const W = 800
const H = 520
const MAXP = 5000
const KMAX = 32
const COLS = 25
const ROWS = 16

type PresetId = (typeof PRESETS)[number]['id'] | 'custom'
const OPTIONS: [PresetId, string][] = [...PRESETS.map((p) => [p.id, p.name] as [PresetId, string]), ['custom', 'Custom']]

/** Blue (weak) → teal → yellow → orange (strong). */
const magColor = (u: number, a = 1) => `hsl(${Math.round(215 - 185 * Math.min(1, u))} 85% ${Math.round(58 + 8 * u)}% / ${a})`

function tryCompile(p: string, q: string): { field: Field | null; error: string } {
  try {
    return { field: { P: compile(p), Q: compile(q) }, error: '' }
  } catch (e) {
    return { field: null, error: (e as Error).message }
  }
}

export default function VectorField() {
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<PresetId>('vdp')
  const [pText, setP] = useState<string>(PRESETS[6].p)
  const [qText, setQ] = useState<string>(PRESETS[6].q)
  const [range, setRange] = useState<number>(PRESETS[6].range)
  const [count, setCount] = useState(2000)
  const [speed, setSpeed] = useState(1)
  const [trail, setTrail] = useState(14)
  const [arrows, setArrows] = useState(true)
  const [probe, setProbe] = useState<{ x: number; y: number; P: number; Q: number; div: number; curl: number } | null>(null)
  const good = useRef<Field>(tryCompile(pText, qText).field!)
  const { field, error } = useMemo(() => tryCompile(pText, qText), [pText, qText])
  if (field) good.current = field
  // The field depends on time if it changes between two instants at a few sample points.
  const usesT = useMemo(() => [0.3, -1.1, 2.2].some((v) => { const F = good.current; return F.P(v, 0.7, 0) !== F.P(v, 0.7, 1.7) || F.Q(v, 0.7, 0) !== F.Q(v, 0.7, 1.7) }), [field])
  const sim = useRef({
    x: new Float32Array(MAXP),
    y: new Float32Array(MAXP),
    life: new Float32Array(MAXP),
    mark: new Uint8Array(MAXP),
    hist: new Float32Array(MAXP * KMAX * 2),
    head: 0,
    t: 0,
    drop: 0,
    ready: false,
  })
  const hover = useRef<{ x: number; y: number } | null>(null)
  const out = useRef<[number, number]>([0, 0])

  const scale = W / (2 * range)
  const ry = H / 2 / scale
  const toX = (x: number) => W / 2 + x * scale
  const toY = (y: number) => H / 2 - y * scale

  function place(i: number, x: number, y: number, life: number, mark: number) {
    const s = sim.current
    s.x[i] = x
    s.y[i] = y
    s.life[i] = life
    s.mark[i] = mark
    for (let k = 0; k < KMAX; k++) {
      s.hist[(k * MAXP + i) * 2] = x
      s.hist[(k * MAXP + i) * 2 + 1] = y
    }
  }
  const spawn = (i: number) => place(i, (Math.random() * 2 - 1) * range, (Math.random() * 2 - 1) * ry, 1 + Math.random() * 4, 0)
  function resetAll() {
    for (let i = 0; i < MAXP; i++) spawn(i)
    sim.current.t = 0
  }

  function load(id: PresetId) {
    setPreset(id)
    const p = PRESETS.find((q) => q.id === id)
    if (!p) return
    setP(p.p)
    setQ(p.q)
    setRange(p.range)
    sim.current.ready = false
  }

  function onPointer(p: SimPointer) {
    const x = (p.x - W / 2) / scale
    const y = (H / 2 - p.y) / scale
    hover.current = { x, y }
    if (!p.down || p.type === 'up') return
    const s = sim.current
    const n = p.type === 'down' ? 90 : 12
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * range * 0.06
      place(s.drop, x + Math.cos(a) * r, y + Math.sin(a) * r, 5 + Math.random() * 4, 1)
      s.drop = (s.drop + 1) % count
    }
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
            label={`Vector field with dx/dt = ${pText} and dy/dt = ${qText}, shown with arrows and ${count} flowing particles.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              const F = good.current
              if (!s.ready) {
                resetAll()
                s.ready = true
              }
              const o = out.current
              if (f.dt > 0) {
                const dt = Math.min(f.dt, 0.04) * speed
                s.head = (s.head + 1) % KMAX
                const base = s.head * MAXP * 2
                for (let i = 0; i < count; i++) {
                  rk4Field(F, s.x[i], s.y[i], s.t, dt, o)
                  s.life[i] -= f.dt
                  if (!(Math.abs(o[0]) < range * 1.05 && Math.abs(o[1]) < ry * 1.05) || s.life[i] <= 0) spawn(i)
                  else {
                    s.x[i] = o[0]
                    s.y[i] = o[1]
                  }
                  s.hist[base + i * 2] = s.x[i]
                  s.hist[base + i * 2 + 1] = s.y[i]
                }
                s.t += dt
              }

              clear(ctx, W, H, '#0d0c0b')
              line(ctx, 0, toY(0), W, toY(0), 'rgba(255,255,255,0.18)')
              line(ctx, toX(0), 0, toX(0), H, 'rgba(255,255,255,0.18)')
              text(ctx, `x = ${fmt(range)}`, W - 6, toY(0) - 6, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
              text(ctx, `y = ${fmt(ry, 1)}`, toX(0) + 6, 16, { color: 'rgba(255,255,255,0.5)', size: 12 })

              if (arrows) {
                const cw = W / COLS
                const vals: number[] = []
                const mags: number[] = []
                for (let r = 0; r < ROWS; r++)
                  for (let c = 0; c < COLS; c++) {
                    const x = ((c + 0.5) * cw - W / 2) / scale
                    const y = (H / 2 - (r + 0.5) * (H / ROWS)) / scale
                    const P = F.P(x, y, s.t)
                    const Q = F.Q(x, y, s.t)
                    const m = Math.hypot(P, Q)
                    vals.push(P, Q, m)
                    if (Number.isFinite(m)) mags.push(m)
                  }
                // Scale by the 90th percentile so a few huge arrows at the edge don't wash out the rest.
                mags.sort((a, b) => a - b)
                const max = Math.max(1e-9, mags[Math.floor(mags.length * 0.9)] ?? 1)
                for (let r = 0; r < ROWS; r++)
                  for (let c = 0; c < COLS; c++) {
                    const k = (r * COLS + c) * 3
                    const m = vals[k + 2]
                    if (!(m > 1e-12) || !Number.isFinite(m)) continue
                    const u = Math.min(1, Math.sqrt(m / max))
                    const len = cw * 0.44 * (0.3 + 0.7 * u)
                    const dx = (vals[k] / m) * len
                    const dy = (-vals[k + 1] / m) * len
                    const cx = (c + 0.5) * cw
                    const cy = (r + 0.5) * (H / ROWS)
                    arrow(ctx, cx - dx, cy - dy, cx + dx, cy + dy, magColor(u, 0.75), 1.5, 6)
                  }
              }

              // Streaks: one stroke per trail age for all particles, fading towards the tail.
              const K = trail
              ctx.lineCap = 'round'
              for (const mark of [0, 1]) {
                for (let a = 0; a < K - 1; a++) {
                  const s0 = ((s.head - (K - 1) + a + KMAX * 2) % KMAX) * MAXP * 2
                  const s1 = ((s.head - (K - 2) + a + KMAX * 2) % KMAX) * MAXP * 2
                  ctx.beginPath()
                  for (let i = 0; i < count; i++) {
                    if (s.mark[i] !== mark) continue
                    ctx.moveTo(toX(s.hist[s0 + i * 2]), toY(s.hist[s0 + i * 2 + 1]))
                    ctx.lineTo(toX(s.hist[s1 + i * 2]), toY(s.hist[s1 + i * 2 + 1]))
                  }
                  const al = 0.08 + 0.85 * ((a + 1) / (K - 1)) ** 1.3
                  ctx.strokeStyle = mark ? `rgba(255,146,43,${al})` : `rgba(215,236,255,${al * 0.8})`
                  ctx.lineWidth = mark ? 2 : 1.4
                  ctx.stroke()
                }
              }
              ctx.lineCap = 'butt'

              const hv = hover.current
              if (hv) {
                const P = F.P(hv.x, hv.y, s.t)
                const Q = F.Q(hv.x, hv.y, s.t)
                const m = Math.hypot(P, Q)
                const px = toX(hv.x)
                const py = toY(hv.y)
                circle(ctx, px, py, 5, undefined, '#fff', 1.5)
                if (m > 1e-9) arrow(ctx, px, py, px + (P / m) * 44, py - (Q / m) * 44, '#fff', 2.5, 10)
                if (f.frame % 6 === 0) setProbe({ x: hv.x, y: hv.y, P, Q, div: divergence(F, hv.x, hv.y, s.t), curl: curl(F, hv.x, hv.y, s.t) })
              }
              if (usesT) {
                rrect(ctx, 8, H - 32, 86, 24, 6, 'rgba(0,0,0,0.6)')
                text(ctx, `t = ${s.t.toFixed(1)}`, 16, H - 15, { color: '#fff', size: 12 })
              }
            }}
          />
          <Readout
            items={[
              ['At pointer', probe ? `(${fmt(probe.x, 2)}, ${fmt(probe.y, 2)})` : 'hover'],
              ['Vector (P, Q)', probe ? `(${fmt(probe.P, 2)}, ${fmt(probe.Q, 2)})` : '—'],
              ['Magnitude', probe ? fmt(Math.hypot(probe.P, probe.Q), 3) : '—'],
              ['Divergence', probe ? fmt(probe.div, 3) : '—'],
              ['Curl', probe ? fmt(probe.curl, 3) : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={resetAll} resetLabel="Respawn" />
      <Select label="Preset" value={preset} options={OPTIONS} onChange={load} />
      <label className="sim-field">
        <span className="sim-label">dx/dt = P(x, y, t)</span>
        <input type="text" className="sim-text sim-mono" value={pText} spellCheck={false} onChange={(e) => { setP(e.target.value); setPreset('custom') }} />
      </label>
      <label className="sim-field">
        <span className="sim-label">dy/dt = Q(x, y, t)</span>
        <input type="text" className="sim-text sim-mono" value={qText} spellCheck={false} onChange={(e) => { setQ(e.target.value); setPreset('custom') }} />
      </label>
      {error && <p className="sim-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
      <Slider label="Particles" value={count} min={100} max={MAXP} step={100} onChange={setCount} />
      <Slider label="Flow speed" value={speed} min={0.1} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <Slider label="Trail length" value={trail} min={2} max={KMAX} onChange={setTrail} />
      <Slider label="View range" value={range} min={1} max={10} step={0.5} format={(v) => `±${v}`} onChange={(v) => { setRange(v); sim.current.ready = false }} />
      <Toggle label="Show arrows" checked={arrows} onChange={setArrows} />
      <Hint>Type any field using x, y, t, sin, cos, exp, sqrt, ^… Click or drag on the stage to drop a bunch of orange tracer particles. Positive divergence means flow spreads out; curl measures the local spin.</Hint>
    </SimLayout>
  )
}
