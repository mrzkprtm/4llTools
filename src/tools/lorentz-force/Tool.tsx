import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { borisStep, cyclotronPeriod, driftSpeed, larmorRadius, type Particle } from './lorentz'

const W = 800
const H = 480
const PLATE = 14
const PRESETS = [['circle', 'Circles (B only)'], ['drift', 'E × B drift'], ['selector', 'Velocity selector'], ['custom', 'Custom']] as const
type Preset = (typeof PRESETS)[number][0]

interface Shot extends Particle {
  q: number
  m: number
  trail: number[]
  age: number
  color: string
}

export default function LorentzForce() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<Preset>('circle')
  const [B, setB] = useState(1.5)
  const [E, setE] = useState(0)
  const [sign, setSign] = useState<'+' | '-'>('+')
  const [mass, setMass] = useState(1)
  const [speed, setSpeed] = useState(150)
  const [emitter, setEmitter] = useState(true)
  const [mixed, setMixed] = useState(false)
  const [count, setCount] = useState(0)
  const shots = useRef<Shot[]>([])
  const emitter0 = useRef({ x: 230, y: 330 })
  const [live, setLive] = useState(0)
  const clock = useRef(0.3)

  const q = sign === '+' ? 1 : -1

  function load(p: Preset) {
    setPreset(p)
    shots.current = []
    if (p === 'circle') (setB(1.5), setE(0), setMixed(false), (emitter0.current = { x: 230, y: 330 }))
    if (p === 'drift') (setB(1.5), setE(120), setMixed(false), (emitter0.current = { x: 6, y: H / 2 }))
    if (p === 'selector') (setB(1.5), setE(Math.round(speed * 1.5)), setMixed(true), (emitter0.current = { x: 6, y: H / 2 }))
  }

  function fire() {
    const v = mixed ? speed * (0.55 + Math.random() * 0.9) : speed
    const hueShift = mixed ? clamp((v / speed - 1) * 2, -1, 1) : 0
    const color = sign === '+' ? `hsl(${8 + hueShift * 30} 78% 52%)` : `hsl(${212 + hueShift * 30} 75% 52%)`
    shots.current = [...shots.current.slice(-29), { x: emitter0.current.x, y: emitter0.current.y, vx: v, vy: 0, q, m: mass, trail: [], age: 0, color }]
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    emitter0.current = { x: clamp(p.x, 6, W - 20), y: clamp(H - p.y, PLATE + 10, H - PLATE - 10) }
    fire()
    if (!running) setRunning(true)
  }

  const r = larmorRadius(mass, speed, q, B)
  const T = cyclotronPeriod(mass, q, B)
  const vd = driftSpeed(E, B)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Charged particles in a magnetic field of ${B} tesla and an electric field of ${E} volts per metre.`}
            onFrame={(ctx, f) => {
              const Y = (y: number) => H - y
              clear(ctx, W, H, theme.sunken)

              // Field symbols: ⊙ out of the screen, ⊗ into it.
              const a = B === 0 ? 0 : 0.18 + (Math.abs(B) / 3) * 0.35
              if (a > 0)
                for (let y = PLATE + 30; y < H - PLATE - 10; y += 50)
                  for (let x = 40; x < W; x += 50) {
                    const col = alpha(theme.text, a)
                    circle(ctx, x, y, 7, undefined, col, 1.3)
                    if (B > 0) circle(ctx, x, y, 2, col)
                    else {
                      line(ctx, x - 4.5, y - 4.5, x + 4.5, y + 4.5, col, 1.3)
                      line(ctx, x - 4.5, y + 4.5, x + 4.5, y - 4.5, col, 1.3)
                    }
                  }

              // Plates for the electric field (E points from + to −).
              if (E !== 0) {
                const topPlus = E < 0
                const plate = (y: number, plus: boolean) => {
                  rrect(ctx, 0, y, W, PLATE, 0, alpha(plus ? '#e03131' : '#1c6ed6', 0.75))
                  for (let x = 30; x < W; x += 60) text(ctx, plus ? '+' : '−', x, y + PLATE / 2 + 1, { color: '#fff', size: 14, align: 'center', baseline: 'middle', weight: 700 })
                }
                plate(0, topPlus)
                plate(H - PLATE, !topPlus)
                const dir = E > 0 ? -1 : 1
                for (let x = 65; x < W; x += 100) arrow(ctx, x, H / 2 - dir * 22, x, H / 2 + dir * 22, alpha('#f59f00', 0.25 + Math.min(0.4, Math.abs(E) / 600)), 2, 8)
              }

              // Predicted circle for the next particle when there is no electric field.
              if (E === 0 && Number.isFinite(r) && r < 3000) {
                const cy = emitter0.current.y - Math.sign(q * B) * r
                ctx.beginPath()
                ctx.arc(emitter0.current.x, Y(cy), r, 0, Math.PI * 2)
                ctx.setLineDash([4, 7])
                ctx.strokeStyle = alpha(theme.text, 0.25)
                ctx.lineWidth = 1.2
                ctx.stroke()
                ctx.setLineDash([])
              }

              // Emitter.
              if (running && emitter && f.dt > 0) {
                clock.current -= f.dt
                if (clock.current <= 0) {
                  clock.current = mixed ? 0.22 : 0.45
                  fire()
                }
              }
              const ex = emitter0.current.x
              const ey = Y(emitter0.current.y)
              rrect(ctx, ex - 22, ey - 9, 24, 18, 4, theme.text)
              circle(ctx, ex, ey, 3, sign === '+' ? '#e03131' : '#1c6ed6')

              // Particles.
              const alive: Shot[] = []
              for (const s of shots.current) {
                if (f.dt > 0) {
                  const n = 6
                  for (let i = 0; i < n; i++) borisStep(s, s.q / s.m, 0, E, B, f.dt / n)
                  s.age += f.dt
                  s.trail.push(s.x, Y(s.y))
                  if (s.trail.length > 1600) s.trail.splice(0, 2)
                }
                const out = s.x < -40 || s.x > W + 40 || s.y < PLATE - 4 || s.y > H - PLATE + 4
                if (out || s.age > 40) continue
                alive.push(s)
                ctx.beginPath()
                for (let i = 0; i < s.trail.length; i += 2) (i ? ctx.lineTo(s.trail[i], s.trail[i + 1]) : ctx.moveTo(s.trail[i], s.trail[i + 1]))
                ctx.strokeStyle = alpha(s.color, 0.7)
                ctx.lineWidth = 2
                ctx.stroke()
                circle(ctx, s.x, Y(s.y), 6, s.color, theme.surface, 1.5)
                text(ctx, s.q > 0 ? '+' : '−', s.x, Y(s.y) + 1, { color: '#fff', size: 12, align: 'center', baseline: 'middle', weight: 700 })
              }
              shots.current = alive

              const label = B === 0 ? 'B = 0' : B > 0 ? `B = ${fmt(B, 2)} T out of the screen ⊙` : `B = ${fmt(-B, 2)} T into the screen ⊗`
              rrect(ctx, W - 290, PLATE + 8, 280, 26, 6, alpha(theme.surface, 0.85))
              text(ctx, label, W - 150, PLATE + 22, { color: theme.text, size: 13, align: 'center', baseline: 'middle', weight: 700 })
              if (f.frame % 10 === 0) {
                if (alive.length !== count) setCount(alive.length)
                const last = alive[alive.length - 1]
                setLive(last ? Math.hypot(last.vx, last.vy) : 0)
              }
            }}
          />
          <Readout
            items={[
              ['Radius r = mv/qB', Number.isFinite(r) ? `${fmt(r, 1)} m` : '∞'],
              ['Period 2πm/qB', Number.isFinite(T) ? `${fmt(T, 2)} s` : '∞'],
              ['Drift E/B', Number.isFinite(vd) ? `${fmt(Math.abs(vd), 1)} m/s` : '—'],
              ['Newest speed', count ? `${fmt(live, 1)} m/s` : '—'],
              ['Particles', String(count)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (shots.current = [])} resetLabel="Clear">
        <button type="button" className="btn" onClick={fire}>
          Fire
        </button>
      </PlayBar>
      <Select label="Preset" value={preset} options={PRESETS} onChange={load} />
      <Slider label="Magnetic field B" value={B} min={-3} max={3} step={0.1} unit=" T" onChange={(v) => (setB(v), setPreset('custom'))} />
      <Slider label="Electric field E" value={E} min={-400} max={400} step={10} unit=" V/m" onChange={(v) => (setE(v), setPreset('custom'))} />
      <Choice label="Charge" value={sign} options={[['+', 'Positive +1 C'], ['-', 'Negative −1 C']]} onChange={setSign} />
      <Slider label="Mass" value={mass} min={0.5} max={5} step={0.1} unit=" kg" onChange={setMass} />
      <Slider label="Launch speed" value={speed} min={40} max={300} step={5} unit=" m/s" onChange={setSpeed} />
      <Toggle label="Continuous emitter" checked={emitter} onChange={setEmitter} />
      <Toggle label="Mixed speeds" checked={mixed} onChange={setMixed} />
      <Hint>
        Tap the stage to move the launcher there and fire. In a pure magnetic field the particle circles at constant speed; add an electric field and it drifts sideways at E/B whatever its
        charge. In the velocity selector only particles moving at exactly E/B fly straight.
      </Hint>
    </SimLayout>
  )
}
