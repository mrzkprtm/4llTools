import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import { fmt, makeNoise } from '../../sim/math'
import { STATES, bandColor, easeInOut, gradient, mix, orientations, type Style } from './truchet'

const W = 800
const H = 520
const FLIP = 0.55

const PALETTES = {
  dusk: { name: 'Dusk', bg: '#211a38', fill: ['#f25f5c', '#2d2250'], line: ['#ffe066', '#f7a072', '#70c1b3'] },
  ocean: { name: 'Ocean', bg: '#062a3a', fill: ['#127a8f', '#0a3d52'], line: ['#b8f3ec', '#46c2cb'] },
  ink: { name: 'Ink and paper', bg: '#f4efe4', fill: ['#1d1b18', '#f4efe4'], line: ['#1d1b18'] },
  c64: { name: 'Commodore 64', bg: '#352879', fill: ['#6c5eb5', '#352879'], line: ['#a39cf0'] },
  candy: { name: 'Candy', bg: '#fff4e6', fill: ['#ff8fab', '#8ecae6'], line: ['#3d405b'] },
  neon: { name: 'Neon', bg: '#0b0b14', fill: ['#1d1a3a', '#0b0b14'], line: ['#00f5d4', '#9b5de5', '#f15bb5'] },
} as const
type PaletteKey = keyof typeof PALETTES
const PALETTE_OPTIONS = Object.entries(PALETTES).map(([k, p]) => [k as PaletteKey, p.name] as const)

type Motion = 'ripple' | 'twinkle' | 'noise'

interface Tiles {
  cols: number
  rows: number
  size: number
  rot: Int32Array
  from: Float32Array
  prog: Float32Array
}

function buildTiles(size: number, seed: number, states: number): Tiles {
  const cols = Math.ceil(W / size)
  const rows = Math.ceil(H / size)
  const o = orientations(cols, rows, seed, states)
  const rot = Int32Array.from(o)
  return { cols, rows, size, rot, from: Float32Array.from(o), prog: new Float32Array(cols * rows).fill(1) }
}

export default function TruchetTiles() {
  const [running, setRunning] = useRunning()
  const [style, setStyle] = useState<Style>('arcs')
  const [motion, setMotion] = useState<Motion>('ripple')
  const [size, setSize] = useState(44)
  const [width, setWidth] = useState(4)
  const [fill, setFill] = useState(true)
  const [palette, setPalette] = useState<PaletteKey>('dusk')
  const [rate, setRate] = useState(5)
  const [seed, setSeed] = useState(7)
  const [flips, setFlips] = useState(0)
  const tiles = useRef<Tiles>(buildTiles(size, seed, STATES[style]))
  const ripples = useRef<{ x: number; y: number; r: number }[]>([{ x: W / 2, y: H / 2, r: 0 }])
  const flipCount = useRef(0)
  const hover = useRef(-1)
  const noise = useRef(makeNoise(seed))
  const nextRipple = useRef(3)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  function rebuild(nextSize = size, nextSeed = seed, nextStyle = style) {
    tiles.current = buildTiles(nextSize, nextSeed, STATES[nextStyle])
    noise.current = makeNoise(nextSeed)
  }

  /** Starts a quarter-turn of tile k from wherever it is displayed right now. */
  function flip(k: number) {
    const T = tiles.current
    const cur = T.from[k] + (T.rot[k] - T.from[k]) * easeInOut(T.prog[k])
    T.from[k] = cur
    T.rot[k]++
    T.prog[k] = 0
    flipCount.current++
  }

  function tileAt(x: number, y: number) {
    const T = tiles.current
    const i = Math.floor(x / T.size)
    const j = Math.floor(y / T.size)
    return i >= 0 && j >= 0 && i < T.cols && j < T.rows ? j * T.cols + i : -1
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') ripples.current.push({ x: p.x, y: p.y, r: 0 })
    const k = tileAt(p.x, p.y)
    if (p.type === 'move' && k >= 0 && k !== hover.current && tiles.current.prog[k] >= 1) flip(k)
    hover.current = k
  }

  const pal = PALETTES[palette]

  function draw(ctx: CanvasRenderingContext2D) {
    const T = tiles.current
    const s = T.size
    const h = s / 2
    const states = STATES[style]
    const filled = fill && (style === 'arcs' || style === 'lines')
    const lines = style !== 'triangles' && (style === 'print' || width > 0)
    ctx.fillStyle = pal.bg
    ctx.fillRect(0, 0, W, H)
    ctx.lineCap = style === 'print' ? 'square' : 'round'
    const base = ctx.getTransform()
    const turnOf = (k: number) => T.from[k] + (T.rot[k] - T.from[k]) * easeInOut(T.prog[k])

    /** Moves into tile k's rotated frame (clipped to its cell while it turns) and calls paint. */
    const inTile = (k: number, paint: (turn: number, i: number, j: number) => void) => {
      const i = k % T.cols
      const j = (k - i) / T.cols
      const turn = turnOf(k)
      const animating = T.prog[k] < 1
      if (animating) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(i * s, j * s, s, s)
        ctx.clip()
      }
      ctx.translate(i * s + h, j * s + h)
      ctx.rotate((turn % states) * (Math.PI / 2))
      paint(turn, i, j)
      ctx.setTransform(base)
      if (animating) ctx.restore()
    }

    const fillTile = (turn: number, i: number, j: number) => {
      if (style === 'triangles') {
        ctx.fillStyle = pal.fill[1]
        ctx.fillRect(-h - 0.5, -h - 0.5, s + 1, s + 1)
        ctx.fillStyle = pal.fill[0]
        ctx.beginPath()
        ctx.moveTo(-h - 0.5, -h - 0.5)
        ctx.lineTo(h + 0.5, -h - 0.5)
        ctx.lineTo(-h - 0.5, h + 0.5)
        ctx.closePath()
        ctx.fill()
        return
      }
      // Colours cross-fade mid-turn, so the two-colour fill is consistent again when the turn ends.
      const o = Math.floor(turn)
      const t = Math.min(1, Math.max(0, (turn - o - 0.3) / 0.4))
      const band = mix(pal.fill[bandColor(i, j, o)], pal.fill[bandColor(i, j, o + 1)], t)
      ctx.fillStyle = band
      ctx.fillRect(-h - 0.5, -h - 0.5, s + 1, s + 1)
      // Every region around a grid corner has that corner's colour, so whole circles (or diamonds)
      // can spill into the neighbours without seams.
      ctx.fillStyle = mix(pal.fill[1 - bandColor(i, j, o)], pal.fill[1 - bandColor(i, j, o + 1)], t)
      ctx.beginPath()
      for (const c of [-h, h]) {
        if (style === 'arcs') {
          ctx.moveTo(c + h, c)
          ctx.arc(c, c, h, 0, Math.PI * 2)
        } else {
          ctx.moveTo(c + h, c)
          ctx.lineTo(c, c + h)
          ctx.lineTo(c - h, c)
          ctx.lineTo(c, c - h)
          ctx.closePath()
        }
      }
      ctx.fill()
    }

    const strokeTile = (_turn: number, i: number, j: number) => {
      ctx.beginPath()
      if (style === 'arcs') {
        ctx.arc(-h, -h, h, 0, Math.PI / 2)
        ctx.moveTo(0, h)
        ctx.arc(h, h, h, Math.PI, Math.PI * 1.5)
      } else if (style === 'lines') {
        ctx.moveTo(0, -h)
        ctx.lineTo(-h, 0)
        ctx.moveTo(h, 0)
        ctx.lineTo(0, h)
      } else {
        ctx.moveTo(-h, -h)
        ctx.lineTo(h, h)
      }
      ctx.strokeStyle = gradient(pal.line as unknown as string[], (i / T.cols + j / T.rows) / 2)
      ctx.lineWidth = style === 'print' ? Math.max(1.5, width) : width
      ctx.stroke()
    }

    const n = T.cols * T.rows
    if (filled || style === 'triangles') {
      // Settled tiles first, then turning ones on top (clipped to their own cells).
      for (let k = 0; k < n; k++) if (T.prog[k] >= 1) inTile(k, fillTile)
      for (let k = 0; k < n; k++) if (T.prog[k] < 1) inTile(k, fillTile)
    }
    if (lines) for (let k = 0; k < n; k++) inTile(k, strokeTile)
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
            cursor="pointer"
            label={`Truchet tiling of ${style} tiles that flip in waves.`}
            onFrame={(ctx, f) => {
              const T = tiles.current
              const n = T.cols * T.rows
              if (f.dt > 0) {
                for (let k = 0; k < n; k++) if (T.prog[k] < 1) T.prog[k] = Math.min(1, T.prog[k] + f.dt / FLIP)
                if (motion === 'ripple') {
                  nextRipple.current -= f.dt
                  if (nextRipple.current <= 0) {
                    nextRipple.current = 12 / rate
                    ripples.current.push({ x: Math.random() * W, y: Math.random() * H, r: 0 })
                  }
                } else if (motion === 'twinkle') {
                  const count = rate * n * f.dt * 0.01
                  for (let c = Math.floor(count + Math.random()); c > 0; c--) {
                    const k = Math.floor(Math.random() * n)
                    if (T.prog[k] >= 1) flip(k)
                  }
                } else {
                  // Each tile follows the sign of a slowly drifting noise field.
                  const states = STATES[style]
                  const z = f.t * rate * 0.03
                  for (let j = 0; j < T.rows; j++)
                    for (let i = 0; i < T.cols; i++) {
                      const k = j * T.cols + i
                      if (T.prog[k] < 1) continue
                      const v = noise.current(i * 0.12, j * 0.12, z)
                      const want = states === 2 ? (v > 0 ? 1 : 0) : Math.floor((v * 1.6 + 1) * 2) & 3
                      if (((T.rot[k] % states) + states) % states !== want) flip(k)
                    }
                }
              }
              // Advance ripple fronts and flip the tiles they sweep over.
              const speed = 90 + rate * 40
              ripples.current = ripples.current.filter((r) => {
                const r0 = r.r
                r.r += f.dt * speed
                for (let j = 0; j < T.rows; j++)
                  for (let i = 0; i < T.cols; i++) {
                    const d = Math.hypot((i + 0.5) * T.size - r.x, (j + 0.5) * T.size - r.y)
                    if (d >= r0 && d < r.r) flip(j * T.cols + i)
                  }
                return r.r < Math.hypot(W, H)
              })
              draw(ctx)
              if (f.frame % 10 === 0) setFlips(flipCount.current)
            }}
          />
          <Readout items={[['Tiles', fmt(tiles.current.cols * tiles.current.rows, 0)], ['Flips', fmt(flips, 0)], ['Seed', seed]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => {
            const s = Math.floor(Math.random() * 99999)
            setSeed(s)
            rebuild(size, s)
          }}
        >
          <Icon name="shooting-star" size={18} />
          New seed
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `truchet-${style}-${seed}.png`)}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice
        label="Tiles"
        value={style}
        options={[['arcs', 'Arcs'], ['lines', 'Lines'], ['triangles', 'Triangles'], ['print', '10 PRINT']]}
        onChange={(v) => {
          setStyle(v)
          rebuild(size, seed, v)
        }}
      />
      <Choice label="Motion" value={motion} options={[['ripple', 'Ripples'], ['twinkle', 'Twinkle'], ['noise', 'Noise wave']]} onChange={setMotion} />
      <Select label="Palette" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} />
      <Slider
        label="Tile size"
        value={size}
        min={16}
        max={96}
        step={4}
        unit=" px"
        onChange={(v) => {
          setSize(v)
          rebuild(v)
        }}
      />
      <Slider label="Line width" value={width} min={0} max={16} step={0.5} unit=" px" onChange={setWidth} />
      <Slider label="Activity" value={rate} min={1} max={10} onChange={setRate} />
      <Toggle label="Two-colour fill (arcs and lines)" checked={fill} onChange={setFill} />
      <Hint>Click anywhere to send a ripple of flipping tiles across the grid, or sweep the pointer to flip tiles by hand. Each tile only ever turns a quarter, yet the arcs always join up into endless winding paths.</Hint>
    </SimLayout>
  )
}
