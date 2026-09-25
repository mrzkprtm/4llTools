import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt } from '../../sim/math'
import { PHASES, SYNODIC, daysToFull, illumination, moonAge, moonUp, norm, observerAngle, phaseName, riseSet, terminatorK, waxing } from './moon'

const W = 820
const H = 500
// Top-down view.
const EX = 235
const EY = 200
const ORBIT = 145
// Moon as seen from Earth.
const MX = 648
const MY = 150
const MR = 96
// Timeline.
const TX0 = 70
const TX1 = 750

const MARIA: [number, number, number, number][] = [
  [-0.3, -0.35, 0.28, 0.2],
  [0.1, -0.3, 0.2, 0.16],
  [0.28, -0.05, 0.22, 0.18],
  [0.62, -0.18, 0.12, 0.1],
  [-0.5, 0.1, 0.25, 0.35],
  [0.05, 0.35, 0.18, 0.12],
  [0.25, 0.2, 0.12, 0.1],
]

/** Draws the Moon as seen from Earth: a textured disc with the unlit part shaded. */
function moonFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, angle: number, south: boolean) {
  circle(ctx, cx, cy, R, '#dcd6c8')
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, TAU)
  ctx.clip()
  ctx.fillStyle = '#b4ad9d'
  for (const [x, y, rx, ry] of MARIA) {
    ctx.beginPath()
    ctx.ellipse(cx + (south ? -x : x) * R, cy + (south ? -y : y) * R, rx * R, ry * R, 0.3, 0, TAU)
    ctx.fill()
  }
  // The shadow: from the dark limb to the terminator ellipse, row by row.
  const k = terminatorK(angle)
  const wax = waxing(angle)
  const flip = south ? -1 : 1
  const N = 60
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const y = -R + (2 * R * i) / N
    const s = Math.sqrt(Math.max(0, R * R - y * y))
    ctx.lineTo(cx + flip * (wax ? -s : s), cy + y)
  }
  for (let i = N; i >= 0; i--) {
    const y = -R + (2 * R * i) / N
    const s = Math.sqrt(Math.max(0, R * R - y * y))
    ctx.lineTo(cx + flip * k * s, cy + y)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(14, 14, 24, 0.9)'
  ctx.fill()
  ctx.restore()
}

/** A body lit from the right: bright right half, dark left half. */
function litBody(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, day: string, night: string) {
  circle(ctx, x, y, r, night)
  ctx.beginPath()
  ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2)
  ctx.closePath()
  ctx.fillStyle = day
  ctx.fill()
}

const hhmm = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`

export default function MoonPhases() {
  const [running, setRunning] = useRunning()
  const [speed, setSpeed] = useState(2)
  const [hour, setHour] = useState(21)
  const [observer, setObserver] = useState(true)
  const [south, setSouth] = useState(false)
  const angle = useRef(Math.PI / 3)
  const drag = useRef<'orbit' | 'timeline' | null>(null)
  const [info, setInfo] = useState(angle.current)

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      const mx = EX + ORBIT * Math.cos(angle.current)
      const my = EY - ORBIT * Math.sin(angle.current)
      if (p.y > 395) drag.current = 'timeline'
      else if (Math.hypot(p.x - mx, p.y - my) < 30 || Math.abs(Math.hypot(p.x - EX, p.y - EY) - ORBIT) < 30) drag.current = 'orbit'
    }
    if (drag.current === 'orbit') angle.current = norm(Math.atan2(EY - p.y, p.x - EX))
    if (drag.current === 'timeline') angle.current = (clamp((p.x - TX0) / (TX1 - TX0), 0, 0.9999) * TAU)
    if (drag.current) setInfo(angle.current)
    if (p.type === 'up') drag.current = null
  }

  const a = info
  const up = moonUp(a, hour)
  const sunUp = Math.cos(observerAngle(hour)) > 0
  const rs = riseSet(a)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            label={`Moon phase diagram: ${phaseName(a)}, ${Math.round(illumination(a) * 100)} percent illuminated, ${fmt(moonAge(a), 1)} days old.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0 && !drag.current) angle.current = norm(angle.current + (f.dt * speed * TAU) / SYNODIC)
              const th = angle.current
              clear(ctx, W, H, '#0d0c0b')
              // Sunlight arriving from the right.
              for (let k = 0; k < 7; k++) arrow(ctx, 470, 40 + k * 55, 430, 40 + k * 55, 'rgba(255, 212, 59, 0.45)', 1.5, 7)
              text(ctx, 'sunlight', 470, 22, { color: 'rgba(255, 212, 59, 0.8)', size: 12, align: 'right' })
              circle(ctx, EX, EY, ORBIT, undefined, 'rgba(255,255,255,0.18)', 1)
              const marks: [number, string][] = [[0, 'New'], [Math.PI / 2, 'First quarter'], [Math.PI, 'Full'], [(3 * Math.PI) / 2, 'Last quarter']]
              for (const [m, name] of marks) {
                const x = EX + (ORBIT + 22) * Math.cos(m)
                const y = EY - (ORBIT + 22) * Math.sin(m)
                text(ctx, name, x, y + 4, { color: 'rgba(255,255,255,0.45)', size: 12, align: m === 0 ? 'left' : m === Math.PI ? 'right' : 'center' })
              }
              litBody(ctx, EX, EY, 26, '#4dabf7', '#1b3a57')
              text(ctx, 'Earth', EX, EY + 44, { color: 'rgba(255,255,255,0.7)', size: 12, align: 'center' })
              if (observer) {
                const psi = observerAngle(hour)
                const ox = EX + 26 * Math.cos(psi)
                const oy = EY - 26 * Math.sin(psi)
                // Horizon: the tangent line at the observer. Anything beyond it is up in their sky.
                line(ctx, ox - 70 * Math.sin(psi), oy - 70 * Math.cos(psi), ox + 70 * Math.sin(psi), oy + 70 * Math.cos(psi), 'rgba(140, 233, 154, 0.7)', 1.5, [5, 4])
                line(ctx, ox, oy, EX + 44 * Math.cos(psi), EY - 44 * Math.sin(psi), '#8ce99a', 2)
                circle(ctx, ox, oy, 4, '#8ce99a')
              }
              const mx = EX + ORBIT * Math.cos(th)
              const my = EY - ORBIT * Math.sin(th)
              litBody(ctx, mx, my, 13, '#e9e4d6', '#34322d')
              // The half of the Moon that faces Earth: that is all we ever get to see.
              const px = -Math.sin(th)
              const py = -Math.cos(th)
              line(ctx, mx + px * 20, my + py * 20, mx - px * 20, my - py * 20, 'rgba(255,255,255,0.5)', 1, [3, 3])
              line(ctx, EX, EY, mx, my, 'rgba(255,255,255,0.12)', 1)
              circle(ctx, mx, my, 18, undefined, 'rgba(255,255,255,0.35)', 1)
              text(ctx, 'drag the Moon', mx, my + (th > Math.PI ? 34 : -26), { color: 'rgba(255,255,255,0.5)', size: 12, align: 'center' })

              // As seen from Earth.
              rrect(ctx, 500, 10, 310, 380, 10, '#15140f', '#2f2d28')
              text(ctx, `seen from Earth (${south ? 'southern' : 'northern'} hemisphere)`, 655, 32, { color: 'rgba(255,255,255,0.55)', size: 12, align: 'center' })
              moonFace(ctx, MX, MY, MR, th, south)
              text(ctx, phaseName(th), MX, 282, { color: '#fff', size: 20, align: 'center', weight: 700, mono: false })
              text(ctx, `${Math.round(illumination(th) * 100)}% lit · ${fmt(moonAge(th), 1)} days old`, MX, 306, { color: 'rgba(255,255,255,0.75)', size: 13, align: 'center' })
              if (observer) {
                const vis = moonUp(th, hour)
                const sun = Math.cos(observerAngle(hour)) > 0
                rrect(ctx, 520, 322, 270, 54, 8, sun ? 'rgba(77,171,247,0.25)' : 'rgba(92,124,250,0.12)')
                text(ctx, `At ${hhmm(hour)} the Moon is ${vis ? 'up' : 'below the horizon'}`, MX, 344, { color: vis ? '#8ce99a' : 'rgba(255,255,255,0.6)', size: 13, align: 'center' })
                const r = riseSet(th)
                text(ctx, `rises ${hhmm(r.rise)} · sets ${hhmm(r.set)} · ${sun ? 'daytime' : 'night'}`, MX, 364, { color: 'rgba(255,255,255,0.6)', size: 12, align: 'center' })
              }

              // Timeline strip of the lunar month.
              line(ctx, TX0, 410, TX1, 410, 'rgba(255,255,255,0.3)', 2)
              PHASES.forEach((name, i) => {
                const x = TX0 + (i / 8) * (TX1 - TX0)
                const cur = phaseName(th) === name
                if (cur) rrect(ctx, x - 44, 418, 88, 78, 8, 'rgba(255,255,255,0.08)')
                moonFace(ctx, x, 440, 14, (i / 8) * TAU + 1e-6, south)
                const [w1, w2] = name.split(' ')
                text(ctx, w1, x, 471, { color: cur ? '#fff' : 'rgba(255,255,255,0.55)', size: 12, align: 'center', mono: false })
                text(ctx, w2 ?? '', x, 486, { color: cur ? '#fff' : 'rgba(255,255,255,0.55)', size: 12, align: 'center', mono: false })
              })
              const tx = TX0 + (th / TAU) * (TX1 - TX0)
              circle(ctx, tx, 410, 6, '#ffd43b')
              text(ctx, `day ${fmt(moonAge(th), 1)}`, tx, 402, { color: '#ffd43b', size: 12, align: 'center' })
              if (f.frame % 8 === 0 && f.dt > 0) setInfo(th)
            }}
          />
          <Readout
            items={[
              ['Phase', phaseName(a)],
              ['Illuminated', `${Math.round(illumination(a) * 100)}%`],
              ['Moon age', `${fmt(moonAge(a), 1)} d`],
              ['Days to full', fmt(daysToFull(a), 1)],
              ['Moonrise / set', `${hhmm(rs.rise)} / ${hhmm(rs.set)}`],
              [`Visible at ${hhmm(hour)}`, up ? (sunUp ? 'yes, by day' : 'yes') : 'no'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { angle.current = 0; setInfo(0) }} resetLabel="New moon" />
      <Slider label="Speed" value={speed} min={0.5} max={8} step={0.5} unit=" days/s" onChange={setSpeed} />
      <Slider label="Observer's local time" value={hour} min={0} max={24} step={0.25} format={hhmm} onChange={setHour} />
      <Toggle label="Show observer on Earth" checked={observer} onChange={setObserver} />
      <Toggle label="Southern hemisphere view" checked={south} onChange={setSouth} />
      <Hint>Half of the Moon is always lit by the Sun; the phase is how much of that lit half faces us. Drag the Moon around its orbit or along the timeline. The green line is the observer's horizon: the Moon is visible when it is on the far side of that line.</Hint>
    </SimLayout>
  )
}
