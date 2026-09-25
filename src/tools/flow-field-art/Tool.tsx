import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, downloadCanvas } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { PALETTES, makeField, makeParticles, seedParticles, stepParticles, swirl, type PaletteKey } from './field'

const W = 800
const H = 520
const SCALE = 2
const MAX = 8000
const VORTEX = 110
const PALETTE_OPTIONS = Object.entries(PALETTES).map(([k, p]) => [k, p.label] as const) as [PaletteKey, string][]

const newSeed = () => Math.floor(Math.random() * 99999) + 1

export default function FlowFieldArt() {
  const seedId = useId()
  const [running, setRunning] = useRunning()
  const [seed, setSeed] = useState(2024)
  const [palette, setPalette] = useState<PaletteKey>('sunset')
  const [count, setCount] = useState(3000)
  const [scale, setScale] = useState(0.0035)
  const [turns, setTurns] = useState(1.6)
  const [speed, setSpeed] = useState(1.6)
  const [strokeAlpha, setStrokeAlpha] = useState(0.08)
  const [evolve, setEvolve] = useState(true)
  const [frames, setFrames] = useState(0)
  const art = useRef<HTMLCanvasElement | null>(null)
  const parts = useRef(makeParticles(MAX))
  const random = useRef<() => number>(Math.random)
  const z = useRef(0)
  const drawn = useRef(0)
  const vortex = useRef<{ x: number; y: number } | null>(null)
  const field = useMemo(() => makeField(seed), [seed])
  const pal = PALETTES[palette]

  const params = useRef({ scale, turns, speed, strokeAlpha, count })
  params.current = { scale, turns, speed, strokeAlpha, count }

  function paint(steps: number) {
    const c = art.current?.getContext('2d')
    if (!c) return
    const p = parts.current
    const { scale: s, turns: tr, speed: sp, strokeAlpha: a } = params.current
    const v = vortex.current
    const heading = v ? (x: number, y: number) => swirl(field(x, y, z.current, s, tr), x, y, v.x, v.y, VORTEX) : (x: number, y: number) => field(x, y, z.current, s, tr)
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    c.globalCompositeOperation = pal.blend
    c.globalAlpha = a
    c.lineWidth = 0.7
    c.lineCap = 'round'
    // Long steps are split so every stroke stays a smooth curve.
    const sub = Math.ceil(sp / 1.2)
    for (let k = 0; k < steps * sub; k++) {
      stepParticles(p, heading, sp / sub, W, H, pal.colors.length, random.current)
      pal.colors.forEach((col, ci) => {
        c.beginPath()
        for (let i = 0; i < p.n; i++) {
          if (p.color[i] !== ci || (p.px[i] === p.x[i] && p.py[i] === p.y[i])) continue
          c.moveTo(p.px[i], p.py[i])
          c.lineTo(p.x[i], p.y[i])
        }
        c.strokeStyle = col
        c.stroke()
      })
      if (k % sub === sub - 1) drawn.current++
    }
  }

  function restart() {
    if (!art.current) {
      art.current = document.createElement('canvas')
      art.current.width = W * SCALE
      art.current.height = H * SCALE
    }
    const c = art.current.getContext('2d')
    if (!c) return
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = pal.bg
    c.fillRect(0, 0, W * SCALE, H * SCALE)
    random.current = seedParticles(parts.current, count, W, H, pal.colors.length, seed)
    z.current = 0
    drawn.current = 0
    paint(24) // a quick head start so there is a picture straight away
    setFrames(drawn.current)
  }

  // A new seed, palette or field shape starts a fresh canvas.
  useEffect(restart, [seed, palette, scale, turns])

  // Changing the particle count keeps the picture and adds or removes particles.
  useEffect(() => {
    const p = parts.current
    const before = p.n
    p.n = Math.min(count, MAX)
    for (let i = before; i < p.n; i++) {
      p.x[i] = p.px[i] = random.current() * W
      p.y[i] = p.py[i] = random.current() * H
      p.life[i] = 60 + random.current() * 240
      p.color[i] = Math.floor(random.current() * pal.colors.length)
    }
  }, [count])

  function onPointer(p: SimPointer) {
    if (p.type === 'up') vortex.current = null
    else if (p.down) vortex.current = { x: p.x, y: p.y }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            className={pal.bg.startsWith('#f') ? 'sim-flat' : 'sim-dark'}
            label={`Flow field artwork: ${count} particles following Perlin noise with the ${pal.label} palette, seed ${seed}.`}
            onFrame={(ctx, f) => {
              if (!art.current) restart()
              if (f.dt > 0) {
                paint(1)
                if (evolve) z.current += f.dt * 0.035
              }
              if (art.current) ctx.drawImage(art.current, 0, 0, W, H)
              const v = vortex.current
              if (v) {
                const light = pal.bg.startsWith('#f')
                circle(ctx, v.x, v.y, VORTEX, undefined, light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', 1.5)
                circle(ctx, v.x, v.y, 4, light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)')
              }
              if (f.frame % 12 === 0) setFrames(drawn.current)
            }}
          />
          <Readout
            items={[
              ['Particles', fmt(count)],
              ['Seed', seed],
              ['Steps drawn', fmt(frames)],
              ['Field z', fmt(z.current, 2)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} resetLabel="Clear">
        <button type="button" className="btn btn-icon" onClick={() => setSeed(newSeed())}>
          <Icon name="lightning-bolt" size={18} />
          New seed
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(art.current, `flow-field-${seed}.png`)}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select label="Palette" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} />
      <div className="sim-field">
        <label htmlFor={seedId} className="sim-label">
          Seed
        </label>
        <input id={seedId} type="number" min={1} max={99999} value={seed} onChange={(e) => setSeed(Math.max(1, Math.floor(Number(e.target.value)) || 1))} />
      </div>
      <Slider label="Particles" value={count} min={500} max={MAX} step={250} onChange={setCount} />
      <Slider label="Noise scale" value={scale} min={0.001} max={0.012} step={0.0005} format={(v) => v.toFixed(4)} onChange={setScale} />
      <Slider label="Curl (turns)" value={turns} min={0.3} max={4} step={0.1} onChange={setTurns} />
      <Slider label="Speed" value={speed} min={0.5} max={5} step={0.1} unit=" px" onChange={setSpeed} />
      <Slider label="Stroke opacity" value={strokeAlpha} min={0.02} max={0.4} step={0.01} onChange={setStrokeAlpha} />
      <Toggle label="Evolving field (z drift)" checked={evolve} onChange={setEvolve} />
      <Hint>Each particle steers by the noise angle under it and leaves a faint line, so the picture builds up over time. Press and drag on the canvas to stir in a vortex; change the seed, scale or curl to start a new piece.</Hint>
    </SimLayout>
  )
}
