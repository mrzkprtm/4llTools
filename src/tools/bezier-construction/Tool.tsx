import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, round } from '../../sim/math'
import { PALETTE, alpha, hue, useTheme } from '../../sim/theme'
import { arcLength, bernstein, deCasteljau, sampleCurve, type Pt } from './bezier'

const W = 800
const H = 560
const TOP = 410 // curve area height; the Bernstein chart sits below
const MAX_PTS = 7
const START: Pt[] = [[120, 330], [230, 80], [560, 60], [680, 320]]

export default function BezierConstruction() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [points, setPoints] = useState<Pt[]>(START)
  const [tView, setTView] = useState(0)
  const [duration, setDuration] = useState(4)
  const [hull, setHull] = useState(true)
  const [inter, setInter] = useState(true)
  const [full, setFull] = useState(true)
  const tRef = useRef(0)
  const held = useRef<number | null>(null)
  const lastDown = useRef({ time: 0, i: -1 })
  const hover = useRef(-1)

  const n = points.length - 1
  const levels = deCasteljau(points, tView)
  const B = levels[n][0]

  function setT(t: number) {
    setRunning(false)
    tRef.current = t
    setTView(t)
  }
  function removePoint(i: number) {
    if (points.length <= 2) return
    setPoints(points.filter((_, k) => k !== i))
  }
  function addPoint() {
    if (points.length >= MAX_PTS) return
    // Put the new point a little beyond the last one, inside the stage.
    const [x, y] = points[points.length - 1]
    setPoints([...points, [clamp(x + 70 * (x > W / 2 ? -1 : 1), 20, W - 20), clamp(y + (y > TOP / 2 ? -110 : 110), 20, TOP - 20)]])
  }

  function onPointer(p: SimPointer) {
    const near = points.findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) < 16)
    if (p.type === 'move' && held.current === null) hover.current = near
    if (p.type === 'down') {
      const now = performance.now()
      if (near >= 0 && lastDown.current.i === near && now - lastDown.current.time < 350) {
        removePoint(near)
        lastDown.current = { time: 0, i: -1 }
        return
      }
      lastDown.current = { time: now, i: near }
      if (near >= 0) held.current = near
      else if (p.y < TOP && points.length < MAX_PTS) {
        setPoints([...points, [p.x, p.y]])
        held.current = points.length
      }
    }
    if (held.current !== null && p.down) {
      const i = held.current
      setPoints((ps) => ps.map((q, k) => (k === i ? [clamp(p.x, 10, W - 10), clamp(p.y, 10, TOP - 10)] : q)))
    }
    if (p.type === 'up') held.current = null
  }

  const colorOf = (level: number) => (level === 0 ? theme.muted : hue(level - 1, Math.max(1, n - 1), 50, 75))

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor={hover.current >= 0 ? 'grab' : 'crosshair'}
            label={`Degree ${n} Bézier curve built with de Casteljau's algorithm at t = ${round(tView, 2)}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                // Run 0 → 1, then hold briefly at the end before starting again.
                tRef.current += f.dt / duration
                if (tRef.current > 1.25) tRef.current = 0
                if (f.frame % 5 === 0) setTView(Math.min(1, tRef.current))
              }
              const t = Math.min(1, tRef.current)
              const lv = deCasteljau(points, t)
              clear(ctx, W, H, theme.sunken)
              ctx.fillStyle = theme.surface
              ctx.fillRect(0, TOP, W, H - TOP)
              line(ctx, 0, TOP, W, TOP, theme.border)

              const curve = sampleCurve(points, 160)
              if (full) {
                ctx.beginPath()
                curve.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                ctx.strokeStyle = alpha(theme.text, 0.18)
                ctx.lineWidth = 3
                ctx.stroke()
              }
              // The part traced so far.
              ctx.beginPath()
              const upto = Math.floor(t * 160)
              for (let k = 0; k <= upto; k++) ctx.lineTo(curve[k][0], curve[k][1])
              ctx.lineTo(lv[n][0][0], lv[n][0][1])
              ctx.strokeStyle = theme.accent
              ctx.lineWidth = 4
              ctx.lineCap = 'round'
              ctx.stroke()
              ctx.lineCap = 'butt'

              // Construction lines level by level.
              lv.forEach((pts, level) => {
                if (level === n) return
                if (level === 0 ? !hull : !inter) return
                const c = colorOf(level)
                ctx.beginPath()
                pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                ctx.strokeStyle = level === 0 ? alpha(c, 0.7) : c
                ctx.lineWidth = level === 0 ? 1.5 : 2
                ctx.setLineDash(level === 0 ? [6, 5] : [])
                ctx.stroke()
                ctx.setLineDash([])
                if (level > 0) pts.forEach(([x, y]) => circle(ctx, x, y, 4.5, c, theme.surface, 1.5))
              })
              // Control points.
              points.forEach(([x, y], i) => {
                const big = i === hover.current || i === held.current
                circle(ctx, x, y, big ? 11 : 9, PALETTE[i % PALETTE.length], theme.surface, 2.5)
                text(ctx, `P${i}`, x + 13, y - 10, { color: theme.text, size: 13, weight: 700 })
              })
              const [bx, by] = lv[n][0]
              circle(ctx, bx, by, 9, theme.accent, theme.surface, 3)
              text(ctx, `t = ${t.toFixed(2)}`, 12, 22, { color: theme.muted, size: 13 })

              // Bernstein basis: each weight bᵢ(t) over t, and the current weights as bars.
              const cx = 44
              const cy = TOP + 20
              const cw = 500
              const ch = H - TOP - 44
              line(ctx, cx, cy + ch, cx + cw, cy + ch, theme.border)
              line(ctx, cx, cy, cx, cy + ch, theme.border)
              text(ctx, '1', cx - 8, cy + 5, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, '0', cx - 8, cy + ch + 4, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, 't →', cx + cw, cy + ch + 18, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, 'Bernstein weights bᵢ(t)', cx + 8, cy - 6, { color: theme.muted, size: 12 })
              for (let i = 0; i <= n; i++) {
                ctx.beginPath()
                for (let k = 0; k <= 80; k++) ctx.lineTo(cx + (k / 80) * cw, cy + ch - bernstein(n, i, k / 80) * ch)
                ctx.strokeStyle = PALETTE[i % PALETTE.length]
                ctx.lineWidth = 2
                ctx.stroke()
                circle(ctx, cx + t * cw, cy + ch - bernstein(n, i, t) * ch, 4, PALETTE[i % PALETTE.length], theme.surface, 1.5)
              }
              line(ctx, cx + t * cw, cy, cx + t * cw, cy + ch, alpha(theme.text, 0.5), 1, [3, 3])
              const bx0 = 590
              const bw = (W - 20 - bx0) / (n + 1)
              for (let i = 0; i <= n; i++) {
                const v = bernstein(n, i, t)
                rrect(ctx, bx0 + i * bw + 3, cy + ch - v * ch, bw - 6, Math.max(1, v * ch), 3, PALETTE[i % PALETTE.length])
                text(ctx, `P${i}`, bx0 + i * bw + bw / 2, cy + ch + 16, { color: theme.text, size: 12, align: 'center' })
              }
              text(ctx, 'weight of each point now', bx0, cy - 6, { color: theme.muted, size: 12 })
            }}
          />
          <Readout
            items={[
              ['t', fmt(tView, 3)],
              ['Point B(t)', `(${Math.round(B[0])}, ${Math.round(TOP - B[1])})`],
              ['Degree', n],
              ['Construction levels', n],
              ['Curve length', `${Math.round(arcLength(points))} px`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { setPoints(START); setT(0) }}>
        <button type="button" className="btn" onClick={addPoint} disabled={points.length >= MAX_PTS}>
          Add point
        </button>
        <button type="button" className="btn" onClick={() => removePoint(points.length - 1)} disabled={points.length <= 2}>
          Remove last
        </button>
      </PlayBar>
      <Slider label="t" value={round(tView, 3)} min={0} max={1} step={0.005} onChange={setT} />
      <Slider label="Seconds per sweep" value={duration} min={1} max={12} step={0.5} unit=" s" onChange={setDuration} />
      <Toggle label="Show control polygon (hull)" checked={hull} onChange={setHull} />
      <Toggle label="Show intermediate lines" checked={inter} onChange={setInter} />
      <Toggle label="Show whole curve" checked={full} onChange={setFull} />
      <Hint>Drag the numbered points; click empty space to add one (up to degree 6) and double-click a point to remove it. At every t, each coloured level splits the segments above it in the ratio t : 1 − t until one point is left — that point draws the curve.</Hint>
    </SimLayout>
  )
}
