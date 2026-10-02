import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, deg, dist, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { tone } from '../../sim/audio'
import { dopplerObserved, machAngle } from './doppler'

const W = 800
const H = 460
const Y0 = 220
const XMIN = 110
const XMAX = 690
const MAXR = 1100

interface Front {
  x: number
  y: number
  t0: number
}

interface Observer {
  x: number
  y: number
  name: string
  last: number
  f: number
  flash: number
}

export default function DopplerEffect() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mach, setMach] = useState(0.6)
  const [freq, setFreq] = useState(2)
  const [c, setC] = useState(120)
  const [auto, setAuto] = useState(true)
  const [info, setInfo] = useState({ M: 0.6 })
  const sim = useRef({
    x: 300,
    y: Y0,
    vx: 0,
    vy: 0,
    dir: 1,
    t: 0,
    phase: 0,
    fronts: [] as Front[],
    obs: [
      { x: 50, y: Y0 + 110, name: 'A', last: -1, f: 0, flash: 0 },
      { x: 750, y: Y0 + 110, name: 'B', last: -1, f: 0, flash: 0 },
    ] as Observer[],
  })
  const held = useRef<{ kind: 'source' } | { kind: 'obs'; i: number } | null>(null)
  const target = useRef({ x: 300, y: Y0 })

  function reset() {
    const s = sim.current
    s.fronts = []
    s.phase = 0
    s.x = 300
    s.y = Y0
    s.dir = 1
    s.obs.forEach((o) => Object.assign(o, { last: -1, f: 0, flash: 0 }))
  }

  function onPointer(p: SimPointer) {
    const s = sim.current
    if (p.type === 'down') {
      const oi = s.obs.findIndex((o) => dist(o.x, o.y, p.x, p.y) < 28)
      if (dist(s.x, s.y, p.x, p.y) < 30) held.current = { kind: 'source' }
      else if (oi >= 0) held.current = { kind: 'obs', i: oi }
      else held.current = null
    }
    const h = held.current
    if (h?.kind === 'source') target.current = { x: clamp(p.x, 12, W - 12), y: clamp(p.y, 12, H - 12) }
    if (h?.kind === 'obs') Object.assign(s.obs[h.i], { x: clamp(p.x, 20, W - 20), y: clamp(p.y, 20, H - 20), last: -1 })
    if (p.type === 'up') held.current = null
  }

  function hear() {
    const M = info.M
    const base = 330
    if (M >= 1) tone(55, 450, 'sawtooth', 0.12)
    else tone(Math.min(3000, dopplerObserved(base, 1, M)), 550, 'triangle', 0.06)
    setTimeout(() => tone(dopplerObserved(base, 1, -M), 650, 'triangle', 0.06), 650)
  }

  const M = info.M
  const cone = machAngle(M)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Sound source moving at Mach ${fmt(M, 2)} emitting circular wavefronts at ${freq} hertz.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              const dt = f.dt
              const px = s.x
              const py = s.y
              // Move the source: follow the finger while dragged, otherwise sweep back and forth.
              if (held.current?.kind === 'source') {
                s.x = target.current.x
                s.y = target.current.y
                if (dt > 0) {
                  s.vx += ((s.x - px) / dt - s.vx) * 0.25
                  s.vy += ((s.y - py) / dt - s.vy) * 0.25
                }
              } else if (auto) {
                if (s.y !== Y0) s.y += (Y0 - s.y) * Math.min(1, dt * 4)
                s.vx = s.dir * mach * c
                s.vy = 0
                s.x += s.vx * dt
                if (s.x > XMAX) (s.x = XMAX), (s.dir = -1)
                if (s.x < XMIN) (s.x = XMIN), (s.dir = 1)
              } else if (dt > 0) {
                s.vx *= 0.8
                s.vy *= 0.8
              }

              // Emit fronts at the exact sub-frame moment, from where the source was then.
              const tPrev = s.t
              if (dt > 0) {
                s.t += dt
                s.phase += freq * dt
                while (s.phase >= 1) {
                  s.phase -= 1
                  const back = s.phase / freq
                  const k = dt > 0 ? back / dt : 0
                  s.fronts.push({ x: s.x - (s.x - px) * k, y: s.y - (s.y - py) * k, t0: s.t - back })
                }
                s.fronts = s.fronts.filter((fr) => c * (s.t - fr.t0) < MAXR)
                // Observers hear a click each time a front sweeps past them.
                for (const o of s.obs) {
                  const hits: number[] = []
                  for (const fr of s.fronts) {
                    const d = dist(fr.x, fr.y, o.x, o.y)
                    if (c * (tPrev - fr.t0) < d && c * (s.t - fr.t0) >= d) hits.push(fr.t0 + d / c)
                  }
                  hits.sort((a, b) => a - b)
                  for (const th of hits) {
                    if (o.last >= 0 && th - o.last > 1e-4) o.f += (1 / (th - o.last) - o.f) * (o.f ? 0.5 : 1)
                    o.last = th
                    o.flash = hits.length > 1 ? 2 : 1
                  }
                  o.flash = Math.max(0, o.flash - dt * 3)
                }
              }

              clear(ctx, W, H, theme.sunken)
              line(ctx, 0, Y0, W, Y0, alpha(theme.text, 0.12), 1, [4, 8])
              for (const fr of s.fronts) {
                const r = c * (s.t - fr.t0)
                circle(ctx, fr.x, fr.y, r, undefined, alpha(theme.accent, Math.max(0.05, 0.85 * (1 - r / MAXR))), 2)
              }

              // Mach cone.
              const speed = Math.hypot(s.vx, s.vy)
              const Mnow = speed / c
              const a = machAngle(Mnow)
              if (a !== null && speed > 1) {
                const back = Math.atan2(-s.vy, -s.vx)
                const L = 1400
                ctx.beginPath()
                ctx.moveTo(s.x, s.y)
                ctx.lineTo(s.x + Math.cos(back + a) * L, s.y + Math.sin(back + a) * L)
                ctx.lineTo(s.x + Math.cos(back - a) * L, s.y + Math.sin(back - a) * L)
                ctx.closePath()
                ctx.fillStyle = alpha(theme.danger, 0.08)
                ctx.fill()
                line(ctx, s.x, s.y, s.x + Math.cos(back + a) * L, s.y + Math.sin(back + a) * L, theme.danger, 2.5)
                line(ctx, s.x, s.y, s.x + Math.cos(back - a) * L, s.y + Math.sin(back - a) * L, theme.danger, 2.5)
              }

              // Observers.
              for (const o of s.obs) {
                if (o.flash > 0) circle(ctx, o.x, o.y, 16 + (1 - Math.min(1, o.flash)) * 22, undefined, alpha(o.flash > 1 ? theme.danger : theme.text, Math.min(1, o.flash) * 0.7), 3)
                circle(ctx, o.x, o.y, 13, theme.surface, theme.text, 2.5)
                text(ctx, o.name, o.x, o.y + 1, { color: theme.text, size: 13, align: 'center', baseline: 'middle', weight: 700 })
                const label = `${o.name} hears ${o.f ? fmt(o.f, 2) : '…'} Hz`
                const lx = clamp(o.x, 80, W - 80)
                const ly = o.y > H - 60 ? o.y - 34 : o.y + 34
                rrect(ctx, lx - 74, ly - 13, 148, 24, 6, alpha(theme.surface, 0.9), theme.border)
                text(ctx, label, lx, ly, { color: theme.text, size: 12, align: 'center', baseline: 'middle' })
              }

              // Source and its velocity.
              circle(ctx, s.x, s.y, 13, theme.accent, theme.surface, 3)
              if (speed > 2) arrow(ctx, s.x, s.y, s.x + (s.vx / speed) * (22 + Mnow * 30), s.y + (s.vy / speed) * (22 + Mnow * 30), theme.text, 2.5, 9)
              text(ctx, `Mach ${fmt(Mnow, 2)}`, 16, 26, { color: theme.text, size: 15, weight: 700 })
              text(ctx, a !== null ? `cone half-angle ${fmt(deg(a), 1)}°` : 'wavefronts bunch up ahead', 16, 46, { color: theme.muted, size: 12 })

              if (f.frame % 8 === 0 && Math.abs(Mnow - info.M) > 0.004) setInfo({ M: Mnow })
            }}
          />
          <Readout
            items={[
              ['Mach number', fmt(M, 2)],
              ['f ahead', M >= 1 ? 'boom' : `${fmt(dopplerObserved(freq, c, M * c), 2)} Hz`],
              ['f behind', `${fmt(dopplerObserved(freq, c, -M * c), 2)} Hz`],
              ['Cone angle', cone === null ? 'no cone' : `${fmt(deg(cone), 1)}°`],
              ['Wavelength ahead', M >= 1 ? 'shock' : `${fmt((c - M * c) / freq, 0)} px`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} resetLabel="Clear">
        <button type="button" className="btn" onClick={hear}>
          Hear it
        </button>
      </PlayBar>
      <Slider label="Source speed" value={mach} min={0} max={2} step={0.05} unit=" Mach" format={(v) => v.toFixed(2)} onChange={setMach} />
      <Slider label="Frequency" value={freq} min={0.5} max={5} step={0.1} unit=" Hz" onChange={setFreq} />
      <Slider label="Wave speed c" value={c} min={60} max={200} step={5} unit=" px/s" onChange={setC} />
      <Toggle label="Move back and forth" checked={auto} onChange={setAuto} />
      <Hint>
        Drag the orange source or the two listeners A and B. Ahead of a moving source the fronts crowd together (higher pitch), behind it they spread out.
        Past Mach 1 the source outruns its own sound and the fronts pile into a shock cone.
      </Hint>
    </SimLayout>
  )
}
