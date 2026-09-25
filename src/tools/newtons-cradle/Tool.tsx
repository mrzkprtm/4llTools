import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, rad } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { tone } from '../../sim/audio'
import { ballX, energy, momentum, pivotX, resolveContacts, stepPendulums, type Ball, type Rig } from './cradle'

const W = 800
const H = 480
const RIG: Rig = { L: 0.3, r: 0.025, g: 9.81, m: 0.1 }
const PX = 880 // pixels per metre
const CX = W / 2
const PY = 70
const SUB = 1 / 2000

function lifted(n: number, k: number, deg = -32): Ball[] {
  return Array.from({ length: n }, (_, i) => ({ th: i < k ? rad(deg) : 0, w: 0 }))
}

export default function NewtonsCradle() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(5)
  const [e, setE] = useState(1)
  const [damping, setDamping] = useState(0.02)
  const [sound, setSound] = useState(true)
  const [stats, setStats] = useState({ p: 0, E: 0 })
  const [hits, setHits] = useState(0)
  const balls = useRef<Ball[]>(lifted(5, 1))
  const held = useRef(-1)
  const acc = useRef(0)
  const hitCount = useRef(0)
  const armed = useRef(false)
  const lastClick = useRef(0)

  function load(count: number, k: number) {
    balls.current = lifted(count, k)
    hitCount.current = 0
    setHits(0)
    armed.current = true
    if (!running) setRunning(true)
  }

  function onPointer(p: SimPointer) {
    const bs = balls.current
    const N = bs.length
    if (p.type === 'down') {
      armed.current = true
      held.current = -1
      bs.forEach((b, i) => {
        const bx = CX + ballX(b, i, N, RIG) * PX
        const by = PY + Math.cos(b.th) * RIG.L * PX
        if (Math.hypot(p.x - bx, p.y - by) < RIG.r * PX + 10) held.current = i
      })
    }
    const k = held.current
    if (k >= 0 && p.down) {
      const s = clamp((p.x - CX) / PX - pivotX(k, N, RIG.r), -RIG.L * 0.8, RIG.L * 0.8) / RIG.L
      const th = Math.asin(s)
      // Balls beyond the dragged one on that side come along; the rest hang still.
      bs.forEach((b, i) => {
        b.w = 0
        b.th = (th < 0 && i <= k) || (th > 0 && i >= k) ? th : 0
      })
    }
    if (p.type === 'up') held.current = -1
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Newton's cradle with ${n} balls and restitution ${e}.`}
            onFrame={(ctx, f) => {
              const bs = balls.current
              const N = bs.length
              if (f.dt > 0 && held.current < 0) {
                acc.current = Math.min(acc.current + f.dt, 0.05)
                let loud = 0
                while (acc.current >= SUB) {
                  acc.current -= SUB
                  stepPendulums(bs, SUB, RIG, damping)
                  const r = resolveContacts(bs, RIG, e)
                  // Count real impacts, not the gentle resting contacts of balls leaning on each other.
                  if (r.hits && r.speed > 0.01) {
                    hitCount.current++
                    loud = Math.max(loud, r.speed)
                  }
                }
                const now = performance.now()
                if (sound && armed.current && loud > 0.03 && now - lastClick.current > 40) {
                  lastClick.current = now
                  tone(2300 + Math.random() * 300, 30, 'triangle', clamp(loud * 0.05, 0.004, 0.07))
                }
              }

              clear(ctx, W, H, theme.sunken)
              // Frame.
              const half = (N * RIG.r + 0.08) * PX
              rrect(ctx, CX - half, PY - 16, half * 2, 12, 4, alpha(theme.text, 0.8))
              line(ctx, CX - half + 6, PY - 6, CX - half + 6, H - 60, alpha(theme.text, 0.35), 5)
              line(ctx, CX + half - 6, PY - 6, CX + half - 6, H - 60, alpha(theme.text, 0.35), 5)
              rrect(ctx, CX - half - 30, H - 64, half * 2 + 60, 14, 5, alpha(theme.text, 0.25))

              const maxE = Math.max(1e-9, energy(bs, RIG))
              bs.forEach((b, i) => {
                const px = CX + pivotX(i, N, RIG.r) * PX
                const bx = CX + ballX(b, i, N, RIG) * PX
                const by = PY + Math.cos(b.th) * RIG.L * PX
                line(ctx, px, PY - 4, bx, by, alpha(theme.text, 0.55), 1.5)
                const g = ctx.createRadialGradient(bx - 7, by - 8, 2, bx, by, RIG.r * PX)
                g.addColorStop(0, '#ffffff')
                g.addColorStop(0.35, '#c9ccd2')
                g.addColorStop(1, '#5d626c')
                circle(ctx, bx, by, RIG.r * PX, undefined, alpha(theme.text, 0.4), 1)
                ctx.fillStyle = g
                ctx.fill()
                if (i === held.current) circle(ctx, bx, by, RIG.r * PX + 5, undefined, theme.accent, 2.5)
                // Energy bar under each ball's pivot.
                const ke = 0.5 * RIG.m * (RIG.L * b.w) ** 2 + RIG.m * RIG.g * RIG.L * (1 - Math.cos(b.th))
                const bw = RIG.r * PX * 1.4
                rrect(ctx, px - bw / 2, H - 36 - 0, bw, 6, 2, alpha(theme.text, 0.12))
                rrect(ctx, px - bw / 2, H - 36, bw * clamp(ke / maxE, 0, 1), 6, 2, theme.accent)
              })
              text(ctx, 'energy per ball', CX, H - 12, { color: theme.muted, size: 12, align: 'center' })

              if (f.frame % 8 === 0) {
                setStats({ p: momentum(bs, RIG), E: energy(bs, RIG) })
                if (hitCount.current !== hits) setHits(hitCount.current)
              }
            }}
          />
          <Readout
            items={[
              ['Total momentum', `${fmt(stats.p, 3)} kg·m/s`],
              ['Total energy', `${fmt(stats.E * 1000, 1)} mJ`],
              ['Collisions', String(hits)],
              ['Restitution', fmt(e, 3)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => load(n, 1)} />
      <div className="row sim-bar">
        {[1, 2, 3].map((k) => (
          <button key={k} type="button" className="btn" onClick={() => load(n, k)} disabled={k >= n}>
            Lift {k}
          </button>
        ))}
      </div>
      <Slider label="Balls" value={n} min={3} max={7} onChange={(v) => (setN(v), (balls.current = lifted(v, 1)))} />
      <Slider label="Restitution e" value={e} min={0.8} max={1} step={0.005} format={(v) => v.toFixed(3)} onChange={setE} />
      <Slider label="Air damping" value={damping} min={0} max={0.5} step={0.01} unit=" /s" onChange={setDamping} />
      <Toggle label="Click sound" checked={sound} onChange={setSound} />
      <Hint>
        Drag a ball sideways and let go; the balls beyond it come along. Lift one and exactly one flies out, lift two and two fly out: that is the only way to pass on both the momentum and
        the energy. Lower the restitution and the middle balls start to join in.
      </Hint>
    </SimLayout>
  )
}
