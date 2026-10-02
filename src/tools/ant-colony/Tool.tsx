import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, makeBuffer, text } from '../../sim/draw'
import { rad, rng } from '../../sim/math'
import { createAnts, createField, diffuse, evaporate, stepAnts, type Ants, type Field } from './ants'

const W = 800
const H = 500
const CELL = 5
const COLS = W / CELL
const ROWS = H / CELL
const NEST = { x: 400, y: 250, r: 16 }

type Brush = 'food' | 'wall' | 'erase'

function paint(f: Field, x: number, y: number, brush: Brush) {
  const cx = Math.floor(x / CELL)
  const cy = Math.floor(y / CELL)
  const r = brush === 'food' ? 3 : brush === 'wall' ? 2 : 4
  for (let oy = -r; oy <= r; oy++)
    for (let ox = -r; ox <= r; ox++) {
      const gx = cx + ox
      const gy = cy + oy
      if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS || ox * ox + oy * oy > r * r + 1) continue
      if (Math.hypot(gx * CELL + CELL / 2 - NEST.x, gy * CELL + CELL / 2 - NEST.y) < NEST.r + 6) continue
      const k = gy * COLS + gx
      if (brush === 'food' && !f.walls[k]) f.stock[k] = Math.min(12, f.stock[k] + 4)
      if (brush === 'wall') {
        f.walls[k] = 1
        f.stock[k] = 0
        f.home[k] = f.food[k] = 0
      }
      if (brush === 'erase') f.walls[k] = f.stock[k] = 0
    }
}

function initialField(): Field {
  const f = createField(COLS, ROWS, CELL)
  for (const [x, y] of [[120, 110], [680, 400], [660, 90]]) {
    paint(f, x, y, 'food')
    paint(f, x + 6, y + 4, 'food')
  }
  for (let y = 50; y <= 200; y += 5) paint(f, 230, y, 'wall')
  for (let x = 520; x <= 640; x += 5) paint(f, x, 330, 'wall')
  return f
}

export default function AntColony() {
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState(200)
  const [evap, setEvap] = useState(5)
  const [sensor, setSensor] = useState(35)
  const [speed, setSpeed] = useState(1.5)
  const [brush, setBrush] = useState<Brush>('food')
  const [showTrails, setShowTrails] = useState(true)
  const [info, setInfo] = useState({ collected: 0, remaining: 0, carrying: 0 })
  const field = useRef<Field>(null as unknown as Field)
  if (!field.current) field.current = initialField()
  const random = useRef(rng(21))
  const ants = useRef<Ants>(null as unknown as Ants)
  if (!ants.current) ants.current = createAnts(NEST.x, NEST.y, random.current)
  const collected = useRef(0)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)

  function reset() {
    field.current = initialField()
    ants.current = createAnts(NEST.x, NEST.y, random.current)
    collected.current = 0
  }

  function onPointer(p: SimPointer) {
    if (!p.down) {
      last.current = null
      return
    }
    // Paint along the drag so fast strokes leave no gaps.
    const from = last.current ?? { x: p.x, y: p.y }
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - from.x, p.y - from.y) / 4))
    for (let i = 1; i <= steps; i++) paint(field.current, from.x + ((p.x - from.x) * i) / steps, from.y + ((p.y - from.y) * i) / steps, brush)
    last.current = p.type === 'up' ? null : { x: p.x, y: p.y }
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
            label={`Ant colony with ${count} ants; ${info.collected} pieces of food brought back to the nest.`}
            onFrame={(ctx, fr) => {
              const f = field.current
              const a = ants.current
              a.n = count
              if (fr.dt > 0) {
                const total = fr.dt * speed
                const n = Math.ceil(total / (1 / 60))
                const params = { sensorAngle: rad(sensor), sensorDist: 14, speed: 70, nest: NEST }
                for (let i = 0; i < n; i++) collected.current += stepAnts(a, f, params, total / n, random.current)
                evaporate(f.home, evap / 100, total)
                evaporate(f.food, evap / 100, total)
                diffuse(f.home, COLS, ROWS, 0.08, f.walls, f.tmp)
                diffuse(f.food, COLS, ROWS, 0.08, f.walls, f.tmp)
              }
              if (!buf.current) buf.current = makeBuffer(COLS, ROWS)
              const b = buf.current
              for (let k = 0; k < COLS * ROWS; k++) {
                const o = k * 4
                if (f.walls[k]) {
                  b.data[o] = 120
                  b.data[o + 1] = 114
                  b.data[o + 2] = 102
                } else if (f.stock[k]) {
                  const s = 0.55 + f.stock[k] / 26
                  b.data[o] = 70 * s
                  b.data[o + 1] = 230 * s
                  b.data[o + 2] = 90 * s
                } else {
                  const hm = showTrails ? Math.min(1, Math.sqrt(f.home[k] / 6)) : 0
                  const fd = showTrails ? Math.min(1, Math.sqrt(f.food[k] / 6)) : 0
                  b.data[o] = 13 + hm * 30 + fd * 235
                  b.data[o + 1] = 12 + hm * 90 + fd * 90
                  b.data[o + 2] = 11 + hm * 220 + fd * 40
                }
                b.data[o + 3] = 255
              }
              b.flush()
              clear(ctx, W, H, '#0d0c0b')
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(b.canvas, 0, 0, W, H)
              ctx.imageSmoothingEnabled = true
              circle(ctx, NEST.x, NEST.y, NEST.r + 4, 'rgba(180, 120, 60, 0.35)')
              circle(ctx, NEST.x, NEST.y, NEST.r, '#8a5a2b', '#d9a066', 2)
              text(ctx, 'nest', NEST.x, NEST.y + 4, { color: '#fff', size: 12, align: 'center', weight: 600 })
              ctx.lineCap = 'round'
              for (const carry of [0, 1]) {
                ctx.beginPath()
                for (let i = 0; i < a.n; i++) {
                  if (a.carrying[i] !== carry) continue
                  const c = Math.cos(a.a[i]) * 2.5
                  const s = Math.sin(a.a[i]) * 2.5
                  ctx.moveTo(a.x[i] - c, a.y[i] - s)
                  ctx.lineTo(a.x[i] + c, a.y[i] + s)
                }
                ctx.strokeStyle = carry ? '#b2f2bb' : '#f1ece0'
                ctx.lineWidth = carry ? 3 : 2
                ctx.stroke()
              }
              if (fr.frame % 12 === 0) {
                let rem = 0
                for (let k = 0; k < f.stock.length; k++) rem += f.stock[k]
                let carrying = 0
                for (let i = 0; i < a.n; i++) carrying += a.carrying[i]
                setInfo({ collected: collected.current, remaining: rem, carrying })
              }
            }}
          />
          <Legend items={[['#4fa3ff', 'Trail to home'], ['#ff8a5c', 'Trail to food'], ['#46e65a', 'Food'], ['#78726a', 'Wall']]} />
          <Readout items={[['Food collected', info.collected], ['Food remaining', info.remaining], ['Ants', count], ['Carrying food', info.carrying]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} />
      <Choice label="Drag to draw" value={brush} options={[['food', 'Food'], ['wall', 'Wall'], ['erase', 'Erase']]} onChange={setBrush} />
      <Slider label="Ants" value={count} min={50} max={500} step={10} onChange={setCount} />
      <Slider label="Evaporation" value={evap} min={1} max={30} unit=" %/s" onChange={setEvap} />
      <Slider label="Sensor angle" value={sensor} min={10} max={80} unit="°" onChange={setSensor} />
      <Slider label="Speed" value={speed} min={0.5} max={4} step={0.5} unit="×" onChange={setSpeed} />
      <Toggle label="Show pheromone trails" checked={showTrails} onChange={setShowTrails} />
      <Hint>No ant knows the way. Searching ants leave a blue scent back to the nest; ants carrying food leave an orange scent back to the food, and others follow the strongest smell. Draw a wall across a busy trail and watch them re-route.</Hint>
    </SimLayout>
  )
}
