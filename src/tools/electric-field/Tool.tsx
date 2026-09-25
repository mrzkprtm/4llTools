import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, makeBuffer, text } from '../../sim/draw'
import { clamp, fmt, pushCap } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { fieldAt, potentialAt, traceLine, type Charge, type Line } from './field'

const W = 800
const H = 500
const RES = 5
const BW = W / RES
const BH = H / RES
const CR = 15
const POS = [224, 49, 49]
const NEG = [28, 110, 214]
// World units: 1 px = 1 cm and charges in nC, so E = 89 900·(q/r²) N/C and V = 899·(q/r) volts.
const E_UNIT = 89900
const V_UNIT = 899
const PUSH = 6e5

interface Probe {
  x: number
  y: number
  vx: number
  vy: number
  trail: number[]
  age: number
}

function rgb(hex: string): number[] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [236, 232, 222]
}

export default function ElectricField() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [showMap, setShowMap] = useState(true)
  const [showLines, setShowLines] = useState(true)
  const [showArrows, setShowArrows] = useState(false)
  const [selected, setSelected] = useState(0)
  const [, setTick] = useState(0)
  const [probeInfo, setProbeInfo] = useState<{ E: number; V: number } | null>(null)
  const charges = useRef<Charge[]>([
    { x: 300, y: 250, q: 2 },
    { x: 500, y: 250, q: -2 },
  ])
  const tests = useRef<Probe[]>([])
  const held = useRef(-1)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const cache = useRef<{ key: string; lines: Line[] }>({ key: '', lines: [] })
  const mapKey = useRef('')
  const contours = useRef<Path2D | null>(null)

  const refresh = () => setTick((t) => t + 1)

  function add(q: number) {
    charges.current.push({
      x: 200 + Math.random() * 400,
      y: 120 + Math.random() * 260,
      q,
    })
    setSelected(charges.current.length - 1)
  }

  function release(x = 60 + Math.random() * (W - 120), y = 40 + Math.random() * (H - 80)) {
    tests.current = [...tests.current.slice(-11), { x, y, vx: 0, vy: 0, trail: [], age: 0 }]
    if (!running) setRunning(true)
  }

  function onPointer(p: SimPointer) {
    pointer.current = { x: p.x, y: p.y }
    const cs = charges.current
    if (p.type === 'down') {
      held.current = cs.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < CR + 6)
      if (held.current >= 0) setSelected(held.current)
      else release(p.x, p.y)
    }
    if (held.current >= 0 && p.down) {
      cs[held.current].x = clamp(p.x, CR, W - CR)
      cs[held.current].y = clamp(p.y, CR, H - CR)
    }
    if (p.type === 'up') held.current = -1
  }

  const sel = charges.current[selected]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Electric field of ${charges.current.length} point charges.`}
            onFrame={(ctx, f) => {
              const cs = charges.current
              const neutral = rgb(theme.sunken)
              const ink = rgb(theme.text)
              clear(ctx, W, H, theme.sunken)
              const key = cs.map((c) => `${c.x | 0},${c.y | 0},${c.q}`).join(';')

              // Potential heatmap with equipotential contours, redrawn only when something changed.
              if (showMap && cs.length) {
                if (!buf.current) buf.current = makeBuffer(BW, BH)
                const b = buf.current
                if (mapKey.current !== key + theme.sunken) {
                  mapKey.current = key + theme.sunken
                  const vs = new Float32Array(BW * BH)
                  for (let j = 0; j < BH; j++)
                    for (let i = 0; i < BW; i++) vs[j * BW + i] = Math.tanh(potentialAt(cs, i * RES + RES / 2, j * RES + RES / 2) / 0.02)
                  for (let k = 0; k < BW * BH; k++) {
                    const v = vs[k]
                    const tgt = v > 0 ? POS : NEG
                    const a = Math.abs(v) ** 0.85 * 0.8
                    for (let c = 0; c < 3; c++) b.data[k * 4 + c] = neutral[c] + (tgt[c] - neutral[c]) * a
                    b.data[k * 4 + 3] = 255
                  }
                  b.flush()
                  contours.current = contourPath(vs, 9)
                }
                ctx.imageSmoothingEnabled = true
                ctx.drawImage(b.canvas, 0, 0, W, H)
                if (contours.current) {
                  ctx.strokeStyle = `rgba(${ink.join(',')}, 0.32)`
                  ctx.lineWidth = 1.2
                  ctx.stroke(contours.current)
                }
              }

              // Field lines, re-traced only when a charge moves.
              if (showLines) {
                if (key !== cache.current.key) {
                  const lines: Line[] = []
                  const pos = cs.some((c) => c.q > 0)
                  cs.forEach((c) => {
                    const n = Math.round(Math.abs(c.q) * 7)
                    const dir = c.q > 0 ? 1 : -1
                    if (dir < 0 && !pos) return traceFrom(c, n, -1, lines, cs, false)
                    if (dir > 0) traceFrom(c, n, 1, lines, cs, false)
                    // From negative charges keep only the lines that come in from far away.
                    else traceFrom(c, n, -1, lines, cs, true)
                  })
                  cache.current = { key, lines }
                }
                ctx.lineWidth = 1.4
                ctx.strokeStyle = alpha(theme.text, 0.6)
                for (const ln of cache.current.lines) {
                  const p = ln.points
                  ctx.beginPath()
                  ctx.moveTo(p[0], p[1])
                  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
                  ctx.stroke()
                  // One arrowhead part-way along, pointing along E.
                  const m = Math.min(p.length - 4, 2 * Math.floor(Math.min(p.length / 4, 24)))
                  if (m > 2) {
                    const [ax, ay, bx, by] = [p[m - 2], p[m - 1], p[m], p[m + 1]]
                    const [ex, ey] = fieldAt(cs, bx, by)
                    const s = Math.sign(ex * (bx - ax) + ey * (by - ay))
                    const cx = (ax + bx) / 2
                    const cy = (ay + by) / 2
                    const dl = Math.hypot(bx - ax, by - ay) || 1
                    arrow(ctx, cx - (s * (bx - ax) * 5) / dl, cy - (s * (by - ay) * 5) / dl, cx + (s * (bx - ax) * 5) / dl, cy + (s * (by - ay) * 5) / dl, alpha(theme.text, 0.75), 1.4, 9)
                  }
                }
              }

              // Optional arrow grid.
              if (showArrows)
                for (let y = 25; y < H; y += 40)
                  for (let x = 25; x < W; x += 40) {
                    const [ex, ey] = fieldAt(cs, x, y, 100)
                    const m = Math.hypot(ex, ey)
                    if (m < 1e-9) continue
                    const L = clamp(6 + Math.log10(m * 1e5) * 7, 4, 17)
                    arrow(ctx, x - (ex / m) * L * 0.5, y - (ey / m) * L * 0.5, x + (ex / m) * L * 0.5, y + (ey / m) * L * 0.5, alpha(theme.text, 0.55), 1.3, 6)
                  }

              // Test charges.
              const alive: Probe[] = []
              for (const t of tests.current) {
                let gone = false
                if (f.dt > 0) {
                  const n = 10
                  const h = f.dt / n
                  for (let i = 0; i < n && !gone; i++) {
                    const [ex, ey] = fieldAt(cs, t.x, t.y, 40)
                    t.vx += ex * PUSH * h
                    t.vy += ey * PUSH * h
                    const sp = Math.hypot(t.vx, t.vy)
                    if (sp > 900) ((t.vx *= 900 / sp), (t.vy *= 900 / sp))
                    t.x += t.vx * h
                    t.y += t.vy * h
                    if (cs.some((c) => c.q < 0 && Math.hypot(c.x - t.x, c.y - t.y) < CR - 2)) gone = true
                  }
                  t.age += f.dt
                  pushCap(t.trail, t.x, 600)
                  pushCap(t.trail, t.y, 600)
                }
                if (gone || t.age > 40 || t.x < -200 || t.x > W + 200 || t.y < -200 || t.y > H + 200) continue
                alive.push(t)
                ctx.beginPath()
                for (let i = 0; i < t.trail.length; i += 2) i ? ctx.lineTo(t.trail[i], t.trail[i + 1]) : ctx.moveTo(t.trail[i], t.trail[i + 1])
                ctx.strokeStyle = alpha('#f59f00', 0.8)
                ctx.lineWidth = 2
                ctx.stroke()
                circle(ctx, t.x, t.y, 6, '#f59f00', theme.surface, 2)
              }
              tests.current = alive

              // Charges.
              cs.forEach((c, i) => {
                const col = c.q > 0 ? '#e03131' : '#1c6ed6'
                const r = CR + Math.abs(c.q) * 1.2
                if (i === selected) circle(ctx, c.x, c.y, r + 6, undefined, alpha(theme.text, 0.6), 2)
                circle(ctx, c.x, c.y, r, col, '#fff', 2.5)
                text(ctx, c.q > 0 ? '+' : '−', c.x, c.y + 1, {
                  color: '#fff',
                  size: 20,
                  align: 'center',
                  baseline: 'middle',
                  weight: 700,
                })
              })
              if (!cs.length) text(ctx, 'Add a charge with the + q or − q buttons', W / 2, H / 2, { color: theme.muted, size: 15, align: 'center' })

              const p = pointer.current
              if (p) circle(ctx, p.x, p.y, 4, undefined, theme.text, 1.5)
              if (f.frame % 6 === 0) {
                if (p && cs.length) {
                  const [ex, ey] = fieldAt(cs, p.x, p.y)
                  setProbeInfo({
                    E: Math.hypot(ex, ey) * E_UNIT,
                    V: potentialAt(cs, p.x, p.y) * V_UNIT,
                  })
                } else setProbeInfo(null)
              }
            }}
          />
          <Readout
            items={[
              ['|E| at pointer', probeInfo ? `${fmt(probeInfo.E, 2)} N/C` : 'hover'],
              ['V at pointer', probeInfo ? `${fmt(probeInfo.V, 2)} V` : 'hover'],
              ['Charges', String(charges.current.length)],
              [
                'Net charge',
                `${fmt(
                  charges.current.reduce((s, c) => s + c.q, 0),
                  1,
                )} nC`,
              ],
            ]}
          />
        </>
      }
    >
      <PlayBar
        running={running}
        setRunning={setRunning}
        onReset={() => {
          charges.current = []
          tests.current = []
          setSelected(0)
          refresh()
        }}
        resetLabel="Clear"
      />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => add(2)}>
          Add +q
        </button>
        <button type="button" className="btn" onClick={() => add(-2)}>
          Add −q
        </button>
        <button type="button" className="btn" onClick={() => release()}>
          Release test charge
        </button>
      </div>
      {sel && (
        <Slider
          label="Selected charge"
          value={sel.q}
          min={-5}
          max={5}
          step={0.5}
          unit=" nC"
          onChange={(v) => {
            sel.q = v === 0 ? (sel.q > 0 ? 0.5 : -0.5) : v
            refresh()
          }}
        />
      )}
      <Toggle label="Potential map and equipotentials" checked={showMap} onChange={setShowMap} />
      <Toggle label="Field lines" checked={showLines} onChange={setShowLines} />
      <Toggle label="Field arrows" checked={showArrows} onChange={setShowArrows} />
      <Hint>
        Drag the charges around; tap an empty spot to drop a small positive test charge and watch it follow the field. Field lines leave + charges and end on − charges, always crossing the
        equipotential rings at right angles.
      </Hint>
    </SimLayout>
  )
}

function traceFrom(c: Charge, n: number, dir: number, out: Line[], cs: Charge[], onlyOpen: boolean) {
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2
    const ln = traceLine(cs, c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6, {
      dir,
      step: 4,
      maxSteps: 450,
      stopRadius: 7,
      bounds: [-40, -40, W + 40, H + 40],
    })
    if (!onlyOpen || ln.end !== 'charge') out.push(ln)
  }
}

/** Equipotential lines by marching squares over the cell-centre grid, at every 1/levels step of the value. */
function contourPath(vs: Float32Array, levels: number): Path2D {
  const path = new Path2D()
  const px = (i: number) => i * RES + RES / 2
  for (let j = 0; j < BH - 1; j++)
    for (let i = 0; i < BW - 1; i++) {
      const k = j * BW + i
      const c = [vs[k] * levels, vs[k + 1] * levels, vs[k + BW + 1] * levels, vs[k + BW] * levels]
      const lo = Math.min(c[0], c[1], c[2], c[3])
      const hi = Math.max(c[0], c[1], c[2], c[3])
      for (let L = Math.ceil(lo); L <= hi; L++) {
        if (L === lo) continue
        const corners: [number, number][] = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
        const pts: number[] = []
        for (let e = 0; e < 4; e++) {
          const a = c[e] - L
          const b = c[(e + 1) % 4] - L
          if ((a < 0) !== (b < 0)) {
            const t = a / (a - b)
            const [x0, y0] = corners[e]
            const [x1, y1] = corners[(e + 1) % 4]
            pts.push(px(x0 + (x1 - x0) * t), px(y0 + (y1 - y0) * t))
          }
        }
        for (let q = 0; q + 3 < pts.length; q += 4) {
          path.moveTo(pts[q], pts[q + 1])
          path.lineTo(pts[q + 2], pts[q + 3])
        }
      }
    }
  return path
}
