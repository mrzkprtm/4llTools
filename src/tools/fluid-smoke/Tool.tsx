import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, makeBuffer } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { useTheme } from '../../sim/theme'
import { Fluid } from './fluid'

const W = 800
const H = 500
const NX = 128
const NY = 80
const CELL = W / NX
const BG = [13, 12, 11]

type Dye = 'rainbow' | 'accent' | 'smoke'

function hsl(h: number, s = 0.85, l = 0.55): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return Number.isFinite(n) ? [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] : [1, 0.45, 0.2]
}

export default function FluidSmoke() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [dyeMode, setDyeMode] = useState<Dye>('rainbow')
  const [visc, setVisc] = useState(0)
  const [fade, setFade] = useState(0.15)
  const [vort, setVort] = useState(5)
  const [buoy, setBuoy] = useState(false)
  const [auto, setAuto] = useState(true)
  const [arrows, setArrows] = useState(false)
  const [stats, setStats] = useState({ dye: 0, vmax: 0, ms: 0 })
  const fluid = useRef<Fluid | null>(null)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const idle = useRef(10)
  const clock = useRef(0)

  const sim = () => (fluid.current ??= new Fluid(NX, NY))

  function colour(): [number, number, number] {
    if (dyeMode === 'smoke') return [0.8, 0.8, 0.8]
    if (dyeMode === 'accent') return hexRgb(theme.accent)
    return hsl((clock.current * 50) % 360)
  }

  function onPointer(p: SimPointer) {
    const fl = sim()
    const x = p.x / CELL + 0.5
    const y = p.y / CELL + 0.5
    if (p.type === 'down') {
      last.current = { x, y }
      const [r, g, b] = colour()
      fl.addDye(x, y, r * 1.5, g * 1.5, b * 1.5, 4)
    }
    if (p.type === 'up') last.current = null
    if (!p.down || !last.current) return
    idle.current = 0
    const dx = x - last.current.x
    const dy = y - last.current.y
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy)))
    const [r, g, b] = colour()
    for (let i = 1; i <= n; i++) {
      const px = last.current.x + (dx * i) / n
      const py = last.current.y + (dy * i) / n
      fl.addVelocity(px, py, (dx / n) * 55, (dy / n) * 55, 3.5)
      fl.addDye(px, py, r * 0.35, g * 0.35, b * 0.35, 3)
    }
    last.current = { x, y }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            className="sim-dark"
            maxDpr={1.5}
            label="A tank of fluid with coloured dye swirling in the flow."
            onFrame={(ctx, f) => {
              const fl = sim()
              const dt = Math.min(f.dt, 1 / 30)
              if (dt > 0) {
                clock.current += dt
                idle.current += dt
                // A gentle wandering jet keeps the tank alive until someone stirs it.
                if (auto && idle.current > 2.5) {
                  const t = clock.current
                  const ex = NX / 2 + Math.sin(t * 0.6) * NX * 0.3
                  const ey = NY - 5
                  const a = -Math.PI / 2 + Math.sin(t * 1.7) * 0.45
                  const [r, g, b] = colour()
                  fl.nudgeVelocity(ex, ey, Math.cos(a) * 45, Math.sin(a) * 45, 3, 0.35)
                  fl.addDye(ex, ey, r * 12 * dt, g * 12 * dt, b * 12 * dt, 3)
                }
                const t0 = performance.now()
                fl.step(dt, { visc, fade, vorticity: vort, buoyancy: buoy ? 25 : 0, iterations: 16 })
                if (f.frame % 12 === 0) {
                  let vmax = 0
                  for (let k = 0; k < fl.size; k += 3) vmax = Math.max(vmax, Math.abs(fl.u[k]) + Math.abs(fl.v[k]))
                  setStats({ dye: fl.totalDye(), vmax: vmax * CELL, ms: performance.now() - t0 })
                }
              }

              // Dye → pixels, one per cell, smoothed when scaled up.
              if (!buf.current) buf.current = makeBuffer(NX, NY)
              const b = buf.current
              const [R, G, B] = fl.dye
              for (let j = 1; j <= NY; j++)
                for (let i = 1; i <= NX; i++) {
                  const k = fl.IX(i, j)
                  const o = ((j - 1) * NX + (i - 1)) * 4
                  b.data[o] = BG[0] + (255 - BG[0]) * (1 - Math.exp(-1.4 * R[k]))
                  b.data[o + 1] = BG[1] + (255 - BG[1]) * (1 - Math.exp(-1.4 * G[k]))
                  b.data[o + 2] = BG[2] + (255 - BG[2]) * (1 - Math.exp(-1.4 * B[k]))
                  b.data[o + 3] = 255
                }
              b.flush()
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(b.canvas, 0, 0, W, H)

              if (arrows)
                for (let j = 3; j <= NY; j += 5)
                  for (let i = 3; i <= NX; i += 5) {
                    const k = fl.IX(i, j)
                    const x = (i - 0.5) * CELL
                    const y = (j - 0.5) * CELL
                    const s = Math.min(1, 12 / (Math.hypot(fl.u[k], fl.v[k]) * 0.25 + 1e-9))
                    arrow(ctx, x, y, x + fl.u[k] * 0.25 * s, y + fl.v[k] * 0.25 * s, 'rgba(255,255,255,0.55)', 1.2, 5)
                  }
            }}
          />
          <Readout
            items={[
              ['Grid', `${NX} × ${NY}`],
              ['Dye in the tank', fmt(stats.dye, 0)],
              ['Fastest flow', `${fmt(stats.vmax, 0)} px/s`],
              ['Solver step', `${fmt(stats.ms, 1)} ms`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => sim().clear()} resetLabel="Clear" />
      <Choice label="Dye" value={dyeMode} options={[['rainbow', 'Rainbow'], ['accent', 'Accent'], ['smoke', 'Smoke']]} onChange={setDyeMode} />
      <Slider label="Viscosity" value={visc} min={0} max={3} step={0.1} unit=" cell²/s" onChange={setVisc} />
      <Slider label="Dye fade" value={fade} min={0} max={1} step={0.01} unit=" /s" onChange={setFade} />
      <Slider label="Vorticity boost" value={vort} min={0} max={20} step={1} onChange={setVort} />
      <Toggle label="Buoyancy (smoke rises)" checked={buoy} onChange={setBuoy} />
      <Toggle label="Auto-stir when idle" checked={auto} onChange={setAuto} />
      <Toggle label="Show velocity arrows" checked={arrows} onChange={setArrows} />
      <Hint>
        Drag across the tank to push the fluid and squirt dye. Every step the solver moves the dye with the flow, then removes any squeezing so the fluid stays incompressible, which is what
        rolls it up into eddies. Turn fade to 0 to keep all the dye.
      </Hint>
    </SimLayout>
  )
}
