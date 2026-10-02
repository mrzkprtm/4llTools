import { useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, deg, fmt, rad } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { brewsterAngle, criticalAngle, fresnelReflectance, refractAngle } from './snell'

const W = 800
const H = 480
const OX = 400
const OY = 240
const R = 330
const LASER = '#e03131'
const MEDIA = [['air', 'Air (1.00)'], ['water', 'Water (1.33)'], ['glass', 'Glass (1.50)'], ['diamond', 'Diamond (2.42)'], ['custom', 'Custom']] as const
type Medium = (typeof MEDIA)[number][0]
const N: Record<Exclude<Medium, 'custom'>, number> = { air: 1, water: 1.33, glass: 1.5, diamond: 2.42 }
const NAMES: Record<Medium, string> = { air: 'Air', water: 'Water', glass: 'Glass', diamond: 'Diamond', custom: 'Custom' }

type Pt = [number, number]

/** Short arc from angle a0 to a1 around (x, y). */
function arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a0: number, a1: number, color: string) {
  let d = a1 - a0
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  ctx.beginPath()
  ctx.arc(x, y, r, a0, a0 + d, d < 0)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  return a0 + d / 2
}

export default function SnellsLaw() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [top, setTop] = useState<Medium>('air')
  const [bottom, setBottom] = useState<Medium>('glass')
  const [nTopCustom, setNTopCustom] = useState(1.2)
  const [nBotCustom, setNBotCustom] = useState(1.8)
  const [theta, setTheta] = useState(40)
  const [flip, setFlip] = useState(false)

  const nTop = top === 'custom' ? nTopCustom : N[top]
  const nBot = bottom === 'custom' ? nBotCustom : N[bottom]
  const n1 = flip ? nBot : nTop
  const n2 = flip ? nTop : nBot
  const th1 = rad(theta)
  const th2 = refractAngle(n1, n2, th1)
  const Rf = fresnelReflectance(n1, n2, th1)
  const crit = criticalAngle(n1, n2)

  function onPointer(p: SimPointer) {
    if (!p.down) return
    const below = p.y > OY
    if (below !== flip) setFlip(below)
    const a = Math.atan2(OX - p.x, Math.abs(p.y - OY))
    setTheta(Math.round(clamp(deg(a), -89, 89)))
  }

  // Screen geometry: s = −1 when the laser is in the top medium.
  const s = flip ? 1 : -1
  const laser: Pt = [OX - R * Math.sin(th1), OY + s * R * Math.cos(th1)]
  const refl: Pt = [OX + R * Math.sin(th1), OY + s * R * Math.cos(th1)]
  const refr: Pt | null = th2 === null ? null : [OX + R * Math.sin(th2), OY - s * R * Math.cos(th2)]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Laser crossing from a medium with index ${n1} into one with index ${n2} at ${Math.abs(theta)} degrees.`}
            onFrame={(ctx, f) => {
              clear(ctx, W, H, theme.surface)
              // Media, tinted by refractive index.
              const tint = (n: number) => alpha('#1c7ed6', clamp(0.03 + (n - 1) * 0.13, 0.02, 0.4))
              ctx.fillStyle = tint(nTop)
              ctx.fillRect(0, 0, W, OY)
              ctx.fillStyle = tint(nBot)
              ctx.fillRect(0, OY, W, H - OY)
              line(ctx, 0, OY, W, OY, alpha(theme.text, 0.5), 1.5)
              text(ctx, `${NAMES[top]}  n = ${nTop.toFixed(2)}`, 14, 24, { color: theme.text, size: 14, weight: 700 })
              text(ctx, `${NAMES[bottom]}  n = ${nBot.toFixed(2)}`, 14, H - 14, { color: theme.text, size: 14, weight: 700 })
              line(ctx, OX, 20, OX, H - 20, alpha(theme.text, 0.45), 1.2, [6, 6])
              text(ctx, 'normal', OX + 6, 34, { color: theme.muted, size: 12 })

              // Beams, brightness ∝ how much light each carries.
              const beam = (a: Pt, b: Pt, k: number) => {
                if (k <= 0.001) return
                line(ctx, ...a, ...b, alpha(LASER, 0.18 * k), 10)
                line(ctx, ...a, ...b, alpha(LASER, clamp(k, 0.05, 1)), 3)
              }
              beam(laser, [OX, OY], 1)
              beam([OX, OY], refl, Rf)
              if (refr) beam([OX, OY], refr, 1 - Rf)

              // Photons: each medium slows them by its index.
              const v0 = 240
              const v1 = v0 / n1
              const v2 = v0 / n2
              const T1 = R / v1
              const T = T1 + Math.max(R / v1, R / v2)
              const period = 0.16
              for (let k = 0; k * period < T; k++) {
                const tau = (f.t + k * period) % T
                if (tau < T1) {
                  const q = (v1 * tau) / R
                  circle(ctx, laser[0] + (OX - laser[0]) * q, laser[1] + (OY - laser[1]) * q, 3.5, '#fff', LASER, 1.5)
                } else {
                  const q1 = (v1 * (tau - T1)) / R
                  const q2 = (v2 * (tau - T1)) / R
                  if (q1 <= 1 && Rf > 0.01) circle(ctx, OX + (refl[0] - OX) * q1, OY + (refl[1] - OY) * q1, 3.5, alpha('#ffffff', clamp(Rf * 1.2, 0.15, 1)), alpha(LASER, clamp(Rf, 0.1, 1)), 1.5)
                  if (refr && q2 <= 1) circle(ctx, OX + (refr[0] - OX) * q2, OY + (refr[1] - OY) * q2, 3.5, alpha('#ffffff', clamp(1.2 - Rf, 0.15, 1)), alpha(LASER, clamp(1 - Rf, 0.1, 1)), 1.5)
                }
              }

              // Angle arcs and labels.
              const up = -Math.PI / 2
              const down = Math.PI / 2
              const nIn = s < 0 ? up : down
              const nOut = s < 0 ? down : up
              const angOf = (p: Pt) => Math.atan2(p[1] - OY, p[0] - OX)
              const lab = (a: number, r: number, str: string, color: string) => {
                const x = OX + Math.cos(a) * r
                const y = OY + Math.sin(a) * r
                rrect(ctx, x - 38, y - 11, 76, 22, 5, alpha(theme.surface, 0.85))
                text(ctx, str, x, y + 1, { color, size: 12, align: 'center', baseline: 'middle', weight: 700 })
              }
              if (Math.abs(theta) > 0.5) {
                lab(arc(ctx, OX, OY, 62, nIn, angOf(laser), theme.text), 100, `θ₁ ${fmt(Math.abs(theta), 1)}°`, theme.text)
                if (Rf > 0.01) lab(arc(ctx, OX, OY, 48, nIn, angOf(refl), alpha(theme.text, 0.6)), 92, `θr ${fmt(Math.abs(theta), 1)}°`, theme.muted)
                if (refr && th2 !== null) lab(arc(ctx, OX, OY, 62, nOut, angOf(refr), theme.text), 100, `θ₂ ${fmt(Math.abs(deg(th2)), 1)}°`, theme.text)
              }
              if (!refr) text(ctx, 'Total internal reflection', OX, OY - s * 70, { color: LASER, size: 16, align: 'center', weight: 700 })

              // The laser pointer itself.
              ctx.save()
              ctx.translate(...laser)
              ctx.rotate(Math.atan2(OY - laser[1], OX - laser[0]))
              rrect(ctx, -34, -9, 44, 18, 4, theme.text)
              rrect(ctx, 6, -5, 6, 10, 2, LASER)
              ctx.restore()
              circle(ctx, OX, OY, 4, theme.text)
            }}
          />
          <Readout
            items={[
              ['Incidence θ₁', `${fmt(Math.abs(theta), 1)}°`],
              ['Refraction θ₂', th2 === null ? 'TIR' : `${fmt(Math.abs(deg(th2)), 1)}°`],
              ['Critical angle', crit === null ? 'none' : `${fmt(deg(crit), 1)}°`],
              ['Reflected', `${fmt(Rf * 100, 1)}%`],
              ['Brewster angle', `${fmt(deg(brewsterAngle(n1, n2)), 1)}°`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} />
      <Slider label="Angle of incidence" value={Math.abs(theta)} min={0} max={89} unit="°" onChange={(v) => setTheta(theta < 0 ? -v : v)} />
      <Select label="Top material" value={top} options={MEDIA} onChange={setTop} />
      {top === 'custom' && <Slider label="Top index n" value={nTopCustom} min={1} max={3} step={0.01} onChange={setNTopCustom} />}
      <Select label="Bottom material" value={bottom} options={MEDIA} onChange={setBottom} />
      {bottom === 'custom' && <Slider label="Bottom index n" value={nBotCustom} min={1} max={3} step={0.01} onChange={setNBotCustom} />}
      <Toggle label="Laser in the bottom material" checked={flip} onChange={setFlip} />
      <Hint>
        Drag anywhere to aim the laser at the centre (drag below the line to shine from underneath). Going into a denser material the beam bends towards the normal;
        coming out of glass or diamond past the critical angle, all the light reflects.
      </Hint>
    </SimLayout>
  )
}
