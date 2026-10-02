import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, text } from '../../sim/draw'
import { TAU, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { PRESETS, dft, energyShare, epicycleSum, pathLength, presetPath, resample, sortByAmp, type Preset, type Pt, type Term } from './fourier'

const W = 800
const H = 500
const N = 200
const M = 720
const LAP = 10
const PEN = '#e8590c'

interface Shape {
  pts: Pt[]
  terms: Term[]
  cx: number
  cy: number
}

function build(path: Pt[]): Shape {
  const pts = resample(path, N)
  const cx = pts.reduce((s, p) => s + p[0], 0) / N
  const cy = pts.reduce((s, p) => s + p[1], 0) / N
  return { pts, terms: sortByAmp(dft(pts.map(([x, y]) => [x - cx, y - cy]))), cx, cy }
}

const place = (kind: Preset) => build(presetPath(kind).map(([x, y]) => [W / 2 + x * 200, H / 2 + y * 200] as Pt))

type Choice = Preset | 'custom'

export default function FourierDrawing() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<Choice>('heart')
  const [shape, setShape] = useState<Shape>(() => place('heart'))
  const [terms, setTerms] = useState(10)
  const [speed, setSpeed] = useState(1)
  const [circles, setCircles] = useState(true)
  const [original, setOriginal] = useState(true)
  const [grow, setGrow] = useState(false)
  const [lap, setLap] = useState(0)
  const tau = useRef(0)
  const custom = useRef<Shape | null>(null)
  const raw = useRef<Pt[] | null>(null)

  // The approximated curve for the current number of terms, sampled once per change.
  const curve = useMemo(() => Array.from({ length: M }, (_, i) => epicycleSum(shape.terms, terms, i / M)), [shape, terms])
  const share = energyShare(shape.terms, terms)
  const biggest = shape.terms.find((t) => t.freq !== 0) ?? shape.terms[0]

  function choose(p: Choice) {
    setPreset(p)
    setShape(p === 'custom' && custom.current ? custom.current : place(p === 'custom' ? 'heart' : p))
    tau.current = 0
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') raw.current = [[p.x, p.y]]
    const r = raw.current
    if (!r) return
    const last = r[r.length - 1]
    if (p.type === 'move' && Math.hypot(p.x - last[0], p.y - last[1]) > 2) r.push([p.x, p.y])
    if (p.type === 'up') {
      raw.current = null
      if (r.length > 8 && pathLength(r) > 80) {
        custom.current = build(r)
        setShape(custom.current)
        setPreset('custom')
        tau.current = 0
        if (!running) setRunning(true)
      }
    }
  }

  const options: (readonly [Choice, string])[] = [...PRESETS, ...(custom.current ? [['custom', 'Your drawing'] as const] : [])]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            onPointer={onPointer}
            label={`${terms} rotating Fourier circles tracing a ${preset === 'custom' ? 'hand-drawn shape' : preset}.`}
            onFrame={(ctx, f) => {
              clear(ctx, W, H, theme.sunken)
              const r = raw.current
              if (r) {
                ctx.beginPath()
                r.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 3
                ctx.lineJoin = ctx.lineCap = 'round'
                ctx.stroke()
                ctx.beginPath()
                ctx.moveTo(r[r.length - 1][0], r[r.length - 1][1])
                ctx.lineTo(r[0][0], r[0][1])
                ctx.setLineDash([4, 6])
                ctx.strokeStyle = alpha(theme.accent, 0.5)
                ctx.lineWidth = 1.5
                ctx.stroke()
                ctx.setLineDash([])
                text(ctx, 'Drawing… let go to close the shape', 16, 26, { color: theme.muted, size: 14 })
                return
              }

              if (f.dt > 0) {
                tau.current += f.dt / LAP
                if (tau.current >= 1) {
                  tau.current %= 1
                  if (grow) setTerms((k) => (k >= N ? 1 : Math.min(N, Math.ceil(k * 1.6))))
                }
              }
              const t = tau.current
              const { cx, cy } = shape

              if (original) {
                ctx.beginPath()
                shape.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                ctx.closePath()
                ctx.strokeStyle = alpha(theme.muted, 0.45)
                ctx.lineWidth = 1.5
                ctx.setLineDash([3, 5])
                ctx.stroke()
                ctx.setLineDash([])
              }

              // Fading trail of the pen over the last lap.
              const head = Math.floor(t * M)
              const chunks = 24
              const len = M - 4
              ctx.lineCap = ctx.lineJoin = 'round'
              for (let c = 0; c < chunks; c++) {
                ctx.beginPath()
                for (let j = Math.floor((c * len) / chunks); j <= Math.floor(((c + 1) * len) / chunks); j++) {
                  const [x, y] = curve[(((head - len + j) % M) + M) % M]
                  if (j === Math.floor((c * len) / chunks)) ctx.moveTo(cx + x, cy + y)
                  else ctx.lineTo(cx + x, cy + y)
                }
                ctx.strokeStyle = alpha(PEN, 0.12 + (0.88 * (c + 1)) / chunks)
                ctx.lineWidth = 2.5
                ctx.stroke()
              }

              // The epicycle chain, biggest circle first.
              let x = cx
              let y = cy
              const arms = new Path2D()
              const rings = new Path2D()
              arms.moveTo(x, y)
              for (let i = 0; i < Math.min(terms, shape.terms.length); i++) {
                const { freq, amp, phase } = shape.terms[i]
                const a = TAU * freq * t + phase
                if (circles && amp > 0.8) {
                  rings.moveTo(x + amp, y)
                  rings.arc(x, y, amp, 0, TAU)
                }
                x += amp * Math.cos(a)
                y += amp * Math.sin(a)
                arms.lineTo(x, y)
              }
              ctx.strokeStyle = alpha(theme.text, 0.16)
              ctx.lineWidth = 1
              ctx.stroke(rings)
              ctx.strokeStyle = alpha(theme.text, 0.6)
              ctx.lineWidth = 1.2
              ctx.stroke(arms)
              const [lx, ly] = curve[head]
              ctx.beginPath()
              ctx.moveTo(cx + lx, cy + ly)
              ctx.lineTo(x, y)
              ctx.strokeStyle = PEN
              ctx.lineWidth = 2.5
              ctx.stroke()
              circle(ctx, cx, cy, 3, theme.text)
              circle(ctx, x, y, 5, PEN, theme.surface, 2)

              text(ctx, `${terms} circle${terms === 1 ? '' : 's'}`, 16, 26, { color: theme.text, size: 15, weight: 700 })
              text(ctx, 'Press and drag to draw your own shape', 16, H - 16, { color: theme.muted, size: 13 })
              if (f.frame % 10 === 0) setLap(t)
            }}
          />
          <Readout
            items={[
              ['Terms used', `${terms} / ${N}`],
              ['Largest circle', `r = ${fmt(biggest.amp, 1)}`],
              ['Its frequency', `${biggest.freq} per lap`],
              ['Detail captured', `${fmt(share * 100, share > 0.999 ? 2 : 1)}%`],
              ['Lap', `${Math.floor(lap * 100)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => (tau.current = 0)} resetLabel="Restart" />
      <Select label="Shape" value={preset} options={options} onChange={choose} />
      <Slider label="Circles (terms)" value={terms} min={1} max={N} onChange={setTerms} />
      <Slider label="Speed" value={speed} min={0.1} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <Toggle label="Show circles" checked={circles} onChange={setCircles} />
      <Toggle label="Show the original outline" checked={original} onChange={setOriginal} />
      <Toggle label="Add more circles each lap" checked={grow} onChange={setGrow} />
      <Hint>Draw a closed shape on the canvas, or pick one. Each circle spins at a whole number of turns per lap; with only a few circles you get a smooth blob, and adding the small, fast ones brings back the sharp corners.</Hint>
    </SimLayout>
  )
}
