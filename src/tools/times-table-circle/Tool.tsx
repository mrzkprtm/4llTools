import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { chord, curveName, pointOnCircle } from './times'

const W = 800
const H = 520
const CX = 490
const CY = H / 2
const R = 232
const BINS = 48
const PRESETS = [2, 3, 21, 34, 51, 99]

const PALETTES = {
  rainbow: (t: number) => `hsl(${Math.round(t * 330)} 90% 62%)`,
  fire: (t: number) => `hsl(${Math.round(-10 + t * 60)} 95% ${Math.round(40 + t * 30)}%)`,
  ice: (t: number) => `hsl(${Math.round(170 + t * 90)} 85% ${Math.round(55 + t * 20)}%)`,
  gold: (t: number) => `hsl(${Math.round(38 + t * 12)} ${Math.round(60 + t * 30)}% ${Math.round(45 + t * 30)}%)`,
  mono: (t: number) => `hsl(220 10% ${Math.round(60 + t * 35)}%)`,
}
type PaletteKey = keyof typeof PALETTES
const PALETTE_OPTIONS = [['rainbow', 'Rainbow'], ['fire', 'Fire'], ['ice', 'Ice'], ['gold', 'Gold'], ['mono', 'Moonlight']] as const

export default function TimesTableCircle() {
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(200)
  const [speed, setSpeed] = useState(0.12)
  const [colorBy, setColorBy] = useState<'length' | 'index'>('length')
  const [palette, setPalette] = useState<PaletteKey>('rainbow')
  const [linger, setLinger] = useState(true)
  const [dots, setDots] = useState(true)
  const [kShow, setKShow] = useState(2)
  const k = useRef(2)
  const scrub = useRef<{ x: number; k: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  function setK(v: number) {
    k.current = clamp(v, 0, 500)
    setKShow(k.current)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') scrub.current = { x: p.x, k: k.current }
    const s = scrub.current
    if (s && p.down) {
      // Drag right to raise k; hold shift for fine control.
      const v = s.k + (p.x - s.x) * (p.shift ? 0.002 : 0.02)
      k.current = Math.max(0, v)
    }
    if (p.type === 'up') {
      scrub.current = null
      setKShow(k.current)
    }
  }

  const name = curveName(Math.round(kShow * 100) / 100, n)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            canvasRef={canvas}
            cursor="ew-resize"
            className="sim-dark"
            label={`Times table circle: ${n} points, each joined to its multiple by ${fmt(kShow, 2)} modulo ${n}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0 && !scrub.current) {
                const off = Math.abs(k.current - Math.round(k.current))
                const slow = linger ? 0.12 + 0.88 * Math.min(1, off * 6) : 1
                k.current += f.dt * speed * slow
              }
              const kk = k.current
              clear(ctx, W, H, '#07070b')
              circle(ctx, CX, CY, R, undefined, 'rgba(255,255,255,0.12)', 1)

              // Bucket chords by colour so each colour is one path.
              const paths: number[][] = Array.from({ length: BINS }, () => [])
              for (let i = 0; i < n; i++) {
                const [x1, y1, x2, y2] = chord(i, kk, n, CX, CY, R)
                const t = colorBy === 'length' ? Math.hypot(x2 - x1, y2 - y1) / (2 * R) : i / n
                paths[Math.min(BINS - 1, Math.floor(t * BINS))].push(x1, y1, x2, y2)
              }
              ctx.globalCompositeOperation = 'lighter'
              ctx.globalAlpha = clamp(180 / n, 0.3, 0.9)
              ctx.lineWidth = n > 300 ? 0.8 : 1.1
              const col = PALETTES[palette]
              paths.forEach((seg, b) => {
                if (!seg.length) return
                ctx.beginPath()
                for (let j = 0; j < seg.length; j += 4) {
                  ctx.moveTo(seg[j], seg[j + 1])
                  ctx.lineTo(seg[j + 2], seg[j + 3])
                }
                ctx.strokeStyle = col((b + 0.5) / BINS)
                ctx.stroke()
              })
              ctx.globalAlpha = 1
              ctx.globalCompositeOperation = 'source-over'
              if (dots && n <= 240)
                for (let i = 0; i < n; i++) {
                  const [x, y] = pointOnCircle(i, n, CX, CY, R)
                  circle(ctx, x, y, 1.6, 'rgba(255,255,255,0.75)')
                }

              text(ctx, `k = ${kk.toFixed(2)}`, 26, 58, { color: '#fff', size: 40, weight: 700 })
              text(ctx, `n = ${n}`, 28, 88, { color: 'rgba(255,255,255,0.6)', size: 16 })
              const nm = curveName(Math.round(kk * 100) / 100, n)
              if (nm) text(ctx, nm, 28, 116, { color: col(0.6), size: 16, mono: false, weight: 700 })
              text(ctx, 'i  →  i × k  mod n', 28, H - 26, { color: 'rgba(255,255,255,0.45)', size: 13 })
              if (f.frame % 8 === 0) setKShow(kk)
            }}
          />
          <Readout
            items={[
              ['Multiplier k', fmt(kShow, 2)],
              ['Points n', n],
              ['Curve', name || '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `times-table-k${fmt(kShow, 2)}-n${n}.png`)}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <div className="sim-field">
        <span className="sim-label">Jump to k</span>
        <div className="row" style={{ margin: 0, gap: 4 }}>
          {PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              className={`btn ${Math.abs(kShow - v) < 0.005 ? 'primary' : ''}`}
              style={{ padding: '5px 10px', fontSize: '0.82rem' }}
              onClick={() => {
                setK(v)
                setRunning(false)
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Multiplier k" value={Math.round(kShow * 100) / 100} min={0} max={100} step={0.01} onChange={setK} />
      <Slider label="Points n" value={n} min={10} max={500} onChange={setN} />
      <Slider label="Morph speed" value={speed} min={0} max={1} step={0.01} unit=" k/s" onChange={setSpeed} />
      <Toggle label="Linger on whole numbers" checked={linger} onChange={setLinger} />
      <Choice label="Colour by" value={colorBy} options={[['length', 'Line length'], ['index', 'Index']]} onChange={setColorBy} />
      <Select label="Palette" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} />
      <Toggle label="Show points" checked={dots} onChange={setDots} />
      <Hint>Point i is joined to point i × k (mod n). Whole numbers give epicycloids: k = 2 is a cardioid, 3 a nephroid. Drag sideways on the circle to scrub k (hold shift for fine steps).</Hint>
    </SimLayout>
  )
}
