import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { isMirror, principalRays, signedFocal, thinLens, type Optic } from './optics'

const W = 800
const H = 440
const AY = 220
const PX = 5 // pixels per centimetre
const LH = 175
const SPEED = 170
const GAP = 70
const OPTICS = [['converging', 'Convex lens'], ['diverging', 'Concave lens'], ['concave', 'Concave mirror'], ['convex', 'Convex mirror']] as const
const RAY_COLORS = [PALETTE[0], PALETTE[1], PALETTE[2]]

type Pt = [number, number]

function polyLength(pts: Pt[]) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return L
}

function pointAt(pts: Pt[], s: number): Pt | null {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (s <= seg) {
      const k = seg ? s / seg : 0
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]
    }
    s -= seg
  }
  return null
}

export default function LensRayTracer() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [optic, setOptic] = useState<Optic>('converging')
  const [focal, setFocal] = useState(15)
  const [dObj, setDObj] = useState(40)
  const [hObj, setHObj] = useState(10)
  const dragging = useRef(false)

  const mirror = isMirror(optic)
  const xO = mirror ? 580 : 430
  const f = signedFocal(optic, focal)
  const img = thinLens(f, dObj)
  const rays = principalRays(f, dObj, hObj)

  function onPointer(p: SimPointer) {
    if (p.type === 'down') dragging.current = p.x < xO - 8
    if (!dragging.current) return
    setDObj(Math.round(clamp((xO - p.x) / PX, 2, (xO - 16) / PX) * 2) / 2)
    const h = Math.round(clamp((AY - p.y) / PX, -32, 32) * 2) / 2
    setHObj(Math.abs(h) < 1 ? (h < 0 ? -1 : 1) : h)
    if (p.type === 'up') dragging.current = false
  }

  const real = !img.atInfinity && img.di > 0
  const upright = img.m > 0

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            className="sim-flat"
            label={`${OPTICS.find((o) => o[0] === optic)?.[1]} with focal length ${focal} centimetres and an object ${dObj} centimetres away.`}
            onFrame={(ctx, fr) => {
              const S = (u: number, y: number): Pt => [xO + u * PX, AY - y * PX]
              // Outgoing rays are mirrored back to the left for a mirror.
              const O = (u: number, y: number): Pt => [mirror ? xO - u * PX : xO + u * PX, AY - y * PX]
              clear(ctx, W, H, theme.surface)

              // Axis and focal points.
              line(ctx, 0, AY, W, AY, alpha(theme.text, 0.35), 1.5)
              const marks: [number, string][] = mirror
                ? [[-f, 'F'], [-2 * f, 'C']]
                : [[-Math.abs(f), 'F'], [Math.abs(f), 'F'], [-2 * Math.abs(f), '2F'], [2 * Math.abs(f), '2F']]
              for (const [u, name] of marks) {
                const x = xO + u * PX
                circle(ctx, x, AY, 4, theme.text)
                text(ctx, name, x, AY + 20, { color: theme.muted, size: 13, align: 'center', weight: 700 })
              }

              // The optic itself.
              ctx.beginPath()
              if (!mirror) {
                const bulge = optic === 'converging' ? 14 : -10
                const edge = optic === 'converging' ? 2 : 13
                ctx.moveTo(xO - edge, AY - LH)
                ctx.quadraticCurveTo(xO - edge - bulge * 2, AY, xO - edge, AY + LH)
                ctx.lineTo(xO + edge, AY + LH)
                ctx.quadraticCurveTo(xO + edge + bulge * 2, AY, xO + edge, AY - LH)
                ctx.closePath()
                ctx.fillStyle = alpha(PALETTE[1], 0.14)
                ctx.fill()
                ctx.strokeStyle = alpha(PALETTE[1], 0.7)
                ctx.lineWidth = 2
                ctx.stroke()
              } else {
                const sag = optic === 'concave' ? -14 : 14
                ctx.moveTo(xO + sag, AY - LH)
                ctx.quadraticCurveTo(xO - sag, AY, xO + sag, AY + LH)
                ctx.strokeStyle = theme.text
                ctx.lineWidth = 4
                ctx.stroke()
                for (let y = -LH + 12; y < LH; y += 16) {
                  const sx = xO + sag * (y / LH) ** 2 + 3
                  line(ctx, sx, AY + y, sx + 10, AY + y - 8, alpha(theme.text, 0.35), 1.2)
                }
              }
              line(ctx, xO, AY - LH, xO, AY + LH, alpha(theme.text, 0.15), 1, [3, 5])

              // Rays: incoming to the optic, then outgoing to the edge of the stage.
              const paths: Pt[][] = []
              rays.forEach((r, i) => {
                const color = RAY_COLORS[i]
                const reach = (mirror ? xO : W - xO) / PX
                const start = S(-dObj, hObj)
                const hit = S(0, r.yl)
                const end = O(reach, r.yl + r.slopeOut * reach)
                paths.push([start, hit, end])
                line(ctx, ...start, ...hit, color, 2)
                line(ctx, ...hit, ...end, color, 2)
                // Construction lines: the focal ray aimed at (or coming from) a focal point.
                if (r.name === 'focal') {
                  if (f > 0 && dObj < f) line(ctx, ...S(-f, 0), ...start, alpha(color, 0.6), 1.5, [5, 5])
                  if (f < 0) line(ctx, ...hit, ...S(-f, r.yl + r.slopeIn * -f), alpha(color, 0.6), 1.5, [5, 5])
                }
                // Virtual image: extend the outgoing rays backwards.
                if (!img.atInfinity && img.di < 0) {
                  const back = Math.min(img.di, f < 0 && r.name === 'parallel' ? f : img.di)
                  line(ctx, ...hit, ...O(back, r.yl + r.slopeOut * back), alpha(color, 0.6), 1.5, [5, 5])
                }
              })

              // Light pulses.
              const t = fr.t
              paths.forEach((pts, i) => {
                const L = polyLength(pts)
                for (let s = (t * SPEED) % GAP; s < L; s += GAP) {
                  const p = pointAt(pts, s)
                  if (!p) continue
                  circle(ctx, p[0], p[1], 5, alpha(RAY_COLORS[i], 0.25))
                  circle(ctx, p[0], p[1], 2.5, RAY_COLORS[i])
                }
              })

              // Object and image arrows.
              const [ox, oy] = S(-dObj, hObj)
              arrow(ctx, ox, AY, ox, oy, theme.text, 4, 14)
              circle(ctx, ox, oy, 7, undefined, alpha(theme.text, 0.35), 2)
              text(ctx, 'object', ox, hObj > 0 ? oy - 14 : oy + 24, { color: theme.text, size: 12, align: 'center' })
              if (img.atInfinity) {
                text(ctx, 'rays leave parallel: image at infinity', W / 2, 26, { color: theme.danger, size: 14, align: 'center', weight: 700 })
              } else {
                const [ix, iy] = O(img.di, img.m * hObj)
                const color = PALETTE[3]
                if (real) arrow(ctx, ix, AY, ix, iy, color, 4, 14)
                else {
                  line(ctx, ix, AY, ix, iy, alpha(color, 0.8), 3, [6, 4])
                  arrow(ctx, ix, iy + Math.sign(img.m * hObj) * Math.min(12, Math.abs(AY - iy)), ix, iy, alpha(color, 0.8), 3, 14)
                }
                if (ix > -20 && ix < W + 20) {
                  const lx = clamp(ix, 50, W - 50)
                  const ly = clamp(img.m * hObj > 0 ? iy - 14 : iy + 24, 16, H - 8)
                  text(ctx, real ? 'real image' : 'virtual image', lx, ly, { color, size: 12, align: 'center', weight: 700 })
                } else text(ctx, `image off-screen (${fmt(img.di, 0)} cm)`, W / 2, 26, { color, size: 13, align: 'center', weight: 700 })
              }
            }}
          />
          <Readout
            items={[
              ['Object distance', `${fmt(dObj, 1)} cm`],
              ['Image distance', img.atInfinity ? '∞' : `${fmt(img.di, 1)} cm`],
              ['Magnification', img.atInfinity ? '∞' : `${fmt(img.m, 2)}×`],
              ['Image', img.atInfinity ? 'none' : real ? 'Real' : 'Virtual'],
              ['Orientation', img.atInfinity ? '—' : upright ? 'Upright' : 'Inverted'],
            ]}
          />
          <Legend items={[[RAY_COLORS[0], 'parallel ray'], [RAY_COLORS[1], mirror ? 'ray to the vertex' : 'ray through the centre'], [RAY_COLORS[2], 'focal ray'], [PALETTE[3], 'image']]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} />
      <Choice label="Optic" value={optic} options={OPTICS} onChange={setOptic} />
      <Slider label="Focal length" value={focal} min={6} max={30} step={0.5} unit=" cm" onChange={setFocal} />
      <Slider label="Object distance" value={dObj} min={2} max={Math.floor((xO - 16) / PX)} step={0.5} unit=" cm" onChange={setDObj} />
      <Slider label="Object height" value={hObj} min={-30} max={30} step={0.5} unit=" cm" onChange={(v) => setHObj(v === 0 ? 1 : v)} />
      <Hint>
        Drag the black object arrow. Where the three principal rays cross is the image; if they only spread apart, trace them backwards (dashed) to find a virtual image.
        Put the object exactly at F and the rays come out parallel.
      </Hint>
    </SimLayout>
  )
}
