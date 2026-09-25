import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt, pushCap } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { SOLAR, absorbedSolar, emissivityFromCO2, equilibriumTemp, outgoing, stepClimate, type ClimateState } from './climate'

const W = 800
const H = 540
const SW = 600
const TOP = 56
const AIR0 = 90
const AIR1 = 340
const GROUND = 372
const HIT = 14
const SUN = '#fcc419'
const IR = '#fa5252'
const K = 273.15

interface Photon {
  ir: boolean
  x: number
  y: number
  vx: number
  vy: number
  /** Sunlight: height at which it bounces back (0 = absorbed by the ground). */
  bounce: number
  phase: number
}
interface Molecule {
  x: number
  y: number
  vx: number
  vy: number
  a: number
  excited: number
}

const CLOUDS = [
  [90, 150, 110],
  [330, 128, 130],
  [480, 176, 100],
  [210, 196, 90],
] as const

function startState(): ClimateState {
  const ts = equilibriumTemp(SOLAR, 0.3, emissivityFromCO2(280))
  return { ts, ta: ts / 2 ** 0.25 }
}

export default function GreenhouseEffect() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [ppm, setPpm] = useState(420)
  const [albedo, setAlbedo] = useState(0.3)
  const [speed, setSpeed] = useState(1)
  const [photons, setPhotons] = useState(true)
  const [info, setInfo] = useState({ ts: startState().ts, years: 0, out: 0 })
  const sim = useRef({ climate: startState(), years: 0, hist: [] as number[], lastHist: 0, ph: [] as Photon[], mol: [] as Molecule[], sunAcc: 0, irAcc: 0, glow: 0 })
  const s = sim.current

  const eps = emissivityFromCO2(ppm)
  const eq = equilibriumTemp(SOLAR, albedo, eps)
  const clouds = Math.round(clamp((albedo - 0.12) / 0.4, 0, 1) * 4)
  const ice = clamp((albedo - 0.1) / 0.5, 0, 1) * 0.5

  function reset() {
    s.climate = startState()
    s.years = 0
    s.hist = []
    s.ph = []
    setInfo({ ts: s.climate.ts, years: 0, out: outgoing(s.climate, eps) })
  }

  const underCloud = (x: number) => CLOUDS.slice(0, clouds).find(([cx, , w]) => Math.abs(x - cx) < w / 2)

  function update(dt: number) {
    // Greenhouse molecules: enough that an IR photon crossing the air is caught with chance ε.
    const want = Math.round((-Math.log(1 - Math.min(eps, 0.97)) * SW * (AIR1 - AIR0)) / (2 * HIT * (AIR1 - AIR0)))
    while (s.mol.length < want) s.mol.push({ x: Math.random() * SW, y: AIR0 + Math.random() * (AIR1 - AIR0), vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 10, a: Math.random() * TAU, excited: 0 })
    if (s.mol.length > want) s.mol.length = want
    for (const m of s.mol) {
      m.x = (m.x + m.vx * dt + SW) % SW
      m.y += m.vy * dt
      if (m.y < AIR0 || m.y > AIR1) m.vy = -m.vy
      m.a += dt * 0.6
      if (m.excited > 0) {
        m.excited -= dt
        if (m.excited <= 0) {
          // Re-emit the absorbed infrared in a random direction: half of it heads back down.
          const a = Math.random() * TAU
          s.ph.push({ ir: true, x: m.x, y: m.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, bounce: 0, phase: Math.random() * TAU })
        }
      }
    }
    if (!photons) {
      s.ph = []
      return
    }
    // Sunlight in (a share `albedo` bounces off clouds or ice), infrared out at a rate ∝ σT⁴.
    s.sunAcc += dt * 9
    while (s.sunAcc >= 1) {
      s.sunAcc--
      const x = Math.random() * (SW - 60)
      let bounce = 0
      if (Math.random() < albedo) {
        const c = underCloud(x + 30)
        bounce = c ? c[1] + 22 : GROUND
      }
      s.ph.push({ ir: false, x, y: 0, vx: 48, vy: 260, bounce, phase: 0 })
    }
    s.irAcc += dt * 9 * (s.climate.ts / 288) ** 4
    while (s.irAcc >= 1) {
      s.irAcc--
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8
      s.ph.push({ ir: true, x: Math.random() * SW, y: GROUND - 2, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, bounce: 0, phase: Math.random() * TAU })
    }
    const keep: Photon[] = []
    for (const p of s.ph) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.phase += dt * 30
      if (p.x < -20 || p.x > SW + 20 || p.y < -20) continue
      if (!p.ir) {
        if (p.bounce && p.vy > 0 && p.y >= p.bounce) {
          p.vy = -p.vy
          p.y = p.bounce
        }
        if (p.y >= GROUND && p.vy > 0) {
          s.glow = 1
          continue
        }
      } else {
        if (p.y >= GROUND && p.vy > 0) {
          s.glow = 1
          continue
        }
        if (p.y > AIR0 - 10 && p.y < AIR1 + 10) {
          const m = s.mol.find((q) => q.excited <= 0 && Math.abs(q.x - p.x) < HIT && Math.abs(q.y - p.y) < HIT && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < HIT * HIT)
          if (m) {
            m.excited = 0.35
            continue
          }
        }
      }
      keep.push(p)
    }
    s.ph = keep.slice(-500)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            label={`Greenhouse effect model at ${ppm} ppm CO2 and albedo ${albedo}: surface ${fmt(info.ts - K, 1)} °C, heading to ${fmt(eq - K, 1)} °C.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                s.climate = stepClimate(s.climate, f.dt, SOLAR, albedo, eps)
                s.years += f.dt
                update(f.dt)
                if (s.years - s.lastHist > 0.1 || !s.hist.length) {
                  s.lastHist = s.years
                  pushCap(s.hist, s.climate.ts - K, 600)
                }
              }
              s.glow = Math.max(0, s.glow - 0.05)
              const ts = s.climate.ts

              clear(ctx, W, H, theme.sunken)
              // Sky, space and ground.
              const sky = ctx.createLinearGradient(0, 0, 0, GROUND)
              sky.addColorStop(0, '#0b1026')
              sky.addColorStop(TOP / GROUND, '#1b2a55')
              sky.addColorStop(1, '#6fa8dc')
              ctx.fillStyle = sky
              ctx.fillRect(0, 0, SW, GROUND)
              for (let k = 0; k < 24; k++) circle(ctx, (k * 97) % SW, (k * 37) % (TOP - 6) + 4, 1, 'rgba(255,255,255,0.6)')
              text(ctx, 'space', 10, 20, { color: '#adb5bd', size: 12 })
              text(ctx, `atmosphere · ${ppm} ppm CO₂`, 10, AIR0 - 10, { color: '#dee2e6', size: 12 })
              const warm = clamp((ts - K + 10) / 45, 0, 1)
              ctx.fillStyle = `rgb(${Math.round(70 + warm * 90)}, ${Math.round(120 - warm * 40)}, ${Math.round(60 - warm * 20)})`
              ctx.fillRect(0, GROUND, SW, 60)
              ctx.fillStyle = alpha('#ffb703', s.glow * 0.25)
              ctx.fillRect(0, GROUND, SW, 60)
              ctx.fillStyle = '#e9f5ff'
              ctx.fillRect(0, GROUND, SW * ice * 0.5, 12)
              ctx.fillRect(SW * (1 - ice * 0.5), GROUND, SW * ice * 0.5, 12)
              text(ctx, 'ground', 10, GROUND + 50, { color: '#fff', size: 12 })
              // Sun.
              circle(ctx, SW - 40, 26, 18, SUN)
              circle(ctx, SW - 40, 26, 26, alpha(SUN, 0.25))
              // Clouds.
              for (const [cx, cy, cw] of CLOUDS.slice(0, clouds)) {
                ctx.fillStyle = 'rgba(248,249,250,0.9)'
                ctx.beginPath()
                ctx.ellipse(cx, cy, cw / 2, 18, 0, 0, TAU)
                ctx.ellipse(cx - cw / 5, cy - 12, cw / 4, 16, 0, 0, TAU)
                ctx.ellipse(cx + cw / 6, cy - 10, cw / 4.5, 14, 0, 0, TAU)
                ctx.fill()
              }
              // Greenhouse gas molecules (O=C=O), shaking while they hold a photon.
              for (const m of s.mol) {
                const shake = m.excited > 0 ? Math.sin(f.frame * 1.7) * 2 : 0
                const dx = Math.cos(m.a) * (7 + shake)
                const dy = Math.sin(m.a) * (7 + shake)
                if (m.excited > 0) circle(ctx, m.x, m.y, 13, alpha(IR, 0.35))
                line(ctx, m.x - dx, m.y - dy, m.x + dx, m.y + dy, '#ced4da', 2)
                circle(ctx, m.x - dx, m.y - dy, 3.6, '#ff6b6b')
                circle(ctx, m.x + dx, m.y + dy, 3.6, '#ff6b6b')
                circle(ctx, m.x, m.y, 4, '#343a40', '#ced4da', 1)
              }
              // Photons.
              for (const p of s.ph) {
                const sp = Math.hypot(p.vx, p.vy)
                const ux = p.vx / sp
                const uy = p.vy / sp
                if (!p.ir) {
                  line(ctx, p.x - ux * 14, p.y - uy * 14, p.x, p.y, SUN, 3)
                  circle(ctx, p.x, p.y, 3, '#fff3bf')
                } else {
                  ctx.beginPath()
                  for (let k = 0; k <= 12; k++) {
                    const t = k / 12
                    const w = Math.sin(t * TAU * 2 + p.phase) * 3
                    const x = p.x - ux * t * 18 - uy * w
                    const y = p.y - uy * t * 18 + ux * w
                    if (k) ctx.lineTo(x, y)
                    else ctx.moveTo(x, y)
                  }
                  ctx.strokeStyle = IR
                  ctx.lineWidth = 2
                  ctx.stroke()
                }
              }

              // Thermometer.
              const tx = 668
              const t0 = 50
              const t1 = 360
              const tempY = (c: number) => t1 - ((clamp(c, -30, 40) + 30) / 70) * (t1 - t0)
              rrect(ctx, tx - 9, t0 - 8, 18, t1 - t0 + 20, 9, theme.surface, theme.border, 2)
              const col = `hsl(${Math.round(220 - warm * 220)} 75% 50%)`
              rrect(ctx, tx - 5, tempY(ts - K), 10, t1 - tempY(ts - K) + 10, 5, col)
              circle(ctx, tx, t1 + 22, 18, col, theme.border, 2)
              for (let c = -30; c <= 40; c += 10) {
                line(ctx, tx + 10, tempY(c), tx + 18, tempY(c), theme.muted, 1.5)
                text(ctx, `${c}°`, tx + 22, tempY(c) + 4, { color: theme.muted, size: 12 })
              }
              const ey = tempY(eq - K)
              ctx.beginPath()
              ctx.moveTo(tx - 12, ey)
              ctx.lineTo(tx - 22, ey - 6)
              ctx.lineTo(tx - 22, ey + 6)
              ctx.closePath()
              ctx.fillStyle = theme.accent
              ctx.fill()
              text(ctx, `${fmt(ts - K, 1)} °C`, tx, t0 - 20, { color: theme.text, size: 16, weight: 700, align: 'center' })
              text(ctx, '▸ equilibrium', tx + 6, t1 + 58, { color: theme.accent, size: 12, align: 'center' })
              text(ctx, `${fmt(eq - K, 1)} °C`, tx + 6, t1 + 74, { color: theme.accent, size: 12, align: 'center', weight: 700 })

              // Energy budget arrows (W/m²).
              const inW = absorbedSolar(SOLAR, albedo)
              const outW = outgoing(s.climate, eps)
              const bx = 724
              text(ctx, 'W/m²', bx + 30, 60, { color: theme.muted, size: 12, align: 'center' })
              rrect(ctx, bx + 6, 76, 20, clamp(inW, 0, 400) * 0.55, 3, alpha(SUN, 0.85))
              rrect(ctx, bx + 34, 76, 20, clamp(outW, 0, 400) * 0.55, 3, alpha(IR, 0.85))
              text(ctx, 'in', bx + 16, 76 + inW * 0.55 + 16, { color: theme.text, size: 12, align: 'center' })
              text(ctx, fmt(inW, 0), bx + 16, 76 + inW * 0.55 + 30, { color: theme.muted, size: 12, align: 'center' })
              text(ctx, 'out', bx + 44, 76 + outW * 0.55 + 16, { color: theme.text, size: 12, align: 'center' })
              text(ctx, fmt(outW, 0), bx + 44, 76 + outW * 0.55 + 30, { color: theme.muted, size: 12, align: 'center' })

              // Temperature history.
              const cy = 458
              const chH = H - cy - 12
              const lo = Math.min(eq - K, ...s.hist) - 0.5
              const hi = Math.max(eq - K, ...s.hist) + 0.5
              text(ctx, `surface temperature over ${fmt(s.years, 0)} years (dashed: equilibrium)`, 10, cy - 8, { color: theme.muted, size: 12 })
              chart(ctx, 10, cy, W - 20, chH, [{ data: s.hist, color: theme.accent, width: 2.5 }], { min: lo, max: hi, axis: theme.border, span: 600 })
              const eqY = cy + chH - ((eq - K - lo) / (hi - lo)) * chH
              line(ctx, 10, eqY, W - 10, eqY, alpha(theme.accent, 0.6), 1, [5, 5])
              text(ctx, `${fmt(hi, 1)}°`, W - 12, cy + 12, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, `${fmt(lo, 1)}°`, W - 12, cy + chH - 4, { color: theme.muted, size: 12, align: 'right' })

              if (f.frame % 10 === 0) setInfo({ ts, years: s.years, out: outW })
            }}
          />
          <Readout
            items={[
              ['Surface', `${fmt(info.ts - K, 1)} °C`],
              ['Sunlight in', `${fmt(absorbedSolar(SOLAR, albedo), 0)} W/m²`],
              ['Heat out', `${fmt(info.out, 0)} W/m²`],
              ['CO₂', `${ppm} ppm`],
              ['IR absorbed ε', fmt(eps, 2)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} />
      <Slider label="CO₂ concentration" value={ppm} min={0} max={2000} step={10} unit=" ppm" onChange={setPpm} />
      <Choice label="Presets" value={ppm} options={[[280, 'Pre-industrial'], [420, 'Today'], [1000, 'High']]} onChange={setPpm} />
      <Slider label="Albedo (clouds and ice)" value={albedo} min={0.1} max={0.6} step={0.01} onChange={setAlbedo} />
      <Slider label="Years per second" value={speed} min={0.5} max={8} step={0.5} onChange={setSpeed} />
      <Toggle label="Show photons" checked={photons} onChange={setPhotons} />
      <Legend items={[[SUN, 'sunlight (visible)'], [IR, 'infrared heat'], ['#ff6b6b', 'CO₂ molecule']]} />
      <Hint>
        Sunlight passes through the air and warms the ground, which glows in infrared. Greenhouse molecules catch that infrared and send about half of it back down, so the surface warms until heat out balances sunlight in. Raise CO₂ and watch the temperature creep towards its new equilibrium.
      </Hint>
    </SimLayout>
  )
}
