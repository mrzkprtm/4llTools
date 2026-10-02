import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, downloadCanvas, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { PRESETS, fitTransform, parseRules, rewrite, turtle, type Path } from './lsystem'

const W = 800
const H = 520
const K = 2
const MARGIN = 28
const BG = '#0c0d0b'
const SWAY_LIMIT = 30000
const BUCKETS = 48
const PRESET_OPTIONS = Object.entries(PRESETS).map(([k, p]) => [k, p.name] as const) as [string, string][]

type ColorBy = 'depth' | 'path' | 'single'
type Fit = { s: number; ox: number; oy: number }

/** Draws segments [from, to) grouped into a few colour buckets so each bucket is one stroke. */
function drawSegments(ctx: CanvasRenderingContext2D, P: Path, from: number, to: number, fit: Fit, colorBy: ColorBy, plant: boolean) {
  const groups: number[][] = Array.from({ length: BUCKETS }, () => [])
  const md = Math.max(1, P.maxDepth)
  for (let i = from; i < to; i++) {
    const b = colorBy === 'single' ? 0 : colorBy === 'path' ? Math.min(BUCKETS - 1, Math.floor((i / P.count) * BUCKETS)) : Math.min(BUCKETS - 1, Math.round((P.depth[i] / md) * (BUCKETS - 1)))
    groups[b].push(i)
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  groups.forEach((g, b) => {
    if (!g.length) return
    const u = b / (BUCKETS - 1)
    ctx.beginPath()
    for (const i of g) {
      ctx.moveTo(fit.ox + P.seg[i * 4] * fit.s, fit.oy + P.seg[i * 4 + 1] * fit.s)
      ctx.lineTo(fit.ox + P.seg[i * 4 + 2] * fit.s, fit.oy + P.seg[i * 4 + 3] * fit.s)
    }
    if (colorBy === 'single') ctx.strokeStyle = plant ? '#cfe8b4' : '#ece6d6'
    else if (colorBy === 'depth' && plant) ctx.strokeStyle = `hsl(${Math.round(26 + 84 * u)} ${Math.round(45 + 25 * u)}% ${Math.round(34 + 26 * u)}%)`
    else ctx.strokeStyle = `hsl(${Math.round((190 + 300 * u) % 360)} 80% 62%)`
    const base = Math.min(2.2, Math.max(0.6, fit.s * 0.45))
    ctx.lineWidth = plant && colorBy !== 'path' ? Math.max(0.6, base * 2.4 * (1 - (colorBy === 'depth' ? u : 0) * 0.8)) : base
    ctx.stroke()
  })
}

export default function LSystemPlants() {
  const axiomId = useId()
  const drawId = useId()
  const rulesId = useId()
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState('plant')
  const [axiom, setAxiom] = useState(PRESETS.plant.axiom)
  const [rulesText, setRulesText] = useState(PRESETS.plant.rules)
  const [angle, setAngle] = useState(PRESETS.plant.angle)
  const [iterations, setIterations] = useState(PRESETS.plant.iterations)
  const [drawSyms, setDrawSyms] = useState(PRESETS.plant.draw)
  const [speed, setSpeed] = useState(1)
  const [colorBy, setColorBy] = useState<ColorBy>('depth')
  const [jitter, setJitter] = useState(false)
  const [sway, setSway] = useState(true)
  const [seed, setSeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const art = useRef<HTMLCanvasElement | null>(null)
  const drawn = useRef(0)
  const swayAmp = useRef(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const p = PRESETS[preset]
  const plant = p.plant

  const result = useMemo(() => rewrite(axiom, parseRules(rulesText), iterations), [axiom, rulesText, iterations])
  const opts = { angle, heading: p.heading, draw: drawSyms || 'F', jitter: jitter ? 0.18 : 0, seed }
  const path = useMemo(() => turtle(result.str, opts), [result, angle, p.heading, drawSyms, jitter, seed])
  const fit = useMemo(() => fitTransform(path.bounds, W, H, MARGIN), [path])

  function regrow() {
    if (!art.current) {
      art.current = document.createElement('canvas')
      art.current.width = W * K
      art.current.height = H * K
    }
    const c = art.current.getContext('2d')!
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = BG
    c.fillRect(0, 0, W * K, H * K)
    drawn.current = 0
    swayAmp.current = 0
    setProgress(0)
  }

  useEffect(regrow, [path, colorBy])

  function load(key: string) {
    const q = PRESETS[key]
    setPreset(key)
    setAxiom(q.axiom)
    setRulesText(q.rules)
    setAngle(q.angle)
    setIterations(q.iterations)
    setDrawSyms(q.draw)
    setColorBy(q.plant ? 'depth' : 'path')
  }

  const canSway = plant && sway && path.count <= SWAY_LIMIT

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            canvasRef={canvas}
            className="sim-dark"
            label={`L-system drawing: ${p.name}, ${result.done} iterations, ${path.count} line segments.`}
            onFrame={(ctx, f) => {
              if (!art.current) regrow()
              const c = art.current!.getContext('2d')!
              if (f.dt > 0 && drawn.current < path.count) {
                // A preset takes about five seconds to draw at 1×.
                const rate = Math.max(60, path.count / 5) * speed
                const from = Math.floor(drawn.current)
                drawn.current = Math.min(path.count, drawn.current + rate * f.dt)
                c.setTransform(K, 0, 0, K, 0, 0)
                drawSegments(c, path, from, Math.floor(drawn.current), fit, colorBy, plant)
              }
              const done = drawn.current >= path.count
              if (canSway && done) {
                if (f.dt > 0) swayAmp.current = Math.min(1, swayAmp.current + f.dt / 1.5)
                const amp = swayAmp.current
                const t = f.t
                const moving = turtle(result.str, { ...opts, sway: (d) => amp * Math.sin(t * 1.3 + d * 0.8) * (1.2 + d * 0.9) })
                clear(ctx, W, H, BG)
                drawSegments(ctx, moving, 0, moving.count, fit, colorBy, plant)
              } else {
                clear(ctx, W, H, BG)
                ctx.drawImage(art.current!, 0, 0, W, H)
              }
              if (result.capped) text(ctx, `stopped at ${result.done} iterations (400k symbol cap)`, W - 12, 22, { color: 'rgba(255,255,255,0.6)', size: 12, align: 'right' })
              if (f.frame % 10 === 0) setProgress(path.count ? drawn.current / path.count : 1)
            }}
          />
          <Readout
            items={[
              ['Iterations', result.capped ? `${result.done} (cap)` : result.done],
              ['Symbols', fmt(result.str.length)],
              ['Segments', fmt(path.count)],
              ['Drawn', `${Math.round(progress * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={regrow} resetLabel="Regrow">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `l-system-${preset}.png`)}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select label="Preset" value={preset} options={PRESET_OPTIONS} onChange={load} />
      <Slider label="Iterations" value={iterations} min={0} max={14} onChange={setIterations} />
      <Slider label="Angle" value={angle} min={1} max={180} step={0.5} unit="°" onChange={setAngle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="sim-field">
          <label htmlFor={axiomId} className="sim-label">
            Axiom
          </label>
          <input id={axiomId} type="text" className="sim-mono" value={axiom} spellCheck={false} onChange={(e) => setAxiom(e.target.value.replace(/\s+/g, ''))} />
        </div>
        <div className="sim-field">
          <label htmlFor={drawId} className="sim-label">
            Line symbols
          </label>
          <input id={drawId} type="text" className="sim-mono" value={drawSyms} spellCheck={false} onChange={(e) => setDrawSyms(e.target.value.replace(/[\s[\]+\-|]/g, ''))} />
        </div>
      </div>
      <div className="sim-field">
        <label htmlFor={rulesId} className="sim-label">
          Rules (one per line)
        </label>
        <textarea id={rulesId} className="sim-text" style={{ minHeight: 76 }} value={rulesText} spellCheck={false} onChange={(e) => setRulesText(e.target.value)} />
      </div>
      <Slider label="Drawing speed" value={speed} min={0.1} max={10} step={0.1} unit="×" onChange={setSpeed} />
      <Choice label="Colour by" value={colorBy} options={[['depth', 'Depth'], ['path', 'Path'], ['single', 'Single']]} onChange={setColorBy} />
      <Toggle label="Random angle jitter" checked={jitter} onChange={setJitter} />
      {jitter && (
        <button type="button" className="btn btn-icon" onClick={() => setSeed(seed + 1)}>
          <Icon name="lightning-bolt" size={18} />
          New random seed
        </button>
      )}
      {plant && <Toggle label={path.count > SWAY_LIMIT ? 'Sway in the wind (too many segments)' : 'Sway in the wind'} checked={sway} onChange={setSway} />}
      <Hint>F draws a step, + and − turn by the angle, [ and ] save and restore the turtle so branches can sprout. Each iteration rewrites every symbol by its rule, so the drawing grows in detail; try editing a rule.</Hint>
    </SimLayout>
  )
}
