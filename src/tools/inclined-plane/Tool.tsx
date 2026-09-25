import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { arrow, chart, clear, line, rrect, text } from '../../sim/draw'
import { clamp, deg, fmt, pushCap, rad } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { inclineAcceleration, stepIncline } from './incline'

const W = 800
const H = 480
const GY = 440
const BX = 720
const PX = 90 // pixels per metre along the ramp
const BW = 70
const BH = 44
const G = 9.81

type Pt = [number, number]

export default function InclinedPlane() {
  const theme = useTheme()
  const [running, setRunningRaw] = useRunning()
  const [angle, setAngle] = useState(30)
  const [m, setM] = useState(5)
  const [mus, setMus] = useState(0.4)
  const [muk, setMuk] = useState(0.25)
  const [F, setF] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [info, setInfo] = useState({ v: 0, t: 0, s: 0, done: '' })
  const sim = useRef({ s: 0, v: 0, t: 0, done: '', vs: [] as number[] })
  const dragTop = useRef(false)

  const th = rad(angle)
  const Ls = angle > 0.5 ? Math.min(600, 360 / Math.sin(th)) : 600
  const travel = (Ls - BW) / PX
  const forces = inclineAcceleration({ angle, m, g: G, mus, muk, F, v: sim.current.v })

  function reset() {
    Object.assign(sim.current, { s: 0, v: 0, t: 0, done: '', vs: [] })
    setInfo({ v: 0, t: 0, s: 0, done: '' })
  }

  function setRunning(v: boolean) {
    if (v && sim.current.done) reset()
    setRunningRaw(v)
  }

  function onPointer(p: SimPointer) {
    const top: Pt = [BX - Ls * Math.cos(th), GY - Ls * Math.sin(th)]
    if (p.type === 'down') dragTop.current = Math.hypot(p.x - top[0], p.y - top[1]) < 40
    if (dragTop.current && p.down) setAngle(Math.round(clamp(deg(Math.atan2(GY - p.y, BX - p.x)), 0, 60)))
    if (p.type === 'up') dragTop.current = false
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            onPointer={onPointer}
            className="sim-flat"
            label={`Block of ${m} kilograms on a ${angle} degree ramp with static friction ${mus} and kinetic friction ${muk}.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              const input = { angle, m, g: G, mus, muk, F }
              if (s.s > travel) s.s = travel
              if (f.dt > 0 && !s.done) {
                const n = 8
                for (let i = 0; i < n; i++) {
                  const r = stepIncline(s.s, s.v, f.dt / n, input)
                  s.s = r.s
                  s.v = r.v
                  s.t += f.dt / n
                  if (s.s >= travel) {
                    s.s = travel
                    s.done = `Reached the bottom in ${fmt(s.t, 2)} s at ${fmt(Math.abs(s.v), 2)} m/s`
                    break
                  }
                  if (s.s <= 0 && s.v < 0) {
                    s.s = 0
                    s.done = `Pushed back to the top in ${fmt(s.t, 2)} s`
                    break
                  }
                }
                pushCap(s.vs, Math.abs(s.v), 300)
                if (s.done) setRunningRaw(false)
              }
              const fr = inclineAcceleration({ ...input, v: s.v })

              clear(ctx, W, H, theme.surface)
              // Status and a speed–time trace.
              const msg = s.done || (fr.holds ? 'Static friction holds: the block stays put' : s.v === 0 && !running ? 'Press Play to let go' : '')
              if (msg) {
                rrect(ctx, 16, 16, 380, 30, 7, alpha(fr.holds && !s.done ? PALETTE[2] : theme.accent, 0.14))
                text(ctx, msg, 30, 36, { color: theme.text, size: 13, weight: 700 })
              }
              rrect(ctx, W - 226, 16, 210, 92, 8, alpha(theme.sunken, 0.9), theme.border)
              chart(ctx, W - 216, 34, 190, 66, [{ data: s.vs, color: theme.accent, width: 2 }], { min: 0, span: 300, axis: theme.border })
              text(ctx, 'speed vs time', W - 216, 30, { color: theme.muted, size: 12 })

              // Ramp.
              const d: Pt = [Math.cos(th), Math.sin(th)]
              const nrm: Pt = [Math.sin(th), -Math.cos(th)]
              const top: Pt = [BX - Ls * d[0], GY - Ls * d[1]]
              ctx.beginPath()
              ctx.moveTo(top[0], top[1])
              ctx.lineTo(BX, GY)
              ctx.lineTo(top[0], GY)
              ctx.closePath()
              ctx.fillStyle = alpha(theme.text, 0.1)
              ctx.fill()
              ctx.strokeStyle = alpha(theme.text, 0.6)
              ctx.lineWidth = 2
              ctx.stroke()
              line(ctx, 0, GY, W, GY, alpha(theme.text, 0.4), 2)
              ctx.beginPath()
              ctx.arc(BX, GY, 46, Math.PI, Math.PI + th)
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 1.5
              ctx.stroke()
              text(ctx, `${angle}°`, BX - 72, GY - 10, { color: theme.text, size: 14, align: 'center', weight: 700 })
              ctx.beginPath()
              ctx.arc(top[0], top[1], 9, 0, Math.PI * 2)
              ctx.fillStyle = alpha(theme.accent, 0.25)
              ctx.fill()
              ctx.strokeStyle = theme.accent
              ctx.stroke()

              // Block.
              const along = s.s * PX + BW / 2
              const C: Pt = [top[0] + d[0] * along + nrm[0] * (BH / 2), top[1] + d[1] * along + nrm[1] * (BH / 2)]
              ctx.save()
              ctx.translate(C[0], C[1])
              ctx.rotate(th)
              rrect(ctx, -BW / 2, -BH / 2, BW, BH, 5, alpha(PALETTE[1], 0.85), theme.text, 1.5)
              text(ctx, `${m} kg`, 0, 1, { color: '#fff', size: 13, align: 'center', baseline: 'middle', weight: 700 })
              ctx.restore()

              // Free-body diagram, scaled so that mg is always 95 px.
              const k = 95 / (m * G)
              const tip = (o: Pt, dir: Pt, mag: number): Pt => [o[0] + dir[0] * mag * k, o[1] + dir[1] * mag * k]
              const vec = (o: Pt, dir: Pt, mag: number, color: string, label: string, width = 2.5, dash = false) => {
                if (Math.abs(mag) * k < 2) return
                const e = tip(o, dir, mag)
                if (dash) line(ctx, o[0], o[1], e[0], e[1], color, 1.5, [5, 4])
                else arrow(ctx, o[0], o[1], e[0], e[1], color, width, 10)
                const L = Math.hypot(e[0] - o[0], e[1] - o[1]) || 1
                text(ctx, label, e[0] + ((e[0] - o[0]) / L) * 14, e[1] + ((e[1] - o[1]) / L) * 14 + 4, { color, size: 12, align: 'center', weight: 700 })
              }
              const contact: Pt = [C[0] - nrm[0] * (BH / 2), C[1] - nrm[1] * (BH / 2)]
              vec(C, d, fr.gravityAlong, alpha(theme.text, 0.55), 'mg sinθ', 1.5, true)
              vec(C, [-nrm[0], -nrm[1]], fr.gravityPerp, alpha(theme.text, 0.55), 'mg cosθ', 1.5, true)
              vec(C, [0, 1], m * G, theme.text, 'mg')
              vec(C, nrm, fr.normal, PALETTE[2], 'N')
              vec(contact, d, fr.friction, PALETTE[6], 'f')
              if (F !== 0) vec([C[0] - d[0] * (BW / 2), C[1] - d[1] * (BW / 2)], [-d[0], -d[1]], F, PALETTE[3], 'F')
              if (!fr.holds && Math.abs(fr.net) * k > 2) vec([C[0] + nrm[0] * (BH / 2 + 30), C[1] + nrm[1] * (BH / 2 + 30)], d, fr.net, theme.accent, 'net', 4)

              if (f.frame % 6 === 0) setInfo({ v: Math.abs(s.v), t: s.t, s: s.s, done: s.done })
            }}
          />
          <Readout
            items={[
              ['Acceleration', `${fmt(forces.holds ? 0 : Math.abs(forces.a), 2)} m/s²`],
              ['Friction', `${fmt(Math.abs(forces.friction), 1)} N ${forces.holds ? '(static)' : '(kinetic)'}`],
              ['Normal force', `${fmt(forces.normal, 1)} N`],
              ['Speed', `${fmt(info.v, 2)} m/s`],
              ['Time', `${fmt(info.t, 2)} s`],
              ['Distance', `${fmt(info.s, 2)} / ${fmt(travel, 2)} m`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} />
      <Slider label="Ramp angle θ" value={angle} min={0} max={60} unit="°" onChange={setAngle} />
      <Slider label="Mass" value={m} min={1} max={20} step={0.5} unit=" kg" onChange={setM} />
      <Slider label="Static friction μs" value={mus} min={0} max={1} step={0.01} onChange={(v) => (setMus(v), muk > v && setMuk(v))} />
      <Slider label="Kinetic friction μk" value={muk} min={0} max={1} step={0.01} onChange={(v) => (setMuk(Math.min(v, mus)))} />
      <Slider label="Push up the ramp F" value={F} min={-100} max={100} step={1} unit=" N" onChange={setF} />
      <Slider label="Playback speed" value={speed} min={0.1} max={1} step={0.05} unit="×" onChange={setSpeed} />
      <Hint>
        Drag the orange handle at the top of the ramp or use the slider. The block only starts to slide once tan θ beats μs; after that the smaller kinetic friction takes over, so it
        accelerates at g(sin θ − μk cos θ).
      </Hint>
    </SimLayout>
  )
}
