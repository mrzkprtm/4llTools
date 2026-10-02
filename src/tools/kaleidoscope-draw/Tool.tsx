import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, line } from '../../sim/draw'
import { TAU, deg, makeNoise } from '../../sim/math'
import { drawRuns, rotate, RUN, runCount, type Stroke } from './symmetry'

const W = 800
const H = 520
/** The art canvas is a square big enough to cover the stage at any rotation. */
const D = 960
const K = 1.5
const HISTORY = 60
const ART_BASE: [number, number, number, number, number, number] = [K, 0, 0, K, (D * K) / 2, (D * K) / 2]

type Bg = 'dark' | 'light'

function makeLayer() {
  const c = document.createElement('canvas')
  c.width = c.height = D * K
  return c
}

export default function KaleidoscopeDraw() {
  const colorId = useId()
  const [running, setRunning] = useRunning()
  const [slices, setSlices] = useState(8)
  const [mirror, setMirror] = useState(true)
  const [size, setSize] = useState(3)
  const [cycle, setCycle] = useState(true)
  const [color, setColor] = useState('#4dabf7')
  const [glow, setGlow] = useState(true)
  const [bg, setBg] = useState<Bg>('dark')
  const [spin, setSpin] = useState(false)
  const [auto, setAuto] = useState(true)
  const [guides, setGuides] = useState(true)
  const [count, setCount] = useState(0)
  const strokes = useRef<Stroke[]>([])
  const baked = useRef(0)
  const live = useRef<{ s: Stroke; done: number; auto: boolean } | null>(null)
  const art = useRef<HTMLCanvasElement | null>(null)
  const base = useRef<HTMLCanvasElement | null>(null)
  const rot = useRef(0)
  const hueRef = useRef(190)
  const pen = useRef({ t: 0, age: 0 })
  const hover = useRef<{ x: number; y: number } | null>(null)
  const noise = useMemo(() => makeNoise(11), [])
  const dark = bg === 'dark'

  const settings = useRef({ slices, mirror, size, cycle, color, glow, dark })
  settings.current = { slices, mirror, size, cycle, color, glow, dark }

  function layers() {
    art.current ??= makeLayer()
    base.current ??= makeLayer()
    return { a: art.current.getContext('2d')!, b: base.current.getContext('2d')! }
  }

  /** Redraws the undoable strokes on top of the baked (older) strokes. */
  function redraw(rebake = false) {
    const { a, b } = layers()
    const d = settings.current.dark
    if (rebake) {
      b.setTransform(1, 0, 0, 1, 0, 0)
      b.clearRect(0, 0, D * K, D * K)
      for (const s of strokes.current.slice(0, baked.current)) drawRuns(b, s, 0, runCount(s.pts.length / 3), ART_BASE, d)
    }
    a.setTransform(1, 0, 0, 1, 0, 0)
    a.clearRect(0, 0, D * K, D * K)
    a.drawImage(base.current!, 0, 0)
    for (const s of strokes.current.slice(baked.current)) drawRuns(a, s, 0, runCount(s.pts.length / 3), ART_BASE, d)
    setCount(strokes.current.length)
  }

  useEffect(() => redraw(true), [bg])

  function begin(x: number, y: number, isAuto: boolean) {
    finish()
    const st = settings.current
    const s: Stroke = { pts: [x, y, hueRef.current], n: st.slices, mirror: st.mirror, size: st.size, color: st.cycle ? null : st.color, glow: st.glow }
    live.current = { s, done: 0, auto: isAuto }
  }

  function extend(x: number, y: number) {
    const l = live.current
    if (!l) return
    const p = l.s.pts
    const n = p.length
    const d = Math.hypot(x - p[n - 3], y - p[n - 2])
    if (d < 1.5) return
    hueRef.current = (hueRef.current + d * 0.35) % 360
    p.push(x, y, hueRef.current)
    const last = p.length / 3 - 1
    const { a } = layers()
    // Completed runs go straight onto the art layer; the short tail is drawn live each frame.
    while ((l.done + 1) * RUN <= last) {
      drawRuns(a, l.s, l.done, l.done + 1, ART_BASE, settings.current.dark)
      l.done++
    }
  }

  function finish() {
    const l = live.current
    if (!l) return
    live.current = null
    const { a, b } = layers()
    drawRuns(a, l.s, l.done, runCount(l.s.pts.length / 3), ART_BASE, settings.current.dark)
    strokes.current.push(l.s)
    // Strokes that fall out of the undo history are baked into the base layer.
    while (strokes.current.length - baked.current > HISTORY) {
      const s = strokes.current[baked.current++]
      drawRuns(b, s, 0, runCount(s.pts.length / 3), ART_BASE, settings.current.dark)
    }
    setCount(strokes.current.length)
  }

  function undo() {
    finish()
    if (strokes.current.length > baked.current) {
      strokes.current.pop()
      redraw()
    }
  }

  function wipe() {
    live.current = null
    strokes.current = []
    baked.current = 0
    redraw(true)
  }

  function save() {
    const out = document.createElement('canvas')
    out.width = W * 2
    out.height = H * 2
    const c = out.getContext('2d')!
    c.fillStyle = dark ? '#07070c' : '#fbf8f1'
    c.fillRect(0, 0, out.width, out.height)
    c.translate(W, H)
    c.rotate(rot.current)
    if (art.current) c.drawImage(art.current, -D, -D, D * 2, D * 2)
    downloadCanvas(out, 'kaleidoscope.png')
  }

  const toArt = (x: number, y: number) => rotate(x - W / 2, y - H / 2, -rot.current)

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
    const [x, y] = toArt(p.x, p.y)
    if (p.type === 'down') {
      if (auto) setAuto(false)
      begin(x, y, false)
    } else if (p.type === 'move' && p.down && live.current && !live.current.auto) extend(x, y)
    else if (p.type === 'up' && live.current && !live.current.auto) finish()
  }

  const copies = mirror ? slices * 2 : slices

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="none"
            className={dark ? 'sim-dark' : 'sim-flat'}
            label={`Kaleidoscope drawing with ${slices} slices${mirror ? ' and mirror reflection' : ''}, ${count} strokes.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                if (spin) rot.current = (rot.current + f.dt * 0.18) % TAU
                if (auto) {
                  const pn = pen.current
                  pn.t += f.dt * 0.32
                  pn.age += f.dt
                  const px = noise(pn.t, 3.7) * 420 + noise(pn.t * 2.3, 9.1) * 120
                  const py = noise(8.2, pn.t) * 420 + noise(1.4, pn.t * 2.3) * 120
                  if (!live.current || !live.current.auto || pn.age > 3.2) {
                    pn.age = 0
                    begin(px, py, true)
                  } else extend(px, py)
                }
              }
              if (!auto && live.current?.auto) finish()

              clear(ctx, W, H, dark ? '#07070c' : '#fbf8f1')
              ctx.save()
              ctx.translate(W / 2, H / 2)
              ctx.rotate(rot.current)
              if (guides) {
                const r = Math.hypot(W, H) / 2
                const gc = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
                for (let k = 0; k < slices; k++) {
                  const a = (k * TAU) / slices
                  line(ctx, 0, 0, Math.cos(a) * r, Math.sin(a) * r, gc)
                }
              }
              if (art.current) ctx.drawImage(art.current, -D / 2, -D / 2, D, D)
              const l = live.current
              if (l) {
                const m = ctx.getTransform()
                drawRuns(ctx, l.s, l.done, runCount(l.s.pts.length / 3), [m.a, m.b, m.c, m.d, m.e, m.f], dark)
              }
              ctx.restore()
              const h = hover.current
              if (h) circle(ctx, h.x, h.y, Math.max(3, size / 2 + 2), undefined, dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)', 1.2)
              if (f.frame % 15 === 0 && strokes.current.length !== count) setCount(strokes.current.length)
            }}
          />
          <Readout
            items={[
              ['Slices', slices],
              ['Copies per stroke', copies],
              ['Strokes', count],
              ['Rotation', `${Math.round(deg(rot.current))}°`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={wipe} resetLabel="Clear">
        <button type="button" className="btn btn-icon" onClick={undo} disabled={count <= baked.current && !live.current}>
          <Icon name="undo" size={18} />
          Undo
        </button>
        <button type="button" className="btn btn-icon" onClick={save}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Slider label="Slices" value={slices} min={2} max={24} onChange={setSlices} />
      <Toggle label="Mirror each slice" checked={mirror} onChange={setMirror} />
      <Slider label="Brush size" value={size} min={1} max={20} step={0.5} unit=" px" onChange={setSize} />
      <Toggle label="Cycle hue as you draw" checked={cycle} onChange={setCycle} />
      {!cycle && (
        <div className="sim-field">
          <label htmlFor={colorId} className="sim-label">
            Colour
          </label>
          <input id={colorId} type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '100%', height: 34 }} />
        </div>
      )}
      <Toggle label="Glow" checked={glow} onChange={setGlow} />
      <Choice label="Background" value={bg} options={[['dark', 'Dark'], ['light', 'Light']]} onChange={setBg} />
      <Toggle label="Auto draw (noise pen)" checked={auto} onChange={setAuto} />
      <Toggle label="Slowly rotate" checked={spin} onChange={setSpin} />
      <Toggle label="Slice guides" checked={guides} onChange={setGuides} />
      <Hint>Draw anywhere on the canvas and every stroke is copied into each slice, mirrored if you like. The noise pen draws on its own until you start drawing; each stroke keeps the slice settings it was drawn with.</Hint>
    </SimLayout>
  )
}
