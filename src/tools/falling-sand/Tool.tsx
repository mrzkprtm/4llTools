import { useEffect, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, makeBuffer } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { EMPTY, MATERIALS, SAND, counts, demoScene, makeGrid, paint, place, render, step } from './sand'

const GW = 200
const GH = 130
const CELL = 4
const W = GW * CELL
const H = GH * CELL

const PICK = [1, 2, 3, 4, 5, 6, 7, 0]
const rgb = (id: number) => `rgb(${MATERIALS[id].rgb.join(',')})`

export default function FallingSand() {
  const [running, setRunning] = useRunning()
  const [material, setMaterial] = useState(SAND)
  const [brush, setBrush] = useState(4)
  const [rain, setRain] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tally, setTally] = useState<number[]>(() => new Array(MATERIALS.length).fill(0))
  const grid = useRef<ReturnType<typeof makeGrid> | null>(null)
  if (!grid.current) {
    grid.current = makeGrid(GW, GH)
    demoScene(grid.current)
  }
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const pointer = useRef({ x: -99, y: -99, down: false, erase: false, lx: -1, ly: -1 })
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const leave = () => {
      if (!pointer.current.down) pointer.current.x = -99
    }
    c.addEventListener('pointerleave', leave)
    return () => c.removeEventListener('pointerleave', leave)
  }, [])

  function onPointer(p: SimPointer) {
    const s = pointer.current
    s.x = p.x / CELL
    s.y = p.y / CELL
    if (p.type === 'down') {
      s.down = true
      s.erase = p.button === 2
      s.lx = s.x
      s.ly = s.y
    }
    if (p.type === 'up') s.down = false
  }

  /** Paints along the pointer's path since the last frame so fast strokes stay continuous. */
  function brushStroke() {
    const s = pointer.current
    const g = grid.current!
    const m = s.erase ? EMPTY : material
    const d = Math.hypot(s.x - s.lx, s.y - s.ly)
    const n = Math.max(1, Math.ceil(d / Math.max(1, brush / 2)))
    for (let k = 1; k <= n; k++) paint(g, s.lx + ((s.x - s.lx) * k) / n, s.ly + ((s.y - s.ly) * k) / n, brush, m)
    s.lx = s.x
    s.ly = s.y
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            canvasRef={canvas}
            onPointer={onPointer}
            label="Pixel sandbox where sand, water, oil, plants, fire and steam fall, flow, grow and burn."
            onFrame={(ctx, f) => {
              const g = grid.current!
              if (!buf.current) buf.current = makeBuffer(GW, GH)
              const b = buf.current
              if (pointer.current.down) brushStroke()
              if (f.dt > 0) {
                for (let k = 0; k < speed; k++) {
                  if (rain)
                    for (let r = 0; r < 3; r++) {
                      const x = (Math.random() * GW) | 0
                      if (g.mat[x] === EMPTY) place(g, x, SAND)
                    }
                  step(g)
                }
              }
              render(g, b.data, f.t)
              b.flush()
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(b.canvas, 0, 0, W, H)
              ctx.imageSmoothingEnabled = true
              const s = pointer.current
              if (s.x >= 0 && s.x <= GW && s.y >= 0 && s.y <= GH) {
                const col = s.erase && s.down ? '#ffffff' : material === EMPTY ? '#ffffff' : rgb(material)
                circle(ctx, s.x * CELL, s.y * CELL, brush * CELL, undefined, col, 1.5)
                circle(ctx, s.x * CELL, s.y * CELL, 1.5, col)
              }
              if (f.frame % 12 === 0) setTally(counts(g))
            }}
          />
          <Readout items={PICK.filter((id) => id !== EMPTY).map((id) => [MATERIALS[id].name, fmt(tally[id], 0)] as const)} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => demoScene(grid.current!)} resetLabel="Demo">
        <button type="button" className="btn" onClick={() => grid.current!.mat.fill(EMPTY)}>
          Clear
        </button>
      </PlayBar>
      <div className="sim-field">
        <span className="sim-label">Material</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
          {PICK.map((id) => (
            <button
              key={id}
              type="button"
              className={`btn ${material === id ? 'primary' : ''}`}
              aria-pressed={material === id}
              onClick={() => setMaterial(id)}
              style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: '0.84rem', gap: 8 }}
            >
              <i aria-hidden="true" style={{ display: 'inline-block', marginRight: 7, verticalAlign: '-1px', width: 12, height: 12, borderRadius: 3, flex: 'none', background: id === EMPTY ? 'transparent' : rgb(id), border: '1px solid rgba(128,128,128,0.6)' }} />
              {MATERIALS[id].name}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Brush size" value={brush} min={1} max={14} unit=" cells" onChange={setBrush} />
      <Slider label="Speed" value={speed} min={1} max={4} unit="×" onChange={setSpeed} />
      <Toggle label="Rain sand" checked={rain} onChange={setRain} />
      <Hint>Pick a material and draw on the canvas; hold still to keep pouring. Right-click erases. Sand sinks through water, oil floats on top, plants drink water and grow, and fire burns plants and oil but turns to steam in water.</Hint>
    </SimLayout>
  )
}
