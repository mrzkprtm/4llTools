import { useId, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, makeBuffer, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { HIGHWAY_PERIOD, antStep, highwayDetector, makeAnt, parseTurmite, type Ant } from './ant'

const W = 800
const H = 500
const GW = 400
const GH = 250

const PRESETS = [
  ['RL', 'RL · Langton’s ant'],
  ['RLR', 'RLR · chaotic growth'],
  ['LLRR', 'LLRR · symmetric blob'],
  ['LRRRRRLLR', 'LRRRRRLLR · filled square'],
  ['LLRRRLRLRLLR', 'LLRRRLRLRLLR · convoluted highway'],
  ['RRLLLRLLLRRR', 'RRLLLRLLLRRR · growing triangle'],
  ['custom', 'Custom…'],
] as const

// Colour 0 is the empty background; the rest step round a warm-to-cool ramp.
const COLOURS: [number, number, number][] = [
  [13, 12, 11], [242, 234, 214], [255, 146, 64], [58, 196, 170], [86, 140, 255], [196, 104, 230], [255, 208, 70], [110, 214, 96],
  [255, 110, 150], [150, 230, 255], [230, 90, 70], [170, 170, 170], [120, 110, 250], [250, 170, 120], [70, 160, 110], [210, 210, 120],
]

const speedOf = (v: number) => Math.max(1, Math.round(5000 ** (v / 100)))

function freshWorld() {
  return { grid: new Uint8Array(GW * GH), visited: new Uint8Array(GW * GH), ants: [makeAnt(GW / 2, GH / 2)] as Ant[], steps: 0, cells: 0, highway: 0, detect: highwayDetector(), acc: 0 }
}

export default function LangtonsAnt() {
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<(typeof PRESETS)[number][0]>('RL')
  const [ruleText, setRuleText] = useState('RL')
  const [speedV, setSpeedV] = useState(52)
  const [cell, setCell] = useState(4)
  const [follow, setFollow] = useState(false)
  const [stats, setStats] = useState({ steps: 0, cells: 0, ants: 1, highway: 0 })
  const ruleId = useId()
  const sim = useRef(freshWorld())
  const turns = useRef(parseTurmite('RL')!)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const view = useRef({ x: 0, y: 0 })
  const ruleOk = parseTurmite(ruleText) !== null
  const spf = speedOf(speedV)
  const vw = W / cell
  const vh = H / cell

  function sync() {
    const s = sim.current
    setStats({ steps: s.steps, cells: s.cells, ants: s.ants.length, highway: s.highway })
  }

  function reset() {
    sim.current = freshWorld()
    sync()
  }

  function applyRule(r: string) {
    setRuleText(r)
    const t = parseTurmite(r)
    if (t) {
      turns.current = t
      sim.current = freshWorld()
      sync()
    }
  }

  function advance(n: number) {
    const s = sim.current
    const t = turns.current
    const g = s.grid
    for (let k = 0; k < n; k++) {
      for (const ant of s.ants) {
        const i = antStep(g, GW, GH, ant, t)
        if (!s.visited[i]) {
          s.visited[i] = 1
          s.cells++
        }
      }
      s.steps++
      if (s.steps % HIGHWAY_PERIOD === 0 && !s.highway && s.detect(s.ants[0])) s.highway = s.steps
    }
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    const s = sim.current
    if (s.ants.length >= 16) return
    const x = clamp(Math.floor(view.current.x + p.x / cell), 0, GW - 1)
    const y = clamp(Math.floor(view.current.y + p.y / cell), 0, GH - 1)
    s.ants.push(makeAnt(x, y, s.ants.length % 4))
    sync()
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            maxDpr={1.5}
            onPointer={onPointer}
            label={`Turmite with rule ${ruleText} after ${stats.steps} steps, ${stats.ants} ant${stats.ants > 1 ? 's' : ''}.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0) {
                s.acc += spf * f.dt * 60
                const n = Math.min(50000, Math.floor(s.acc))
                s.acc -= n
                advance(n)
              }
              // Viewport: centred on the grid, or chasing the first ant.
              const a0 = s.ants[0]
              const cx = follow ? a0.x : GW / 2
              const cy = follow ? a0.y : GH / 2
              const v = view.current
              v.x = clamp(cx - vw / 2, 0, GW - vw)
              v.y = clamp(cy - vh / 2, 0, GH - vh)

              if (!buf.current) buf.current = makeBuffer(GW, GH)
              const b = buf.current
              const d = b.data
              const g = s.grid
              for (let i = 0; i < g.length; i++) {
                const c = COLOURS[g[i] % COLOURS.length]
                const o = i * 4
                d[o] = c[0]
                d[o + 1] = c[1]
                d[o + 2] = c[2]
                d[o + 3] = 255
              }
              b.flush()
              clear(ctx, W, H, '#0d0c0b')
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(b.canvas, v.x, v.y, vw, vh, 0, 0, W, H)
              if (cell >= 8) {
                ctx.beginPath()
                const ox = -(v.x % 1) * cell
                const oy = -(v.y % 1) * cell
                for (let x = ox; x <= W; x += cell) {
                  ctx.moveTo(x, 0)
                  ctx.lineTo(x, H)
                }
                for (let y = oy; y <= H; y += cell) {
                  ctx.moveTo(0, y)
                  ctx.lineTo(W, y)
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.05)'
                ctx.lineWidth = 1
                ctx.stroke()
              }
              // Ants as little arrowheads with a pulsing halo.
              const r = Math.max(5, cell * 0.8)
              const pulse = 1 + 0.25 * Math.sin(f.t * 6 + f.frame * 0.1)
              for (const ant of s.ants) {
                const x = (ant.x - v.x + 0.5) * cell
                const y = (ant.y - v.y + 0.5) * cell
                if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue
                circle(ctx, x, y, r * 1.9 * pulse, 'rgba(255,70,70,0.22)')
                ctx.save()
                ctx.translate(x, y)
                ctx.rotate((ant.dir * Math.PI) / 2)
                ctx.beginPath()
                ctx.moveTo(0, -r)
                ctx.lineTo(r * 0.8, r * 0.8)
                ctx.lineTo(0, r * 0.4)
                ctx.lineTo(-r * 0.8, r * 0.8)
                ctx.closePath()
                ctx.fillStyle = '#ff4d4d'
                ctx.fill()
                ctx.strokeStyle = '#fff'
                ctx.lineWidth = 1.5
                ctx.stroke()
                ctx.restore()
              }
              if (s.highway) text(ctx, `Highway! Since about step ${fmt(Math.max(0, s.highway - 3 * HIGHWAY_PERIOD))}`, 14, 26, { color: '#ffd166', size: 15, weight: 700 })
              else if (turns.current.length === 2 && s.steps < 10000 && s.steps > 0) text(ctx, 'Chaos… the highway usually appears near step 10 000', 14, 26, { color: '#9a958a', size: 13 })
              if (f.frame % 8 === 0 && running) sync()
            }}
          />
          <Readout
            items={[
              ['Steps', fmt(stats.steps)],
              ['Cells visited', fmt(stats.cells)],
              ['Ants', stats.ants],
              ['Highway', stats.highway ? `step ≈ ${fmt(Math.max(0, stats.highway - 3 * HIGHWAY_PERIOD))}` : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={() => { advance(1); sync() }} onReset={reset} />
      <Slider label="Steps per frame" value={speedV} min={0} max={100} format={(v) => fmt(speedOf(v))} onChange={setSpeedV} />
      <Select label="Rule" value={preset} options={PRESETS} onChange={(v) => { setPreset(v); if (v !== 'custom') applyRule(v) }} />
      <div className="sim-field">
        <label className="sim-label" htmlFor={ruleId}>
          Rule string (L, R, N, U) {!ruleOk && <span className="sim-val" style={{ color: 'var(--danger)' }}>not valid</span>}
        </label>
        <input id={ruleId} type="text" className="sim-text sim-mono" value={ruleText} maxLength={16} aria-invalid={!ruleOk} onChange={(e) => { setPreset('custom'); applyRule(e.target.value) }} />
      </div>
      <Slider label="Zoom (cell size)" value={cell} min={2} max={16} unit=" px" onChange={setCell} />
      <Toggle label="Follow the first ant" checked={follow} onChange={setFollow} />
      <Hint>On a cell of colour i the ant turns by letter i of the rule, bumps the cell to the next colour, and steps forward. The classic RL ant wanders chaotically for about 10 000 steps, then builds a diagonal highway forever. Click the grid to add more ants.</Hint>
    </SimLayout>
  )
}
