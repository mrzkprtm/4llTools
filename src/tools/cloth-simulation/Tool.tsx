import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line } from '../../sim/draw'
import { clamp, fmt, makeNoise } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { Cloth, type PinMode } from './cloth'

const W = 800
const H = 520
const COLS = 36
const ROWS = 24
const SP = 15
const OX = (W - (COLS - 1) * SP) / 2
const OY = 44
const STEP = 1 / 120
const noise = makeNoise(7)

type Mode = 'pull' | 'cut'
type Look = 'shaded' | 'wire'

export default function ClothSimulation() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [pins, setPins] = useState<PinMode>('row')
  const [gravity, setGravity] = useState(980)
  const [wind, setWind] = useState(300)
  const [iters, setIters] = useState(10)
  const [tear, setTear] = useState(true)
  const [tearAt, setTearAt] = useState(2.4)
  const [mode, setMode] = useState<Mode>('pull')
  const [look, setLook] = useState<Look>('shaded')
  const [stats, setStats] = useState({ links: 0, torn: 0, stretch: 0 })
  const cloth = useRef<Cloth | null>(null)
  const acc = useRef(0)
  const time = useRef(0)
  const cutFrom = useRef<{ x: number; y: number } | null>(null)

  const get = () => (cloth.current ??= new Cloth(COLS, ROWS, SP, OX, OY, pins))

  function reset(p = pins) {
    cloth.current = new Cloth(COLS, ROWS, SP, OX, OY, p)
  }

  function onPointer(p: SimPointer) {
    const c = get()
    const cutting = mode === 'cut' || p.shift
    if (p.type === 'down') {
      if (cutting) cutFrom.current = { x: p.x, y: p.y }
      else {
        const k = c.nearest(p.x, p.y, 45)
        if (k >= 0) c.grab(k, p.x, p.y)
      }
    }
    if (p.type === 'move' && p.down) {
      if (cutFrom.current) {
        c.cut(cutFrom.current.x, cutFrom.current.y, p.x, p.y, 7)
        cutFrom.current = { x: p.x, y: p.y }
      } else if (c.grabbed >= 0) c.grab(c.grabbed, clamp(p.x, 0, W), clamp(p.y, 0, H))
    }
    if (p.type === 'up') {
      c.release()
      cutFrom.current = null
    }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor={mode === 'cut' ? 'crosshair' : 'grab'}
            label={`A ${COLS} by ${ROWS} cloth hanging under gravity with wind.`}
            onFrame={(ctx, f) => {
              const c = get()
              // Fixed sub-steps keep Verlet stable whatever the frame rate.
              acc.current = Math.min(acc.current + f.dt, STEP * 5)
              while (acc.current >= STEP) {
                acc.current -= STEP
                time.current += STEP
                const t = time.current
                c.step(STEP, {
                  gravity,
                  iterations: iters,
                  tearAt: tear ? tearAt : 0,
                  force: wind ? (x, y) => [wind * (0.55 + 0.9 * noise(x * 0.004 + t * 0.35, y * 0.004, t * 0.25)), wind * 0.35 * noise(x * 0.006, y * 0.006 + 40, t * 0.6)] : undefined,
                })
              }
              if (!f.running && c.grabbed >= 0) (c.snap(), c.satisfy(iters))

              clear(ctx, W, H, theme.sunken)
              line(ctx, OX - 30, OY, OX + (COLS - 1) * SP + 30, OY, alpha(theme.text, 0.5), 4)
              const { x, y, right, down, alive, rest } = c
              if (look === 'shaded') {
                for (let j = 0; j < ROWS - 1; j++)
                  for (let i = 0; i < COLS - 1; i++) {
                    const k = j * COLS + i
                    const top = right[k]
                    const left = down[k]
                    const bottom = right[k + COLS]
                    const rgt = down[k + 1]
                    if (!alive[top] || !alive[left] || !alive[bottom] || !alive[rgt]) continue
                    const len =
                      Math.hypot(x[k + 1] - x[k], y[k + 1] - y[k]) +
                      Math.hypot(x[k + COLS] - x[k], y[k + COLS] - y[k]) +
                      Math.hypot(x[k + COLS + 1] - x[k + COLS], y[k + COLS + 1] - y[k + COLS]) +
                      Math.hypot(x[k + COLS + 1] - x[k + 1], y[k + COLS + 1] - y[k + 1])
                    const s = clamp((len / (4 * rest[top]) - 1) * 4, 0, 1)
                    const light = (theme.dark ? 46 : 58) + ((i + j) % 2) * 5 - s * 6
                    ctx.beginPath()
                    ctx.moveTo(x[k], y[k])
                    ctx.lineTo(x[k + 1], y[k + 1])
                    ctx.lineTo(x[k + COLS + 1], y[k + COLS + 1])
                    ctx.lineTo(x[k + COLS], y[k + COLS])
                    ctx.closePath()
                    const col = `hsl(${205 - s * 205} ${62 + s * 20}% ${light}%)`
                    ctx.fillStyle = col
                    ctx.strokeStyle = col
                    ctx.lineWidth = 0.6
                    ctx.fill()
                    ctx.stroke()
                  }
              } else {
                ctx.beginPath()
                for (let l = 0; l < c.ca.length; l++) {
                  if (!alive[l]) continue
                  ctx.moveTo(x[c.ca[l]], y[c.ca[l]])
                  ctx.lineTo(x[c.cb[l]], y[c.cb[l]])
                }
                ctx.strokeStyle = alpha(theme.text, 0.75)
                ctx.lineWidth = 1
                ctx.stroke()
              }
              for (let k = 0; k < COLS; k++) if (c.pinned[k]) circle(ctx, x[k], y[k], 4, theme.text, theme.surface, 1.5)
              if (c.grabbed >= 0) circle(ctx, x[c.grabbed], y[c.grabbed], 9, undefined, theme.accent, 2.5)

              if (f.frame % 12 === 0) {
                let n = 0
                for (let l = 0; l < alive.length; l++) n += alive[l]
                setStats({ links: n, torn: alive.length - n, stretch: c.maxStretch() })
              }
            }}
          />
          <Readout
            items={[
              ['Points', String(COLS * ROWS)],
              ['Links intact', String(stats.links)],
              ['Torn', String(stats.torn)],
              ['Max stretch', `${fmt(stats.stretch * 100, 0)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <Choice label="Pins" value={pins} options={[['row', 'Top row'], ['corners', 'Corners'], ['every4', 'Every 4th']]} onChange={(p) => (setPins(p), reset(p))} />
      <Choice label="Drag to" value={mode} options={[['pull', 'Pull'], ['cut', 'Cut']]} onChange={setMode} />
      <Slider label="Gravity" value={gravity} min={0} max={2000} step={20} unit=" px/s²" onChange={setGravity} />
      <Slider label="Wind" value={wind} min={0} max={1500} step={20} unit=" px/s²" onChange={setWind} />
      <Slider label="Stiffness (iterations)" value={iters} min={3} max={24} onChange={setIters} />
      <Toggle label="Tearable" checked={tear} onChange={setTear} />
      {tear && <Slider label="Tears at" value={tearAt} min={1.4} max={4} step={0.1} unit="× length" onChange={setTearAt} />}
      <Choice label="Look" value={look} options={[['shaded', 'Shaded'], ['wire', 'Wireframe']]} onChange={setLook} />
      <Hint>
        Grab the cloth and pull; yank hard and it tears. Shift-drag (or pick Cut) to slice it. Fewer iterations make it stretchy like jersey; more make it stiff like canvas. Red shows where it
        is stretched.
      </Hint>
    </SimLayout>
  )
}
