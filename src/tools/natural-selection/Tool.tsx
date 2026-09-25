import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { BASE_SENSE, DAY, createWorld, endDay, radiusOf, startDay, stats, stepDay, type World } from './selection'

const W = 820
const H = 500
const AX = 10
const AY = 10
const AS = 480
const START = 20
const C_SPEED = '#e8590c'
const C_SIZE = '#1c7ed6'
const C_SENSE = '#2f9e44'

/** Slow creatures are blue, fast ones red, passing through violet (never green, which is food). */
const speedHue = (s: number) => `hsl(${Math.round(230 + clamp((s - 0.3) / 2.2, 0, 1) * 130) % 360} 70% 55%)`

export default function NaturalSelection() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [food, setFood] = useState(60)
  const [mutation, setMutation] = useState(10)
  const [speed, setSpeed] = useState(3)
  const [predation, setPredation] = useState(false)
  const [showSense, setShowSense] = useState(true)
  const random = useRef(rng(8))
  const world = useRef<World>(null as unknown as World)
  if (!world.current) world.current = createWorld(AS, START, food, random.current)
  const dusk = useRef(-1)
  const hover = useRef<{ x: number; y: number } | null>(null)
  const [info, setInfo] = useState(() => ({ day: 1, ...stats(world.current) }))

  function reset() {
    random.current = rng(Math.floor(Math.random() * 1e9))
    world.current = createWorld(AS, START, food, random.current)
    dusk.current = -1
  }

  function nextDay() {
    const w = world.current
    endDay(w, mutation / 100, random.current)
    startDay(w, food, random.current)
    dusk.current = -1
  }

  /** Runs the rest of today in one go (the Step button). */
  function finishDay() {
    const w = world.current
    if (w.creatures.length === 0) return
    let guard = 0
    while (!stepDay(w, 1 / 30, predation, random.current) && guard++ < DAY * 40);
    nextDay()
    setInfo({ day: w.day, ...stats(w) })
  }

  function onPointer(p: SimPointer) {
    const x = p.x - AX
    const y = p.y - AY
    hover.current = x >= 0 && y >= 0 && x <= AS && y <= AS ? { x, y } : null
    if (p.type === 'down' && hover.current)
      for (let i = 0; i < 5; i++) world.current.food.push({ x: clamp(x + (random.current() - 0.5) * 40, 10, AS - 10), y: clamp(y + (random.current() - 0.5) * 40, 10, AS - 10), eaten: false })
  }

  function drawCharts(ctx: CanvasRenderingContext2D) {
    const w = world.current
    const h = w.history
    const px = 510
    const pw = 300
    rrect(ctx, px - 6, 10, pw + 6, 140, 6, theme.surface, theme.border)
    const maxPop = Math.max(10, ...h.map((d) => d.pop))
    chart(ctx, px + 4, 34, pw - 14, 106, [{ data: h.map((d) => d.pop), color: theme.text, width: 2 }], { min: 0, max: maxPop * 1.1, span: Math.max(20, h.length) })
    text(ctx, 'population by day', px + 4, 27, { color: theme.muted, size: 12 })
    text(ctx, `max ${maxPop}`, px + pw - 8, 27, { color: theme.muted, size: 12, align: 'right' })

    rrect(ctx, px - 6, 158, pw + 6, 140, 6, theme.surface, theme.border)
    const traits = [
      { data: h.map((d) => d.speed), color: C_SPEED, width: 2 },
      { data: h.map((d) => d.size), color: C_SIZE, width: 2 },
      { data: h.map((d) => d.sense), color: C_SENSE, width: 2 },
    ]
    const hi = Math.max(2, ...h.map((d) => Math.max(d.speed, d.size, d.sense))) * 1.1
    line(ctx, px + 4, 288 - (1 / hi) * 106, px + pw - 10, 288 - (1 / hi) * 106, theme.border, 1, [3, 4])
    chart(ctx, px + 4, 182, pw - 14, 106, traits, { min: 0, max: hi, span: Math.max(20, h.length) })
    text(ctx, 'average traits (dashed = 1, the start)', px + 4, 175, { color: theme.muted, size: 12 })

    // Scatter of the living population: speed across, size up, colour by sense.
    const sx = px + 30
    const sy = 318
    const sw = pw - 40
    const sh = 150
    rrect(ctx, px - 6, 306, pw + 6, 188, 6, theme.surface, theme.border)
    line(ctx, sx, sy + sh, sx + sw, sy + sh, theme.muted)
    line(ctx, sx, sy, sx, sy + sh, theme.muted)
    for (const c of w.creatures) {
      const cx = sx + (clamp(c.genes.speed, 0, 3) / 3) * sw
      const cy = sy + sh - (clamp(c.genes.size, 0, 3) / 3) * sh
      circle(ctx, cx, cy, 3.5, alpha(C_SENSE, clamp(0.25 + (c.genes.sense - 0.3) / 2, 0.25, 1)), alpha(theme.text, 0.4), 0.5)
    }
    text(ctx, 'speed →', sx + sw, sy + sh + 16, { color: C_SPEED, size: 12, align: 'right' })
    text(ctx, '0', sx, sy + sh + 16, { color: theme.muted, size: 12, align: 'center' })
    text(ctx, '3', sx + sw, sy + sh + 30, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, 'size ↑', sx + 6, sy + 12, { color: C_SIZE, size: 12 })
    text(ctx, '3', sx - 6, sy + 10, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, 'darker green = keener sense', sx + 60, sy + sh + 30, { color: theme.muted, size: 12 })
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Day ${info.day}: ${info.pop} creatures competing for ${food} pieces of food.`}
            onFrame={(ctx, f) => {
              const w = world.current
              if (f.dt > 0 && w.creatures.length) {
                if (dusk.current < 0) {
                  const total = f.dt * speed
                  const n = Math.ceil(total / (1 / 30))
                  for (let i = 0; i < n && dusk.current < 0; i++) if (stepDay(w, total / n, predation, random.current)) dusk.current = 0
                } else if ((dusk.current += f.dt) > 0.8) nextDay()
              }
              clear(ctx, W, H, theme.sunken)
              rrect(ctx, AX, AY, AS, AS, 8, theme.surface, theme.border)
              ctx.save()
              ctx.translate(AX, AY)
              ctx.beginPath()
              for (const fd of w.food) {
                if (fd.eaten) continue
                ctx.moveTo(fd.x + 3.5, fd.y)
                ctx.arc(fd.x, fd.y, 3.5, 0, Math.PI * 2)
              }
              ctx.fillStyle = '#40c057'
              ctx.fill()
              const evening = dusk.current >= 0
              for (const c of w.creatures) {
                if (!c.alive && !evening) continue
                const r = radiusOf(c.genes)
                const doomed = evening && (c.eaten < 1 || !c.alive)
                if (showSense && !evening && c.alive) circle(ctx, c.x, c.y, c.genes.sense * BASE_SENSE, undefined, alpha(theme.text, 0.1), 1)
                circle(ctx, c.x, c.y, r, doomed ? alpha(theme.muted, 0.35) : c.energy <= 0 ? alpha(speedHue(c.genes.speed), 0.45) : speedHue(c.genes.speed), c.eaten >= 2 ? theme.text : undefined, 2)
                if (c.eaten === 1) circle(ctx, c.x, c.y, 2, '#fff')
              }
              const hv = hover.current
              if (hv) {
                const c = w.creatures.find((k) => k.alive && Math.hypot(k.x - hv.x, k.y - hv.y) < radiusOf(k.genes) + 5)
                if (c) {
                  const bx = clamp(c.x + 14, 4, AS - 170)
                  const by = clamp(c.y - 70, 4, AS - 86)
                  rrect(ctx, bx, by, 166, 82, 6, alpha(theme.surface, 0.95), theme.border)
                  ;[`speed  ${fmt(c.genes.speed, 2)}`, `size   ${fmt(c.genes.size, 2)}`, `sense  ${fmt(c.genes.sense, 2)}`, `energy ${fmt(Math.max(0, c.energy), 1)} · ate ${c.eaten}`].forEach((s, i) =>
                    text(ctx, s, bx + 10, by + 20 + i * 18, { color: theme.text, size: 12 }),
                  )
                }
              }
              if (evening) {
                rrect(ctx, AS / 2 - 150, 12, 300, 30, 8, alpha(theme.text, 0.8))
                text(ctx, `End of day ${w.day}: grey ones starve`, AS / 2, 32, { color: theme.surface, size: 13, align: 'center' })
              } else {
                rrect(ctx, 8, AS - 14, AS - 16, 6, 3, alpha(theme.text, 0.08))
                rrect(ctx, 8, AS - 14, (AS - 16) * Math.min(1, w.t / DAY), 6, 3, alpha(theme.accent, 0.6))
              }
              if (!w.creatures.length) {
                rrect(ctx, AS / 2 - 150, AS / 2 - 24, 300, 48, 8, alpha(theme.text, 0.85))
                text(ctx, 'Extinct! Press Reset.', AS / 2, AS / 2 + 5, { color: theme.surface, size: 15, align: 'center' })
              }
              ctx.restore()
              drawCharts(ctx)
              if (f.frame % 12 === 0) setInfo({ day: w.day, ...stats(w) })
            }}
          />
          <Legend items={[[C_SPEED, 'Speed'], [C_SIZE, 'Size'], [C_SENSE, 'Sense'], ['#40c057', 'Food']]} />
          <Readout
            items={[
              ['Day', info.day],
              ['Population', info.pop],
              ['Mean speed', fmt(info.speed, 2)],
              ['Mean size', fmt(info.size, 2)],
              ['Mean sense', fmt(info.sense, 2)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} onStep={finishDay} />
      <Slider label="Food per day" value={food} min={10} max={150} step={5} onChange={setFood} />
      <Slider label="Mutation rate" value={mutation} min={0} max={50} unit="%" onChange={setMutation} />
      <Slider label="Speed" value={speed} min={1} max={10} unit="×" onChange={setSpeed} />
      <Toggle label="Big eat small (size ratio > 1.2)" checked={predation} onChange={setPredation} />
      <Toggle label="Show sense range" checked={showSense} onChange={setShowSense} />
      <Hint>Each day a creature needs 1 food to survive and 2 to have a child with slightly mutated genes. Moving costs size³ × speed² + sense energy per second, so there is no free lunch. Colour shows speed (blue slow, red fast); click the arena to drop food, hover a creature to see its genes.</Hint>
    </SimLayout>
  )
}
