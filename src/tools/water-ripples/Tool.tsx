import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { downloadCanvas, makeBuffer } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { addDrop, makeFloor, renderWater, stepWave, waveEnergy, type Floor } from './ripples'

const RES = 2
const GW = 400
const GH = 250
const W = GW * RES
const H = GH * RES

export default function WaterRipples() {
  const [running, setRunning] = useRunning()
  const [floor, setFloor] = useState<Floor>('pebbles')
  const [rain, setRain] = useState(true)
  const [rate, setRate] = useState(4)
  const [damping, setDamping] = useState(0.994)
  const [speed, setSpeed] = useState(2)
  const [walls, setWalls] = useState(false)
  const [info, setInfo] = useState({ drops: 0, energy: 0 })
  const sim = useRef({ cur: new Float32Array(GW * GH), prev: new Float32Array(GW * GH), walls: new Uint8Array(GW * GH), drops: 0 })
  const floors = useRef<Partial<Record<Floor, Uint8ClampedArray>>>({})
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    // A few opening splashes so the pond is alive straight away.
    const s = sim.current
    for (const [x, y, a] of [[0.3, 0.4, 2.2], [0.68, 0.62, 2.6], [0.52, 0.25, 1.6]]) drop(x * GW, y * GH, 6, a)
    s.drops = 0
  }, [])

  function drop(x: number, y: number, r: number, amp: number) {
    const s = sim.current
    addDrop(s.cur, GW, GH, x, y, r, amp)
    s.drops++
  }

  function paintWall(x: number, y: number, erase: boolean) {
    const s = sim.current
    const r = 3
    for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(GH - 1, Math.ceil(y + r)); j++)
      for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(GW - 1, Math.ceil(x + r)); i++)
        if ((i - x) ** 2 + (j - y) ** 2 <= r * r) {
          const k = j * GW + i
          s.walls[k] = erase ? 0 : 1
          s.cur[k] = 0
          s.prev[k] = 0
        }
  }

  function twoSlits() {
    const s = sim.current
    s.walls.fill(0)
    const x0 = Math.round(GW * 0.42)
    for (let y = 0; y < GH; y++) {
      const gap = Math.abs(y - GH * 0.4) < 6 || Math.abs(y - GH * 0.6) < 6
      if (!gap) for (let x = x0; x < x0 + 4; x++) s.walls[y * GW + x] = 1
    }
    s.cur.fill(0)
    s.prev.fill(0)
    setRain(false)
  }

  function onPointer(p: SimPointer) {
    const x = p.x / RES
    const y = p.y / RES
    const prev = last.current
    if (walls && p.down) {
      const erase = p.button === 2 || p.shift
      const n = prev ? Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 1.5)) : 1
      for (let k = 1; k <= n; k++) paintWall(prev ? prev.x + ((x - prev.x) * k) / n : x, prev ? prev.y + ((y - prev.y) * k) / n : y, erase)
    } else if (p.type === 'down') drop(x, y, 7, 3)
    else if (prev) {
      // Dragging stirs a wake; merely hovering leaves a faint one.
      const d = Math.hypot(x - prev.x, y - prev.y)
      const n = Math.min(20, Math.ceil(d / 2))
      for (let k = 1; k <= n; k++) addDrop(sim.current.cur, GW, GH, prev.x + ((x - prev.x) * k) / n, prev.y + ((y - prev.y) * k) / n, p.down ? 4 : 3, p.down ? 0.5 : 0.08)
    }
    last.current = p.type === 'up' ? null : { x, y }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            canvasRef={canvas}
            onPointer={onPointer}
            label="A pond seen from above; ripples spread from drops and reflect off the edges and walls."
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0) {
                if (rain) {
                  let n = rate * f.dt
                  while (n > 0) {
                    if (Math.random() < n) drop(1 + Math.random() * (GW - 2), 1 + Math.random() * (GH - 2), 2 + Math.random() * 2.5, 0.6 + Math.random() * 1.4)
                    n -= 1
                  }
                }
                for (let k = 0; k < speed; k++) {
                  stepWave(s.cur, s.prev, GW, GH, damping, s.walls)
                  const t = s.cur
                  s.cur = s.prev
                  s.prev = t
                }
              }
              if (!buf.current) buf.current = makeBuffer(GW, GH)
              const floorPx = (floors.current[floor] ??= makeFloor(floor, GW, GH))
              renderWater(s.cur, floorPx, s.walls, buf.current.data, GW, GH, floor === 'deep' ? 5 : 10, floor === 'deep' ? 1.6 : 0.9)
              buf.current.flush()
              ctx.imageSmoothingEnabled = true
              ctx.drawImage(buf.current.canvas, 0, 0, W, H)
              if (f.frame % 15 === 0) setInfo({ drops: s.drops, energy: waveEnergy(s.cur, s.prev, GW, GH) })
            }}
          />
          <Readout items={[['Drops', fmt(info.drops, 0)], ['Wave energy', fmt(info.energy, 1)], ['Grid', `${GW}×${GH}`]]} />
        </>
      }
    >
      <PlayBar
        running={running}
        setRunning={setRunning}
        resetLabel="Calm"
        onReset={() => {
          sim.current.cur.fill(0)
          sim.current.prev.fill(0)
          sim.current.drops = 0
        }}
      >
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, 'ripples.png')}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice label="Pond floor" value={floor} options={[['pebbles', 'Pebbles'], ['tiles', 'Pool tiles'], ['deep', 'Deep water']]} onChange={setFloor} />
      <Toggle label="Rain" checked={rain} onChange={setRain} />
      <Slider label="Rain rate" value={rate} min={0.5} max={30} step={0.5} unit=" drops/s" onChange={setRate} />
      <Slider label="Damping" value={damping} min={0.95} max={0.999} step={0.001} format={(v) => fmt(v, 3)} onChange={setDamping} />
      <Slider label="Wave speed" value={speed} min={1} max={4} unit="×" onChange={setSpeed} />
      <Toggle label="Draw walls (shift-drag erases)" checked={walls} onChange={setWalls} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={twoSlits}>
          Two slits
        </button>
        <button type="button" className="btn" onClick={() => sim.current.walls.fill(0)}>
          Clear walls
        </button>
      </div>
      <Hint>Click or drag across the water to make ripples; they bounce off the edges and walls and pass through each other. Try “Two slits”, then click left of the wall to see an interference pattern.</Hint>
    </SimLayout>
  )
}
