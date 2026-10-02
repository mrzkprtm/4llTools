import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, text } from '../../sim/draw'
import { TAU, fmt } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { coefficients, offset, partialSum, peak, target, termFormula, type WaveKind } from './series'

const W = 800
const H = 440
const CX = 190
const CY = 220
const S = 82
const WX = 400
const K = (W - 20 - WX) / (2 * TAU)
const KINDS = [['square', 'Square'], ['sawtooth', 'Sawtooth'], ['triangle', 'Triangle'], ['pulse', 'Pulse']] as const

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

export default function FourierSeries() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [kind, setKind] = useState<WaveKind>('square')
  const [count, setCount] = useState(5)
  const [speed, setSpeed] = useState(1)
  const [showTarget, setShowTarget] = useState(true)
  const [parts, setParts] = useState(false)
  const [probe, setProbe] = useState<number | null>(null)
  const [now, setNow] = useState(0)
  const time = useRef(0)

  const terms = useMemo(() => coefficients(kind, count), [kind, count])
  const top = useMemo(() => peak(kind, count), [kind, count])
  const overshoot = Math.max(0, (top - 1) / 2)
  const last = terms[terms.length - 1]
  const valueAt = (x: number) => time.current - (x - WX) / K

  function onPointer(p: SimPointer) {
    setProbe(p.x >= WX && p.x <= W - 20 ? p.x : null)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            onPointer={onPointer}
            label={`${count} rotating circles adding up to an approximate ${kind} wave.`}
            onFrame={(ctx, f) => {
              time.current += f.dt
              const t = time.current
              const Y = (v: number) => CY - v * S
              clear(ctx, W, H, theme.sunken)

              // Axes and the ±1 guides.
              line(ctx, WX - 10, CY, W - 10, CY, alpha(theme.muted, 0.6))
              for (const v of [1, -1]) {
                line(ctx, WX - 10, Y(v), W - 10, Y(v), alpha(theme.muted, 0.35), 1, [4, 5])
                text(ctx, v > 0 ? '+1' : '−1', W - 12, Y(v) - 5, { color: theme.muted, size: 12, align: 'right' })
              }
              if (top > 1.004) {
                line(ctx, WX - 10, Y(top), W - 10, Y(top), alpha(theme.danger, 0.55), 1, [2, 4])
                text(ctx, `Gibbs overshoot +${fmt(overshoot * 100, 1)}% of the jump`, WX + 4, Y(top) - 6, { color: theme.danger, size: 12 })
              }

              // Target wave (faint) and the individual harmonics.
              const plot = (fn: (tt: number) => number, color: string, width: number) => {
                ctx.beginPath()
                for (let x = WX; x <= W - 20; x += 1.5) {
                  const y = Y(fn(t - (x - WX) / K))
                  if (x === WX) ctx.moveTo(x, y)
                  else ctx.lineTo(x, y)
                }
                ctx.strokeStyle = color
                ctx.lineWidth = width
                ctx.lineJoin = 'round'
                ctx.stroke()
              }
              if (showTarget) plot((tt) => target(kind, tt), alpha(theme.text, 0.18), 5)
              if (parts) terms.slice(0, 6).forEach((h, i) => plot((tt) => h.amp * Math.sin(h.n * tt + h.phase), alpha(PALETTE[(i + 1) % 8], 0.7), 1.2))
              plot((tt) => partialSum(kind, count, tt, terms), theme.accent, 2.5)

              // The chain of circles.
              let x = CX
              let y = Y(offset(kind))
              circle(ctx, x, y, 2.5, theme.muted)
              terms.forEach((h, i) => {
                const a = h.n * t + h.phase
                const nx = x + h.amp * S * Math.cos(a)
                const ny = y - h.amp * S * Math.sin(a)
                const tint = parts && i < 6 ? PALETTE[(i + 1) % 8] : theme.text
                if (h.amp * S > 1) circle(ctx, x, y, h.amp * S, undefined, alpha(tint, i < 6 && parts ? 0.55 : 0.2), 1)
                line(ctx, x, y, nx, ny, alpha(tint, 0.7), 1.3)
                x = nx
                y = ny
              })
              line(ctx, x, y, WX, y, alpha(theme.accent, 0.6), 1, [3, 3])
              circle(ctx, x, y, 4, theme.accent)
              circle(ctx, WX, y, 5, theme.accent, theme.surface, 2)

              text(ctx, `${count} circle${count === 1 ? '' : 's'}`, 16, 26, { color: theme.text, size: 15, weight: 700 })
              text(ctx, 'now', WX, H - 14, { color: theme.muted, size: 12, align: 'center' })
              text(ctx, 'earlier →', W - 20, H - 14, { color: theme.muted, size: 12, align: 'right' })

              if (f.frame % 8 === 0) setNow(partialSum(kind, count, t, terms))
              if (probe !== null) {
                const tt = valueAt(probe)
                const v = partialSum(kind, count, tt, terms)
                line(ctx, probe, 34, probe, H - 30, alpha(theme.text, 0.4), 1)
                circle(ctx, probe, Y(v), 5, theme.accent, theme.surface, 2)
                const right = probe < W - 170
                text(ctx, `sum ${fmt(v, 3)}  target ${fmt(target(kind, tt), 2)}`, probe + (right ? 8 : -8), 30, { color: theme.text, size: 12, align: right ? 'left' : 'right' })
              }
            }}
          />
          <Legend items={[[theme.accent, `Sum of ${count} harmonic${count === 1 ? '' : 's'}`], [alpha(theme.text, 0.3), 'Target wave'], ...(parts ? [[PALETTE[1], 'Individual harmonics'] as const] : [])]} />
          <Readout
            items={[
              ['Harmonics', count],
              ['Highest harmonic', ordinal(last.n)],
              ['Overshoot', `${fmt(overshoot * 100, 1)}%`],
              ['Value now', fmt(now, 3)],
            ]}
          />
          <p className="sim-mono" style={{ margin: 0 }}>
            Term {count}: {termFormula(kind, last.n)}
          </p>
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (time.current = 0)} />
      <Choice label="Wave" value={kind} options={KINDS} onChange={setKind} />
      <Slider label="Harmonics N" value={count} min={1} max={50} onChange={setCount} />
      <Slider label="Speed" value={speed} min={0.1} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <Toggle label="Show target wave" checked={showTarget} onChange={setShowTarget} />
      <Toggle label="Colour the first harmonics" checked={parts} onChange={setParts} />
      <Hint>Each circle spins faster than the one before it, and the height of the last one traces the wave. Add harmonics and the corners sharpen, but the square wave always overshoots by about 9% next to each jump: the Gibbs phenomenon.</Hint>
    </SimLayout>
  )
}
