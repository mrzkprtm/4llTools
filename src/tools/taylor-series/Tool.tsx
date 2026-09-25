import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, niceStep, round } from '../../sim/math'
import { alpha, hue, useTheme } from '../../sim/theme'
import { evalF, FUNCTIONS, polyString, radius, taylorCoeffs, taylorEval, type FnId } from './taylor'

const W = 800
const H = 500
const MAX_TERMS = 20
const colorOf = (k: number, a = 1) => hue(k, 12, 50, 80, a)

export default function TaylorSeries() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [fn, setFn] = useState<FnId>('sin')
  const [a, setA] = useState(0)
  const [terms, setTerms] = useState(1)
  const [probe, setProbe] = useState(2.5)
  const [pace, setPace] = useState(1)
  const timer = useRef(0)
  const drag = useRef<'a' | 'x' | null>(null)

  const def = FUNCTIONS.find((f) => f.id === fn)!
  const [x0, x1, y0, y1] = def.view
  const X = (x: number) => ((x - x0) / (x1 - x0)) * W
  const Y = (y: number) => H - ((y - y0) / (y1 - y0)) * H
  const coeffs = taylorCoeffs(fn, a, MAX_TERMS)
  const R = radius(fn, a)
  const fx = evalF(fn, probe)
  const px = taylorEval(coeffs.slice(0, terms), a, probe)

  function pick(id: FnId) {
    const d = FUNCTIONS.find((f) => f.id === id)!
    setFn(id)
    setA(clamp(0, d.aRange[0], d.aRange[1]))
    setProbe(round(d.view[0] + (d.view[1] - d.view[0]) * 0.75, 1))
    setTerms(1)
    timer.current = 0
  }

  function onPointer(p: SimPointer) {
    const x = x0 + (p.x / W) * (x1 - x0)
    if (p.type === 'down') {
      if (Math.abs(p.x - X(a)) < 16 && Math.abs(p.y - Y(0)) < 40) drag.current = 'a'
      else drag.current = 'x'
    }
    if (drag.current === 'a') setA(round(clamp(x, def.aRange[0], def.aRange[1]), 2))
    if (drag.current === 'x') setProbe(round(clamp(x, x0, x1), 2))
    if (p.type === 'up') drag.current = null
  }

  /** Draws y = g(x) across the view, lifting the pen where the curve leaves the picture or is undefined. */
  function plot(ctx: CanvasRenderingContext2D, g: (x: number) => number, color: string, width: number) {
    ctx.beginPath()
    let pen = false
    for (let i = 0; i <= 400; i++) {
      const x = x0 + ((x1 - x0) * i) / 400
      const y = g(x)
      const sy = Y(y)
      if (!Number.isFinite(y) || sy < -H || sy > 2 * H) {
        pen = false
        continue
      }
      if (pen) ctx.lineTo(X(x), sy)
      else ctx.moveTo(X(x), sy)
      pen = true
    }
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Taylor polynomial of ${def.name} around a = ${a} with ${terms} terms.`}
            onFrame={(ctx, f) => {
              let morph = 1
              if (f.dt > 0) {
                timer.current += f.dt * pace
                const hold = terms >= MAX_TERMS ? 2.5 : 0.9
                if (timer.current > hold) {
                  timer.current = 0
                  setTerms(terms >= MAX_TERMS ? 1 : terms + 1)
                }
                morph = Math.min(1, timer.current / 0.4)
                morph = morph * morph * (3 - 2 * morph)
              }
              clear(ctx, W, H, theme.sunken)
              // Radius of convergence.
              if (Number.isFinite(R)) {
                ctx.fillStyle = alpha(theme.ok, 0.1)
                ctx.fillRect(X(a - R), 0, X(a + R) - X(a - R), H)
                line(ctx, X(a - R), 0, X(a - R), H, alpha(theme.ok, 0.6), 1.5, [6, 5])
                line(ctx, X(a + R), 0, X(a + R), H, alpha(theme.ok, 0.6), 1.5, [6, 5])
              }
              // Axes and ticks.
              const sx = niceStep(x1 - x0, 10)
              const syS = niceStep(y1 - y0, 8)
              for (let x = Math.ceil(x0 / sx) * sx; x <= x1; x += sx) {
                line(ctx, X(x), 0, X(x), H, alpha(theme.border, 0.6))
                if (Math.abs(x) > 1e-9 && X(x) > 14 && X(x) < W - 14) text(ctx, fmt(x), X(x), Y(0) + 16, { color: theme.muted, size: 12, align: 'center' })
              }
              for (let y = Math.ceil(y0 / syS) * syS; y <= y1; y += syS) {
                line(ctx, 0, Y(y), W, Y(y), alpha(theme.border, 0.6))
                if (Math.abs(y) > 1e-9) text(ctx, fmt(y), X(0) + 6, Y(y) - 4, { color: theme.muted, size: 12 })
              }
              line(ctx, 0, Y(0), W, Y(0), theme.muted, 1.5)
              line(ctx, X(0), 0, X(0), H, theme.muted, 1.5)

              // Earlier polynomials, faintly, then the function, then the newest polynomial.
              for (let k = 1; k < terms; k++) plot(ctx, (x) => taylorEval(coeffs.slice(0, k), a, x), colorOf(k - 1, 0.28), 1.5)
              plot(ctx, (x) => evalF(fn, x), theme.text, 3.5)
              const prev = coeffs.slice(0, Math.max(0, terms - 1))
              const cur = coeffs.slice(0, terms)
              plot(ctx, (x) => {
                const p1 = taylorEval(cur, a, x)
                return morph < 1 ? taylorEval(prev, a, x) + (p1 - taylorEval(prev, a, x)) * morph : p1
              }, colorOf(terms - 1), 3)

              // Error at the probe x.
              const fv = evalF(fn, probe)
              const pv = taylorEval(cur, a, probe)
              line(ctx, X(probe), 0, X(probe), H, alpha(theme.text, 0.35), 1, [3, 4])
              if (Number.isFinite(fv)) {
                const ya = clamp(Y(fv), -10, H + 10)
                const yb = clamp(Y(pv), -10, H + 10)
                line(ctx, X(probe), ya, X(probe), yb, theme.danger, 3)
                circle(ctx, X(probe), ya, 5, theme.text)
                circle(ctx, X(probe), yb, 5, colorOf(terms - 1), theme.surface, 1.5)
              }
              text(ctx, 'x', X(probe) + 6, 18, { color: theme.text, size: 13, weight: 700 })

              // The expansion point, draggable along the axis.
              line(ctx, X(a), Y(0), X(a), Y(evalF(fn, a)), alpha(theme.accent, 0.6), 1.5, [2, 3])
              circle(ctx, X(a), Y(evalF(fn, a)), 5, theme.accent)
              rrect(ctx, X(a) - 11, Y(0) - 11, 22, 22, 6, theme.accent, theme.surface, 2)
              text(ctx, 'a', X(a), Y(0) + 5, { color: '#fff', size: 13, align: 'center', weight: 700 })

              rrect(ctx, 10, 10, 250, 50, 8, alpha(theme.surface, 0.92), theme.border)
              text(ctx, terms ? `${terms} term${terms === 1 ? '' : 's'} · degree ${terms - 1}` : '0 terms · P(x) = 0', 20, 30, { color: colorOf(terms - 1), size: 13, weight: 700 })
              text(ctx, Number.isFinite(R) ? `radius of convergence ${fmt(R, 3)}` : 'converges for every x', 20, 50, { color: theme.ok, size: 12 })
            }}
          />
          <p className="sim-mono" style={{ margin: 0 }}>
            P(x) = {polyString(coeffs.slice(0, terms), a)}
          </p>
          <Readout
            items={[
              ['Degree', terms ? terms - 1 : '—'],
              [`f(${fmt(probe)})`, fmt(fx, 6)],
              [`P(${fmt(probe)})`, fmt(px, 6)],
              ['Error |f − P|', Number.isFinite(fx) ? fmt(Math.abs(fx - px), 4) : '—'],
              ['Radius R', Number.isFinite(R) ? fmt(R, 3) : '∞'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { setTerms(1); timer.current = 0 }} resetLabel="Restart" />
      <Select label="Function f(x)" value={fn} options={FUNCTIONS.map((f) => [f.id, f.name] as [FnId, string])} onChange={pick} />
      <Slider label="Terms" value={terms} min={0} max={MAX_TERMS} onChange={(v) => { setRunning(false); setTerms(v) }} />
      <Slider label="Expansion point a" value={a} min={def.aRange[0]} max={def.aRange[1]} step={0.05} onChange={setA} />
      <Slider label="Error measured at x" value={probe} min={x0} max={x1} step={0.05} onChange={setProbe} />
      <Slider label="Animation pace" value={pace} min={0.25} max={3} step={0.25} unit="×" onChange={setPace} />
      <Hint>Play adds one term at a time; older polynomials stay faintly behind. Drag the orange “a” along the axis to move the centre, and click anywhere to measure the error there. Outside the green band the series cannot converge, however many terms you add.</Hint>
    </SimLayout>
  )
}
