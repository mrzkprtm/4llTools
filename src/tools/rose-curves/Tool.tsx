import { useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { extent, maurer, polar, reduce, rosePeriod, rosePetals, tracePolar, type Curve } from './rose'

const W = 800
const H = 520
const CX = W / 2
const CY = H / 2
const R = 228
const BATCHES = 60

const CURVES = [['rose', 'Rose r = cos(kθ)'], ['cardioid', 'Cardioid'], ['limacon', 'Limaçon'], ['lemniscate', 'Lemniscate'], ['spiral', 'Archimedean spiral'], ['butterfly', 'Butterfly curve']] as const

const PALETTES = {
  rainbow: { name: 'Rainbow', color: (u: number) => `hsl(${(200 + u * 320) % 360} 90% 64%)` },
  sunset: { name: 'Sunset', stops: ['#ffd166', '#ef476f', '#b5179e'] },
  ocean: { name: 'Ocean', stops: ['#e0fbfc', '#4cc9f0', '#4361ee'] },
  gold: { name: 'Gold', stops: ['#fff1c1', '#ffc857', '#e9724c'] },
} as const
type PaletteKey = keyof typeof PALETTES

function paletteColor(key: PaletteKey, u: number): string {
  const p = PALETTES[key]
  if ('color' in p) return p.color(u)
  const x = clamp(u, 0, 0.9999) * (p.stops.length - 1)
  const k = Math.floor(x)
  const t = x - k
  const a = parseInt(p.stops[k].slice(1), 16)
  const b = parseInt(p.stops[k + 1].slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

export default function RoseCurves() {
  const [running, setRunning] = useRunning()
  const [curve, setCurve] = useState<Curve>('rose')
  const [n, setN] = useState(5)
  const [d, setD] = useState(4)
  const [overlay, setOverlay] = useState(false)
  const [step, setStep] = useState(71)
  const [penSpeed, setPenSpeed] = useState(6)
  const [width, setWidth] = useState(2.5)
  const [palette, setPalette] = useState<PaletteKey>('rainbow')
  const [rotate, setRotate] = useState(true)
  const [grid, setGrid] = useState(true)
  const [progress, setProgress] = useState(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const anim = useRef({ head: 0, hold: 0, rot: 0 })
  const drag = useRef<number | null>(null)

  const shape = useMemo(() => polar(curve, n, d), [curve, n, d])
  const pts = useMemo(() => tracePolar(shape, Math.round(clamp((shape.span / (2 * Math.PI)) * 900, 900, 14000))), [shape])
  const mpts = useMemo(() => maurer(shape, step), [shape, step])
  const scale = R / extent(pts)

  function restart() {
    anim.current.head = 0
    anim.current.hold = 0
  }

  function onPointer(p: SimPointer) {
    const a = Math.atan2(p.y - CY, p.x - CX)
    if (p.type === 'down') drag.current = a
    else if (drag.current !== null && p.down) {
      let da = a - drag.current
      if (da > Math.PI) da -= 2 * Math.PI
      if (da < -Math.PI) da += 2 * Math.PI
      anim.current.rot += da
      drag.current = a
    }
    if (p.type === 'up') drag.current = null
  }

  const isRose = curve === 'rose'
  const [kn, kd] = reduce(n, d)
  const period = isRose ? rosePeriod(n, d) : Math.round(shape.span / Math.PI)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            canvasRef={canvas}
            onPointer={onPointer}
            cursor="grab"
            label={isRose ? `Rose curve r = cos(${kn}/${kd} θ) with ${rosePetals(n, d)} petals being traced by a pen.` : `A ${curve} polar curve being traced by a pen.`}
            onFrame={(ctx, f) => {
              const s = anim.current
              if (f.dt > 0) {
                if (s.head < 1) s.head = Math.min(1, s.head + (f.dt * penSpeed) / shape.span)
                else if ((s.hold += f.dt) > 3) restart()
                if (rotate) s.rot += f.dt * 0.12
              }
              ctx.fillStyle = '#0c0b10'
              ctx.fillRect(0, 0, W, H)
              ctx.save()
              ctx.translate(CX, CY)
              if (grid) {
                ctx.strokeStyle = 'rgba(255,255,255,0.07)'
                ctx.lineWidth = 1
                ctx.beginPath()
                for (let r = R / 4; r <= R + 1; r += R / 4) {
                  ctx.moveTo(r, 0)
                  ctx.arc(0, 0, r, 0, Math.PI * 2)
                }
                for (let k = 0; k < 12; k++) {
                  const a = (k * Math.PI) / 6 - s.rot
                  ctx.moveTo(0, 0)
                  ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R)
                }
                ctx.stroke()
              }
              ctx.rotate(-s.rot)
              ctx.lineJoin = 'round'
              ctx.lineCap = 'round'
              if (overlay) {
                ctx.beginPath()
                for (let i = 0; i < mpts.length; i += 2) ctx.lineTo(mpts[i] * scale, -mpts[i + 1] * scale)
                ctx.strokeStyle = paletteColor(palette, 0.35)
                ctx.globalAlpha = 0.45
                ctx.lineWidth = 0.8
                ctx.stroke()
                ctx.globalAlpha = 1
              }
              const N = pts.length / 2 - 1
              const count = Math.floor(s.head * N)
              for (let b = 0; b < BATCHES; b++) {
                const i0 = Math.floor((b * N) / BATCHES)
                if (i0 >= count) break
                const i1 = Math.min(count, Math.floor(((b + 1) * N) / BATCHES))
                ctx.beginPath()
                for (let i = i0; i <= i1; i++) ctx.lineTo(pts[2 * i] * scale, -pts[2 * i + 1] * scale)
                ctx.strokeStyle = paletteColor(palette, b / (BATCHES - 1))
                ctx.lineWidth = width
                ctx.stroke()
              }
              if (s.head < 1) {
                const x = pts[2 * count] * scale
                const y = -pts[2 * count + 1] * scale
                ctx.beginPath()
                ctx.moveTo(0, 0)
                ctx.lineTo(x, y)
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'
                ctx.lineWidth = 1
                ctx.setLineDash([4, 5])
                ctx.stroke()
                ctx.setLineDash([])
                const glow = ctx.createRadialGradient(x, y, 0, x, y, 16)
                glow.addColorStop(0, 'rgba(255,255,255,0.9)')
                glow.addColorStop(1, 'rgba(255,255,255,0)')
                ctx.fillStyle = glow
                ctx.fillRect(x - 16, y - 16, 32, 32)
                ctx.beginPath()
                ctx.arc(x, y, 3.5, 0, Math.PI * 2)
                ctx.fillStyle = '#fff'
                ctx.fill()
              }
              ctx.restore()
              if (f.frame % 8 === 0) setProgress(s.head)
            }}
          />
          <Readout
            items={[
              ['k', isRose ? (kd === 1 ? String(kn) : `${kn}/${kd} = ${fmt(kn / kd, 3)}`) : '—'],
              ['Petals', isRose ? rosePetals(n, d) : '—'],
              ['Closes after', `θ = ${period === 1 ? '' : period}π`],
              ['Drawn', `${Math.round(progress * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} resetLabel="Redraw">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `rose-${curve}-${n}-${d}.png`)}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select
        label="Curve"
        value={curve}
        options={CURVES}
        onChange={(v) => {
          setCurve(v)
          restart()
        }}
      />
      {isRose && (
        <>
          <Slider label="Numerator n" value={n} min={1} max={12} onChange={(v) => { setN(v); restart() }} />
          <Slider label="Denominator d" value={d} min={1} max={12} onChange={(v) => { setD(v); restart() }} />
        </>
      )}
      <Toggle label="Maurer rose overlay" checked={overlay} onChange={setOverlay} />
      {overlay && <Slider label="Maurer step" value={step} min={1} max={359} unit="°" onChange={setStep} />}
      <Slider label="Pen speed" value={penSpeed} min={1} max={30} unit=" rad/s" onChange={setPenSpeed} />
      <Slider label="Line width" value={width} min={0.5} max={8} step={0.5} unit=" px" onChange={setWidth} />
      <Select label="Colours" value={palette} options={Object.entries(PALETTES).map(([k, p]) => [k as PaletteKey, p.name] as const)} onChange={setPalette} />
      <Toggle label="Rotate slowly" checked={rotate} onChange={setRotate} />
      <Toggle label="Polar grid" checked={grid} onChange={setGrid} />
      <Hint>The pen sweeps the angle θ while its distance from the centre follows r = cos(kθ). With k = n/d the rose has n petals when n and d are both odd and 2n otherwise. Drag the canvas to spin it; turn on the Maurer overlay and try steps like 71° or 29°.</Hint>
    </SimLayout>
  )
}
