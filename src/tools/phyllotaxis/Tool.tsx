import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { GOLDEN_ANGLE, isFibonacci, parastichies, seedPosition } from './phyllo'

const W = 800
const H = 520
const CX = W / 2 + 70
const CY = H / 2
const RMAX = 244
const PRESETS: [string, number][] = [['Golden', GOLDEN_ANGLE], ['137.3°', 137.3], ['137.6°', 137.6], ['90°', 90], ['222.5°', 222.5]]

type ColorMode = 'sunflower' | 'a' | 'b'

export default function Phyllotaxis() {
  const [running, setRunning] = useRunning()
  const [coarse, setCoarse] = useState(137.5)
  const [fine, setFine] = useState(GOLDEN_ANGLE - 137.5)
  const [sweep, setSweep] = useState(false)
  const [max, setMax] = useState(1000)
  const [size, setSize] = useState(1)
  const [scaleSize, setScaleSize] = useState(true)
  const [mode, setMode] = useState<ColorMode>('sunflower')
  const [info, setInfo] = useState({ seeds: 0, a: 0, b: 0 })
  const fineRef = useRef(fine)
  const phase = useRef(0)
  const shown = useRef(0)
  const hover = useRef<{ x: number; y: number } | null>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  const angle = coarse + fine

  function setAngle(a: number) {
    const c = Math.round(a * 10) / 10
    setCoarse(c)
    setFine(a - c)
    fineRef.current = a - c
    setSweep(false)
  }

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
  }

  const fam = mode === 'a' ? info.a : mode === 'b' ? info.b : 0

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            canvasRef={canvas}
            className="sim-dark"
            label={`Phyllotaxis pattern of ${Math.round(shown.current)} seeds with a divergence angle of ${angle.toFixed(3)} degrees.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                shown.current = Math.min(max, shown.current + f.dt * Math.max(120, max / 4))
                if (sweep) {
                  phase.current += f.dt * 0.12
                  fineRef.current = 0.5 * Math.sin(phase.current)
                  if (f.frame % 6 === 0) setFine(fineRef.current)
                }
              }
              if (shown.current > max) shown.current = max
              const alpha = coarse + fineRef.current
              const count = Math.floor(shown.current)
              const c = RMAX / Math.sqrt(Math.max(max, 50))
              const [pa, pb] = count > 8 ? parastichies(Math.floor(count * 0.92), alpha, c) : [1, 0]
              const family = mode === 'a' ? pa : mode === 'b' ? pb : 0

              clear(ctx, W, H, '#0d0a07')
              // Find the seed under the pointer to highlight its two spiral arms.
              let h = -1
              const hv = hover.current
              if (hv) {
                let best = (c * 1.2) ** 2
                for (let n = 1; n <= count; n++) {
                  const [x, y] = seedPosition(n, alpha, c)
                  const d = (CX + x - hv.x) ** 2 + (CY + y - hv.y) ** 2
                  if (d < best) {
                    best = d
                    h = n
                  }
                }
              }
              for (let n = 1; n <= count; n++) {
                const [x, y] = seedPosition(n, alpha, c)
                const t = n / max
                const grow = shown.current >= max ? 1 : clamp((shown.current - n) / 30, 0, 1)
                const r = c * 0.5 * size * (scaleSize ? 0.55 + 0.75 * Math.sqrt(t) : 1) * grow
                let col: string
                if (family > 0) col = `hsl(${Math.round(((n % family) / family) * 360)} 80% ${Math.round(48 + 14 * t)}%)`
                else col = `hsl(${Math.round(22 + 28 * t)} ${Math.round(70 + 20 * t)}% ${Math.round(16 + 48 * t)}%)`
                if (h > 0 && ((pa > 0 && (n - h) % pa === 0) || (pb > 0 && (n - h) % pb === 0))) {
                  const onA = pa > 0 && (n - h) % pa === 0
                  circle(ctx, CX + x, CY + y, r + 1.5, onA ? '#ffffff' : '#7ee0ff')
                } else circle(ctx, CX + x, CY + y, r, col)
              }
              if (h > 0) circle(ctx, CX + seedPosition(h, alpha, c)[0], CY + seedPosition(h, alpha, c)[1], c * 0.9, undefined, '#fff', 2)

              text(ctx, `${alpha.toFixed(3)}°`, 24, 50, { color: '#fff4dc', size: 32, weight: 700 })
              text(ctx, `seed n at angle n × α, radius c√n`, 24, 76, { color: 'rgba(255,244,220,0.55)', size: 13 })
              if (pa) {
                text(ctx, pb ? `${pa} and ${pb} spirals` : `${pa} straight rays`, 24, 106, { color: '#f2b53a', size: 17, weight: 700, mono: false })
                if (pb && isFibonacci(pa) && isFibonacci(pb)) text(ctx, 'both Fibonacci numbers', 24, 128, { color: 'rgba(242,181,58,0.75)', size: 13, mono: false })
              }
              if (h > 0 && pa) {
                circle(ctx, 30, H - 50, 5, '#ffffff')
                text(ctx, `arm of ${pa} (n ≡ ${h % pa} mod ${pa})`, 42, H - 46, { color: '#fff', size: 13 })
                if (pb) {
                  circle(ctx, 30, H - 28, 5, '#7ee0ff')
                  text(ctx, `arm of ${pb} (n ≡ ${h % pb} mod ${pb})`, 42, H - 24, { color: '#7ee0ff', size: 13 })
                }
              }
              if (f.frame % 10 === 0) setInfo({ seeds: count, a: pa, b: pb })
            }}
          />
          <Readout
            items={[
              ['Divergence angle', `${angle.toFixed(3)}°`],
              ['Seeds', fmt(info.seeds)],
              ['Visible spirals', info.b ? `${info.a} / ${info.b}` : info.a ? `${info.a} rays` : '—'],
              ['Fibonacci pair', info.b && isFibonacci(info.a) && isFibonacci(info.b) ? 'yes' : 'no'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (shown.current = 0)} resetLabel="Regrow">
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, `phyllotaxis-${angle.toFixed(3)}.png`)}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <div className="sim-field">
        <span className="sim-label">Angle presets</span>
        <div className="row" style={{ margin: 0, gap: 4 }}>
          {PRESETS.map(([name, v]) => (
            <button key={name} type="button" className={`btn ${Math.abs(angle - v) < 5e-4 ? 'primary' : ''}`} style={{ padding: '5px 9px', fontSize: '0.82rem' }} onClick={() => setAngle(v)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Divergence angle" value={coarse} min={1} max={359} step={0.1} unit="°" format={(v) => v.toFixed(1)} onChange={(v) => setAngle(v + fineRef.current)} />
      <Slider
        label="Fine tune"
        value={Math.round(fine * 1000) / 1000}
        min={-0.5}
        max={0.5}
        step={0.001}
        unit="°"
        format={(v) => (v >= 0 ? '+' : '') + v.toFixed(3)}
        onChange={(v) => {
          setFine(v)
          fineRef.current = v
          setSweep(false)
        }}
      />
      <Toggle label="Sweep the fine angle slowly" checked={sweep} onChange={setSweep} />
      <Slider label="Seeds" value={max} min={50} max={3000} step={50} onChange={setMax} />
      <Slider label="Seed size" value={size} min={0.3} max={1.6} step={0.05} unit="×" onChange={setSize} />
      <Toggle label="Bigger seeds towards the rim" checked={scaleSize} onChange={setScaleSize} />
      <Choice
        label="Colour"
        value={mode}
        options={[
          ['sunflower', 'Sunflower'],
          ['a', info.a ? `mod ${info.a}` : 'Arms A'],
          ['b', info.b ? `mod ${info.b}` : 'Arms B'],
        ]}
        onChange={setMode}
      />
      {fam > 0 && <p className="muted sim-hint">Colouring seed n by n mod {fam} gives each of the {fam} spiral arms its own colour.</p>}
      <Hint>Each new seed turns by the divergence angle. The golden angle packs seeds with no gaps and shows Fibonacci numbers of spirals; nudge it by a tenth of a degree and gaps and straight arms appear. Hover a seed to light up its two spiral arms.</Hint>
    </SimLayout>
  )
}
