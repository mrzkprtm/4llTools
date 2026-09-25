import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, text } from '../../sim/draw'
import { TAU, fmt } from '../../sim/math'
import { emit, makePool, stepPool, type Well } from './particles'

const W = 800
const H = 520
const MAX = 6000
const STOPS = 24
const WELL = 4e6

type EmitterKind = 'fountain' | 'burst' | 'rain'
type Place = 'emitter' | 'attract' | 'repel'

interface Emitter {
  kind: EmitterKind
  x: number
  y: number
  acc: number
}

const GRADIENTS: Record<string, [number, number, number][]> = {
  fire: [[255, 255, 230], [255, 214, 90], [255, 130, 30], [200, 40, 20], [70, 10, 10]],
  ice: [[240, 255, 255], [140, 230, 255], [60, 140, 255], [70, 60, 200], [20, 10, 60]],
  neon: [[255, 255, 255], [255, 80, 220], [150, 70, 255], [40, 200, 255], [10, 40, 90]],
  forest: [[250, 255, 220], [190, 240, 110], [80, 200, 120], [30, 120, 90], [10, 40, 30]],
}
const GRADIENT_OPTIONS = [['fire', 'Fire'], ['ice', 'Ice'], ['neon', 'Neon'], ['forest', 'Firefly']] as const
type GradientKey = (typeof GRADIENT_OPTIONS)[number][0]

/** A soft round sprite per colour stop, drawn additively. */
function makeSprites(key: GradientKey): HTMLCanvasElement[] {
  const g = GRADIENTS[key]
  return Array.from({ length: STOPS }, (_, s) => {
    const t = (s / (STOPS - 1)) * (g.length - 1)
    const i = Math.min(g.length - 2, Math.floor(t))
    const u = t - i
    const [r, gg, b] = g[i].map((v, k) => Math.round(v + (g[i + 1][k] - v) * u))
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const x = c.getContext('2d')!
    const grad = x.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`)
    grad.addColorStop(0.35, `rgba(${r},${gg},${b},0.55)`)
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`)
    x.fillStyle = grad
    x.fillRect(0, 0, 32, 32)
    return c
  })
}

const defaultEmitters = (): Emitter[] => [
  { kind: 'fountain', x: 400, y: 490, acc: 0 },
  { kind: 'burst', x: 160, y: 170, acc: 0.6 },
  { kind: 'rain', x: 640, y: 20, acc: 0 },
]
const defaultWells = (): Well[] => [{ x: 600, y: 300, strength: WELL }]

export default function ParticlePlayground() {
  const [running, setRunning] = useRunning()
  const [place, setPlace] = useState<Place>('emitter')
  const [kind, setKind] = useState<EmitterKind>('fountain')
  const [gravity, setGravity] = useState(260)
  const [wind, setWind] = useState(0)
  const [life, setLife] = useState(2.6)
  const [size, setSize] = useState(5)
  const [rate, setRate] = useState(260)
  const [cap, setCap] = useState(MAX)
  const [gradient, setGradient] = useState<GradientKey>('fire')
  const [info, setInfo] = useState({ n: 0, fps: 60 })
  const pool = useRef(makePool(MAX))
  const emitters = useRef<Emitter[]>(defaultEmitters())
  const wells = useRef<Well[]>(defaultWells())
  const sprites = useRef<{ key: string; list: HTMLCanvasElement[] } | null>(null)
  const held = useRef<{ x: number; y: number } | null>(null)
  const fps = useRef({ last: 0, avg: 60 })
  const [counts, setCounts] = useState({ e: 3, w: 1 })

  const sync = () => setCounts({ e: emitters.current.length, w: wells.current.length })

  function reset() {
    pool.current.n = 0
    emitters.current = defaultEmitters()
    wells.current = defaultWells()
    sync()
  }

  function clearAll() {
    pool.current.n = 0
    emitters.current = []
    wells.current = []
    sync()
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      const objs: { x: number; y: number }[] = [...emitters.current, ...wells.current]
      const hit = objs.find((o) => Math.hypot(o.x - p.x, o.y - p.y) < 18)
      if (hit && p.shift) {
        emitters.current = emitters.current.filter((e) => e !== hit)
        wells.current = wells.current.filter((w) => w !== hit)
        sync()
        return
      }
      if (hit) held.current = hit
      else {
        const what: Place = p.button === 2 ? (p.shift ? 'repel' : 'attract') : place
        if (what === 'emitter') emitters.current.push({ kind, x: p.x, y: p.y, acc: 0 })
        else wells.current.push({ x: p.x, y: p.y, strength: what === 'attract' ? WELL : -WELL })
        held.current = what === 'emitter' ? emitters.current[emitters.current.length - 1] : wells.current[wells.current.length - 1]
        sync()
      }
    }
    if (held.current && p.down) {
      held.current.x = p.x
      held.current.y = p.y
    }
    if (p.type === 'up') held.current = null
  }

  function spawn(e: Emitter, dt: number) {
    const P = pool.current
    const jitter = () => life * (0.7 + Math.random() * 0.6)
    if (e.kind === 'burst') {
      e.acc += dt
      if (e.acc < 1) return
      e.acc = 0
      const count = Math.round(rate * 0.7)
      for (let k = 0; k < count; k++) {
        const a = (k / count) * TAU
        const v = 150 + Math.random() * 30
        emit(P, e.x, e.y, Math.cos(a) * v, Math.sin(a) * v, jitter(), cap)
      }
      return
    }
    e.acc += rate * dt
    while (e.acc >= 1) {
      e.acc -= 1
      if (e.kind === 'fountain') {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.5
        const v = 300 + Math.random() * 90
        emit(P, e.x + (Math.random() - 0.5) * 6, e.y, Math.cos(a) * v, Math.sin(a) * v, jitter(), cap)
      } else emit(P, e.x + (Math.random() - 0.5) * 240, e.y, (Math.random() - 0.5) * 10, 40 + Math.random() * 60, jitter() * 1.4, cap)
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
            className="sim-dark"
            label={`Particle playground with ${counts.e} emitters and ${counts.w} attractors or repellers.`}
            onFrame={(ctx, f) => {
              const now = performance.now()
              if (fps.current.last) fps.current.avg += (1000 / Math.max(1, now - fps.current.last) - fps.current.avg) * 0.05
              fps.current.last = now
              if (!sprites.current || sprites.current.key !== gradient) sprites.current = { key: gradient, list: makeSprites(gradient) }
              const P = pool.current
              if (f.dt > 0) {
                for (const e of emitters.current) spawn(e, f.dt)
                stepPool(P, f.dt, { gravity, wind, drag: 0.35, wells: wells.current, bounds: { w: W, h: H, margin: 80 } })
              }

              clear(ctx, W, H, '#050409')
              const list = sprites.current.list
              ctx.globalCompositeOperation = 'lighter'
              for (let i = 0; i < P.n; i++) {
                const t = Math.min(1, P.age[i] / P.life[i])
                const s = size * (1.4 - 0.9 * t)
                ctx.drawImage(list[Math.min(STOPS - 1, Math.floor(t * STOPS))], P.x[i] - s, P.y[i] - s, s * 2, s * 2)
              }
              ctx.globalCompositeOperation = 'source-over'

              const pulse = 1 + 0.15 * Math.sin(f.t * 4)
              for (const w of wells.current) {
                const col = w.strength > 0 ? '#5ee7ff' : '#ff5e7a'
                circle(ctx, w.x, w.y, 9, undefined, col, 2)
                circle(ctx, w.x, w.y, 16 * pulse, undefined, col + '66', 1.2)
                text(ctx, w.strength > 0 ? '+' : '−', w.x, w.y + 5, { color: col, size: 14, align: 'center', weight: 700 })
              }
              for (const e of emitters.current) {
                ctx.beginPath()
                if (e.kind === 'rain') ctx.rect(e.x - 120, e.y - 3, 240, 6)
                else if (e.kind === 'fountain') {
                  ctx.moveTo(e.x - 9, e.y + 8)
                  ctx.lineTo(e.x, e.y - 6)
                  ctx.lineTo(e.x + 9, e.y + 8)
                  ctx.closePath()
                } else ctx.arc(e.x, e.y, 8, 0, TAU)
                ctx.strokeStyle = 'rgba(255,255,255,0.75)'
                ctx.lineWidth = 1.5
                ctx.stroke()
              }
              if (P.n >= cap) text(ctx, `particle cap reached (${fmt(cap)})`, W - 14, 24, { color: 'rgba(255,255,255,0.6)', size: 12, align: 'right' })
              if (f.frame % 10 === 0) setInfo({ n: P.n, fps: fps.current.avg })
            }}
          />
          <Readout
            items={[
              ['Live particles', fmt(info.n)],
              ['Emitters', counts.e],
              ['Attractors / repellers', counts.w],
              ['Frame rate', `${Math.round(info.fps)} fps`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset}>
        <button type="button" className="btn btn-icon" onClick={clearAll}>
          <Icon name="delete-bin" size={18} />
          Clear all
        </button>
      </PlayBar>
      <Choice label="A click places" value={place} options={[['emitter', 'Emitter'], ['attract', 'Attractor'], ['repel', 'Repeller']]} onChange={setPlace} />
      <Select label="Emitter type" value={kind} options={[['fountain', 'Fountain'], ['burst', 'Ring burst'], ['rain', 'Rain']]} onChange={setKind} />
      <Slider label="Gravity" value={gravity} min={-400} max={400} step={10} unit=" px/s²" onChange={setGravity} />
      <Slider label="Wind" value={wind} min={-300} max={300} step={10} unit=" px/s²" onChange={setWind} />
      <Slider label="Emission rate" value={rate} min={20} max={600} step={10} unit="/s" onChange={setRate} />
      <Slider label="Lifetime" value={life} min={0.4} max={6} step={0.1} unit=" s" onChange={setLife} />
      <Slider label="Size" value={size} min={1} max={12} step={0.5} unit=" px" onChange={setSize} />
      <Slider label="Particle cap" value={cap} min={500} max={MAX} step={250} onChange={setCap} />
      <Select label="Colour over life" value={gradient} options={GRADIENT_OPTIONS} onChange={setGradient} />
      <Hint>Click the dark stage to place whatever is picked above, and drag anything to move it. Right-click drops an attractor (shift + right-click a repeller); shift-click an object to delete it.</Hint>
    </SimLayout>
  )
}
