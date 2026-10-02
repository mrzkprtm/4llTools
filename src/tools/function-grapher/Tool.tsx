import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, text } from '../../sim/draw'
import { clamp, fmt, niceStep } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { tryCompile, type Vars } from './expr'

const W = 800
const H = 500
const COLORS = [PALETTE[0], PALETTE[1], PALETTE[2]]
const HOME = { cx: 0, cy: 0, scale: 50 }
const EXAMPLES = [
  ['', 'Load an example…'],
  ['wave', 'Travelling wave'],
  ['parabola', 'Parabola family'],
  ['packet', 'Wave packet'],
  ['beats', 'Beats'],
  ['tan', 'Tangent and friends'],
  ['steps', 'Floor and abs'],
] as const
type Example = (typeof EXAMPLES)[number][0]
const EXAMPLE_EXPRS: Record<Exclude<Example, ''>, [string, string, string]> = {
  wave: ['sin(x - t)', 'a*x^2 + b', 'e^(-x^2/8)*cos(3x + t)'],
  parabola: ['a*(x - b)^2', '-a*x^2 + 2', 'a*x^2 + b*x'],
  packet: ['e^(-(x - 2sin(t))^2)*cos(5x - 4t)', 'e^(-(x - 2sin(t))^2)', ''],
  beats: ['sin(5x - t)', 'sin(5.5x - 1.3t)', 'sin(5x - t) + sin(5.5x - 1.3t)'],
  tan: ['tan(x + t/2)', 'sin(x + t/2)', 'cos(x + t/2)'],
  steps: ['floor(x + t)', 'abs(x) - 2', 'sqrt(abs(x))*sin(t)'],
}

function ExprInput({ index, value, error, onChange }: { index: number; value: string; error: string | null; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="sim-field">
      <label htmlFor={id} className="sim-label">
        <span style={{ color: COLORS[index] }}>● f{['₁', '₂', '₃'][index]}(x) =</span>
        {error && <span className="sim-val" style={{ color: 'var(--danger)', whiteSpace: 'normal', textAlign: 'right' }}>{error}</span>}
      </label>
      <input
        id={id}
        type="text"
        className="sim-mono"
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder={index === 2 ? 'optional, e.g. cos(2x)' : ''}
        aria-invalid={!!error}
        style={error ? { borderColor: 'var(--danger)' } : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function FunctionGrapher() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [exprs, setExprs] = useState<[string, string, string]>(EXAMPLE_EXPRS.wave)
  const [a, setA] = useState(0.5)
  const [b, setB] = useState(-2)
  const [speed, setSpeed] = useState(1)
  const [hover, setHover] = useState<number | null>(null)
  const [tNow, setTNow] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const view = useRef({ ...HOME })
  const time = useRef(0)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  const compiled = useMemo(() => exprs.map((s) => (s.trim() ? tryCompile(s) : null)), [exprs])

  function zoom(factor: number, px = W / 2, py = H / 2) {
    const v = view.current
    const wx = v.cx + (px - W / 2) / v.scale
    const wy = v.cy - (py - H / 2) / v.scale
    v.scale = clamp(v.scale * factor, 0.5, 20000)
    v.cx = wx - (px - W / 2) / v.scale
    v.cy = wy + (py - H / 2) / v.scale
  }

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      zoom(Math.exp(-clamp(e.deltaY, -200, 200) * 0.003), ((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H)
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [])

  function onPointer(p: SimPointer) {
    const v = view.current
    if (p.type === 'down') drag.current = { x: p.x, y: p.y, cx: v.cx, cy: v.cy }
    const d = drag.current
    if (d && p.down) {
      v.cx = d.cx - (p.x - d.x) / v.scale
      v.cy = d.cy + (p.y - d.y) / v.scale
    }
    if (p.type === 'up') drag.current = null
    setHover(v.cx + (p.x - W / 2) / v.scale)
  }

  const setExpr = (i: number, s: string) => setExprs((old) => old.map((o, j) => (j === i ? s : o)) as [string, string, string])
  const vars = (x: number): Vars => ({ x, t: tNow, a, b })
  const hoverValues = compiled.map((c) => (c?.fn && hover !== null ? c.fn(vars(hover)) : null))

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            canvasRef={canvasRef}
            cursor="grab"
            onPointer={onPointer}
            label={`Graph of ${exprs.filter(Boolean).join(', ')} at t = ${fmt(tNow, 1)}.`}
            onFrame={(ctx, f) => {
              time.current += f.dt
              const t = time.current
              const { cx, cy, scale } = view.current
              const X = (x: number) => W / 2 + (x - cx) * scale
              const Y = (y: number) => H / 2 - (y - cy) * scale
              clear(ctx, W, H, theme.surface)

              // Grid with labels on the axes (or pinned to the edges when an axis is off-screen).
              const step = niceStep(W / scale, 10)
              const x0 = cx - W / 2 / scale
              const y0 = cy - H / 2 / scale
              const ax = clamp(X(0), 0, W)
              const ay = clamp(Y(0), 0, H)
              const digits = Math.max(0, -Math.floor(Math.log10(step)))
              ctx.beginPath()
              for (let gx = Math.ceil(x0 / step) * step; X(gx) <= W; gx += step) {
                ctx.moveTo(X(gx), 0)
                ctx.lineTo(X(gx), H)
              }
              for (let gy = Math.ceil(y0 / step) * step; Y(gy) >= 0; gy += step) {
                ctx.moveTo(0, Y(gy))
                ctx.lineTo(W, Y(gy))
              }
              ctx.strokeStyle = alpha(theme.border, 0.8)
              ctx.lineWidth = 1
              ctx.stroke()
              line(ctx, ax, 0, ax, H, alpha(theme.text, 0.55), 1.5)
              line(ctx, 0, ay, W, ay, alpha(theme.text, 0.55), 1.5)
              for (let gx = Math.ceil(x0 / step) * step; X(gx) <= W; gx += step) {
                if (Math.abs(gx) < step / 2) continue
                const below = ay > H - 20
                text(ctx, gx.toFixed(digits), X(gx), below ? ay - 6 : ay + 16, { color: theme.muted, size: 12, align: 'center' })
              }
              for (let gy = Math.ceil(y0 / step) * step; Y(gy) >= 0; gy += step) {
                if (Math.abs(gy) < step / 2) continue
                const right = ax < 40
                text(ctx, gy.toFixed(digits), right ? ax + 6 : ax - 6, Y(gy) + 4, { color: theme.muted, size: 12, align: right ? 'left' : 'right' })
              }

              // The curves, one sample per world pixel, broken at jumps (like tan's asymptotes).
              const v: Vars = { x: 0, t, a, b }
              compiled.forEach((c, i) => {
                if (!c?.fn) return
                ctx.beginPath()
                let prev = NaN
                for (let px = 0; px <= W; px += 1) {
                  v.x = cx + (px - W / 2) / scale
                  const py = Y(c.fn(v))
                  if (!Number.isFinite(py)) {
                    prev = NaN
                    continue
                  }
                  const yy = clamp(py, -2 * H, 3 * H)
                  if (!Number.isFinite(prev) || Math.abs(py - prev) > H * 1.2) ctx.moveTo(px, yy)
                  else ctx.lineTo(px, yy)
                  prev = py
                }
                ctx.strokeStyle = COLORS[i]
                ctx.lineWidth = 2.5
                ctx.lineJoin = 'round'
                ctx.stroke()
              })

              // Values under the pointer.
              if (hover !== null && !drag.current) {
                const hx = X(hover)
                line(ctx, hx, 0, hx, H, alpha(theme.text, 0.35), 1, [4, 4])
                v.x = hover
                compiled.forEach((c, i) => {
                  if (!c?.fn) return
                  const y = c.fn(v)
                  if (!Number.isFinite(y) || Y(y) < -10 || Y(y) > H + 10) return
                  circle(ctx, hx, Y(y), 5, COLORS[i], theme.surface, 2)
                  const right = hx < W - 120
                  text(ctx, fmt(y, 3), hx + (right ? 9 : -9), Y(y) - 8, { color: COLORS[i], size: 13, weight: 700, align: right ? 'left' : 'right' })
                })
              }
              text(ctx, `t = ${t.toFixed(2)}`, W - 12, 24, { color: theme.text, size: 14, weight: 700, align: 'right' })
              if (f.frame % 6 === 0) setTNow(t)
            }}
          />
          <Readout
            items={[
              ['t', fmt(tNow, 2)],
              ['Pointer x', hover === null ? '—' : fmt(hover, 3)],
              ...hoverValues.map((y, i) => [`f${['₁', '₂', '₃'][i]}(x)`, y === null ? '—' : fmt(y, 3)] as const),
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (time.current = 0)} resetLabel="t = 0" />
      {exprs.map((s, i) => (
        <ExprInput key={i} index={i} value={s} error={compiled[i]?.error ?? null} onChange={(v) => setExpr(i, v)} />
      ))}
      <Select<Example> label="Examples" value="" options={EXAMPLES} onChange={(e) => e && setExprs(EXAMPLE_EXPRS[e])} />
      <Slider label="a" value={a} min={-5} max={5} step={0.1} onChange={setA} />
      <Slider label="b" value={b} min={-5} max={5} step={0.1} onChange={setB} />
      <Slider label="Speed of t" value={speed} min={0} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => zoom(1.5)}>
          Zoom in
        </button>
        <button type="button" className="btn" onClick={() => zoom(1 / 1.5)}>
          Zoom out
        </button>
        <button type="button" className="btn" onClick={() => Object.assign(view.current, HOME)}>
          Home
        </button>
      </div>
      <Hint>Type expressions using x, t, a and b, such as sin(x − t) or a*x^2. Press Play to run time t, drag to pan, scroll to zoom and hover to read values. Functions: sin cos tan sqrt abs exp ln log floor, and the constants pi and e.</Hint>
    </SimLayout>
  )
}
