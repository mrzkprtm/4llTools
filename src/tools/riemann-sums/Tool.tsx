import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, niceStep, round } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { FUNCS, integrate, riemann, type Method } from './riemann'

const W = 800
const H = 500
const PL = 16
const PR = 548
const PT = 16
const PB = H - 16
const CX = 566 // error chart panel
const POSC = '#1c7ed6'
const NEGC = '#e8590c'
const METHODS: [Method, string][] = [['left', 'Left endpoint'], ['right', 'Right endpoint'], ['mid', 'Midpoint'], ['trap', 'Trapezoid'], ['simpson', 'Simpson']]
const MCOL: Record<Method, string> = { left: '#e03131', right: '#f59f00', mid: '#2f9e44', trap: '#1c7ed6', simpson: '#ae3ec9' }
const NS = Array.from({ length: 40 }, (_, i) => Math.max(1, Math.round(200 ** (i / 39))))

export default function RiemannSums() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [fid, setFid] = useState('sq')
  const [method, setMethod] = useState<Method>('left')
  const [n, setN] = useState(6)
  const [ab, setAb] = useState<[number, number]>([0, 2])
  const nDisp = useRef(6)
  const last = useRef(0)
  const sweep = useRef(0)
  const drag = useRef<0 | 1 | null>(null)

  const def = FUNCS.find((d) => d.id === fid)!
  const f = def.f
  const [a, b] = ab
  const [x0, x1] = def.view
  // Vertical range from the function over the view, always including the axis.
  const [y0, y1] = useMemo(() => {
    let lo = 0
    let hi = 0
    for (let i = 0; i <= 200; i++) {
      const v = f(x0 + ((x1 - x0) * i) / 200)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
    const pad = (hi - lo) * 0.08 || 1
    return [lo - pad, hi + pad]
  }, [fid])
  const X = (x: number) => PL + ((x - x0) / (x1 - x0)) * (PR - PL)
  const Y = (y: number) => PB - ((y - y0) / (y1 - y0)) * (PB - PT)

  const exact = useMemo(() => integrate(f, a, b), [fid, a, b])
  const sum = riemann(f, a, b, n, method)
  const errors = useMemo(() => {
    const out = {} as Record<Method, number[]>
    for (const [m] of METHODS) out[m] = NS.map((k) => Math.abs(riemann(f, a, b, k, m) - exact))
    return out
  }, [fid, a, b, exact])

  function pickFn(id: string) {
    const d = FUNCS.find((q) => q.id === id)!
    setFid(id)
    setAb(d.ab)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down' && p.x < PR + 10) {
      const da = Math.abs(p.x - X(a))
      const db = Math.abs(p.x - X(b))
      drag.current = Math.min(da, db) < 18 ? (da <= db ? 0 : 1) : null
    }
    if (drag.current === null) return
    const x = round(clamp(x0 + ((p.x - PL) / (PR - PL)) * (x1 - x0), Math.max(x0, def.min ?? -Infinity), x1), 2)
    setAb(drag.current === 0 ? [Math.min(x, b - 0.1), b] : [a, Math.max(x, a + 0.1)])
    if (p.type === 'up') drag.current = null
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="ew-resize"
            label={`${METHODS.find((m) => m[0] === method)![1]} sum of ${def.name} from ${a} to ${b} with ${n} strips: ${fmt(sum, 5)}; exact ${fmt(exact, 5)}.`}
            onFrame={(ctx, fr) => {
              // Sweep n upwards while playing.
              if (fr.dt > 0) {
                sweep.current += fr.dt
                if (sweep.current > (n >= 200 ? 2 : 0.3)) {
                  sweep.current = 0
                  setN(n >= 200 ? 1 : Math.min(200, Math.ceil(n * 1.08)))
                }
              }
              // n eases toward its new value in real time (also while paused), so strips morph.
              const now = performance.now()
              const rdt = Math.min(0.05, (now - (last.current || now)) / 1000)
              last.current = now
              nDisp.current += (n - nDisp.current) * Math.min(1, rdt * 9)
              if (Math.abs(n - nDisp.current) < 0.01) nDisp.current = n
              const nd = method === 'simpson' ? Math.max(2, nDisp.current + (n % 2)) : nDisp.current

              clear(ctx, W, H, theme.sunken)
              const sx = niceStep(x1 - x0, 8)
              for (let x = Math.ceil(x0 / sx) * sx; x <= x1 + 1e-9; x += sx) {
                line(ctx, X(x), PT, X(x), PB, alpha(theme.border, 0.6))
                text(ctx, fmt(x), X(x), clamp(Y(0) + 16, PT + 12, PB - 4), { color: theme.muted, size: 12, align: 'center' })
              }
              const sy = niceStep(y1 - y0, 7)
              for (let y = Math.ceil(y0 / sy) * sy; y <= y1; y += sy) {
                line(ctx, PL, Y(y), PR, Y(y), alpha(theme.border, 0.6))
                if (Math.abs(y) > 1e-9) text(ctx, fmt(y), clamp(X(0), PL, PR - 30) + 5, Y(y) - 4, { color: theme.muted, size: 12 })
              }

              // Approximation region as one path, filled blue above the axis and orange below.
              const w = (b - a) / nd
              const path = new Path2D()
              const edges: [number, number, number][] = []
              if (method === 'simpson') {
                for (let l = a; l < b - 1e-9; l += 2 * w) {
                  const f0 = f(l)
                  const f1 = f(l + w)
                  const f2 = f(l + 2 * w)
                  path.moveTo(X(l), Y(0))
                  for (let k = 0; k <= 16; k++) {
                    const u = (k / 16) * 2 // in strip widths
                    const v = f0 * ((u - 1) * (u - 2)) / 2 - f1 * u * (u - 2) + (f2 * u * (u - 1)) / 2
                    path.lineTo(X(l + u * w), Y(v))
                  }
                  path.lineTo(X(l + 2 * w), Y(0))
                  path.closePath()
                  edges.push([l, f0, 0], [l + w, f1, 1], [l + 2 * w, f2, 0])
                }
              } else
                for (let l = a; l < b - 1e-9; l += w) {
                  const r = l + w
                  const hl = method === 'left' ? f(l) : method === 'right' ? f(r) : method === 'mid' ? f(l + w / 2) : f(l)
                  const hr = method === 'trap' ? f(r) : hl
                  path.moveTo(X(l), Y(0))
                  path.lineTo(X(l), Y(hl))
                  path.lineTo(X(r), Y(hr))
                  path.lineTo(X(r), Y(0))
                  path.closePath()
                  const sxp = method === 'left' ? l : method === 'right' ? r : method === 'mid' ? l + w / 2 : l
                  edges.push([sxp, hl, 0])
                  if (method === 'trap') edges.push([r, hr, 0])
                }
              ctx.save()
              ctx.beginPath()
              ctx.rect(X(a), PT, X(b) - X(a), PB - PT)
              ctx.clip()
              for (const [top, bottom, c] of [[PT, Y(0), POSC], [Y(0), PB, NEGC]] as const) {
                ctx.save()
                ctx.beginPath()
                ctx.rect(0, top, W, bottom - top)
                ctx.clip()
                ctx.fillStyle = alpha(c, 0.3)
                ctx.fill(path)
                ctx.strokeStyle = alpha(c, 0.95)
                ctx.lineWidth = nd > 80 ? 0.6 : 1.2
                ctx.stroke(path)
                ctx.restore()
              }
              ctx.restore()

              // The function and the sample points.
              ctx.beginPath()
              for (let i = 0; i <= 300; i++) {
                const x = x0 + ((x1 - x0) * i) / 300
                ctx.lineTo(X(x), Y(f(x)))
              }
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 2.5
              ctx.stroke()
              if (nd <= 60) for (const [x, v] of edges) if (x <= b + 1e-9) circle(ctx, X(x), Y(v), 3.2, theme.text)
              line(ctx, PL, Y(0), PR, Y(0), theme.muted, 1.5)

              // Draggable endpoints.
              for (const [x, name] of [[a, 'a'], [b, 'b']] as const) {
                line(ctx, X(x), PT, X(x), PB, alpha(theme.accent, 0.8), 1.5, [5, 4])
                rrect(ctx, X(x) - 11, Y(0) - 11, 22, 22, 6, theme.accent, theme.surface, 2)
                text(ctx, name, X(x), Y(0) + 5, { color: '#fff', size: 13, align: 'center', weight: 700 })
              }
              text(ctx, `n = ${n}${method === 'simpson' && n % 2 ? ` → ${n + 1} (even)` : ''}`, PL + 8, PT + 16, { color: theme.text, size: 13, weight: 700 })

              // Error vs n on log–log axes: the slope shows each method's order.
              rrect(ctx, CX, PT, W - CX - 12, PB - PT, 8, theme.surface, theme.border)
              const gx = CX + 36
              const gw = W - CX - 60
              const gy = PT + 40
              const gh = 250
              const all = Object.values(errors).flat().filter((e) => e > 1e-15)
              const lo = all.length ? Math.log10(Math.min(...all)) : -15
              const hi = all.length ? Math.max(lo + 1, Math.log10(Math.max(...all))) : -14
              const LX = (k: number) => gx + (Math.log10(k) / Math.log10(200)) * gw
              const LY = (e: number) => gy + gh - ((Math.log10(Math.max(e, 1e-15)) - lo) / (hi - lo || 1)) * gh
              text(ctx, '|error| vs n (log–log)', CX + 12, PT + 22, { color: theme.muted, size: 12 })
              line(ctx, gx, gy + gh, gx + gw, gy + gh, theme.border)
              line(ctx, gx, gy, gx, gy + gh, theme.border)
              for (const k of [1, 10, 100]) text(ctx, String(k), LX(k), gy + gh + 16, { color: theme.muted, size: 12, align: 'center' })
              for (let e = Math.ceil(lo / 3) * 3; e <= hi; e += 3) text(ctx, `1e${e}`, gx - 4, LY(10 ** e) + 4, { color: theme.muted, size: 12, align: 'right' })
              for (const [m] of METHODS) {
                ctx.beginPath()
                NS.forEach((k, i) => ctx.lineTo(LX(k), LY(errors[m][i])))
                ctx.strokeStyle = m === method ? MCOL[m] : alpha(MCOL[m], 0.35)
                ctx.lineWidth = m === method ? 2.5 : 1.2
                ctx.stroke()
              }
              circle(ctx, LX(n), LY(Math.abs(sum - exact)), 5, MCOL[method], theme.surface, 2)
              METHODS.forEach(([m, name], i) => {
                const y = gy + gh + 40 + i * 20
                rrect(ctx, CX + 14, y - 9, 12, 10, 2, MCOL[m])
                text(ctx, name, CX + 32, y, { color: m === method ? theme.text : theme.muted, size: 12, weight: m === method ? 700 : 500 })
              })
            }}
          />
          <Legend items={[[POSC, 'area above the axis (+)'], [NEGC, 'area below the axis (−)']]} />
          <Readout
            items={[
              ['Approximation', fmt(sum, 6)],
              ['Exact integral', fmt(exact, 6)],
              ['Error', fmt(sum - exact, 4)],
              ['Relative error', exact !== 0 ? `${fmt((Math.abs(sum - exact) / Math.abs(exact)) * 100, 3)}%` : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { setN(1); sweep.current = 0 }} resetLabel="n = 1" />
      <Select label="Function f(x)" value={fid} options={FUNCS.map((d) => [d.id, d.name] as [string, string])} onChange={pickFn} />
      <Select label="Method" value={method} options={METHODS} onChange={setMethod} />
      <Slider label="Strips n" value={n} min={1} max={200} onChange={(v) => { setRunning(false); setN(v) }} />
      <Slider label="From a" value={a} min={Math.max(x0, def.min ?? -Infinity)} max={x1} step={0.05} onChange={(v) => setAb([Math.min(v, b - 0.1), b])} />
      <Slider label="To b" value={b} min={x0} max={x1} step={0.05} onChange={(v) => setAb([a, Math.max(v, a + 0.1)])} />
      <Hint>Drag the orange a and b handles to change the interval, and watch the strips morph as you change n. Play sweeps n up to 200: on the log–log chart, left/right sums shrink like 1/n, midpoint and trapezoid like 1/n², Simpson like 1/n⁴.</Hint>
    </SimLayout>
  )
}
