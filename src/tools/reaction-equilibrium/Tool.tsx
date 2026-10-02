import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt, gaussian, pushCap } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { barriers, collisionEnergy, energyProfile, equilibriumK, fractionAbove, predictedK, reacts, thermalEnergy } from './equilibrium'

const W = 800
const H = 520
const BX = 16
const BY = 16
const BW = 460
const BH = 340
const MAX = 500
/** Speed² (px²/s²) per energy unit, so that 300 K gives typical speeds of about 90 px/s. */
const SCALE = 44 ** 2
const RADII = [6, 5, 6.5, 4.5]
const COLORS = ['#1c7ed6', '#f59f00', '#2f9e44', '#ae3ec9']
const NAMES = ['A', 'B', 'C', 'D']
const CELL = 16

type Species = 0 | 1 | 2 | 3

export default function ReactionEquilibrium() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [temp, setTemp] = useState(300)
  const [Ea, setEa] = useState(5)
  const [dH, setDH] = useState(-3)
  const [pick, setPick] = useState<Species>(0)
  const [info, setInfo] = useState({ n: [80, 80, 0, 0], K: NaN, fwd: 0, rev: 0, T: 300 })
  const sim = useRef({
    n: 0,
    x: new Float32Array(MAX),
    y: new Float32Array(MAX),
    vx: new Float32Array(MAX),
    vy: new Float32Array(MAX),
    kind: new Uint8Array(MAX),
    t: 0,
    hist: [[], [], [], []] as number[][],
    lastHist: 0,
    events: [] as [number, number, number, number][],
    ready: false,
  })
  const s = sim.current

  function spawn(kind: number, x?: number, y?: number) {
    if (s.n >= MAX) return
    const i = s.n++
    const r = RADII[kind]
    const sd = Math.sqrt(thermalEnergy(temp) * SCALE)
    s.x[i] = x ?? BX + r + Math.random() * (BW - 2 * r)
    s.y[i] = y ?? BY + r + Math.random() * (BH - 2 * r)
    s.vx[i] = gaussian() * sd
    s.vy[i] = gaussian() * sd
    s.kind[i] = kind
  }

  function remove(kind: number, count: number) {
    for (let i = s.n - 1; i >= 0 && count > 0; i--)
      if (s.kind[i] === kind) {
        const j = --s.n
        s.x[i] = s.x[j]
        s.y[i] = s.y[j]
        s.vx[i] = s.vx[j]
        s.vy[i] = s.vy[j]
        s.kind[i] = s.kind[j]
        count--
      }
  }

  function reset() {
    s.n = 0
    s.t = 0
    s.hist = [[], [], [], []]
    s.lastHist = -1
    s.events = []
    for (let k = 0; k < 80; k++) spawn(0)
    for (let k = 0; k < 80; k++) spawn(1)
    s.ready = true
  }
  if (!s.ready) reset()

  const bar = barriers(Ea, dH)

  function counts() {
    const c = [0, 0, 0, 0]
    for (let i = 0; i < s.n; i++) c[s.kind[i]]++
    return c
  }

  function step(dt: number) {
    const { x, y, vx, vy, kind } = s
    for (let i = 0; i < s.n; i++) {
      const r = RADII[kind[i]]
      x[i] += vx[i] * dt
      y[i] += vy[i] * dt
      if (x[i] < BX + r || x[i] > BX + BW - r) {
        vx[i] = x[i] < BX + r ? Math.abs(vx[i]) : -Math.abs(vx[i])
        x[i] = clamp(x[i], BX + r, BX + BW - r)
      }
      if (y[i] < BY + r || y[i] > BY + BH - r) {
        vy[i] = y[i] < BY + r ? Math.abs(vy[i]) : -Math.abs(vy[i])
        y[i] = clamp(y[i], BY + r, BY + BH - r)
      }
    }
    // Collisions through a spatial grid.
    const cols = Math.ceil(W / CELL)
    const grid = new Map<number, number[]>()
    for (let i = 0; i < s.n; i++) {
      const key = Math.floor(y[i] / CELL) * cols + Math.floor(x[i] / CELL)
      const list = grid.get(key)
      if (list) list.push(i)
      else grid.set(key, [i])
    }
    for (let i = 0; i < s.n; i++) {
      const cx = Math.floor(x[i] / CELL)
      const cy = Math.floor(y[i] / CELL)
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const list = grid.get((cy + oy) * cols + cx + ox)
          if (!list) continue
          for (const j of list) {
            if (j <= i) continue
            const dx = x[j] - x[i]
            const dy = y[j] - y[i]
            const rr = RADII[kind[i]] + RADII[kind[j]]
            const d2 = dx * dx + dy * dy
            if (d2 >= rr * rr || d2 === 0) continue
            const d = Math.sqrt(d2)
            const nx = dx / d
            const ny = dy / d
            const u = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny
            if (u <= 0) continue
            const E = collisionEnergy(1, 1, vx[i], vy[i], vx[j], vy[j], nx, ny, SCALE)
            const pair = kind[i] + kind[j] * 4
            let u2 = u
            // A+B (in either order) or C+D may react when the collision is hard enough.
            const fwd = pair === 0 + 1 * 4 || pair === 1 + 0 * 4
            const rev = pair === 2 + 3 * 4 || pair === 3 + 2 * 4
            if (fwd && reacts(E, bar.forward)) {
              kind[i] = kind[i] === 0 ? 2 : 3
              kind[j] = kind[j] === 0 ? 2 : 3
              u2 = u * Math.sqrt(Math.max(0, E - dH) / E)
              s.events.push([s.t, 1, (x[i] + x[j]) / 2, (y[i] + y[j]) / 2])
            } else if (rev && reacts(E, bar.reverse)) {
              kind[i] = kind[i] === 2 ? 0 : 1
              kind[j] = kind[j] === 2 ? 0 : 1
              u2 = u * Math.sqrt(Math.max(0, E + dH) / E)
              s.events.push([s.t, -1, (x[i] + x[j]) / 2, (y[i] + y[j]) / 2])
            }
            // Equal masses: swap normal motion, with the closing speed changed by the reaction energy.
            const k = (u + u2) / 2
            vx[i] -= k * nx
            vy[i] -= k * ny
            vx[j] += k * nx
            vy[j] += k * ny
          }
        }
    }
    s.t += dt
    while (s.events.length && s.events[0][0] < s.t - 4) s.events.shift()
  }

  function measuredT() {
    let ke = 0
    for (let i = 0; i < s.n; i++) ke += 0.5 * (s.vx[i] ** 2 + s.vy[i] ** 2)
    return s.n ? ke / s.n / SCALE / thermalEnergy(1) : temp
  }

  function thermostat(dt: number) {
    const T = measuredT()
    if (T <= 0) return
    const lam = Math.sqrt(clamp(1 + (dt / 0.6) * (temp / T - 1), 0.8, 1.25))
    for (let i = 0; i < s.n; i++) {
      s.vx[i] *= lam
      s.vy[i] *= lam
    }
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    if (p.x > BX + 8 && p.x < BX + BW - 8 && p.y > BY + 8 && p.y < BY + BH - 8) for (let k = 0; k < 3; k++) spawn(pick, p.x + gaussian() * 6, p.y + gaussian() * 6)
  }

  const kPred = predictedK(dH, temp)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Reaction box: ${info.n[0]} A, ${info.n[1]} B, ${info.n[2]} C and ${info.n[3]} D at ${temp} kelvin.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                for (let k = 0; k < 3; k++) step(f.dt / 3)
                thermostat(f.dt)
              }
              const c = counts()
              if (f.dt > 0 && s.t - s.lastHist > 0.25) {
                s.lastHist = s.t
                for (let k = 0; k < 4; k++) pushCap(s.hist[k], c[k], 360)
              }

              clear(ctx, W, H, theme.sunken)
              rrect(ctx, BX, BY, BW, BH, 6, theme.surface, theme.border, 2)
              for (const [t0, dir, ex, ey] of s.events) {
                const age = s.t - t0
                if (age > 0.5) continue
                circle(ctx, ex, ey, 6 + age * 50, undefined, alpha(dir > 0 ? COLORS[2] : COLORS[0], 1 - age * 2), 2)
              }
              for (let k = 0; k < 4; k++) {
                ctx.beginPath()
                for (let i = 0; i < s.n; i++) {
                  if (s.kind[i] !== k) continue
                  ctx.moveTo(s.x[i] + RADII[k], s.y[i])
                  ctx.arc(s.x[i], s.y[i], RADII[k], 0, TAU)
                }
                ctx.fillStyle = COLORS[k]
                ctx.fill()
              }

              // Energy diagram with the Boltzmann tail shaded.
              const px = 500
              const py = 16
              const pw = 284
              const ph = 340
              rrect(ctx, px, py, pw, ph, 6, theme.surface, theme.border)
              text(ctx, 'energy diagram (kJ/mol)', px + 10, py + 20, { color: theme.text, size: 13, weight: 700, mono: false })
              const eLo = Math.min(0, dH) - 3
              const eHi = Math.max(bar.forward, 0) + 5
              const gx = px + 60
              const gw = pw - 80
              const gy = py + 40
              const gh = ph - 80
              const EY = (e: number) => gy + gh - ((e - eLo) / (eHi - eLo)) * gh
              const kT = thermalEnergy(temp)
              // Distribution of collision energies above each well (width ∝ e^(−E/RT)).
              for (const [base, x0, dir, thr] of [[0, gx, 1, bar.forward], [dH, gx + gw, -1, bar.reverse + dH]] as const) {
                for (let e = base; e < eHi; e += 0.15) {
                  const wv = Math.exp(-(e - base) / kT) * 44
                  ctx.fillStyle = e >= thr ? alpha(theme.accent, 0.6) : alpha(theme.muted, 0.22)
                  ctx.fillRect(dir > 0 ? x0 : x0 - wv, EY(e + 0.15), wv, Math.max(1, EY(e) - EY(e + 0.15)))
                }
              }
              ctx.beginPath()
              for (let k = 0; k <= 100; k++) {
                const sx = k / 100
                const yy = EY(energyProfile(sx, Ea, dH))
                if (k) ctx.lineTo(gx + sx * gw, yy)
                else ctx.moveTo(gx + sx * gw, yy)
              }
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 2.5
              ctx.stroke()
              line(ctx, gx + gw * 0.1, EY(bar.forward), gx + gw * 0.9, EY(bar.forward), alpha(theme.accent, 0.8), 1, [4, 4])
              text(ctx, 'A + B', gx + 6, EY(0) + 18, { color: theme.text, size: 13, weight: 700 })
              text(ctx, 'C + D', gx + gw - 6, EY(dH) + 18, { color: theme.text, size: 13, weight: 700, align: 'right' })
              text(ctx, `Ea ${fmt(bar.forward, 1)}`, gx + gw / 2, EY(bar.forward) - 8, { color: theme.accent, size: 12, align: 'center', weight: 700 })
              line(ctx, px + 54, gy, px + 54, gy + gh, theme.border)
              for (let e = Math.ceil(eLo / 5) * 5; e <= eHi; e += 5) text(ctx, String(e), px + 50, EY(e) + 4, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, `ΔH ${dH > 0 ? '+' : ''}${fmt(dH, 1)} kJ/mol (${dH < 0 ? 'exothermic' : dH > 0 ? 'endothermic' : 'thermoneutral'})`, px + 10, py + ph - 26, { color: theme.muted, size: 12 })
              text(ctx, `shaded: ${fmt(fractionAbove(bar.forward, temp) * 100, 1)}% of A+B hits react`, px + 10, py + ph - 10, { color: theme.accent, size: 12 })

              // Counts over time.
              const cy = 386
              chart(ctx, BX, cy, W - 2 * BX, H - cy - 14, s.hist.map((d, k) => ({ data: d, color: COLORS[k], width: 2 })), { min: 0, axis: theme.border, span: 360 })
              text(ctx, 'molecules over time', BX, cy - 8, { color: theme.muted, size: 12 })
              c.forEach((v, k) => text(ctx, `${NAMES[k]} ${v}`, W - BX - (3 - k) * 70, cy - 8, { color: COLORS[k], size: 13, weight: 700, align: 'right' }))

              if (f.frame % 12 === 0) {
                const avg = s.hist.map((d) => {
                  const tail = d.slice(-24)
                  return tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0
                })
                let fw = 0
                let rv = 0
                for (const e of s.events) {
                  if (e[1] > 0) fw++
                  else rv++
                }
                const span = Math.max(0.5, Math.min(4, s.t))
                setInfo({ n: c, K: equilibriumK(avg[0], avg[1], avg[2], avg[3]), fwd: fw / span, rev: rv / span, T: measuredT() })
              }
            }}
          />
          <Readout
            items={[
              ['A | B', `${info.n[0]} | ${info.n[1]}`],
              ['C | D', `${info.n[2]} | ${info.n[3]}`],
              ['K measured', Number.isFinite(info.K) ? fmt(info.K, 2) : info.K > 0 ? '∞' : '—'],
              ['K = e^(−ΔH/RT)', fmt(kPred, 2)],
              ['Rate → | ← per s', `${fmt(info.fwd, 1)} | ${fmt(info.rev, 1)}`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} />
      <Slider label="Temperature" value={temp} min={100} max={900} step={10} unit=" K" onChange={setTemp} />
      <Slider label="Activation energy Ea" value={Ea} min={1} max={15} step={0.5} unit=" kJ/mol" onChange={setEa} />
      <Slider label="Reaction enthalpy ΔH" value={dH} min={-8} max={8} step={0.5} unit=" kJ/mol" onChange={setDH} />
      <Choice label="Molecule" value={pick} options={NAMES.map((n, i) => [i as Species, n] as const)} onChange={setPick} />
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => { for (let k = 0; k < 20; k++) spawn(pick) }}>
          Add 20 {NAMES[pick]}
        </button>
        <button type="button" className="btn" onClick={() => remove(pick, 20)}>
          Remove 20 {NAMES[pick]}
        </button>
      </div>
      <Legend items={NAMES.map((n, i) => [COLORS[i], n] as const)} />
      <Hint>
        A and B react only when they collide harder than Ea (the shaded tail). Once forward and reverse rates match, K settles near e^(−ΔH/RT). Add A or remove C and watch the balance shift back (Le Chatelier); heating an exothermic reaction lowers K. Click the box to drop in molecules.
      </Hint>
    </SimLayout>
  )
}
