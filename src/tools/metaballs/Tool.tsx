import { useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, makeBuffer } from '../../sim/draw'
import { clamp, fmt, makeNoise } from '../../sim/math'
import { countBlobs, field, marchingSquares, type Ball } from './metaballs'

const W = 800
const H = 520
const RES = 4
const BW = W / RES
const BH = H / RES
const CELL = 8
const COLS = W / CELL
const ROWS = H / CELL
const MAX = 20

type RGB = [number, number, number]
interface Look {
  label: string
  top: RGB
  bottom: RGB
  edge: RGB
  core: RGB
  glow: RGB
  line: string
}
const LOOKS: Record<string, Look> = {
  lava: { label: 'Lava lamp', top: [58, 8, 42], bottom: [128, 20, 40], edge: [255, 90, 30], core: [255, 226, 110], glow: [255, 70, 40], line: '#ffb347' },
  slime: { label: 'Slime', top: [6, 22, 14], bottom: [14, 44, 24], edge: [70, 200, 60], core: [210, 255, 120], glow: [60, 200, 80], line: '#a6ff4d' },
  neon: { label: 'Neon', top: [4, 4, 12], bottom: [10, 6, 28], edge: [255, 40, 200], core: [120, 240, 255], glow: [180, 60, 255], line: '#ff4fd8' },
  mono: { label: 'Ink on paper', top: [246, 242, 232], bottom: [232, 226, 212], edge: [40, 38, 34], core: [10, 10, 10], glow: [120, 110, 90], line: '#1b1a17' },
}
type LookKey = keyof typeof LOOKS
const LOOK_OPTIONS = Object.entries(LOOKS).map(([k, v]) => [k, v.label] as const) as [LookKey, string][]

function makeBall(x?: number, y?: number): Ball {
  const a = Math.random() * Math.PI * 2
  return { x: x ?? 80 + Math.random() * (W - 160), y: y ?? 80 + Math.random() * (H - 160), r: 28 + Math.random() * 34, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 }
}

export default function Metaballs() {
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState(9)
  const [threshold, setThreshold] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [mode, setMode] = useState<'smooth' | 'contour'>('smooth')
  const [look, setLook] = useState<LookKey>('lava')
  const [centres, setCentres] = useState(false)
  const [info, setInfo] = useState({ blobs: 0, cover: 0 })
  const balls = useRef<Ball[]>(Array.from({ length: 9 }, () => makeBall()))
  const drag = useRef<{ b: Ball; dx: number; dy: number } | null>(null)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const grid = useRef(new Float32Array((COLS + 1) * (ROWS + 1)))
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const noise = useMemo(() => makeNoise(5), [])

  function resize(n: number) {
    const b = balls.current
    while (b.length < n) b.push(makeBall())
    b.length = n
    setCount(n)
  }

  function onPointer(p: SimPointer) {
    const b = balls.current
    if (p.type === 'down') {
      const hit = b.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r * 0.8)
      if (hit && p.shift && b.length > 1) {
        b.splice(b.indexOf(hit), 1)
        setCount(b.length)
      } else if (hit) drag.current = { b: hit, dx: hit.x - p.x, dy: hit.y - p.y }
      else if (b.length < MAX) {
        const nb = makeBall(p.x, p.y)
        b.push(nb)
        drag.current = { b: nb, dx: 0, dy: 0 }
        setCount(b.length)
      }
    }
    const d = drag.current
    if (d && p.down) {
      d.b.vx = (p.x + d.dx - d.b.x) * 20
      d.b.vy = (p.y + d.dy - d.b.y) * 20
      d.b.x = clamp(p.x + d.dx, 0, W)
      d.b.y = clamp(p.y + d.dy, 0, H)
    }
    if (p.type === 'up' && d) {
      const s = Math.hypot(d.b.vx, d.b.vy)
      if (s > 200) {
        d.b.vx *= 200 / s
        d.b.vy *= 200 / s
      }
      drag.current = null
    }
  }

  const L = LOOKS[look]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            canvasRef={canvas}
            maxDpr={1.5}
            className={look === 'mono' ? 'sim-flat' : 'sim-dark'}
            cursor="grab"
            label={`${count} metaballs merging and splitting, drawn as ${mode === 'smooth' ? 'smooth blobs' : 'contour lines'} at threshold ${threshold}.`}
            onFrame={(ctx, f) => {
              const bs = balls.current
              if (f.dt > 0) {
                const dt = f.dt * speed
                bs.forEach((b, i) => {
                  if (drag.current?.b === b) return
                  // Wander: noise steers each ball, like warm wax rising and sinking.
                  const a = noise(i * 7.3, f.t * 0.15 * speed) * Math.PI * 2
                  b.vx += Math.cos(a) * 30 * dt
                  b.vy += Math.sin(a) * 30 * dt
                  const s = Math.hypot(b.vx, b.vy)
                  const target = 45
                  b.vx *= 1 + (target / Math.max(1, s) - 1) * Math.min(1, dt)
                  b.vy *= 1 + (target / Math.max(1, s) - 1) * Math.min(1, dt)
                  b.x += b.vx * dt
                  b.y += b.vy * dt
                  if (b.x < b.r * 0.6 || b.x > W - b.r * 0.6) b.vx = -b.vx
                  if (b.y < b.r * 0.6 || b.y > H - b.r * 0.6) b.vy = -b.vy
                  b.x = clamp(b.x, b.r * 0.6, W - b.r * 0.6)
                  b.y = clamp(b.y, b.r * 0.6, H - b.r * 0.6)
                })
              }

              // Coarse grid for the contours and the blob count.
              const G = grid.current
              for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) G[j * (COLS + 1) + i] = field(bs, i * CELL, j * CELL)

              if (mode === 'smooth') {
                if (!buf.current) buf.current = makeBuffer(BW, BH)
                const d = buf.current.data
                const th = threshold
                const soft = th * 0.06
                let inside = 0
                for (let j = 0; j < BH; j++) {
                  const u = j / (BH - 1)
                  const bg0 = L.top[0] + (L.bottom[0] - L.top[0]) * u
                  const bg1 = L.top[1] + (L.bottom[1] - L.top[1]) * u
                  const bg2 = L.top[2] + (L.bottom[2] - L.top[2]) * u
                  for (let i = 0; i < BW; i++) {
                    const v = field(bs, i * RES + RES / 2, j * RES + RES / 2)
                    const o = (j * BW + i) * 4
                    // Outside: a soft glow that rises towards the rim.
                    const g = Math.min(1, (v / th) ** 3) * 0.45
                    let r = bg0 + (L.glow[0] - bg0) * g
                    let gg = bg1 + (L.glow[1] - bg1) * g
                    let b = bg2 + (L.glow[2] - bg2) * g
                    // Inside: edge colour to core colour with depth; a smooth step across the rim.
                    const k = clamp((v - th) / soft + 0.5, 0, 1)
                    if (k > 0) {
                      inside++
                      const depth = clamp((v - th) / (th * 1.8), 0, 1) ** 0.7
                      const cr = L.edge[0] + (L.core[0] - L.edge[0]) * depth
                      const cg = L.edge[1] + (L.core[1] - L.edge[1]) * depth
                      const cb = L.edge[2] + (L.core[2] - L.edge[2]) * depth
                      r += (cr - r) * k
                      gg += (cg - gg) * k
                      b += (cb - b) * k
                    }
                    d[o] = r
                    d[o + 1] = gg
                    d[o + 2] = b
                    d[o + 3] = 255
                  }
                }
                buf.current.flush()
                ctx.imageSmoothingEnabled = true
                ctx.drawImage(buf.current.canvas, 0, 0, W, H)
                if (f.frame % 12 === 0) setInfo({ blobs: countBlobs(G, COLS, ROWS, threshold), cover: inside / (BW * BH) })
              } else {
                const grad = ctx.createLinearGradient(0, 0, 0, H)
                grad.addColorStop(0, `rgb(${L.top.join(',')})`)
                grad.addColorStop(1, `rgb(${L.bottom.join(',')})`)
                clear(ctx, W, H)
                ctx.fillStyle = grad
                ctx.fillRect(0, 0, W, H)
                ctx.lineCap = 'round'
                // Fainter iso-lines below the threshold, like a contour map.
                const levels = [0.35, 0.55, 0.75, 1]
                levels.forEach((lv, n) => {
                  const segs = marchingSquares(G, COLS, ROWS, CELL, threshold * lv)
                  ctx.beginPath()
                  for (let s = 0; s < segs.length; s += 4) {
                    ctx.moveTo(segs[s], segs[s + 1])
                    ctx.lineTo(segs[s + 2], segs[s + 3])
                  }
                  ctx.strokeStyle = L.line
                  ctx.globalAlpha = n === levels.length - 1 ? 1 : 0.18 + n * 0.14
                  ctx.lineWidth = n === levels.length - 1 ? 3 : 1.2
                  ctx.stroke()
                })
                ctx.globalAlpha = 1
                if (f.frame % 12 === 0) {
                  let inside = 0
                  for (let k = 0; k < G.length; k++) if (G[k] >= threshold) inside++
                  setInfo({ blobs: countBlobs(G, COLS, ROWS, threshold), cover: inside / G.length })
                }
              }
              if (centres || drag.current)
                for (const b of bs) circle(ctx, b.x, b.y, drag.current?.b === b ? 6 : 3, look === 'mono' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)')
            }}
          />
          <Readout
            items={[
              ['Balls', count],
              ['Separate blobs', info.blobs],
              ['Threshold', fmt(threshold, 2)],
              ['Area inside', `${Math.round(info.cover * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (balls.current = Array.from({ length: count }, () => makeBall()))} resetLabel="Shuffle">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `metaballs-${look}.png`)}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice label="Render" value={mode} options={[['smooth', 'Smooth blobs'], ['contour', 'Marching squares']]} onChange={setMode} />
      <Select label="Palette" value={look} options={LOOK_OPTIONS} onChange={setLook} />
      <Slider label="Balls" value={count} min={5} max={MAX} onChange={resize} />
      <Slider label="Threshold" value={threshold} min={0.4} max={3} step={0.05} onChange={setThreshold} />
      <Slider label="Speed" value={speed} min={0} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <Toggle label="Show ball centres" checked={centres} onChange={setCentres} />
      <Hint>Each ball adds r²/d² to a field, and the blob outline is wherever the total equals the threshold, so nearby balls melt together. Drag a ball, click empty space to add one, shift-click to remove.</Hint>
    </SimLayout>
  )
}
