import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { SANS, downloadCanvas } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { coverage, makePacker, seed, stepPacker, type Packer } from './packing'

const W = 800
const H = 520

type Mask = 'full' | 'word' | 'circle' | 'heart'
type Look = 'fill' | 'outline'

const PALETTES = {
  coral: { name: 'Coral reef', bg: '#fff8ef', colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'] },
  night: { name: 'Night lights', bg: '#0f0e17', colors: ['#ff8906', '#f25f4c', '#e53170', '#a7a9be', '#7f5af0'] },
  mint: { name: 'Mint', bg: '#f1faee', colors: ['#1d3557', '#457b9d', '#a8dadc', '#e63946', '#2a9d8f'] },
  mono: { name: 'Ink', bg: '#f4efe4', colors: ['#1d1b18', '#3b3833', '#5c5850', '#8a857a', '#1d1b18'] },
  candy: { name: 'Candy', bg: '#22223b', colors: ['#ffafcc', '#ffc8dd', '#cdb4db', '#bde0fe', '#a2d2ff'] },
} as const
type PaletteKey = keyof typeof PALETTES

/** Rasterises the mask shape; returns null for the full canvas. */
function buildMask(mask: Mask, word: string): { data: Uint8Array; area: number; canvas: HTMLCanvasElement } | null {
  if (mask === 'full') return null
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  if (mask === 'circle') {
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, H * 0.46, 0, Math.PI * 2)
    ctx.fill()
  } else if (mask === 'heart') {
    ctx.beginPath()
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * Math.PI * 2
      const x = 16 * Math.sin(t) ** 3
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      ctx.lineTo(W / 2 + x * 14.5, H / 2 - 20 - y * 14.5)
    }
    ctx.fill()
  } else {
    const s = word.trim() || 'Hi'
    let size = 300
    ctx.font = `800 ${size}px ${SANS}`
    size = Math.min(size, (size * W * 0.92) / Math.max(1, ctx.measureText(s).width))
    ctx.font = `800 ${size}px ${SANS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, W / 2, H / 2 + size * 0.05)
  }
  const img = ctx.getImageData(0, 0, W, H).data
  const data = new Uint8Array(W * H)
  let area = 0
  for (let i = 0; i < data.length; i++)
    if (img[i * 4 + 3] > 127) {
      data[i] = 1
      area++
    }
  return { data, area, canvas: c }
}

export default function CirclePacking() {
  const [running, setRunning] = useRunning()
  const [mask, setMask] = useState<Mask>('full')
  const [word, setWord] = useState('PACK')
  const [minR, setMinR] = useState(3)
  const [maxR, setMaxR] = useState(48)
  const [spacing, setSpacing] = useState(2)
  const [growth, setGrowth] = useState(40)
  const [spawn, setSpawn] = useState(6)
  const [look, setLook] = useState<Look>('fill')
  const [palette, setPalette] = useState<PaletteKey>('coral')
  const [info, setInfo] = useState({ n: 0, cover: 0, growing: 0, done: false })
  const packer = useRef<Packer | null>(null)
  const maskRef = useRef<ReturnType<typeof buildMask>>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const lastSeed = useRef<{ x: number; y: number } | null>(null)

  function restart() {
    const m = maskRef.current
    packer.current = makePacker({ w: W, h: H, minR, maxR, spacing, inside: m ? (x, y) => x >= 0 && y >= 0 && x < W && y < H && m.data[(y | 0) * W + (x | 0)] === 1 : undefined })
  }

  // Rebuild the mask and start over when the shape or packing rules change.
  useEffect(() => {
    maskRef.current = buildMask(mask, word)
    restart()
    let live = true
    if (mask === 'word')
      void document.fonts?.ready.then(() => {
        if (!live) return
        maskRef.current = buildMask(mask, word)
        restart()
      })
    return () => {
      live = false
    }
  }, [mask, word, minR, maxR, spacing])

  function onPointer(p: SimPointer) {
    const pk = packer.current
    if (!pk) return
    if (p.type === 'down' || (p.down && lastSeed.current && Math.hypot(p.x - lastSeed.current.x, p.y - lastSeed.current.y) > maxR * 0.6)) {
      // Clicking plants a seed that may grow to twice the usual maximum.
      seed(pk, p.x, p.y, Math.random, maxR * 2)
      lastSeed.current = { x: p.x, y: p.y }
    }
    if (p.type === 'up') lastSeed.current = null
  }

  const pal = PALETTES[palette]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            canvasRef={canvas}
            onPointer={onPointer}
            cursor="cell"
            label={`${info.n} circles packed ${mask === 'full' ? 'across the canvas' : mask === 'word' ? `inside the word ${word}` : `inside a ${mask}`}.`}
            onFrame={(ctx, f) => {
              const pk = packer.current
              if (!pk) return
              if (f.dt > 0) stepPacker(pk, Math.random, growth * f.dt, spawn, 80)
              ctx.fillStyle = pal.bg
              ctx.fillRect(0, 0, W, H)
              const m = maskRef.current
              if (m && pk.idle < 60) {
                ctx.globalAlpha = 0.07
                ctx.drawImage(m.canvas, 0, 0)
                ctx.globalAlpha = 1
              }
              // One path per colour keeps thousands of circles cheap to draw.
              const cols = pal.colors
              for (let k = 0; k < cols.length; k++) {
                ctx.beginPath()
                for (const c of pk.circles) {
                  if (Math.floor(c.tone * cols.length) !== k) continue
                  const r = look === 'outline' ? c.r - 0.75 : c.r
                  if (r <= 0) continue
                  ctx.moveTo(c.x + r, c.y)
                  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
                }
                if (look === 'fill') {
                  ctx.fillStyle = cols[k]
                  ctx.fill()
                } else {
                  ctx.strokeStyle = cols[k]
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }
              }
              if (f.frame % 10 === 0) {
                let growing = 0
                for (const c of pk.circles) if (c.growing) growing++
                setInfo({ n: pk.circles.length, cover: coverage(pk.circles, m ? m.area : W * H), growing, done: pk.idle > 60 })
              }
            }}
          />
          <Readout items={[['Circles', fmt(info.n, 0)], ['Coverage', `${fmt(info.cover * 100, 1)}%`], ['Growing', info.growing], ['Status', info.done ? 'Packed' : 'Growing…']]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} resetLabel="Restart">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `circle-packing-${mask}.png`)}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice label="Shape" value={mask} options={[['full', 'Canvas'], ['word', 'Word'], ['circle', 'Circle'], ['heart', 'Heart']]} onChange={setMask} />
      {mask === 'word' && (
        <div className="sim-field">
          <label className="sim-label" htmlFor="cp-word">
            Word
          </label>
          <input id="cp-word" className="sim-text" type="text" value={word} maxLength={12} spellCheck={false} onChange={(e) => setWord(e.target.value)} />
        </div>
      )}
      <Choice label="Style" value={look} options={[['fill', 'Filled'], ['outline', 'Outline']]} onChange={setLook} />
      <Select label="Palette" value={palette} options={Object.entries(PALETTES).map(([k, p]) => [k as PaletteKey, p.name] as const)} onChange={setPalette} />
      <Slider label="Smallest radius" value={minR} min={1} max={12} step={0.5} unit=" px" onChange={setMinR} />
      <Slider label="Largest radius" value={maxR} min={8} max={120} unit=" px" onChange={setMaxR} />
      <Slider label="Spacing" value={spacing} min={0} max={10} step={0.5} unit=" px" onChange={setSpacing} />
      <Slider label="Growth speed" value={growth} min={5} max={200} step={5} unit=" px/s" onChange={setGrowth} />
      <Slider label="New circles per frame" value={spawn} min={1} max={30} onChange={setSpawn} />
      <Hint>Circles appear in free space and grow until they touch a neighbour, an edge or the shape outline. Click or drag to plant big seeds of your own. Small minimum radii fill the gaps with tiny bubbles.</Hint>
    </SimLayout>
  )
}
