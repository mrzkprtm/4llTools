import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { SANS, downloadCanvas } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { explode, makeSwarm, retarget, sampleText, stepSwarm } from './particles'

const W = 800
const H = 450
const CAP = 9000
const BINS = 24

const PALETTES = {
  aurora: { name: 'Aurora', stops: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5'] },
  sunset: { name: 'Sunset', stops: ['#ffbe0b', '#fb5607', '#ff006e', '#8338ec'] },
  ice: { name: 'Ice', stops: ['#e0fbfc', '#98c1d9', '#5c7cfa'] },
  fire: { name: 'Fire', stops: ['#fff3b0', '#ffb703', '#fb8500', '#e63946'] },
  paper: { name: 'Paper white', stops: ['#f4efe4', '#f4efe4'] },
} as const
type PaletteKey = keyof typeof PALETTES
type Look = 'dots' | 'squares' | 'lines'
type ColorBy = 'target' | 'origin' | 'speed'

function lerpHex(stops: readonly string[], u: number): string {
  const x = Math.min(0.9999, Math.max(0, u)) * (stops.length - 1)
  const k = Math.floor(x)
  const t = x - k
  const a = parseInt(stops[k].slice(1), 16)
  const b = parseInt(stops[k + 1].slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** Renders the word off-screen and samples its pixels into target points. */
function textTargets(word: string, gap: number): number[] {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  const s = word.trim() || ' '
  let size = 200
  ctx.font = `800 ${size}px ${SANS}`
  const m = ctx.measureText(s).width
  size = Math.min(size, (size * W * 0.88) / Math.max(1, m))
  ctx.font = `800 ${size}px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillText(s, W / 2, H / 2 + size * 0.04)
  return sampleText(ctx.getImageData(0, 0, W, H).data, W, H, gap)
}

export default function TextParticles() {
  const [running, setRunning] = useRunning()
  const [word, setWord] = useState('4llTools')
  const [gap, setGap] = useState(5)
  const [stiffness, setStiffness] = useState(40)
  const [damping, setDamping] = useState(7)
  const [radius, setRadius] = useState(90)
  const [force, setForce] = useState(5000)
  const [size, setSize] = useState(2.2)
  const [look, setLook] = useState<Look>('dots')
  const [colorBy, setColorBy] = useState<ColorBy>('target')
  const [palette, setPalette] = useState<PaletteKey>('aurora')
  const [trails, setTrails] = useState(true)
  const [count, setCount] = useState(0)
  const swarm = useRef(makeSwarm(CAP))
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  // Re-sample whenever the word or the density changes; fonts may load late, so try again once they do.
  useEffect(() => {
    // An empty swarm flies in from a ring around the canvas; each particle keeps the colour of its starting angle.
    const apply = () =>
      retarget(swarm.current, textTargets(word, gap), () => {
        const u = Math.random()
        const a = u * Math.PI * 2
        return [W / 2 + Math.cos(a) * W * 0.62, H / 2 + Math.sin(a) * W * 0.62, u]
      })
    apply()
    let live = true
    void document.fonts?.ready.then(() => live && apply())
    return () => {
      live = false
    }
  }, [word, gap])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const leave = () => (pointer.current = null)
    c.addEventListener('pointerleave', leave)
    return () => c.removeEventListener('pointerleave', leave)
  }, [])

  function onPointer(p: SimPointer) {
    pointer.current = { x: p.x, y: p.y }
    if (p.type === 'down') explode(swarm.current, p.x, p.y, 350)
  }

  const stops = PALETTES[palette].stops
  const colors = Array.from({ length: BINS }, (_, i) => lerpHex(stops, i / (BINS - 1)))

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
            label={`The word “${word}” drawn with ${count} particles that scatter from the pointer and spring back.`}
            onFrame={(ctx, f) => {
              const s = swarm.current
              if (f.dt > 0) {
                const p = pointer.current
                const n = 2
                for (let k = 0; k < n; k++) stepSwarm(s, f.dt / n, { stiffness, damping, px: p ? p.x : null, py: p ? p.y : 0, radius, force })
              }
              ctx.fillStyle = trails && f.dt > 0 ? 'rgba(11,10,16,0.32)' : '#0b0a10'
              ctx.fillRect(0, 0, W, H)
              // Bucket particles by colour so each colour is one path.
              const buckets: number[][] = Array.from({ length: BINS }, () => [])
              for (let i = 0; i < s.n; i++) {
                let u: number
                if (colorBy === 'origin') u = s.hue[i]
                else if (colorBy === 'speed') u = Math.min(1, Math.hypot(s.vx[i], s.vy[i]) / 500)
                else u = s.tx[i] / W
                buckets[Math.min(BINS - 1, Math.floor(u * BINS))].push(i)
              }
              for (let b = 0; b < BINS; b++) {
                const list = buckets[b]
                if (!list.length) continue
                ctx.beginPath()
                if (look === 'lines') {
                  for (const i of list) {
                    ctx.moveTo(s.tx[i], s.ty[i])
                    ctx.lineTo(s.x[i], s.y[i])
                  }
                  ctx.strokeStyle = colors[b]
                  ctx.globalAlpha = 0.55
                  ctx.lineWidth = 1
                  ctx.stroke()
                  ctx.globalAlpha = 1
                  ctx.beginPath()
                }
                for (const i of list) {
                  const r = size * Math.max(0, s.life[i])
                  if (r < 0.2) continue
                  if (look === 'squares') ctx.rect(s.x[i] - r, s.y[i] - r, r * 2, r * 2)
                  else {
                    ctx.moveTo(s.x[i] + r, s.y[i])
                    ctx.arc(s.x[i], s.y[i], look === 'lines' ? r * 0.8 : r, 0, Math.PI * 2)
                  }
                }
                ctx.fillStyle = colors[b]
                ctx.fill()
              }
              const p = pointer.current
              if (p) {
                ctx.beginPath()
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
                ctx.strokeStyle = 'rgba(255,255,255,0.12)'
                ctx.lineWidth = 1
                ctx.stroke()
              }
              if (f.frame % 12 === 0) setCount(s.n)
            }}
          />
          <Readout items={[['Particles', fmt(count, 0)], ['Letters', word.trim().length], ['Spacing', `${gap} px`]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn btn-icon" onClick={() => explode(swarm.current, W / 2, H / 2, 900)}>
          <Icon name="lightning-bolt" size={18} />
          Explode
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, 'text-particles.png')}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <div className="sim-field">
        <label className="sim-label" htmlFor="tp-word">
          Text
        </label>
        <input id="tp-word" className="sim-text" type="text" value={word} maxLength={24} spellCheck={false} onChange={(e) => setWord(e.target.value)} />
      </div>
      <Choice label="Particles" value={look} options={[['dots', 'Dots'], ['squares', 'Squares'], ['lines', 'Lines']]} onChange={setLook} />
      <Choice label="Colour by" value={colorBy} options={[['target', 'Position'], ['origin', 'Origin'], ['speed', 'Speed']]} onChange={setColorBy} />
      <Select label="Palette" value={palette} options={Object.entries(PALETTES).map(([k, p]) => [k as PaletteKey, p.name] as const)} onChange={setPalette} />
      <Slider label="Spacing (density)" value={gap} min={3} max={10} unit=" px" onChange={setGap} />
      <Slider label="Particle size" value={size} min={0.8} max={5} step={0.1} unit=" px" onChange={setSize} />
      <Slider label="Spring stiffness" value={stiffness} min={4} max={150} onChange={setStiffness} />
      <Slider label="Damping" value={damping} min={0.5} max={25} step={0.5} onChange={setDamping} />
      <Slider label="Repel radius" value={radius} min={20} max={220} unit=" px" onChange={setRadius} />
      <Slider label="Repel force" value={force} min={0} max={15000} step={250} format={(v) => fmt(v / 1000, 2)} unit="k" onChange={setForce} />
      <Toggle label="Motion trails" checked={trails} onChange={setTrails} />
      <Hint>Move the pointer through the letters to scatter them, click to blast a hole, and type a new word to watch the particles fly into place. Low damping makes them wobble; high stiffness snaps them back fast.</Hint>
    </SimLayout>
  )
}
