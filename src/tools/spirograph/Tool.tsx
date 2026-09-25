import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, line, text } from '../../sim/draw'
import { TAU, clamp, dist, fmt, lerp } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { closingTurns, extent, gearCentre, gearSpin, petals, spiroPoint, type Gear } from './spiro'

const W = 800
const H = 540
const CX = W / 2
const CY = H / 2
const FIT = 250
const TURN_SECONDS = 3

interface Layer extends Gear {
  color: string
  theta: number
  total: number
  pts: number[]
  path: Path2D | null
}

function newLayer(g: Gear, color: string): Layer {
  const [x, y] = spiroPoint(0, g)
  return { ...g, color, theta: 0, total: TAU * closingTurns(g.R, g.r), pts: [x, y], path: null }
}

/** A toothed circle outline: teeth point outwards (sign 1) or inwards (−1). */
function teeth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, sign: 1 | -1, depth: number) {
  const n = Math.max(8, Math.round((TAU * r) / 9))
  ctx.beginPath()
  for (let i = 0; i <= n * 4; i++) {
    const a = spin + (i / (n * 4)) * TAU
    const rr = r + (i % 4 === 1 || i % 4 === 2 ? sign * depth : 0)
    if (i) ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a))
    else ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a))
  }
  ctx.closePath()
}

export default function Spirograph() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [R, setR] = useState(160)
  const [r, setr] = useState(60)
  const [d, setD] = useState(46)
  const [inside, setInside] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [gears, setGears] = useState(true)
  const [info, setInfo] = useState({ progress: 0, layers: 1 })
  const layers = useRef<Layer[]>([newLayer({ R: 160, r: 60, d: 46, inside: true }, PALETTE[0])])
  const zoom = useRef(1)
  const dragging = useRef(false)
  const exporting = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const current = () => layers.current[layers.current.length - 1]

  // Changing a setting restarts the layer that is being drawn.
  function edit(next: Partial<Gear>) {
    const g = { R, r, d, inside, ...next }
    if (next.R !== undefined) setR(next.R)
    if (next.r !== undefined) setr(next.r)
    if (next.d !== undefined) setD(next.d)
    if (next.inside !== undefined) setInside(next.inside)
    const ls = layers.current
    ls[ls.length - 1] = newLayer(g, current().color)
  }

  function addLayer() {
    const n = layers.current.length
    layers.current.push(newLayer({ R, r, d, inside }, PALETTE[n % PALETTE.length]))
    if (!running) setRunning(true)
  }

  function finish() {
    const l = current()
    l.theta = l.total
    l.pts = []
    const step = Math.min(0.05, 0.25 / (1 + (l.inside ? l.R - l.r : l.R + l.r) / l.r))
    for (let th = 0; th <= l.total + 1e-9; th += step) l.pts.push(...spiroPoint(th, l))
    l.pts.push(...spiroPoint(l.total, l))
  }

  function onPointer(p: SimPointer) {
    const l = current()
    const k = zoom.current
    const [gx, gy] = gearCentre(l.theta, l)
    if (p.type === 'down') dragging.current = dist(p.x, p.y, CX + gx * k, CY + gy * k) < (l.r + 12) * k
    if (!dragging.current) return
    edit({ d: Math.round(clamp(dist(p.x, p.y, CX + gx * k, CY + gy * k) / k, 0, Math.max(r * 1.3, 20))) })
    if (p.type === 'up') dragging.current = false
  }

  const g: Gear = { R, r, d, inside }
  const turns = closingTurns(R, r)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            className="sim-flat"
            canvasRef={canvasRef}
            onPointer={onPointer}
            label={`Spirograph with ring radius ${R}, gear radius ${r} rolling ${inside ? 'inside' : 'outside'}, pen offset ${d}.`}
            onFrame={(ctx, f) => {
              const ls = layers.current
              const l = ls[ls.length - 1]
              if (f.dt > 0 && l.theta < l.total) {
                const next = Math.min(l.total, l.theta + (f.dt * TAU) / TURN_SECONDS)
                const step = Math.min(0.05, 0.25 / (1 + (l.inside ? l.R - l.r : l.R + l.r) / l.r))
                for (let th = l.theta + step; th < next; th += step) l.pts.push(...spiroPoint(th, l))
                l.pts.push(...spiroPoint(next, l))
                l.theta = next
              }
              const target = Math.min(1.25, FIT / Math.max(...ls.map(extent)))
              zoom.current = f.frame === 0 ? target : lerp(zoom.current, target, 0.1)
              const k = zoom.current

              clear(ctx, W, H, theme.surface)
              ctx.save()
              ctx.translate(CX, CY)
              ctx.scale(k, k)
              ctx.lineJoin = ctx.lineCap = 'round'
              for (const layer of ls) {
                if (layer.theta >= layer.total && !layer.path) {
                  layer.path = new Path2D()
                  for (let i = 0; i < layer.pts.length; i += 2) layer.path.lineTo(layer.pts[i], layer.pts[i + 1])
                }
                let path = layer.path
                if (!path) {
                  path = new Path2D()
                  for (let i = 0; i < layer.pts.length; i += 2) path.lineTo(layer.pts[i], layer.pts[i + 1])
                }
                ctx.strokeStyle = layer.color
                ctx.lineWidth = 1.6 / k
                ctx.stroke(path)
              }
              ctx.restore()

              if (gears && !exporting.current) {
                // The fixed ring, the rolling gear and the pen.
                const ringFill = alpha(theme.text, 0.06)
                const edge = alpha(theme.text, 0.35)
                if (l.inside) {
                  ctx.beginPath()
                  ctx.arc(CX, CY, (l.R + 16) * k, 0, TAU)
                  teeth(ctx, CX, CY, l.R * k, 0, -1, 4 * k)
                  ctx.fillStyle = ringFill
                  ctx.fill('evenodd')
                } else {
                  teeth(ctx, CX, CY, l.R * k, 0, 1, 4 * k)
                  ctx.fillStyle = ringFill
                  ctx.fill()
                }
                ctx.strokeStyle = edge
                ctx.lineWidth = 1
                ctx.stroke()
                const [gx, gy] = gearCentre(l.theta, l)
                const spin = gearSpin(l.theta, l)
                const x = CX + gx * k
                const y = CY + gy * k
                teeth(ctx, x, y, (l.r - (l.inside ? 4 : 0)) * k, spin, 1, 4 * k)
                ctx.fillStyle = alpha(l.color, 0.14)
                ctx.fill()
                ctx.strokeStyle = alpha(l.color, 0.8)
                ctx.lineWidth = 1.5
                ctx.stroke()
                const [px, py] = spiroPoint(l.theta, l)
                line(ctx, x, y, CX + px * k, CY + py * k, alpha(theme.text, 0.5), 1.5)
                circle(ctx, x, y, 3, theme.text)
                circle(ctx, CX + px * k, CY + py * k, 6, theme.surface, l.color, 2.5)
                const done = l.theta >= l.total
                text(ctx, done ? `Closed after ${closingTurns(l.R, l.r)} trip${closingTurns(l.R, l.r) === 1 ? '' : 's'} round the ring` : `Trip ${Math.floor(l.theta / TAU) + 1} of ${closingTurns(l.R, l.r)}`, 16, 28, { color: theme.text, size: 15, weight: 700 })
                text(ctx, 'Drag inside the gear to move the pen hole', 16, H - 16, { color: theme.muted, size: 13 })
              }
              if (exporting.current) {
                exporting.current = false
                downloadCanvas(canvasRef.current, 'spirograph.png')
              }
              if (f.frame % 10 === 0) setInfo({ progress: l.theta / l.total, layers: ls.length })
            }}
          />
          <Readout
            items={[
              ['Trips to close: r ÷ gcd(R, r)', turns],
              ['Petals', petals(R, r)],
              ['Gear spins per trip', fmt(Math.abs(gearSpin(TAU, g)) / TAU, 2)],
              ['Progress', `${Math.round(info.progress * 100)}%`],
              ['Layers', info.layers],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (layers.current = [newLayer(g, PALETTE[0])])} resetLabel="Clear" />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={addLayer}>
          Add layer
        </button>
        <button type="button" className="btn" onClick={finish}>
          Finish
        </button>
        <button type="button" className="btn" onClick={() => (exporting.current = true)}>
          Save PNG
        </button>
      </div>
      <Choice label="Gear rolls" value={inside ? 'in' : 'out'} options={[['in', 'Inside the ring'], ['out', 'Outside']]} onChange={(v) => edit({ inside: v === 'in' })} />
      <Slider label="Ring radius R" value={R} min={40} max={200} onChange={(v) => edit({ R: v, r: inside ? Math.min(r, v - 1) : r })} />
      <Slider label="Gear radius r" value={r} min={8} max={inside ? R - 1 : 150} onChange={(v) => edit({ r: v })} />
      <Slider label="Pen offset d" value={d} min={0} max={150} onChange={(v) => edit({ d: v })} />
      <Slider label="Speed" value={speed} min={0.2} max={20} step={0.2} unit="×" onChange={setSpeed} />
      <Toggle label="Show gears" checked={gears} onChange={setGears} />
      <Hint>The gear rolls without slipping, so the pattern closes once both have turned a whole number of times: after r ÷ gcd(R, r) trips. Change a setting to redraw the current layer, or press Add layer to keep it and draw over it in a new colour.</Hint>
    </SimLayout>
  )
}
