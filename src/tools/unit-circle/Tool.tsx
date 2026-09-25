import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, text } from '../../sim/draw'
import { TAU, deg, fmt, rad } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { exactTrig, quadrant, snapToSpecial, specialAngleLabel, wrapDeg } from './trig'

const W = 800
const H = 440
const CX = 190
const CY = 220
const R = 150
const GX = 395
const K = (W - 25 - GX) / TAU
const SIN = PALETTE[0]
const COS = PALETTE[1]
const TAN = PALETTE[2]
const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

export default function UnitCircle() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [speed, setSpeed] = useState(30)
  const [snap, setSnap] = useState(true)
  const [showTan, setShowTan] = useState(true)
  const [angle, setAngle] = useState(30)
  const sim = useRef({ deg: 30, hold: 0 })
  const dragging = useRef(false)

  function onPointer(p: SimPointer) {
    if (p.type === 'down') dragging.current = p.x < GX - 20
    if (!dragging.current) return
    let d = wrapDeg(deg(Math.atan2(CY - p.y, p.x - CX)))
    if (snap) d = wrapDeg(snapToSpecial(d, 5))
    sim.current.deg = d
    sim.current.hold = 0
    setAngle(d)
    if (p.type === 'up') dragging.current = false
  }

  const a = wrapDeg(angle)
  const r = rad(a)
  const exact = exactTrig(Math.round(a * 1e6) / 1e6)
  const piLabel = specialAngleLabel(Math.round(a * 1e6) / 1e6)
  const tanV = Math.tan(r)
  const tanUndefined = Math.abs(Math.cos(r)) < 1e-9

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Unit circle at ${fmt(a, 1)} degrees: sine ${fmt(Math.sin(r), 3)}, cosine ${fmt(Math.cos(r), 3)}.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (f.dt > 0 && !dragging.current) {
                if (s.hold > 0) s.hold -= f.dt
                else {
                  const next = s.deg + speed * f.dt
                  // With snapping on, linger for a moment on every special angle.
                  const crossed = snap ? [...SPECIAL, 360].find((sp) => s.deg < sp && next >= sp) : undefined
                  if (crossed !== undefined) {
                    s.deg = crossed
                    s.hold = 0.7
                  } else s.deg = next
                  s.deg = wrapDeg(s.deg)
                }
              }
              const th = rad(s.deg)
              const c = Math.cos(th)
              const sn = Math.sin(th)
              const px = CX + c * R
              const py = CY - sn * R
              clear(ctx, W, H, theme.surface)

              // Circle, axes and the special angles.
              line(ctx, CX - R - 25, CY, CX + R + 25, CY, alpha(theme.text, 0.4))
              line(ctx, CX, CY - R - 25, CX, CY + R + 25, alpha(theme.text, 0.4))
              circle(ctx, CX, CY, R, undefined, alpha(theme.text, 0.7), 1.5)
              for (const sp of SPECIAL) {
                const t = rad(sp)
                circle(ctx, CX + Math.cos(t) * R, CY - Math.sin(t) * R, 2.5, alpha(theme.text, snap ? 0.45 : 0.2))
              }
              text(ctx, '1', CX + R + 6, CY + 16, { color: theme.muted, size: 12 })
              text(ctx, '−1', CX - R - 20, CY + 16, { color: theme.muted, size: 12 })
              text(ctx, '1', CX + 6, CY - R - 6, { color: theme.muted, size: 12 })

              // Angle arc with its label.
              ctx.beginPath()
              ctx.moveTo(CX, CY)
              ctx.arc(CX, CY, 34, 0, -th, true)
              ctx.closePath()
              ctx.fillStyle = alpha(theme.accent, 0.15)
              ctx.fill()
              ctx.beginPath()
              ctx.arc(CX, CY, 34, 0, -th, true)
              ctx.strokeStyle = theme.accent
              ctx.lineWidth = 2
              ctx.stroke()
              const mid = th / 2
              text(ctx, `${fmt(s.deg, 0)}°`, CX + Math.cos(mid) * 56, CY - Math.sin(mid) * 56 + 5, { color: theme.accent, size: 13, weight: 700, align: 'center' })

              // tan: the tangent line at (1, 0), met by the extended radius.
              if (showTan && Math.abs(c) > 1e-6) {
                const tv = sn / c
                const k = Math.min(1, 1.4 / Math.max(1e-9, Math.abs(tv)))
                const ty = CY - tv * R * k
                line(ctx, CX + R, CY - 1.4 * R, CX + R, CY + 1.4 * R, alpha(TAN, 0.25), 1)
                // The line through the centre and the point meets the tangent line at height tan θ.
                line(ctx, px, py, CX + R * k, ty, alpha(TAN, 0.5), 1, [4, 4])
                line(ctx, CX + R, CY, CX + R, ty, TAN, 4)
                text(ctx, 'tan', CX + R + 8, (CY + ty) / 2 + 4, { color: TAN, size: 13, weight: 700 })
              }

              // cos along x, sin straight up to the point.
              line(ctx, CX, CY, px, py, theme.text, 2)
              line(ctx, CX, CY, px, CY, COS, 4)
              line(ctx, px, CY, px, py, SIN, 4)
              text(ctx, 'cos', (CX + px) / 2, CY + (sn >= 0 ? 18 : -8), { color: COS, size: 13, weight: 700, align: 'center' })
              text(ctx, 'sin', px + (c >= 0 ? 8 : -8), (CY + py) / 2 + 4, { color: SIN, size: 13, weight: 700, align: c >= 0 ? 'left' : 'right' })
              circle(ctx, px, py, 8, theme.accent, theme.surface, 2.5)

              // The waves unrolling on the right, sharing the circle's vertical scale.
              const G = (t: number) => GX + t * K
              line(ctx, GX, CY, W - 15, CY, alpha(theme.text, 0.4))
              line(ctx, GX, CY - R - 10, GX, CY + R + 10, alpha(theme.text, 0.4))
              for (const v of [1, -1]) {
                line(ctx, GX, CY - v * R, W - 15, CY - v * R, alpha(theme.border, 0.9), 1, [3, 4])
                text(ctx, v > 0 ? '1' : '−1', GX - 6, CY - v * R + 4, { color: theme.muted, size: 12, align: 'right' })
              }
              ;['π/2', 'π', '3π/2', '2π'].forEach((l, i) => {
                const x = G(((i + 1) * Math.PI) / 2)
                line(ctx, x, CY - 4, x, CY + 4, alpha(theme.text, 0.5))
                text(ctx, l, x, CY + 18, { color: theme.muted, size: 12, align: 'center' })
              })
              const wave = (fn: (t: number) => number, color: string, to: number, width: number, dash?: number[]) => {
                ctx.beginPath()
                for (let t = 0; t <= to + 1e-9; t += 0.02) {
                  const x = G(Math.min(t, to))
                  const y = CY - fn(Math.min(t, to)) * R
                  if (t === 0) ctx.moveTo(x, y)
                  else ctx.lineTo(x, y)
                }
                ctx.lineTo(G(to), CY - fn(to) * R)
                ctx.strokeStyle = color
                ctx.lineWidth = width
                ctx.setLineDash(dash ?? [])
                ctx.stroke()
                ctx.setLineDash([])
              }
              wave(Math.sin, alpha(SIN, 0.25), TAU, 1.5, [4, 4])
              wave(Math.cos, alpha(COS, 0.25), TAU, 1.5, [4, 4])
              wave(Math.cos, COS, th, 2.5)
              wave(Math.sin, SIN, th, 2.5)
              const gx = G(th)
              line(ctx, gx, CY - R - 10, gx, CY + R + 10, alpha(theme.text, 0.25))
              line(ctx, px, py, gx, py, alpha(SIN, 0.6), 1.2, [5, 4])
              circle(ctx, gx, CY - c * R, 6, COS, theme.surface, 2)
              circle(ctx, gx, py, 7, SIN, theme.surface, 2)
              text(ctx, 'y = sin θ', W - 20, 26, { color: SIN, size: 13, weight: 700, align: 'right' })
              text(ctx, 'y = cos θ', W - 20, 44, { color: COS, size: 13, weight: 700, align: 'right' })

              if (f.frame % 6 === 0 && Math.abs(s.deg - angle) > 1e-9) setAngle(s.deg)
            }}
          />
          <Legend items={[[SIN, 'sin θ (height)'], [COS, 'cos θ (across)'], [TAN, 'tan θ (on the tangent line)']]} />
          <Readout
            items={[
              ['θ in degrees', `${fmt(a, 1)}°`],
              ['θ in radians', piLabel ? `${piLabel} ≈ ${fmt(r, 3)}` : fmt(r, 3)],
              ['sin θ', exact ? `${exact.sin}${exact.sin.length > 2 ? ` ≈ ${fmt(Math.sin(r), 3)}` : ''}` : fmt(Math.sin(r), 3)],
              ['cos θ', exact ? `${exact.cos}${exact.cos.length > 2 ? ` ≈ ${fmt(Math.cos(r), 3)}` : ''}` : fmt(Math.cos(r), 3)],
              ['tan θ', tanUndefined ? 'undefined' : exact ? exact.tan : fmt(tanV, 3)],
              ['Quadrant', quadrant(Math.round(a * 1e6) / 1e6)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { sim.current.deg = 0; sim.current.hold = 0; setAngle(0) }} resetLabel="θ = 0" />
      <Slider label="Turning speed" value={speed} min={5} max={120} step={5} unit="°/s" onChange={setSpeed} />
      <Toggle label="Snap to special angles" checked={snap} onChange={setSnap} />
      <Toggle label="Show tangent" checked={showTan} onChange={setShowTan} />
      <Slider label="Angle θ" value={Math.round(a)} min={0} max={359} unit="°" onChange={(v) => { sim.current.deg = v; sim.current.hold = 0; setAngle(v) }} />
      <Hint>Drag the point around the circle or press Play. The cosine is how far across the point is, the sine is how high it is, and both unroll into waves on the right. With snapping on, it pauses on the special angles and shows their exact values.</Hint>
    </SimLayout>
  )
}
