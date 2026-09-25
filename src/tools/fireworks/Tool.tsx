import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { audioContext } from '../../sim/audio'
import { BURSTS, BURST_SPEC, SPARK, SPLIT, TRAIL, addParticle, burstVelocities, launchVelocity, makeParticles, stepParticles, type Burst } from './fireworks'

const W = 800
const H = 520
const GROUND = H - 8
const CAP = 14000

/** Star colours as [r, g, b]; index 2 is willow gold. */
const COLORS: [number, number, number][] = [
  [255, 80, 80],
  [255, 160, 60],
  [255, 205, 110],
  [120, 255, 140],
  [90, 220, 255],
  [120, 140, 255],
  [200, 110, 255],
  [255, 120, 210],
  [255, 250, 240],
]
const GOLD = 2

const TYPES = [['mix', 'Random mix'], ...BURSTS.map((b) => [b, b[0].toUpperCase() + b.slice(1)] as const)] as const
type Pick = Burst | 'mix'

interface Rocket {
  x: number
  y: number
  vx: number
  vy: number
  type: Burst
  color: number
}

/** A short filtered noise burst: the "pop" of a shell. */
function pop(volume: number) {
  const ac = audioContext()
  if (!ac) return
  const len = Math.floor(ac.sampleRate * 0.6)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.09))
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900 + Math.random() * 900
  const gain = ac.createGain()
  gain.gain.value = volume
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start()
}

/** A night skyline with lit windows, drawn once to its own canvas. */
function skyline(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W * 2
  c.height = H * 2
  const ctx = c.getContext('2d')!
  ctx.scale(2, 2)
  const r = rng(8)
  for (const [shade, hMin, hMax, lit] of [['#15121f', 60, 150, 0.04], ['#08070d', 30, 110, 0.12]] as const) {
    let x = -10
    while (x < W) {
      const w = 26 + r() * 60
      const h = hMin + r() * (hMax - hMin)
      ctx.fillStyle = shade
      ctx.fillRect(x, GROUND - h, w, h + 10)
      if (r() < 0.25) ctx.fillRect(x + w / 2 - 1.5, GROUND - h - 18, 3, 18)
      for (let wy = GROUND - h + 8; wy < GROUND - 8; wy += 9)
        for (let wx = x + 5; wx < x + w - 6; wx += 7)
          if (r() < lit) {
            ctx.fillStyle = `rgba(255,${200 + r() * 40},${120 + r() * 60},${0.5 + r() * 0.4})`
            ctx.fillRect(wx, wy, 3, 4)
          }
      x += w + r() * 6
    }
  }
  ctx.fillStyle = '#050409'
  ctx.fillRect(0, GROUND, W, H - GROUND)
  return c
}

export default function Fireworks() {
  const [running, setRunning] = useRunning()
  const [type, setType] = useState<Pick>('mix')
  const [auto, setAuto] = useState(true)
  const [rate, setRate] = useState(1.2)
  const [gravity, setGravity] = useState(90)
  const [drag, setDrag] = useState(1)
  const [sparkle, setSparkle] = useState(true)
  const [sound, setSound] = useState(false)
  const [info, setInfo] = useState({ n: 0, launched: 0 })
  const parts = useRef(makeParticles(CAP))
  const rockets = useRef<Rocket[]>([])
  const flashes = useRef<{ x: number; y: number; t: number; c: number }[]>([])
  const launched = useRef(0)
  const nextAuto = useRef(0.3)
  const city = useRef<HTMLCanvasElement | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const stars = useRef(Array.from({ length: 90 }, (_, i) => [((i * 7919) % 997) / 997, ((i * 3571) % 541) / 541, (i % 5) / 5]))

  function launch(tx: number, ty: number) {
    const x0 = tx + (Math.random() - 0.5) * 120
    const [vx, vy] = launchVelocity(x0, GROUND, tx, ty, gravity)
    const kind = type === 'mix' ? BURSTS[Math.floor(Math.random() * BURSTS.length)] : type
    const color = kind === 'willow' ? GOLD : Math.floor(Math.random() * COLORS.length)
    rockets.current.push({ x: x0, y: GROUND, vx, vy, type: kind, color })
    launched.current++
  }

  function explode(r: Rocket) {
    const p = parts.current
    const spec = BURST_SPEC[r.type]
    const v = burstVelocities(r.type, spec.n, spec.speed)
    const second = Math.random() < 0.4 ? Math.floor(Math.random() * COLORS.length) : r.color
    const flags = r.type === 'chrysanthemum' || r.type === 'willow' ? TRAIL : r.type === 'crossette' ? SPLIT : 0
    for (let i = 0; i < spec.n; i++) {
      const life = spec.life * (r.type === 'crossette' ? 1 : 0.8 + Math.random() * 0.4)
      addParticle(p, r.x, r.y, v[2 * i] + r.vx * 0.3, v[2 * i + 1] + r.vy * 0.3, life, spec.drag, i % 3 === 0 ? second : r.color, flags)
    }
    flashes.current.push({ x: r.x, y: r.y, t: 0, c: r.color })
    if (sound) setTimeout(() => pop(0.25), Math.min(900, (Math.hypot(r.x - W / 2, GROUND - r.y) / 340) * 400))
  }

  function onPointer(e: SimPointer) {
    if (e.type === 'down' && e.y < GROUND - 40) launch(e.x, e.y)
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
            label={`Night sky over a city with ${info.n} firework sparks.`}
            onFrame={(ctx, f) => {
              const p = parts.current
              const dt = f.dt
              if (dt > 0) {
                if (auto && (nextAuto.current -= dt) <= 0) {
                  nextAuto.current = (0.4 + Math.random() * 1.2) / rate
                  launch(80 + Math.random() * (W - 160), 70 + Math.random() * 190)
                }
                rockets.current = rockets.current.filter((r) => {
                  r.vy += gravity * dt
                  r.x += r.vx * dt
                  r.y += r.vy * dt
                  addParticle(p, r.x, r.y, (Math.random() - 0.5) * 20, 20 + Math.random() * 20, 0.35 + Math.random() * 0.3, 2.5, GOLD, SPARK)
                  if (r.vy >= 0) {
                    explode(r)
                    return false
                  }
                  return true
                })
                stepParticles(p, dt, gravity, drag)
              }
              // Fade the previous frame into the sky instead of clearing it: that leaves glowing trails.
              if (f.frame === 0 || dt === 0) {
                ctx.fillStyle = '#070712'
                ctx.fillRect(0, 0, W, H)
              }
              const sky = ctx.createLinearGradient(0, 0, 0, H)
              sky.addColorStop(0, 'rgba(5,5,16,0.28)')
              sky.addColorStop(1, 'rgba(26,18,48,0.28)')
              ctx.fillStyle = sky
              ctx.fillRect(0, 0, W, H)
              for (const [sx, sy, b] of stars.current) {
                ctx.fillStyle = `rgba(255,255,255,${0.15 + b * 0.25})`
                ctx.fillRect(sx * W, sy * H * 0.7, 1.2, 1.2)
              }
              ctx.globalCompositeOperation = 'lighter'
              flashes.current = flashes.current.filter((fl) => {
                fl.t += dt
                const a = Math.max(0, 1 - fl.t / 0.25)
                const [r, g, b] = COLORS[fl.c]
                const glow = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 90)
                glow.addColorStop(0, `rgba(${r},${g},${b},${0.55 * a})`)
                glow.addColorStop(1, `rgba(${r},${g},${b},0)`)
                ctx.fillStyle = glow
                ctx.fillRect(fl.x - 90, fl.y - 90, 180, 180)
                return fl.t < 0.25
              })
              // Bucket particles by colour and brightness so each bucket is a single path.
              const LEVELS = 4
              const buckets: number[][] = Array.from({ length: COLORS.length * LEVELS }, () => [])
              for (let i = 0; i < p.n; i++) {
                let a = Math.min(1, p.life[i] / Math.min(p.max[i], 0.6))
                if (sparkle && !(p.flags[i] & SPARK) && p.life[i] < p.max[i] * 0.5 && Math.random() < 0.35) a *= 0.15
                const lvl = Math.min(LEVELS - 1, Math.floor(a * LEVELS))
                if (a > 0.02) buckets[p.color[i] * LEVELS + lvl].push(i)
              }
              for (let c = 0; c < COLORS.length; c++) {
                const [r, g, b] = COLORS[c]
                for (let l = 0; l < LEVELS; l++) {
                  const list = buckets[c * LEVELS + l]
                  if (!list.length) continue
                  const a = (l + 1) / LEVELS
                  ctx.beginPath()
                  for (const i of list) {
                    const s = p.flags[i] & SPARK ? 1.2 : 2.2
                    ctx.rect(p.x[i] - s / 2, p.y[i] - s / 2, s, s)
                  }
                  ctx.fillStyle = `rgba(${r},${g},${b},${a})`
                  ctx.fill()
                  if (l >= 2) {
                    // A soft halo round the brightest stars.
                    ctx.beginPath()
                    for (const i of list) if (!(p.flags[i] & SPARK)) ctx.rect(p.x[i] - 3, p.y[i] - 3, 6, 6)
                    ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.12})`
                    ctx.fill()
                  }
                }
              }
              for (const r of rockets.current) {
                ctx.beginPath()
                ctx.arc(r.x, r.y, 2, 0, Math.PI * 2)
                ctx.fillStyle = '#fff4d6'
                ctx.fill()
              }
              ctx.globalCompositeOperation = 'source-over'
              city.current ??= skyline()
              ctx.drawImage(city.current, 0, 0, W, H)
              if (f.frame % 10 === 0) setInfo({ n: p.n, launched: launched.current })
            }}
          />
          <Readout items={[['Particles', fmt(info.n, 0)], ['Rockets launched', fmt(info.launched, 0)], ['Particle cap', fmt(CAP, 0)]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn btn-icon" onClick={() => launch(120 + Math.random() * (W - 240), 90 + Math.random() * 150)}>
          <Icon name="rocket-3-start" size={18} />
          Launch
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, 'fireworks.png')}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select label="Shell type" value={type} options={TYPES} onChange={setType} />
      <Toggle label="Automatic show" checked={auto} onChange={setAuto} />
      <Slider label="Show rate" value={rate} min={0.2} max={5} step={0.1} unit=" /s" onChange={setRate} />
      <Slider label="Gravity" value={gravity} min={0} max={250} step={5} unit=" px/s²" onChange={setGravity} />
      <Slider label="Air drag" value={drag} min={0} max={3} step={0.1} unit="×" onChange={setDrag} />
      <Toggle label="Sparkle" checked={sparkle} onChange={setSparkle} />
      <Toggle label="Sound (pops)" checked={sound} onChange={setSound} />
      <Hint>Click or tap the sky to launch a rocket that bursts right where you clicked. Willows droop because their stars are slow and meet more air drag; crossettes split into four; rings keep every star at the same speed.</Hint>
    </SimLayout>
  )
}
