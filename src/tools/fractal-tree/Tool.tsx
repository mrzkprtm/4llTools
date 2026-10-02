import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, text } from '../../sim/draw'
import { fmt, lerp, makeNoise, round } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { bounds, branches, type TreeParams } from './tree'

const W = 800
const H = 560
const ROOT_Y = H - 24
const PALETTES = {
  spring: ['#6b4226', '#51cf66'],
  autumn: ['#5c3a1e', '#ff7a1a'],
  blossom: ['#4a3428', '#f783ac'],
  frost: ['#3b4a5a', '#a5d8ff'],
} as const
type Pal = keyof typeof PALETTES

function mix(a: string, b: string, t: number) {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)
  return `rgb(${[0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), t))).join(',')})`
}

export default function FractalTree() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [depth, setDepth] = useState(10)
  const [angle, setAngle] = useState(24)
  const [ratio, setRatio] = useState(0.72)
  const [trunk, setTrunk] = useState(120)
  const [asym, setAsym] = useState(0)
  const [taper, setTaper] = useState(0.7)
  const [palette, setPalette] = useState<Pal>('spring')
  const [leaves, setLeaves] = useState(true)
  const [wind, setWind] = useState(true)
  const [gust, setGust] = useState(0.12)
  const [growRate, setGrowRate] = useState(2)
  const [drawn, setDrawn] = useState(0)
  const grown = useRef(0)
  const scale = useRef(1)
  const dragging = useRef(false)
  const noise = useMemo(() => makeNoise(7), [])

  const params: TreeParams = { depth, angle, ratio, trunk, asym, taper }
  const still = useMemo(() => branches(params), [depth, angle, ratio, trunk, asym, taper])
  const [, top, , bottom] = bounds(still)
  const totalLength = still.reduce((s, b) => s + Math.hypot(b.x2 - b.x1, b.y2 - b.y1), 0)

  function onPointer(p: SimPointer) {
    if (p.type === 'down') dragging.current = true
    if (!dragging.current) return
    setAngle(Math.round((p.x / W) * 120))
    setRatio(round(0.5 + (1 - p.y / H) * 0.35, 2))
    if (p.type === 'up') dragging.current = false
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="move"
            label={`Fractal tree of depth ${depth} with branch angle ${angle} degrees and length ratio ${ratio}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0 && grown.current < depth) grown.current = Math.min(depth, grown.current + f.dt * growRate)
              if (grown.current > depth) grown.current = depth
              const g = grown.current
              const t = f.t
              const bend = wind
                ? (level: number, id: number) => gust * (0.55 * noise(t * 0.35, 0.5) + 0.45 * noise(t * 1.4, id * 0.71)) * (0.25 + level / depth)
                : undefined
              const segs = branches(params, 0, 0, bend)
              // Shrink (never enlarge) so the whole tree fits above the ground.
              const [minX, minY, maxX] = bounds(still)
              const target = Math.min(1, (ROOT_Y - 16) / Math.max(1, -minY), (W / 2 - 16) / Math.max(1, Math.abs(minX), Math.abs(maxX)))
              scale.current = f.frame === 0 ? target : lerp(scale.current, target, 0.12)

              clear(ctx, W, H, theme.sunken)
              ctx.fillStyle = alpha(theme.text, 0.08)
              ctx.beginPath()
              ctx.ellipse(W / 2, ROOT_Y + 6, 220, 16, 0, 0, Math.PI * 2)
              ctx.fill()
              ctx.save()
              ctx.translate(W / 2, ROOT_Y)
              ctx.scale(scale.current, scale.current)
              ctx.lineCap = 'round'
              const [c0, c1] = PALETTES[palette]
              let count = 0
              let i = 0
              for (let level = 0; level < depth; level++) {
                const n = 2 ** level
                const frac = Math.min(1, g - level)
                if (frac <= 0) break
                ctx.beginPath()
                for (let k = 0; k < n; k++) {
                  const s = segs[i + k]
                  ctx.moveTo(s.x1, s.y1)
                  ctx.lineTo(lerp(s.x1, s.x2, frac), lerp(s.y1, s.y2, frac))
                }
                count += n
                ctx.strokeStyle = mix(c0, c1, depth > 1 ? level / (depth - 1) : 0)
                ctx.lineWidth = Math.max(0.6, segs[i].width)
                ctx.stroke()
                i += n
              }
              if (leaves && g >= depth && depth > 2) {
                ctx.beginPath()
                const r = Math.max(1.6, 3 / scale.current)
                for (let k = segs.length - 2 ** (depth - 1); k < segs.length; k++) {
                  const s = segs[k]
                  ctx.moveTo(s.x2 + r, s.y2)
                  ctx.arc(s.x2, s.y2, r, 0, Math.PI * 2)
                }
                ctx.fillStyle = alpha(c1, 0.55)
                ctx.fill()
              }
              ctx.restore()
              if (dragging.current) text(ctx, `angle ${angle}° · ratio ${ratio}`, 14, 24, { color: theme.text, size: 13, weight: 700 })
              if (f.frame % 6 === 0 && count !== drawn) setDrawn(count)
            }}
          />
          <Readout
            items={[
              ['Branches drawn', fmt(drawn, 0)],
              ['Depth', depth],
              ['Twigs at the tips', fmt(2 ** (depth - 1), 0)],
              ['Total length', `${fmt(totalLength, 0)}`],
              ['Height', `${fmt(bottom - top, 0)}`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { grown.current = 0; setRunning(true) }} resetLabel="Grow" />
      <Slider label="Depth" value={depth} min={1} max={12} onChange={setDepth} />
      <Slider label="Branch angle" value={angle} min={0} max={120} unit="°" onChange={setAngle} />
      <Slider label="Length ratio" value={ratio} min={0.5} max={0.85} step={0.01} onChange={setRatio} />
      <Slider label="Trunk length" value={trunk} min={60} max={160} onChange={setTrunk} />
      <Slider label="Asymmetry" value={asym} min={-0.5} max={0.5} step={0.05} onChange={setAsym} />
      <Slider label="Thickness taper" value={taper} min={0.5} max={0.95} step={0.01} onChange={setTaper} />
      <Select label="Colours" value={palette} options={[['spring', 'Spring green'], ['autumn', 'Autumn'], ['blossom', 'Cherry blossom'], ['frost', 'Frost']]} onChange={setPalette} />
      <Toggle label="Leaves at the tips" checked={leaves} onChange={setLeaves} />
      <Toggle label="Wind" checked={wind} onChange={setWind} />
      {wind && <Slider label="Wind strength" value={gust} min={0.02} max={0.4} step={0.01} onChange={setGust} />}
      <Slider label="Growth speed" value={growRate} min={0.5} max={6} step={0.5} unit=" levels/s" onChange={setGrowRate} />
      <Hint>Every branch splits into two smaller copies of itself, so depth d has 2^d − 1 branches. Drag across the stage: left–right sets the angle, up–down the length ratio. Press Grow to watch it sprout level by level.</Hint>
    </SimLayout>
  )
}
