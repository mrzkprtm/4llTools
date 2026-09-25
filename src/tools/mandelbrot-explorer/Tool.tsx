import { useEffect, useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, line, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { PALETTES, buildLut, escapeTime, julia, lutIndex, type Palette } from './fractal'

const W = 800
const H = 520
const JW = 180
const JH = 120
const JX = W - JW - 12
const JY = H - JH - 12
const BUDGET = 6
const HOME = { cx: -0.6, cy: 0, s: 3.3 / W }
const JHOME = { cx: 0, cy: 0, s: 3.4 / W }
const MIN_S = 2e-15
const UNKNOWN = -2

interface View {
  cx: number
  cy: number
  s: number
}
type Mode = 'mandel' | 'julia'

const same = (a: View, b: View) => a.cx === b.cx && a.cy === b.cy && a.s === b.s
const complex = (re: number, im: number, d = 4) => `${fmt(re, d)} ${im < 0 ? '−' : '+'} ${fmt(Math.abs(im), d)}i`

export default function MandelbrotExplorer() {
  const [running, setRunning] = useRunning()
  const [maxIter, setMaxIter] = useState(300)
  const [palette, setPalette] = useState<Palette>('ember')
  const [mode, setMode] = useState<Mode>('mandel')
  const [info, setInfo] = useState({ cx: HOME.cx, cy: HOME.cy, zoom: 1, progress: 0 })
  const [jc, setJc] = useState({ re: -0.8, im: 0.156 })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const views = useRef({ mandel: { view: { ...HOME }, target: { ...HOME } }, julia: { view: { ...JHOME }, target: { ...JHOME } } })
  const store = useRef<{ main: ReturnType<typeof makeBuffer>; inset: ReturnType<typeof makeBuffer>; vals: Float32Array; ivals: Float32Array } | null>(null)
  const job = useRef({ view: null as View | null, key: '', pass: 0, row: 0, done: true })
  const insetKey = useRef('')
  const painted = useRef('')
  const cycle = useRef(0)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const lut = useMemo(() => buildLut(PALETTES[palette]), [palette])

  const cur = () => views.current[mode]

  function zoomAt(factor: number, x = W / 2, y = H / 2) {
    const t = cur().target
    const ar = t.cx + (x - W / 2) * t.s
    const ai = t.cy - (y - H / 2) * t.s
    const ns = clamp(t.s * factor, MIN_S, 0.02)
    const f = ns / t.s
    t.cx = ar + (t.cx - ar) * f
    t.cy = ai + (t.cy - ai) * f
    t.s = ns
  }

  // Mouse-wheel zoom around the pointer (Stage has no wheel hook).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      zoomAt(Math.exp(clamp(e.deltaY, -200, 200) * 0.004), ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  })

  function onPointer(p: SimPointer) {
    const v = cur()
    if (p.type === 'down') drag.current = { x: p.x, y: p.y, cx: v.view.cx, cy: v.view.cy, moved: false }
    const d = drag.current
    if (d && p.down) {
      if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true
      if (d.moved) {
        v.view.cx = v.target.cx = d.cx - (p.x - d.x) * v.view.s
        v.view.cy = v.target.cy = d.cy + (p.y - d.y) * v.view.s
      }
    }
    if (p.type === 'up' && d) {
      // A plain click glides the view to centre on that point.
      if (!d.moved) {
        v.target.cx = v.view.cx + (p.x - W / 2) * v.view.s
        v.target.cy = v.view.cy - (p.y - H / 2) * v.view.s
      }
      drag.current = null
    }
    if (mode === 'mandel' && !p.down && !(p.x > JX - 4 && p.y > JY - 24)) setJc({ re: v.view.cx + (p.x - W / 2) * v.view.s, im: v.view.cy - (p.y - H / 2) * v.view.s })
  }

  function reset() {
    Object.assign(cur().target, mode === 'mandel' ? HOME : JHOME)
  }

  /** Colours escape counts into RGBA, shifted along the palette by `offset` for colour cycling. */
  function paint(vals: Float32Array, data: Uint8ClampedArray, offset: number) {
    const size = lut.length / 3
    for (let i = 0, o = 0; i < vals.length; i++, o += 4) {
      const v = vals[i]
      if (v < 0) {
        data[o] = data[o + 1] = data[o + 2] = 0
      } else {
        const k = ((lutIndex(v, size) + offset) % size) * 3
        data[o] = lut[k]
        data[o + 1] = lut[k + 1]
        data[o + 2] = lut[k + 2]
      }
      data[o + 3] = 255
    }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            canvasRef={canvasRef}
            cursor="grab"
            onPointer={onPointer}
            label={`${mode === 'mandel' ? 'Mandelbrot' : 'Julia'} set centred on ${complex(info.cx, info.cy)} at ${fmt(info.zoom, 1)} times zoom.`}
            onFrame={(ctx, f) => {
              if (!store.current) {
                store.current = { main: makeBuffer(W, H), inset: makeBuffer(JW, JH), vals: new Float32Array(W * H).fill(UNKNOWN), ivals: new Float32Array(JW * JH) }
              }
              const { main, inset, vals, ivals } = store.current
              const { view, target } = cur()
              cycle.current += f.dt * 14

              // Glide towards the target view (zoom in log space).
              if (!drag.current) {
                view.s = Math.exp(Math.log(view.s) + (Math.log(target.s) - Math.log(view.s)) * 0.2)
                view.cx += (target.cx - view.cx) * 0.2
                view.cy += (target.cy - view.cy) * 0.2
                if (Math.abs(Math.log(view.s / target.s)) < 0.004 && Math.abs(view.cx - target.cx) < view.s * 0.3 && Math.abs(view.cy - target.cy) < view.s * 0.3) Object.assign(view, target)
              }
              const settled = !drag.current && same(view, target)

              // (Re)start the progressive render when the view or the maths changes.
              const key = `${mode}|${maxIter}|${mode === 'julia' ? `${jc.re},${jc.im}` : ''}`
              const j = job.current
              if (settled && (!j.view || !same(j.view, view) || j.key !== key)) {
                if (j.view && j.key.startsWith(mode) && !same(j.view, view)) {
                  // Carry the old picture over, moved to where it now belongs, while the new one fills in.
                  const k = j.view.s / view.s
                  const dx = W / 2 + (j.view.cx - view.cx) / view.s - (W / 2) * k
                  const dy = H / 2 - (j.view.cy - view.cy) / view.s - (H / 2) * k
                  const old = vals.slice()
                  for (let y = 0; y < H; y++) {
                    const oy = Math.floor((y - dy) / k)
                    for (let x = 0; x < W; x++) {
                      const ox = Math.floor((x - dx) / k)
                      vals[y * W + x] = ox >= 0 && ox < W && oy >= 0 && oy < H ? old[oy * W + ox] : UNKNOWN
                    }
                  }
                } else if (!j.key.startsWith(mode)) vals.fill(UNKNOWN)
                job.current = { view: { ...view }, key, pass: 0, row: 0, done: false }
              }

              const jb = job.current
              const busy = !jb.done
              if (!jb.done && jb.view) {
                const start = performance.now()
                const rv = jb.view
                const isJ = mode === 'julia'
                while (!jb.done && performance.now() - start < BUDGET) {
                  const y = jb.row
                  const step = jb.pass === 0 ? 4 : 1
                  const ci = rv.cy - (y + step / 2 - H / 2) * rv.s
                  for (let x = 0; x < W; x += step) {
                    if (step === 1 && x % 4 === 0 && y % 4 === 0) continue
                    const cr = rv.cx + (x + step / 2 - W / 2) * rv.s
                    const v = isJ ? julia(cr, ci, jc.re, jc.im, maxIter) : escapeTime(cr, ci, maxIter)
                    if (step === 1) vals[y * W + x] = v
                    else for (let yy = y; yy < Math.min(H, y + 4); yy++) vals.fill(v, yy * W + x, yy * W + x + 4)
                  }
                  jb.row += step
                  if (jb.row >= H) {
                    if (jb.pass === 0) {
                      jb.pass = 1
                      jb.row = 0
                    } else jb.done = true
                  }
                }
              }
              const offset = Math.floor(cycle.current)
              const look = `${offset}|${palette}|${jb.key}|${jb.view?.cx},${jb.view?.cy},${jb.view?.s}`
              if (busy || painted.current !== look) {
                painted.current = look
                paint(vals, main.data, offset)
                main.flush()
              }

              // Draw the picture, stretched to the live view while gliding or dragging.
              ctx.fillStyle = '#000'
              ctx.fillRect(0, 0, W, H)
              if (jb.view) {
                const k = jb.view.s / view.s
                ctx.imageSmoothingEnabled = k < 1
                ctx.drawImage(main.canvas, W / 2 + (jb.view.cx - view.cx) / view.s - (W / 2) * k, H / 2 - (jb.view.cy - view.cy) / view.s - (H / 2) * k, W * k, H * k)
                ctx.imageSmoothingEnabled = true
              }

              if (mode === 'mandel') {
                // Marker for c and the live Julia inset.
                const mx = W / 2 + (jc.re - view.cx) / view.s
                const my = H / 2 - (jc.im - view.cy) / view.s
                if (mx > -10 && mx < W + 10 && my > -10 && my < H + 10) {
                  circle(ctx, mx, my, 6, undefined, '#fff', 1.5)
                  line(ctx, mx - 11, my, mx - 5, my, '#fff', 1.5)
                  line(ctx, mx + 5, my, mx + 11, my, '#fff', 1.5)
                }
                const ik = `${jc.re},${jc.im},${maxIter}`
                const look = `${ik}|${offset}|${palette}`
                if (insetKey.current.split('|')[0] !== ik) {
                  const s = 3.4 / JW
                  const it = Math.min(maxIter, 200)
                  for (let y = 0; y < JH; y++) for (let x = 0; x < JW; x++) ivals[y * JW + x] = julia((x - JW / 2) * s, -(y - JH / 2) * s, jc.re, jc.im, it)
                }
                if (insetKey.current !== look) {
                  insetKey.current = look
                  paint(ivals, inset.data, offset)
                  inset.flush()
                }
                rrect(ctx, JX - 4, JY - 24, JW + 8, JH + 28, 6, 'rgba(0,0,0,0.75)', 'rgba(255,255,255,0.35)')
                ctx.drawImage(inset.canvas, JX, JY, JW, JH)
                text(ctx, `Julia set, c = ${complex(jc.re, jc.im, 3)}`, JX + 2, JY - 8, { color: '#fff', size: 12 })
              } else {
                rrect(ctx, 10, 10, 290, 28, 6, 'rgba(0,0,0,0.65)')
                text(ctx, `Julia set for c = ${complex(jc.re, jc.im)}`, 20, 29, { color: '#fff', size: 13 })
              }
              const progress = jb.done ? 1 : jb.pass === 0 ? jb.row / H / 5 : 0.2 + (0.8 * jb.row) / H
              if (progress < 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.75)'
                ctx.fillRect(0, H - 3, W * progress, 3)
              }
              if (f.frame % 8 === 0) setInfo({ cx: view.cx, cy: view.cy, zoom: (mode === 'mandel' ? HOME.s : JHOME.s) / view.s, progress })
            }}
          />
          <Readout
            items={[
              ['Centre (re)', info.cx.toFixed(clamp(Math.ceil(Math.log10(info.zoom)) + 3, 3, 15))],
              ['Centre (im)', info.cy.toFixed(clamp(Math.ceil(Math.log10(info.zoom)) + 3, 3, 15))],
              ['Zoom', `×${fmt(info.zoom, 1)}`],
              ['Iterations', maxIter],
              ['Rendered', `${Math.round(info.progress * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} resetLabel="Reset view">
        <button type="button" className="btn" onClick={() => zoomAt(0.4)}>
          Zoom in
        </button>
        <button type="button" className="btn" onClick={() => zoomAt(2.5)}>
          Zoom out
        </button>
      </PlayBar>
      <Choice label="Show" value={mode} options={[['mandel', 'Mandelbrot'], ['julia', 'Julia at marker']]} onChange={setMode} />
      <Slider label="Max iterations" value={maxIter} min={50} max={3000} step={50} onChange={setMaxIter} />
      <Choice label="Palette" value={palette} options={[['ember', 'Ember'], ['ocean', 'Ocean'], ['rainbow', 'Rainbow'], ['mono', 'Mono']]} onChange={setPalette} />
      <Hint>Scroll or use the buttons to zoom, drag to pan, and click to glide to a point. Hover over the Mandelbrot set to preview that point's Julia set: points inside give connected shapes, points outside give dust. Play cycles the colours; raise the iterations when deep zooms turn black.</Hint>
    </SimLayout>
  )
}
