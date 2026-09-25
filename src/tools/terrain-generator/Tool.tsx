import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import { clamp, fmt, lerp, makeNoise, rng } from '../../sim/math'
import { fbm, landColor, project, type Camera } from './terrain'

const W = 800
const H = 500
const COLS = 46
const ROWS = 30
/** Grid spacing across (x) and along (z) the flight path; wider across so the far rows fill the view. */
const CELL = 14
const CELLX = 20
const FOCAL = 420
const HORIZON = H * 0.42

type Look = 'synth' | 'lowpoly'

export default function TerrainGenerator() {
  const [running, setRunning] = useRunning()
  const [look, setLook] = useState<Look>('synth')
  const [seed, setSeed] = useState(1984)
  const [octaves, setOctaves] = useState(5)
  const [persistence, setPersistence] = useState(0.5)
  const [lacunarity, setLacunarity] = useState(2)
  const [scale, setScale] = useState(160)
  const [amp, setAmp] = useState(70)
  const [speed, setSpeed] = useState(60)
  const [sea, setSea] = useState(-0.05)
  const [snow, setSnow] = useState(0.4)
  const [info, setInfo] = useState({ alt: 0, dist: 0 })
  const noise = useMemo(() => makeNoise(seed), [seed])
  const cam = useRef({ x: 0, y: 45, z: 0, steer: 0, dist: 0 })
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const stars = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: 70 }, () => [r() * W * 1.2 - W * 0.1, r() * HORIZON * 0.8, r() * 1.3 + 0.3])
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const leave = () => (pointer.current = null)
    c.addEventListener('pointerleave', leave)
    return () => c.removeEventListener('pointerleave', leave)
  }, [])

  const opts = { octaves, persistence, lacunarity }
  /** Normalised terrain value in about [-1, 1] at world (x, z). */
  const value = (x: number, z: number) => fbm(noise, x / scale, z / scale, opts)
  /** Height in world units. Synthwave keeps a flat valley down the middle of the world. */
  const heightAt = (x: number, z: number) => {
    const n = value(x, z)
    if (look === 'lowpoly') return n * amp
    const valley = clamp((Math.abs(x) - 40) / 160, 0, 1)
    return (n * 0.5 + 0.5) ** 2 * amp * 2.2 * valley
  }

  function onPointer(p: SimPointer) {
    pointer.current = { x: p.x, y: p.y }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            canvasRef={canvas}
            onPointer={onPointer}
            cursor="move"
            label={`A ${look === 'synth' ? 'neon wireframe' : 'shaded low-poly'} flight over procedural terrain, seed ${seed}.`}
            onFrame={(ctx, f) => {
              const c = cam.current
              const p = pointer.current
              const seaH = sea * amp
              const base = look === 'lowpoly' ? Math.max(0, seaH) : 0
              const steer = p ? clamp((p.x / W - 0.5) * 2.2, -1, 1) : 0
              const altTarget = base + (p ? lerp(amp * 2.2, 10, p.y / H) : amp * 0.8)
              c.steer = lerp(c.steer, steer, Math.min(1, f.dt * 3))
              if (f.dt > 0) {
                c.z += speed * f.dt
                c.x += c.steer * speed * 0.9 * f.dt
                c.dist += speed * f.dt
                c.y = lerp(c.y, altTarget, Math.min(1, f.dt * 1.5))
              }
              // Keep a little clearance above the ground just ahead.
              let ground = Math.max(heightAt(c.x, c.z + CELL * 3), heightAt(c.x, c.z + CELL * 6))
              if (look === 'lowpoly') ground = Math.max(ground, seaH)
              c.y = Math.max(c.y, ground + 8)
              const camera: Camera = { x: c.x, y: c.y, z: c.z, f: FOCAL, cx: W / 2, horizon: HORIZON }

              // Vertex grid, nearest row first.
              const z0 = Math.floor(c.z / CELL) + 2
              const x0 = Math.floor(c.x / CELLX) - COLS / 2
              const n = (ROWS + 1) * (COLS + 1)
              const sx = new Float32Array(n)
              const sy = new Float32Array(n)
              const hv = new Float32Array(n)
              const wx = new Float32Array(n)
              const wz = new Float32Array(n)
              for (let r = 0; r <= ROWS; r++)
                for (let k = 0; k <= COLS; k++) {
                  const i = r * (COLS + 1) + k
                  const x = (x0 + k) * CELLX
                  const z = (z0 + r) * CELL
                  const h = heightAt(x, z)
                  const y = look === 'lowpoly' ? Math.max(h, seaH) : h
                  const s = project(camera, x, y, z) ?? [W / 2, H * 4]
                  sx[i] = s[0]
                  sy[i] = s[1]
                  hv[i] = h
                  wx[i] = x
                  wz[i] = z
                }
              const far = (z0 + ROWS) * CELL - c.z

              ctx.save()
              // Bank into turns.
              ctx.translate(W / 2, H / 2)
              ctx.rotate(-c.steer * 0.08)
              ctx.translate(-W / 2, -H / 2)
              if (look === 'synth') {
                const sky = ctx.createLinearGradient(0, -60, 0, HORIZON)
                sky.addColorStop(0, '#07021a')
                sky.addColorStop(0.55, '#2a0b4d')
                sky.addColorStop(1, '#b21e6b')
                ctx.fillStyle = sky
                ctx.fillRect(-100, -100, W + 200, HORIZON + 100)
                for (const [x, y, r] of stars) {
                  ctx.fillStyle = `rgba(255,255,255,${0.35 + r * 0.3})`
                  ctx.fillRect(x, y, r, r)
                }
                // A striped retro sun sitting on the horizon.
                const R = 104
                const sunY = HORIZON - 30
                const sun = ctx.createLinearGradient(0, sunY - R, 0, sunY + R)
                sun.addColorStop(0, '#ffe66d')
                sun.addColorStop(0.5, '#ff9a3c')
                sun.addColorStop(1, '#ff2e88')
                ctx.save()
                ctx.beginPath()
                ctx.arc(W / 2 - c.steer * 40, sunY, R, 0, Math.PI * 2)
                ctx.clip()
                ctx.fillStyle = sun
                ctx.fillRect(W / 2 - R - 60, sunY - R, R * 2 + 120, R * 0.95)
                for (let b = 0, y = sunY - R * 0.05; y < sunY + R; b++) {
                  const gap = 2 + b * 1.6
                  const band = Math.max(3, 14 - b * 1.5)
                  y += gap
                  ctx.fillRect(W / 2 - R - 60, y, R * 2 + 120, band)
                  y += band
                }
                ctx.restore()
                const ground = ctx.createLinearGradient(0, HORIZON, 0, H)
                ground.addColorStop(0, '#3a0b45')
                ground.addColorStop(0.2, '#12031f')
                ground.addColorStop(1, '#0a0114')
                ctx.fillStyle = ground
                ctx.fillRect(-100, HORIZON, W + 200, H - HORIZON + 100)
                ctx.lineJoin = 'round'
                for (let r = ROWS - 1; r >= 0; r--) {
                  const a = r * (COLS + 1)
                  const b = (r + 1) * (COLS + 1)
                  const depth = (z0 + r) * CELL - c.z
                  const fog = clamp(depth / far, 0, 1)
                  ctx.beginPath()
                  for (let k = 0; k <= COLS; k++) ctx.lineTo(sx[b + k], sy[b + k])
                  for (let k = COLS; k >= 0; k--) ctx.lineTo(sx[a + k], sy[a + k])
                  ctx.closePath()
                  ctx.fillStyle = `rgb(${lerp(14, 58, fog * fog) | 0},${lerp(3, 11, fog * fog) | 0},${lerp(28, 69, fog * fog) | 0})`
                  ctx.fill()
                  ctx.beginPath()
                  for (let k = 0; k <= COLS; k++) ctx.lineTo(sx[b + k], sy[b + k])
                  for (let k = 0; k <= COLS; k++) {
                    ctx.moveTo(sx[a + k], sy[a + k])
                    ctx.lineTo(sx[b + k], sy[b + k])
                  }
                  if (r === 0) {
                    ctx.moveTo(sx[a], sy[a])
                    for (let k = 1; k <= COLS; k++) ctx.lineTo(sx[a + k], sy[a + k])
                  }
                  const alpha = 1 - fog * 0.85
                  ctx.strokeStyle = `rgba(255,43,214,${alpha * 0.22})`
                  ctx.lineWidth = 4
                  ctx.stroke()
                  ctx.strokeStyle = `rgba(255,110,230,${alpha})`
                  ctx.lineWidth = 1.2
                  ctx.stroke()
                }
              } else {
                const fogC = [214, 230, 240]
                const sky = ctx.createLinearGradient(0, -60, 0, HORIZON)
                sky.addColorStop(0, '#5d9bd6')
                sky.addColorStop(1, `rgb(${fogC.join(',')})`)
                ctx.fillStyle = sky
                ctx.fillRect(-100, -100, W + 200, HORIZON + 100)
                const glow = ctx.createRadialGradient(W * 0.72, HORIZON - 70, 4, W * 0.72, HORIZON - 70, 120)
                glow.addColorStop(0, 'rgba(255,250,225,1)')
                glow.addColorStop(0.12, 'rgba(255,245,210,0.9)')
                glow.addColorStop(1, 'rgba(255,245,210,0)')
                ctx.fillStyle = glow
                ctx.fillRect(W * 0.72 - 130, HORIZON - 200, 260, 260)
                ctx.fillStyle = `rgb(${fogC.join(',')})`
                ctx.fillRect(-100, HORIZON, W + 200, H - HORIZON + 100)
                const lx = 0.6
                const ly = 0.7
                const lz = 0.38
                ctx.lineWidth = 0.8
                ctx.lineJoin = 'round'
                const tri = (i: number, j: number, k: number) => {
                  // Skip triangles entirely off-screen (most of the nearest rows).
                  if ((sx[i] < -20 && sx[j] < -20 && sx[k] < -20) || (sx[i] > W + 20 && sx[j] > W + 20 && sx[k] > W + 20) || (sy[i] > H + 60 && sy[j] > H + 60 && sy[k] > H + 60)) return
                  const ay = Math.max(hv[i], seaH)
                  const by = Math.max(hv[j], seaH)
                  const cy = Math.max(hv[k], seaH)
                  // Flat-shade with the triangle's normal.
                  const ux = wx[j] - wx[i]
                  const uy = by - ay
                  const uz = wz[j] - wz[i]
                  const vx = wx[k] - wx[i]
                  const vy = cy - ay
                  const vz = wz[k] - wz[i]
                  let nx = uy * vz - uz * vy
                  let ny = uz * vx - ux * vz
                  let nz = ux * vy - uy * vx
                  if (ny < 0) {
                    nx = -nx
                    ny = -ny
                    nz = -nz
                  }
                  const len = Math.hypot(nx, ny, nz) || 1
                  const hn = (hv[i] + hv[j] + hv[k]) / 3 / amp
                  const water = hn <= sea
                  const shade = water ? 1 : 0.5 + 0.6 * Math.max(0, (nx * lx + ny * ly + nz * lz) / len)
                  const col = landColor(hn, sea, snow)
                  const fog = clamp(((wz[i] - c.z) / far) ** 1.6, 0, 1)
                  const rr = lerp(col[0] * shade, fogC[0], fog) | 0
                  const gg = lerp(col[1] * shade, fogC[1], fog) | 0
                  const bb = lerp(col[2] * shade, fogC[2], fog) | 0
                  const style = `rgb(${rr},${gg},${bb})`
                  ctx.beginPath()
                  ctx.moveTo(sx[i], sy[i])
                  ctx.lineTo(sx[j], sy[j])
                  ctx.lineTo(sx[k], sy[k])
                  ctx.closePath()
                  ctx.fillStyle = style
                  ctx.strokeStyle = style
                  ctx.fill()
                  ctx.stroke()
                }
                for (let r = ROWS - 1; r >= 0; r--)
                  for (let k = 0; k < COLS; k++) {
                    const a = r * (COLS + 1) + k
                    const b = a + COLS + 1
                    tri(b, b + 1, a)
                    tri(a, b + 1, a + 1)
                  }
              }
              ctx.restore()
              if (f.frame % 10 === 0) setInfo({ alt: c.y - base, dist: c.dist })
            }}
          />
          <Readout items={[['Seed', seed], ['Speed', `${speed} u/s`], ['Altitude', fmt(info.alt, 0)], ['Distance', fmt(info.dist, 0)]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn btn-icon" onClick={() => setSeed(Math.floor(Math.random() * 99999))}>
          <Icon name="shooting-star" size={18} />
          New seed
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `terrain-${seed}.png`)}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice label="Style" value={look} options={[['synth', 'Neon wireframe'], ['lowpoly', 'Low-poly hills']]} onChange={setLook} />
      <Slider label="Flight speed" value={speed} min={0} max={240} step={5} unit=" u/s" onChange={setSpeed} />
      <Slider label="Octaves" value={octaves} min={1} max={8} onChange={setOctaves} />
      <Slider label="Persistence" value={persistence} min={0.2} max={0.8} step={0.02} onChange={setPersistence} />
      <Slider label="Lacunarity" value={lacunarity} min={1.5} max={3} step={0.05} onChange={setLacunarity} />
      <Slider label="Feature scale" value={scale} min={50} max={400} step={10} onChange={setScale} />
      <Slider label="Height" value={amp} min={10} max={140} step={5} onChange={setAmp} />
      {look === 'lowpoly' && (
        <>
          <Slider label="Sea level" value={sea} min={-0.6} max={0.4} step={0.02} onChange={setSea} />
          <Slider label="Snow line" value={snow} min={0} max={0.8} step={0.02} onChange={setSnow} />
        </>
      )}
      <Hint>Move the pointer over the view to fly: left and right steer, up climbs and down dives. Each octave adds finer, fainter bumps; persistence sets how rough they are and lacunarity how much finer each layer gets.</Hint>
    </SimLayout>
  )
}
