import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, makeBuffer } from '../../sim/draw'
import { clamp, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { centroid, delaunay, nearest, voronoiCells, type Metric, type Pt, type Tri } from './voronoi'

const W = 800
const H = 520

const PALETTES = {
  pastel: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff'],
  jewel: ['#9b2226', '#bb3e03', '#ee9b00', '#0a9396', '#005f73', '#3a0ca3', '#7209b7', '#2d6a4f'],
  ocean: ['#03045e', '#023e8a', '#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#caf0f8'],
  autumn: ['#582f0e', '#7f4f24', '#936639', '#a68a64', '#b6ad90', '#c2c5aa', '#a4ac86', '#bc6c25'],
  mono: ['#212529', '#343a40', '#495057', '#6c757d', '#adb5bd', '#ced4da', '#dee2e6', '#f1f3f5'],
}
type PaletteKey = keyof typeof PALETTES
const PALETTE_OPTIONS = [['pastel', 'Pastel'], ['jewel', 'Jewel'], ['ocean', 'Ocean'], ['autumn', 'Autumn'], ['mono', 'Greys']] as const

interface Seed {
  x: number
  y: number
  vx: number
  vy: number
  c: number
}

const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function makeSeeds(n: number, seed: number): Seed[] {
  const r = rng(seed)
  return Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2
    const v = 6 + r() * 14
    return { x: 20 + r() * (W - 40), y: 20 + r() * (H - 40), vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.floor(r() * 64) }
  })
}

export default function VoronoiDiagram() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(60)
  const [drift, setDrift] = useState(true)
  const [fill, setFill] = useState(true)
  const [edges, setEdges] = useState(true)
  const [tris, setTris] = useState(false)
  const [showSeeds, setShowSeeds] = useState(true)
  const [glass, setGlass] = useState(false)
  const [metric, setMetric] = useState<Metric>('euclid')
  const [palette, setPalette] = useState<PaletteKey>('pastel')
  const [relax, setRelax] = useState(false)
  const [info, setInfo] = useState({ tris: 0, iter: 0 })
  const seeds = useRef<Seed[]>(makeSeeds(60, 7))
  const drag = useRef<number | null>(null)
  const hover = useRef<Pt | null>(null)
  const iter = useRef(0)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  function resize(k: number) {
    const s = seeds.current
    if (k > s.length) seeds.current = s.concat(makeSeeds(k - s.length, Math.floor(Math.random() * 1e9)))
    else seeds.current = s.slice(0, k)
    setN(k)
  }

  function scatter() {
    seeds.current = makeSeeds(n, Math.floor(Math.random() * 1e9))
    iter.current = 0
    setRelax(false)
  }

  function onPointer(p: SimPointer) {
    hover.current = [p.x, p.y]
    const s = seeds.current
    if (p.type === 'down') {
      const i = s.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 14)
      if (i >= 0 && (p.button === 2 || p.shift)) {
        s.splice(i, 1)
        setN(s.length)
      } else if (i >= 0) drag.current = i
      else if (s.length < 300) {
        s.push({ x: p.x, y: p.y, vx: 0, vy: 0, c: Math.floor(Math.random() * 64) })
        drag.current = s.length - 1
        setN(s.length)
      }
    }
    const d = drag.current
    if (d !== null && s[d]) {
      s[d].x = clamp(p.x, 1, W - 1)
      s[d].y = clamp(p.y, 1, H - 1)
    }
    if (p.type === 'up') drag.current = null
  }

  const pal = PALETTES[palette]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            canvasRef={canvas}
            className="sim-flat"
            label={`Voronoi diagram of ${n} seeds${tris ? ' with its Delaunay triangulation' : ''}.`}
            onFrame={(ctx, f) => {
              const s = seeds.current
              if (f.dt > 0 && drift && !relax)
                s.forEach((q, i) => {
                  if (i === drag.current) return
                  q.x += q.vx * f.dt
                  q.y += q.vy * f.dt
                  if (q.x < 2 || q.x > W - 2) q.vx *= -1
                  if (q.y < 2 || q.y > H - 2) q.vy *= -1
                  q.x = clamp(q.x, 2, W - 2)
                  q.y = clamp(q.y, 2, H - 2)
                })
              const pts: Pt[] = s.map((q) => [q.x, q.y])
              const T: Tri[] = delaunay(pts)
              const cells = voronoiCells(pts, T, W, H)

              // Lloyd relaxation: move each seed part of the way to its cell's centroid.
              if (relax && f.dt > 0) {
                let move = 0
                cells.forEach((poly, i) => {
                  const c = centroid(poly)
                  if (!c || i === drag.current) return
                  const dx = (c[0] - s[i].x) * 0.15
                  const dy = (c[1] - s[i].y) * 0.15
                  s[i].x += dx
                  s[i].y += dy
                  move = Math.max(move, Math.hypot(dx, dy))
                })
                iter.current++
                if (move < 0.02) setRelax(false)
              }

              clear(ctx, W, H, glass ? '#15110d' : theme.surface)
              const dark = theme.dark
              if (fill && metric === 'manhattan') {
                const res = s.length > 120 ? 6 : 4
                const bw = Math.ceil(W / res)
                const bh = Math.ceil(H / res)
                if (!buf.current || buf.current.canvas.width !== bw) buf.current = makeBuffer(bw, bh)
                const b = buf.current
                const owner = new Int16Array(bw * bh)
                for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) owner[j * bw + i] = nearest(pts, (i + 0.5) * res, (j + 0.5) * res, 'manhattan')
                const rgb = pal.map(hexRgb)
                for (let j = 0; j < bh; j++)
                  for (let i = 0; i < bw; i++) {
                    const k = j * bw + i
                    const o = owner[k]
                    const [r, g, bl] = o >= 0 ? rgb[s[o].c % rgb.length] : [128, 128, 128]
                    const edge = edges && ((i + 1 < bw && owner[k + 1] !== o) || (j + 1 < bh && owner[k + bw] !== o))
                    const m = edge ? 0.25 : 1
                    b.data[k * 4] = r * m
                    b.data[k * 4 + 1] = g * m
                    b.data[k * 4 + 2] = bl * m
                    b.data[k * 4 + 3] = 255
                  }
                b.flush()
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(b.canvas, 0, 0, bw * res, bh * res)
                ctx.imageSmoothingEnabled = true
              } else if (fill || glass) {
                cells.forEach((poly, i) => {
                  if (poly.length < 3) return
                  ctx.beginPath()
                  poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                  ctx.closePath()
                  ctx.fillStyle = pal[s[i].c % pal.length]
                  ctx.fill()
                  if (glass) {
                    const r = Math.max(...poly.map(([x, y]) => Math.hypot(x - s[i].x, y - s[i].y)))
                    const g = ctx.createRadialGradient(s[i].x, s[i].y, 0, s[i].x, s[i].y, r)
                    g.addColorStop(0, 'rgba(255,255,255,0.55)')
                    g.addColorStop(0.5, 'rgba(255,255,255,0.12)')
                    g.addColorStop(1, 'rgba(0,0,0,0.25)')
                    ctx.fillStyle = g
                    ctx.fill()
                  }
                })
              }
              if ((edges || glass) && metric === 'euclid') {
                ctx.lineJoin = 'round'
                if (glass) {
                  ctx.strokeStyle = '#15110d'
                  ctx.lineWidth = 6
                } else {
                  ctx.strokeStyle = fill ? alpha(dark && palette !== 'pastel' ? '#ffffff' : '#1b1a17', 0.55) : theme.text
                  ctx.lineWidth = 1.5
                }
                ctx.beginPath()
                for (const poly of cells) {
                  poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                  ctx.closePath()
                }
                ctx.stroke()
              }
              if (tris) {
                ctx.beginPath()
                for (const [a, b, c] of T) {
                  ctx.moveTo(pts[a][0], pts[a][1])
                  ctx.lineTo(pts[b][0], pts[b][1])
                  ctx.lineTo(pts[c][0], pts[c][1])
                  ctx.closePath()
                }
                ctx.strokeStyle = alpha(theme.accent, 0.8)
                ctx.lineWidth = 1
                ctx.stroke()
              }
              const hv = hover.current
              if (hv && metric === 'euclid' && s.length) {
                const i = nearest(pts, hv[0], hv[1], 'euclid')
                const poly = cells[i]
                if (poly && poly.length > 2) {
                  ctx.beginPath()
                  poly.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                  ctx.closePath()
                  ctx.strokeStyle = theme.accent
                  ctx.lineWidth = 3
                  ctx.stroke()
                }
              }
              if (showSeeds) for (let i = 0; i < s.length; i++) circle(ctx, s[i].x, s[i].y, i === drag.current ? 6 : 3.5, '#fff', '#1b1a17', 1.5)
              if (f.frame % 10 === 0) setInfo({ tris: T.length, iter: iter.current })
            }}
          />
          <Readout
            items={[
              ['Seeds', n],
              ['Delaunay triangles', info.tris],
              ['Voronoi cells', n],
              ['Lloyd steps', info.iter],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={scatter} resetLabel="Scatter">
        <button
          type="button"
          className={`btn btn-icon ${relax ? 'primary' : ''}`}
          onClick={() => {
            setRelax(!relax)
            if (!running) setRunning(true)
          }}
          aria-pressed={relax}
        >
          <Icon name="lightning-bolt" size={18} />
          {relax ? 'Relaxing…' : 'Lloyd relax'}
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, 'voronoi.png')}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Slider label="Seeds" value={n} min={3} max={300} onChange={resize} />
      <Toggle label="Seeds drift" checked={drift} onChange={setDrift} />
      <Select label="Palette" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} />
      <Choice label="Distance" value={metric} options={[['euclid', 'Euclidean'], ['manhattan', 'Manhattan']]} onChange={setMetric} />
      <Toggle label="Fill cells" checked={fill} onChange={setFill} />
      <Toggle label="Cell edges" checked={edges} onChange={setEdges} />
      <Toggle label="Delaunay triangles" checked={tris} onChange={setTris} />
      <Toggle label="Show seeds" checked={showSeeds} onChange={setShowSeeds} />
      <Toggle label="Stained glass" checked={glass} onChange={setGlass} />
      <Hint>Every point in a cell is closer to that cell's seed than to any other. Drag seeds, click empty space to add one, and shift- or right-click a seed to remove it. Lloyd relaxation moves each seed to its cell's centre until the cells even out.</Hint>
    </SimLayout>
  )
}
