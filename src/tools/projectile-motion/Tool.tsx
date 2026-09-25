import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, text } from '../../sim/draw'
import { clamp, deg, fmt, lerp, niceStep } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { launchBody, simulateFlight, stepBody, type Body } from './projectile'

const W = 800
const H = 460
const OX = 50
const OY = H - 34
const GRAVITY = [['9.81', 'Earth (9.81)'], ['1.62', 'Moon (1.62)'], ['3.71', 'Mars (3.71)'], ['24.79', 'Jupiter (24.79)']] as const

interface Shot {
  body: Body
  trail: [number, number][]
  color: string
  peak: number
  t: number
  landed: boolean
}

export default function ProjectileMotion() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [angle, setAngle] = useState(45)
  const [speed, setSpeed] = useState(25)
  const [height, setHeight] = useState(0)
  const [g, setG] = useState<(typeof GRAVITY)[number][0]>('9.81')
  const [drag, setDrag] = useState(false)
  const [k, setK] = useState(0.02)
  const [slow, setSlow] = useState(1)
  const [stats, setStats] = useState({ range: 0, peak: 0, time: 0, v: 0 })
  const shots = useRef<Shot[]>([])
  const scale = useRef(10)
  const aiming = useRef(false)
  const count = useRef(0)

  const launch = { v: speed, angle, g: Number(g), h0: height }
  const kk = drag ? k : 0
  const predicted = useMemo(() => simulateFlight(launch, kk), [speed, angle, g, height, kk])

  function fire() {
    const color = PALETTE[count.current++ % PALETTE.length]
    shots.current = [...shots.current.slice(-7), { body: launchBody(launch), trail: [], color, peak: height, t: 0, landed: false }]
    if (!running) setRunning(true)
  }

  function onPointer(p: SimPointer) {
    const s = scale.current
    const cy = OY - height * s
    if (p.type === 'down') aiming.current = true
    if (!aiming.current) return
    const dx = p.x - OX
    const dy = cy - p.y
    setAngle(Math.round(clamp(deg(Math.atan2(dy, Math.max(0.01, dx))), 0, 90)))
    setSpeed(Math.round(clamp(Math.hypot(dx, dy) / 5, 2, 80)))
    if (p.type === 'up') {
      aiming.current = false
      fire()
    }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={slow}
            label={`Projectile launched at ${angle} degrees and ${speed} metres per second, landing about ${fmt(predicted.range, 1)} metres away.`}
            onPointer={onPointer}
            onFrame={(ctx, f) => {
              // Zoom smoothly so the predicted path always fits.
              const fitX = Math.max(10, predicted.range, ...shots.current.map((s) => s.body.x)) * 1.08
              const fitY = Math.max(5, predicted.peak) * 1.15
              const target = Math.min((W - OX - 30) / fitX, (OY - 30) / fitY, 60)
              scale.current = f.frame === 0 ? target : lerp(scale.current, target, 0.08)
              const s = scale.current
              const X = (x: number) => OX + x * s
              const Y = (y: number) => OY - y * s

              clear(ctx, W, H, theme.sunken)
              const step = niceStep((W - OX) / s, 8)
              for (let x = 0; X(x) < W; x += step) {
                line(ctx, X(x), 0, X(x), OY, alpha(theme.border, 0.7))
                text(ctx, `${fmt(x)}m`, X(x) + 3, OY + 16, { color: theme.muted, size: 12 })
              }
              for (let y = step; Y(y) > 0; y += step) {
                line(ctx, OX, Y(y), W, Y(y), alpha(theme.border, 0.7))
                text(ctx, `${fmt(y)}`, 6, Y(y) + 4, { color: theme.muted, size: 12 })
              }
              ctx.fillStyle = alpha(theme.text, 0.08)
              ctx.fillRect(0, OY, W, H - OY)
              line(ctx, 0, OY, W, OY, theme.border, 2)

              // Launch platform and predicted path.
              if (height > 0) {
                ctx.fillStyle = alpha(theme.text, 0.15)
                ctx.fillRect(OX - 22, Y(height), 30, height * s)
              }
              ctx.beginPath()
              predicted.path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
              ctx.setLineDash([4, 6])
              ctx.strokeStyle = alpha(theme.text, 0.35)
              ctx.lineWidth = 1.5
              ctx.stroke()
              ctx.setLineDash([])
              const top = predicted.path.reduce((a, b) => (b[1] > a[1] ? b : a))
              circle(ctx, X(top[0]), Y(top[1]), 3, alpha(theme.text, 0.4))

              // Cannon.
              ctx.save()
              ctx.translate(OX, Y(height))
              ctx.rotate(-(angle * Math.PI) / 180)
              ctx.fillStyle = theme.text
              ctx.beginPath()
              ctx.roundRect(-6, -7, 42, 14, 5)
              ctx.fill()
              ctx.restore()
              circle(ctx, OX, Y(height), 11, theme.accent)
              const a = (angle * Math.PI) / 180
              arrow(ctx, OX, Y(height), OX + Math.cos(a) * (40 + speed * 1.2), Y(height) - Math.sin(a) * (40 + speed * 1.2), alpha(theme.accent, 0.8), 2)

              // Shots.
              const sub = 6
              for (const shot of shots.current) {
                if (!shot.landed && f.dt > 0) {
                  for (let i = 0; i < sub; i++) {
                    const prev = { ...shot.body }
                    stepBody(shot.body, f.dt / sub, Number(g), kk)
                    shot.t += f.dt / sub
                    shot.peak = Math.max(shot.peak, shot.body.y)
                    if (shot.body.y <= 0) {
                      const fr = prev.y / (prev.y - shot.body.y)
                      shot.body.x = prev.x + (shot.body.x - prev.x) * fr
                      shot.body.y = 0
                      shot.landed = true
                      break
                    }
                  }
                  shot.trail.push([shot.body.x, shot.body.y])
                }
                ctx.beginPath()
                shot.trail.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
                ctx.strokeStyle = shot.color
                ctx.lineWidth = 2.5
                ctx.stroke()
                const bx = X(shot.body.x)
                const by = Y(shot.body.y)
                circle(ctx, bx, by, shot.landed ? 5 : 7, shot.color, theme.surface, 2)
                if (shot.landed) text(ctx, `${fmt(shot.body.x, 1)} m`, bx, OY - 10, { color: shot.color, size: 13, align: 'center', weight: 700 })
                else arrow(ctx, bx, by, bx + shot.body.vx * 1.5, by - shot.body.vy * 1.5, alpha(shot.color, 0.8), 1.5, 6)
              }

              const last = shots.current[shots.current.length - 1]
              if (last && f.frame % 6 === 0)
                setStats({ range: last.body.x, peak: last.peak, time: last.t, v: Math.hypot(last.body.vx, last.body.vy) })
            }}
          />
          <Readout
            items={[
              ['Predicted range', `${fmt(predicted.range, 1)} m`],
              ['Predicted peak', `${fmt(predicted.peak, 1)} m`],
              ['Flight time', `${fmt(predicted.time, 2)} s`],
              ['Last shot x', `${fmt(stats.range, 1)} m`],
              ['Last shot speed', `${fmt(stats.v, 1)} m/s`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (shots.current = [])} resetLabel="Clear">
        <button type="button" className="btn" onClick={fire}>
          🚀 Fire
        </button>
      </PlayBar>
      <Slider label="Angle" value={angle} min={0} max={90} unit="°" onChange={setAngle} />
      <Slider label="Speed" value={speed} min={1} max={80} unit=" m/s" onChange={setSpeed} />
      <Slider label="Launch height" value={height} min={0} max={50} unit=" m" onChange={setHeight} />
      <Select label="Gravity" value={g} options={GRAVITY} onChange={setG} />
      <Toggle label="Air resistance" checked={drag} onChange={setDrag} />
      {drag && <Slider label="Drag coefficient k" value={k} min={0.001} max={0.1} step={0.001} onChange={setK} />}
      <Slider label="Playback speed" value={slow} min={0.1} max={2} step={0.1} unit="×" onChange={setSlow} />
      <Hint>Drag from the cannon to aim, and let go to fire. The dashed line is the predicted path; with air resistance on, 45° no longer gives the longest range.</Hint>
    </SimLayout>
  )
}
