import { useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { MONO, downloadCanvas, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { BRANCH, MAX_ORDER, buildCurve, pathLength, type Kind } from './curves'

const S = 600
const M = 28
const BOX = S - 2 * M
const BATCHES = 72
const MORPH = 1.3

const KINDS = [['hilbert', 'Hilbert'], ['moore', 'Moore'], ['peano', 'Peano'], ['zorder', 'Z-order (Morton)'], ['gosper', 'Gosper flowsnake']] as const

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const hueAt = (u: number) => `hsl(${(250 - u * 290 + 360) % 360} 85% 62%)`

/** Screen positions for a curve's points. */
function toScreen(pts: Float32Array, n: number): Float32Array {
  const cs = BOX / n
  const out = new Float32Array(pts.length)
  for (let i = 0; i < pts.length; i += 2) {
    out[i] = M + (pts[i] + 0.5) * cs
    out[i + 1] = M + (n - 1 - pts[i + 1] + 0.5) * cs
  }
  return out
}

export default function SpaceFillingCurves() {
  const [running, setRunning] = useRunning()
  const [kind, setKind] = useState<Kind>('hilbert')
  const [order, setOrder] = useState(1)
  const [speed, setSpeed] = useState(4)
  const [grid, setGrid] = useState(true)
  const [grow, setGrow] = useState(true)
  const [change, setChange] = useState<'morph' | 'redraw'>('morph')
  const [hover, setHover] = useState(-1)
  const [drawn, setDrawn] = useState(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  const curve = useMemo(() => buildCurve(kind, order), [kind, order])
  const screen = useMemo(() => toScreen(curve.pts, curve.n), [curve])
  const count = curve.pts.length / 2
  const length = useMemo(() => pathLength(curve.pts), [curve])
  // Where each point starts when morphing up from the previous order: the centre of its parent cell.
  const parents = useMemo(() => {
    const f = BRANCH[kind]
    if (!f || order < 2) return null
    const out = new Float32Array(curve.pts.length)
    for (let i = 0; i < curve.pts.length; i++) out[i] = Math.floor(curve.pts[i] / f) * f + (f - 1) / 2
    return toScreen(out, curve.n)
  }, [curve, kind, order])
  const anim = useRef({ head: 0, morph: 1, wait: 0 })

  function go(nextKind: Kind, nextOrder: number) {
    const o = clamp(nextOrder, 1, MAX_ORDER[nextKind])
    const up = nextKind === kind && o === order + 1
    const a = anim.current
    if (up && change === 'morph' && BRANCH[nextKind] && a.head >= 1) {
      a.morph = 0
      a.head = 1
    } else {
      a.morph = 1
      a.head = 0
    }
    a.wait = 0
    setKind(nextKind)
    setOrder(o)
    setHover(-1)
  }

  function onPointer(p: SimPointer) {
    // Nearest point of the curve to the pointer.
    let best = -1
    let bd = ((BOX / curve.n) * 0.9) ** 2 + 36
    for (let i = 0; i < count; i++) {
      const d = (screen[2 * i] - p.x) ** 2 + (screen[2 * i + 1] - p.y) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    }
    setHover(best)
  }

  const cs = BOX / curve.n
  const lw = clamp(cs * (kind === 'gosper' ? 0.18 : 0.32), 1, 9)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[S, S]}
            running={running}
            className="sim-dark"
            canvasRef={canvas}
            onPointer={onPointer}
            label={`${kind} curve of order ${order} with ${count} points, drawn by an animated pen.`}
            onFrame={(ctx, f) => {
              const a = anim.current
              if (f.dt > 0) {
                if (a.morph < 1) a.morph = Math.min(1, a.morph + f.dt / MORPH)
                // Bigger curves take longer to draw, but not proportionally longer.
                else if (a.head < 1) a.head = Math.min(1, a.head + f.dt / Math.max(1.2, Math.sqrt(count) / (speed * 5)))
                else if (grow && (a.wait += f.dt) > 1.6) {
                  if (order < MAX_ORDER[kind]) go(kind, order + 1)
                  else go(kind, 1)
                }
              }
              ctx.fillStyle = '#0d0c12'
              ctx.fillRect(0, 0, S, S)
              if (grid && curve.grid && cs >= 6) {
                ctx.beginPath()
                for (let k = 0; k <= curve.n; k++) {
                  ctx.moveTo(M + k * cs, M)
                  ctx.lineTo(M + k * cs, M + BOX)
                  ctx.moveTo(M, M + k * cs)
                  ctx.lineTo(M + BOX, M + k * cs)
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'
                ctx.lineWidth = 1
                ctx.stroke()
              }
              const N = count - 1
              const upto = a.morph < 1 ? N : Math.floor(a.head * N)
              const t = ease(a.morph)
              const px = (i: number) => (parents && a.morph < 1 ? parents[2 * i] + (screen[2 * i] - parents[2 * i]) * t : screen[2 * i])
              const py = (i: number) => (parents && a.morph < 1 ? parents[2 * i + 1] + (screen[2 * i + 1] - parents[2 * i + 1]) * t : screen[2 * i + 1])
              ctx.lineJoin = 'round'
              ctx.lineCap = 'round'
              ctx.lineWidth = lw
              for (let b = 0; b < BATCHES; b++) {
                const i0 = Math.floor((b * N) / BATCHES)
                if (i0 >= upto && N > 0) break
                const i1 = Math.min(upto, Math.floor(((b + 1) * N) / BATCHES))
                ctx.beginPath()
                ctx.moveTo(px(i0), py(i0))
                for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(px(i), py(i))
                ctx.strokeStyle = hueAt(b / (BATCHES - 1))
                ctx.stroke()
              }
              if (a.head < 1 && a.morph >= 1) {
                const x = px(upto)
                const y = py(upto)
                ctx.beginPath()
                ctx.arc(x, y, Math.max(3, lw * 0.8), 0, Math.PI * 2)
                ctx.fillStyle = '#fff'
                ctx.fill()
              }
              if (hover >= 0 && hover < count) {
                const x = screen[2 * hover]
                const y = screen[2 * hover + 1]
                if (curve.grid) {
                  ctx.strokeStyle = '#fff'
                  ctx.lineWidth = 1.5
                  ctx.strokeRect(x - cs / 2, y - cs / 2, cs, cs)
                }
                ctx.beginPath()
                ctx.arc(x, y, Math.max(4, lw), 0, Math.PI * 2)
                ctx.fillStyle = hueAt(hover / Math.max(1, N))
                ctx.fill()
                ctx.strokeStyle = '#fff'
                ctx.lineWidth = 2
                ctx.stroke()
                const label = curve.grid ? `#${hover}  (${curve.pts[2 * hover]}, ${curve.pts[2 * hover + 1]})` : `#${hover}`
                ctx.font = `600 13px ${MONO}`
                const tw = ctx.measureText(label).width + 14
                const lx = clamp(x + 12, 4, S - tw - 4)
                const ly = clamp(y - 30, 4, S - 26)
                ctx.fillStyle = 'rgba(13,12,18,0.85)'
                ctx.fillRect(lx, ly, tw, 22)
                text(ctx, label, lx + 7, ly + 15, { color: '#fff', size: 13, weight: 600 })
              }
              if (f.frame % 8 === 0) setDrawn(a.morph < 1 ? 1 : a.head)
            }}
          />
          <Readout
            items={[
              ['Order', order],
              ['Points', fmt(count, 0)],
              ['Path length', `${fmt(length, 1)} cells`],
              ['Drawn', `${Math.round(drawn * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => go(kind, order)} resetLabel="Redraw">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `${kind}-order-${order}.png`)}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select label="Curve" value={kind} options={KINDS} onChange={(v) => go(v, Math.min(order, MAX_ORDER[v]))} />
      <Slider label="Order" value={order} min={1} max={MAX_ORDER[kind]} onChange={(v) => go(kind, v)} />
      <Slider label="Pen speed" value={speed} min={1} max={20} onChange={setSpeed} />
      <Choice label="Next order" value={change} options={[['morph', 'Morph'], ['redraw', 'Redraw']]} onChange={setChange} />
      <Toggle label="Grow order automatically" checked={grow} onChange={setGrow} />
      <Toggle label="Show grid" checked={grid} onChange={setGrid} />
      <Hint>Each order replaces every cell with a small copy of the whole curve, so the path visits every cell exactly once without crossing itself. Hover to see a cell’s position along the path: nearby cells get nearby numbers, except at Z-order’s jumps.</Hint>
    </SimLayout>
  )
}
