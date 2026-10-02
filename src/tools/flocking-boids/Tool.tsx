import { useEffect, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, text } from '../../sim/draw'
import { TAU, fmt, rng } from '../../sim/math'
import { averageSpeed, createFlock, polarization, stepFlock, type Hawk, type Obstacle } from './boids'

const W = 800
const H = 500
const BG = '#0d0c0b'
const HUES = 24

export default function FlockingBoids() {
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState(300)
  const [separation, setSeparation] = useState(1.5)
  const [alignment, setAlignment] = useState(1)
  const [cohesion, setCohesion] = useState(1)
  const [perception, setPerception] = useState(50)
  const [maxSpeed, setMaxSpeed] = useState(160)
  const [trails, setTrails] = useState(false)
  const [pointer, setPointer] = useState<'hawk' | 'attract'>('hawk')
  const [info, setInfo] = useState({ speed: 0, order: 0, neighbours: 0 })
  const flock = useRef(createFlock(W, H, 160, rng(4)))
  const obstacles = useRef<Obstacle[]>([
    { x: 250, y: 260, r: 26 },
    { x: 560, y: 180, r: 20 },
  ])
  const hawk = useRef<{ x: number; y: number; px: number; py: number; on: boolean }>({ x: 0, y: 0, px: 0, py: 0, on: false })
  const press = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const wipe = useRef(true)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const off = () => (hawk.current.on = false)
    c.addEventListener('pointerleave', off)
    return () => c.removeEventListener('pointerleave', off)
  }, [])

  function onPointer(p: SimPointer) {
    const hk = hawk.current
    hk.on = true
    hk.x = p.x
    hk.y = p.y
    if (p.type === 'down') press.current = { x: p.x, y: p.y }
    if (p.type === 'up' && press.current) {
      // A tap (not a drag) adds an obstacle, or removes the one under the pointer.
      if (Math.hypot(p.x - press.current.x, p.y - press.current.y) < 6) {
        const obs = obstacles.current
        const hit = obs.findIndex((o) => Math.hypot(o.x - p.x, o.y - p.y) < o.r + 4)
        if (hit >= 0) obs.splice(hit, 1)
        else obs.push({ x: p.x, y: p.y, r: 22 })
      }
      press.current = null
    }
  }

  function reset() {
    flock.current = createFlock(W, H, maxSpeed, rng(Math.floor(Math.random() * 1e9)))
    wipe.current = true
  }

  const params = { separation, alignment, cohesion, perception, maxSpeed }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            canvasRef={canvas}
            cursor="none"
            onPointer={onPointer}
            label={`A flock of ${count} boids flying with separation ${separation}, alignment ${alignment} and cohesion ${cohesion}.`}
            onFrame={(ctx, f) => {
              const fl = flock.current
              fl.n = count
              const hk = hawk.current
              const hw: Hawk | null = hk.on ? { x: hk.x, y: hk.y, attract: pointer === 'attract' } : null
              let nb = info.neighbours
              if (f.dt > 0) {
                const steps = 2
                for (let s = 0; s < steps; s++) nb = stepFlock(fl, params, f.dt / steps, W, H, obstacles.current, hw)
              }
              if (trails && !wipe.current) {
                ctx.fillStyle = 'rgba(13, 12, 11, 0.2)'
                ctx.fillRect(0, 0, W, H)
              } else clear(ctx, W, H, BG)
              wipe.current = false
              for (const o of obstacles.current) {
                circle(ctx, o.x, o.y, o.r + perception * 0.7, 'rgba(255,255,255,0.03)')
                circle(ctx, o.x, o.y, o.r, '#3a3833', '#6b675e', 2)
              }
              // Batch triangles by heading hue so a few hundred boids cost a couple dozen fills.
              for (let b = 0; b < HUES; b++) {
                ctx.beginPath()
                for (let i = 0; i < fl.n; i++) {
                  const a = Math.atan2(fl.vy[i], fl.vx[i])
                  if (Math.floor(((a + Math.PI) / TAU) * HUES) % HUES !== b) continue
                  const c = Math.cos(a)
                  const s = Math.sin(a)
                  const x = fl.x[i]
                  const y = fl.y[i]
                  ctx.moveTo(x + c * 7, y + s * 7)
                  ctx.lineTo(x - c * 5 - s * 3.5, y - s * 5 + c * 3.5)
                  ctx.lineTo(x - c * 3 , y - s * 3)
                  ctx.lineTo(x - c * 5 + s * 3.5, y - s * 5 - c * 3.5)
                  ctx.closePath()
                }
                ctx.fillStyle = `hsl(${Math.round((b / HUES) * 360 + 180)} 75% 66%)`
                ctx.fill()
              }
              if (hk.on) {
                const a = Math.hypot(hk.x - hk.px, hk.y - hk.py) > 0.5 ? Math.atan2(hk.y - hk.py, hk.x - hk.px) : -Math.PI / 2
                if (Math.hypot(hk.x - hk.px, hk.y - hk.py) > 0.5) {
                  hk.px += (hk.x - hk.px) * 0.3
                  hk.py += (hk.y - hk.py) * 0.3
                }
                const col = pointer === 'hawk' ? '#ff6b6b' : '#ffd43b'
                circle(ctx, hk.x, hk.y, pointer === 'hawk' ? 110 : 30, undefined, pointer === 'hawk' ? 'rgba(255,107,107,0.25)' : 'rgba(255,212,59,0.35)', 1)
                ctx.save()
                ctx.translate(hk.x, hk.y)
                ctx.rotate(a)
                ctx.beginPath()
                ctx.moveTo(14, 0)
                ctx.lineTo(-8, -12)
                ctx.lineTo(-3, 0)
                ctx.lineTo(-8, 12)
                ctx.closePath()
                ctx.fillStyle = col
                ctx.fill()
                ctx.restore()
              }
              text(ctx, pointer === 'hawk' ? 'hover to hunt · tap to add or remove rocks' : 'hover to attract · tap to add or remove rocks', 12, H - 12, { color: 'rgba(255,255,255,0.5)', size: 12 })
              if (f.frame % 10 === 0) setInfo({ speed: averageSpeed(fl), order: polarization(fl.vx, fl.vy, fl.n), neighbours: nb })
            }}
          />
          <Readout
            items={[
              ['Boids', count],
              ['Average speed', `${Math.round(info.speed)} px/s`],
              ['Polarisation', fmt(info.order, 2)],
              ['Neighbours each', fmt(info.neighbours, 1)],
              ['Rocks', obstacles.current.length],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} resetLabel="Scatter">
        <button type="button" className="btn" onClick={() => (obstacles.current = [])}>
          Clear rocks
        </button>
      </PlayBar>
      <Slider label="Boids" value={count} min={150} max={600} step={10} onChange={setCount} />
      <Slider label="Separation" value={separation} min={0} max={3} step={0.1} onChange={setSeparation} />
      <Slider label="Alignment" value={alignment} min={0} max={3} step={0.1} onChange={setAlignment} />
      <Slider label="Cohesion" value={cohesion} min={0} max={3} step={0.1} onChange={setCohesion} />
      <Slider label="Perception radius" value={perception} min={20} max={120} unit=" px" onChange={setPerception} />
      <Slider label="Max speed" value={maxSpeed} min={60} max={300} step={10} unit=" px/s" onChange={setMaxSpeed} />
      <Choice label="Pointer" value={pointer} options={[['hawk', 'Hawk'], ['attract', 'Attract']]} onChange={setPointer} />
      <Toggle label="Motion trails" checked={trails} onChange={(v) => { setTrails(v); wipe.current = true }} />
      <Hint>Each bird only looks at nearby neighbours, yet the whole flock turns together. Set alignment to 0 and polarisation collapses; hover over the flock to send in the hawk.</Hint>
    </SimLayout>
  )
}
