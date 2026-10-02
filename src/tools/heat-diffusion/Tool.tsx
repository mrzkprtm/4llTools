import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt, rng } from '../../sim/math'
import { diffuseStep, stats, subSteps, type Boundary } from './heat'

const GW = 160
const GH = 100
const CELL = 5
const W = GW * CELL
const H = GH * CELL
const TMAX = 100
const AMBIENT = 20

type Brush = 'hot' | 'cold' | 'heater' | 'cooler'
type Preset = 'spot' | 'stripes' | 'random' | 'clear'

// Inferno-like colour map, 256 entries.
const STOPS = [
  [0, 0, 0, 4],
  [0.13, 31, 12, 72],
  [0.25, 85, 15, 109],
  [0.38, 136, 34, 106],
  [0.5, 186, 54, 85],
  [0.63, 227, 89, 51],
  [0.75, 249, 140, 10],
  [0.88, 249, 201, 50],
  [1, 252, 255, 164],
]
const LUT = new Uint8Array(256 * 3)
for (let i = 0; i < 256; i++) {
  const t = i / 255
  let s = 1
  while (s < STOPS.length - 1 && STOPS[s][0] < t) s++
  const [t0, ...a] = STOPS[s - 1]
  const [t1, ...b] = STOPS[s]
  const f = (t - t0) / (t1 - t0 || 1)
  for (let c = 0; c < 3; c++) LUT[i * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * f)
}

function build(p: Preset, grid: Float64Array, src: Int8Array) {
  const random = rng(Math.floor(Math.random() * 1e9))
  src.fill(0)
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i
      if (p === 'spot') grid[k] = Math.hypot(i - GW / 2, j - GH / 2) < 14 ? TMAX : AMBIENT
      else if (p === 'stripes') grid[k] = Math.floor(i / 16) % 2 ? TMAX : 0
      else if (p === 'random') grid[k] = random() * TMAX
      else grid[k] = AMBIENT
    }
  if (p === 'random') for (let s = 0; s < 3; s++) grid.set(diffuseStep(grid, GW, GH, 0.24, 'insulated'))
  if (p === 'spot') {
    // A heater on the left and a cooler on the right keep a steady flow going.
    for (let j = 40; j < 60; j++)
      for (let i = 10; i < 14; i++) {
        src[j * GW + i] = 1
        src[j * GW + GW - 1 - i] = -1
      }
  }
}

export default function HeatDiffusion() {
  const [running, setRunning] = useRunning()
  const [brush, setBrush] = useState<Brush>('hot')
  const [size, setSize] = useState(6)
  const [alphaD, setAlphaD] = useState(40)
  const [boundary, setBoundary] = useState<Boundary>('insulated')
  const [info, setInfo] = useState({ min: 0, max: 0, mean: 0, probe: NaN })
  const grid = useRef<Float64Array | null>(null)
  const scratch = useRef<Float64Array | null>(null)
  const [sources] = useState(() => new Int8Array(GW * GH))
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const pointer = useRef<{ x: number; y: number; at: number } | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  function cells() {
    if (!grid.current) {
      grid.current = new Float64Array(GW * GH)
      build('spot', grid.current, sources)
    }
    return grid.current
  }

  function paint(cx: number, cy: number, erase: boolean) {
    const g = cells()
    const s = sources
    const r = size
    for (let j = Math.floor(cy - r); j <= cy + r; j++)
      for (let i = Math.floor(cx - r); i <= cx + r; i++) {
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue
        const d = Math.hypot(i - cx, j - cy) / r
        if (d > 1) continue
        const k = j * GW + i
        if (erase) s[k] = 0
        else if (brush === 'heater') s[k] = 1
        else if (brush === 'cooler') s[k] = -1
        else {
          const target = brush === 'hot' ? TMAX : 0
          g[k] += (target - g[k]) * (1 - d * d) * 0.6
        }
      }
  }

  function onPointer(p: SimPointer) {
    pointer.current = { x: p.x, y: p.y, at: performance.now() }
    const cx = p.x / CELL
    const cy = p.y / CELL
    if (p.type === 'down') last.current = { x: cx, y: cy }
    if (p.down && last.current) {
      const n = Math.max(1, Math.ceil(Math.hypot(cx - last.current.x, cy - last.current.y) / 2))
      for (let q = 1; q <= n; q++) paint(last.current.x + ((cx - last.current.x) * q) / n, last.current.y + ((cy - last.current.y) * q) / n, p.shift)
      last.current = { x: cx, y: cy }
    }
    if (p.type === 'up') last.current = null
  }

  function load(p: Preset) {
    build(p, cells(), sources)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            className="sim-dark"
            maxDpr={1.5}
            label={`Heat spreading across a ${GW} by ${GH} plate with ${boundary} edges.`}
            onFrame={(ctx, f) => {
              let g = cells()
              const s = sources
              const pin = () => {
                for (let k = 0; k < s.length; k++) if (s[k]) g[k] = s[k] > 0 ? TMAX : 0
              }
              pin()
              if (f.dt > 0) {
                const { n, k } = subSteps(alphaD, Math.min(f.dt, 1 / 30))
                for (let q = 0; q < n; q++) {
                  const out = diffuseStep(g, GW, GH, k, boundary, (scratch.current ??= new Float64Array(GW * GH)))
                  scratch.current = g
                  g = out
                  pin()
                }
                grid.current = g
              }

              if (!buf.current) buf.current = makeBuffer(GW, GH)
              const b = buf.current
              for (let k = 0; k < g.length; k++) {
                const li = clamp(Math.round((g[k] / TMAX) * 255), 0, 255) * 3
                b.data[k * 4] = LUT[li]
                b.data[k * 4 + 1] = LUT[li + 1]
                b.data[k * 4 + 2] = LUT[li + 2]
                b.data[k * 4 + 3] = 255
              }
              b.flush()
              ctx.imageSmoothingEnabled = true
              ctx.drawImage(b.canvas, 0, 0, W, H)
              // Mark permanent sources with a sparse dot pattern.
              for (let j = 1; j < GH; j += 3)
                for (let i = 1; i < GW; i += 3) {
                  const v = s[j * GW + i]
                  if (v) circle(ctx, i * CELL + 2.5, j * CELL + 2.5, 1.6, v > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(120,200,255,0.9)')
                }
              if (boundary === 'cold') {
                ctx.strokeStyle = 'rgba(120,200,255,0.8)'
                ctx.lineWidth = 4
                ctx.strokeRect(2, 2, W - 4, H - 4)
              }

              // Pointer: brush outline and a temperature profile along its row.
              const p = pointer.current
              let probe = NaN
              if (p && (last.current || performance.now() - p.at < 4000)) {
                const i = clamp(Math.floor(p.x / CELL), 0, GW - 1)
                const j = clamp(Math.floor(p.y / CELL), 0, GH - 1)
                probe = g[j * GW + i]
                circle(ctx, p.x, p.y, size * CELL, undefined, 'rgba(255,255,255,0.6)', 1.5)
                const py = p.y > H - 110 ? 12 : H - 92
                rrect(ctx, 12, py, W - 24, 80, 8, 'rgba(0,0,0,0.55)')
                ctx.beginPath()
                for (let x = 0; x < GW; x++) {
                  const X = 20 + (x / (GW - 1)) * (W - 40)
                  const Y = py + 70 - (g[j * GW + x] / TMAX) * 56
                  if (x) ctx.lineTo(X, Y)
                  else ctx.moveTo(X, Y)
                }
                ctx.strokeStyle = '#ffd43b'
                ctx.lineWidth = 2
                ctx.stroke()
                text(ctx, `profile along this row · ${fmt(probe, 1)} °C here`, 22, py + 16, { color: '#fff', size: 12 })
              }
              if (f.frame % 8 === 0) {
                const st = stats(g)
                setInfo({ min: st.min, max: st.max, mean: st.mean, probe })
              }
            }}
          />
          <Readout
            items={[
              ['Min', `${fmt(info.min, 1)} °C`],
              ['Max', `${fmt(info.max, 1)} °C`],
              ['Average', `${fmt(info.mean, 2)} °C`],
              ['Under pointer', Number.isFinite(info.probe) ? `${fmt(info.probe, 1)} °C` : 'hover'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => load('spot')}>
        <button type="button" className="btn" onClick={() => sources.fill(0)}>
          Clear sources
        </button>
      </PlayBar>
      <Choice label="Brush" value={brush} options={[['hot', 'Hot'], ['cold', 'Cold'], ['heater', 'Heater'], ['cooler', 'Cooler']]} onChange={setBrush} />
      <Slider label="Brush size" value={size} min={2} max={16} unit=" cells" onChange={setSize} />
      <Slider label="Diffusivity α" value={alphaD} min={2} max={200} step={2} unit=" cell²/s" onChange={setAlphaD} />
      <Choice label="Edges" value={boundary} options={[['insulated', 'Insulated'], ['cold', 'Held at 0 °C']]} onChange={setBoundary} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => load('spot')}>
          Hot spot
        </button>
        <button type="button" className="btn" onClick={() => load('stripes')}>
          Stripes
        </button>
        <button type="button" className="btn" onClick={() => load('random')}>
          Random
        </button>
        <button type="button" className="btn" onClick={() => load('clear')}>
          Even 20 °C
        </button>
      </div>
      <Hint>
        Paint on the plate: Hot and Cold change the temperature once, Heater and Cooler stay fixed at 100 °C and 0 °C. Shift-drag erases sources. With insulated edges and no sources the average
        never changes; heat only spreads out.
      </Hint>
    </SimLayout>
  )
}
