import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, makeBuffer, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { intensityAt, pathDifference, waveAt, type Source } from './waves'

const W = 800
const H = 500
const RES = 4

type View = 'wave' | 'intensity'

export default function WaveInterference() {
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState(2)
  const [lambda, setLambda] = useState(40)
  const [freq, setFreq] = useState(1)
  const [phase, setPhase] = useState(0)
  const [view, setView] = useState<View>('wave')
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null)
  const sources = useRef<Source[]>([
    { x: 340, y: 250, phase: 0 },
    { x: 460, y: 250, phase: 0 },
    { x: 400, y: 150, phase: 0 },
    { x: 400, y: 350, phase: 0 },
  ])
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const held = useRef<number | null>(null)

  const active = () => sources.current.slice(0, count).map((s, i) => ({ ...s, phase: i === 1 ? (phase * Math.PI) / 180 : 0 }))

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      const i = sources.current.slice(0, count).findIndex((s) => Math.hypot(s.x - p.x, s.y - p.y) < 22)
      held.current = i >= 0 ? i : null
    }
    if (held.current !== null) {
      const s = sources.current[held.current]
      s.x = clamp(p.x, 10, W - 10)
      s.y = clamp(p.y, 10, H - 10)
    } else setProbe({ x: p.x, y: p.y })
    if (p.type === 'up') held.current = null
  }

  const pd = probe && count >= 2 ? pathDifference(active()[0], active()[1], probe.x, probe.y, lambda) : null

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Ripple tank with ${count} wave sources of wavelength ${lambda} pixels.`}
            onFrame={(ctx, f) => {
              const bw = W / RES
              const bh = H / RES
              if (!buf.current) buf.current = makeBuffer(bw, bh)
              const b = buf.current
              const src = active()
              const norm = view === 'wave' ? 1 / Math.sqrt(count) : 1 / count
              for (let j = 0; j < bh; j++)
                for (let i = 0; i < bw; i++) {
                  const x = i * RES + RES / 2
                  const y = j * RES + RES / 2
                  const o = (j * bw + i) * 4
                  if (view === 'wave') {
                    const v = clamp(waveAt(src, x, y, f.t, lambda, freq) * norm, -1, 1)
                    // Diverging blue → white → orange map.
                    const a = Math.abs(v)
                    b.data[o] = v > 0 ? 255 - a * 20 : 255 - a * 225
                    b.data[o + 1] = v > 0 ? 255 - a * 130 : 255 - a * 130
                    b.data[o + 2] = v > 0 ? 255 - a * 235 : 255 - a * 40
                  } else {
                    const v = clamp(Math.sqrt(intensityAt(src, x, y, lambda) * norm * norm) * 1.1, 0, 1)
                    b.data[o] = 20 + v * 235
                    b.data[o + 1] = 16 + v * 170
                    b.data[o + 2] = 40 + v * 60
                  }
                  b.data[o + 3] = 255
                }
              b.flush()
              ctx.imageSmoothingEnabled = true
              ctx.drawImage(b.canvas, 0, 0, W, H)
              src.forEach((s, i) => {
                circle(ctx, s.x, s.y, 10, '#1b1a17', '#fff', 3)
                text(ctx, String(i + 1), s.x, s.y + 4, { color: '#fff', size: 11, align: 'center', weight: 700 })
              })
              if (probe) {
                circle(ctx, probe.x, probe.y, 6, undefined, '#1b1a17', 2)
                src.forEach((s) => {
                  ctx.beginPath()
                  ctx.moveTo(s.x, s.y)
                  ctx.lineTo(probe.x, probe.y)
                  ctx.strokeStyle = 'rgba(27,26,23,0.45)'
                  ctx.setLineDash([3, 4])
                  ctx.stroke()
                  ctx.setLineDash([])
                })
              }
            }}
          />
          <Readout
            items={[
              ['Wavelength λ', `${lambda} px`],
              ['Source spacing', count >= 2 ? `${fmt(Math.hypot(sources.current[0].x - sources.current[1].x, sources.current[0].y - sources.current[1].y) / lambda, 2)} λ` : '—'],
              ['Path difference', pd ? `${fmt(pd.waves, 2)} λ` : 'tap the tank'],
              ['At the probe', pd ? pd.kind : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} />
      <Choice label="Show" value={view} options={[['wave', 'Waves'], ['intensity', 'Intensity']]} onChange={setView} />
      <Slider label="Sources" value={count} min={1} max={4} onChange={setCount} />
      <Slider label="Wavelength" value={lambda} min={12} max={120} unit=" px" onChange={setLambda} />
      <Slider label="Frequency" value={freq} min={0.2} max={3} step={0.1} unit=" Hz" onChange={setFreq} />
      <Slider label="Phase of source 2" value={phase} min={0} max={360} step={15} unit="°" onChange={setPhase} />
      <Hint>Drag the numbered sources. Tap anywhere else to drop a probe: when the path difference is a whole number of wavelengths the waves add up; at half a wavelength they cancel.</Hint>
    </SimLayout>
  )
}
