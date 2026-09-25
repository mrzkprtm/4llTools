import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { rcStep, type RCState } from './rc'

const W = 800
const H = 500
const SPAN = 6 // graph width in time constants
const PER_TAU = 50
const PIVOT: Pt = [120, 80]
const THROW_A: Pt = [70, 132]
const THROW_B: Pt = [170, 132]
const CAP_X = 410
const CAP_TOP = 222
const CAP_BOT = 240
const BAT_TOP = 236
const BAT_BOT = 256
const ELECTRON = '#1c7ed6'

type Pt = [number, number]

// Loops in the direction of conventional current. Segments marked hidden carry no visible electrons.
const CHARGE_LOOP: Pt[] = [[70, BAT_TOP], THROW_A, PIVOT, [CAP_X, 80], [CAP_X, CAP_TOP], [CAP_X, CAP_BOT], [CAP_X, 420], [70, 420], [70, BAT_BOT], [70, BAT_TOP]]
const CHARGE_HIDDEN = [4, 8]
const DISCHARGE_LOOP: Pt[] = [[CAP_X, CAP_TOP], [CAP_X, 80], PIVOT, THROW_B, [170, 420], [CAP_X, 420], [CAP_X, CAP_BOT], [CAP_X, CAP_TOP]]
const DISCHARGE_HIDDEN = [6]

function loopLength(pts: Pt[]) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return L
}

function at(pts: Pt[], s: number, hidden: number[]): Pt | null {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (s <= seg) {
      if (hidden.includes(i - 1)) return null
      const k = s / seg
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]
    }
    s -= seg
  }
  return null
}

export default function RCCircuit() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [Rk, setRk] = useState(10)
  const [Cu, setCu] = useState(100)
  const [V0, setV0] = useState(9)
  const [scale, setScale] = useState(1)
  const [charging, setCharging] = useState(true)
  const [info, setInfo] = useState<RCState & { since: number }>({ vc: 0, i: 0, since: 0 })
  const sim = useRef({ state: { vc: 0, i: 0 } as RCState, since: 0, acc: 0, vs: [] as number[], is: [] as number[], key: '', phase: 0 })

  const R = Rk * 1e3
  const C = Cu * 1e-6
  const tau = R * C
  const I0 = V0 / R

  function toggle() {
    setCharging((c) => !c)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down' && Math.hypot(p.x - PIVOT[0], p.y - (PIVOT[1] + 30)) < 50) toggle()
  }

  function resetAll() {
    Object.assign(sim.current, { state: { vc: 0, i: 0 }, since: 0, acc: 0, vs: [], is: [], key: '' })
    setCharging(true)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={scale}
            onPointer={onPointer}
            cursor="pointer"
            className="sim-flat"
            label={`RC circuit ${charging ? 'charging' : 'discharging'}: ${Rk} kilohm resistor and ${Cu} microfarad capacitor, time constant ${fmt(tau, 3)} seconds.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              const key = `${R},${C},${V0},${charging}`
              if (key !== s.key) {
                // A new switch position or new parts: start a fresh trace from here.
                s.key = key
                s.since = 0
                s.acc = 0
                s.vs = [s.state.vc]
                s.is = [(charging ? V0 - s.state.vc : -s.state.vc) / R]
              }
              const sample = tau / PER_TAU
              let left = f.dt
              while (left > 1e-12) {
                if (s.since >= SPAN * tau) {
                  s.state = rcStep(s.state, left, R, C, V0, charging)
                  s.since += left
                  break
                }
                const h = Math.min(left, sample - s.acc)
                s.state = rcStep(s.state, h, R, C, V0, charging)
                s.acc += h
                s.since += h
                left -= h
                if (s.acc >= sample - 1e-12) {
                  s.acc = 0
                  s.vs.push(s.state.vc)
                  s.is.push(s.state.i)
                }
              }
              const { vc, i } = s.state

              clear(ctx, W, H, theme.surface)
              const wire = alpha(theme.text, 0.75)
              const w = 3
              // Wires.
              line(ctx, PIVOT[0], PIVOT[1], CAP_X, 80, wire, w)
              line(ctx, CAP_X, 80, CAP_X, CAP_TOP, wire, w)
              line(ctx, CAP_X, CAP_BOT, CAP_X, 420, wire, w)
              line(ctx, CAP_X, 420, 70, 420, wire, w)
              line(ctx, 70, 420, 70, BAT_BOT, wire, w)
              line(ctx, 70, BAT_TOP, 70, THROW_A[1], wire, w)
              line(ctx, 170, 420, 170, THROW_B[1], wire, w)
              // Resistor zigzag on the top wire.
              rrect(ctx, 214, 66, 112, 28, 4, theme.surface)
              ctx.beginPath()
              ctx.moveTo(214, 80)
              for (let z = 0; z < 8; z++) ctx.lineTo(221 + z * 14, z % 2 ? 94 : 66)
              ctx.lineTo(326, 80)
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 2.5
              ctx.stroke()
              text(ctx, `R = ${Rk} kΩ`, 270, 54, { color: theme.text, size: 13, align: 'center', weight: 700 })
              // Battery: long + plate on top.
              line(ctx, 44, BAT_TOP, 96, BAT_TOP, theme.text, 3)
              line(ctx, 56, BAT_BOT, 84, BAT_BOT, theme.text, 5)
              text(ctx, '+', 104, BAT_TOP + 4, { color: '#e03131', size: 16, weight: 700 })
              text(ctx, `${V0} V`, 22, BAT_BOT + 30, { color: theme.text, size: 13, weight: 700 })
              // Switch.
              circle(ctx, THROW_A[0], THROW_A[1], 5, theme.surface, theme.text, 2)
              circle(ctx, THROW_B[0], THROW_B[1], 5, theme.surface, theme.text, 2)
              const to = charging ? THROW_A : THROW_B
              line(ctx, PIVOT[0], PIVOT[1], to[0], to[1] - 4, theme.accent, 4)
              circle(ctx, PIVOT[0], PIVOT[1], 6, theme.accent)
              text(ctx, 'Charge', THROW_A[0] - 4, THROW_A[1] + 22, { color: charging ? theme.accent : theme.muted, size: 12, align: 'center', weight: 700 })
              text(ctx, 'Discharge', THROW_B[0] + 14, THROW_B[1] + 22, { color: charging ? theme.muted : theme.accent, size: 12, align: 'center', weight: 700 })
              text(ctx, 'tap the switch', PIVOT[0], 40, { color: theme.muted, size: 12, align: 'center' })
              // Capacitor plates with their charge.
              line(ctx, CAP_X - 40, CAP_TOP, CAP_X + 40, CAP_TOP, theme.text, 4)
              line(ctx, CAP_X - 40, CAP_BOT, CAP_X + 40, CAP_BOT, theme.text, 4)
              const nq = Math.round((vc / Math.max(V0, 1e-9)) * 9)
              for (let q = 0; q < nq; q++) {
                const x = CAP_X - 36 + (q * 72) / 8
                text(ctx, '+', x, CAP_TOP - 8, { color: '#e03131', size: 14, align: 'center', weight: 700 })
                text(ctx, '−', x, CAP_BOT + 18, { color: ELECTRON, size: 14, align: 'center', weight: 700 })
              }
              text(ctx, `C = ${Cu} µF`, CAP_X + 50, CAP_TOP + 14, { color: theme.text, size: 13, weight: 700 })
              text(ctx, `${fmt(vc, 2)} V`, CAP_X + 50, CAP_TOP + 32, { color: theme.muted, size: 12 })

              // Electrons drift against the conventional current, faster when more current flows.
              const loop = charging ? CHARGE_LOOP : DISCHARGE_LOOP
              const hidden = charging ? CHARGE_HIDDEN : DISCHARGE_HIDDEN
              const L = loopLength(loop)
              const gap = 24
              s.phase = (((s.phase - (Math.abs(i) / I0) * 140 * (f.dt / Math.max(scale, 1e-9))) % gap) + gap) % gap
              for (let d = s.phase; d < L; d += gap) {
                const p = at(loop, d, hidden)
                if (p) circle(ctx, p[0], p[1], 3.2, ELECTRON)
              }

              // Graphs.
              const gx = 480
              const gw = 290
              const plot = (y: number, h: number, data: number[], min: number, max: number, color: string, title: string, ref?: number) => {
                rrect(ctx, gx - 10, y - 26, gw + 20, h + 50, 8, theme.sunken)
                text(ctx, title, gx, y - 8, { color: theme.text, size: 13, weight: 700 })
                for (let k = 1; k <= SPAN; k++) {
                  const x = gx + (k / SPAN) * gw
                  line(ctx, x, y, x, y + h, alpha(theme.text, 0.1))
                  text(ctx, `${k}τ`, x, y + h + 16, { color: theme.muted, size: 12, align: 'center' })
                }
                if (min < 0) line(ctx, gx, y + h / 2, gx + gw, y + h / 2, alpha(theme.text, 0.3))
                if (ref !== undefined) line(ctx, gx, y + h - ((ref - min) / (max - min)) * h, gx + gw, y + h - ((ref - min) / (max - min)) * h, alpha(color, 0.5), 1, [4, 4])
                chart(ctx, gx, y, gw, h, [{ data, color, width: 2.5 }], { min, max, span: SPAN * PER_TAU + 1, axis: theme.border })
              }
              plot(40, 160, s.vs, 0, V0, theme.accent, 'Capacitor voltage Vc', charging ? V0 * (1 - Math.exp(-1)) : s.vs[0] * Math.exp(-1))
              plot(290, 160, s.is.map((v) => v * 1000), -I0 * 1000, I0 * 1000, PALETTE[1], 'Current I (mA)')

              if (f.frame % 6 === 0) setInfo({ vc, i, since: s.since })
            }}
          />
          <Readout
            items={[
              ['τ = RC', tau >= 1 ? `${fmt(tau, 2)} s` : `${fmt(tau * 1000, 1)} ms`],
              ['Vc', `${fmt(info.vc, 2)} V`],
              ['Current I', `${fmt(info.i * 1000, 3)} mA`],
              ['Charge Q', `${fmt(C * info.vc * 1e6, 1)} µC`],
              ['Charged', `${fmt((info.vc / V0) * 100, 1)}%`],
              ['Since switch', `${fmt(info.since / tau, 2)} τ`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={resetAll}>
        <button type="button" className="btn" onClick={toggle}>
          {charging ? 'Switch to discharge' : 'Switch to charge'}
        </button>
      </PlayBar>
      <Slider label="Resistance R" value={Rk} min={1} max={100} unit=" kΩ" onChange={setRk} />
      <Slider label="Capacitance C" value={Cu} min={10} max={1000} step={10} unit=" µF" onChange={setCu} />
      <Slider label="Battery V0" value={V0} min={1} max={24} step={0.5} unit=" V" onChange={setV0} />
      <Slider label="Time scale" value={scale} min={0.1} max={10} step={0.1} unit="×" onChange={setScale} />
      <Hint>
        Tap the switch to flip between charging and discharging. After one time constant τ = RC the capacitor is 63.2% charged (or down to 36.8%); after 5τ it is practically done. The
        blue dots are electrons, so they move against the current arrow and slow down as the current dies away.
      </Hint>
    </SimLayout>
  )
}
