import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, line, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { tone } from '../../sim/audio'
import { alpha, useTheme } from '../../sim/theme'
import { SORTS, advance, createRun, makeData, sortInfo, type Pattern, type SortId, type SortRun } from './sorts'

const W = 800
const H = 440
const TOP = 52
const BOTTOM = H - 14
const COMPARE = '#1c7ed6'
const PATTERNS = [['random', 'Random'], ['nearly', 'Nearly sorted'], ['reversed', 'Reversed'], ['few', 'Few unique']] as const
const ALGOS = SORTS.map((s) => [s.id, s.name] as const)

/** Speed slider (0–100) → work steps per frame on a log scale, 0.05 … 5000. */
const stepsPerFrame = (v: number) => 0.05 * 10 ** ((v / 100) * 5)

export default function SortingVisualizer() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<SortId>('quick')
  const [size, setSize] = useState(80)
  const [pattern, setPattern] = useState<Pattern>('random')
  const [speed, setSpeed] = useState(40)
  const [sound, setSound] = useState(false)
  const [stats, setStats] = useState({ compares: 0, swaps: 0, writes: 0, steps: 0, done: false })
  const data = useRef(makeData(80, 'random'))
  const run = useRef<SortRun>(createRun('quick', data.current))
  const acc = useRef(0)
  const sweep = useRef(-1)
  const lastTone = useRef(0)
  const info = sortInfo(algo)

  function restart(id = algo, fresh?: number[]) {
    if (fresh) data.current = fresh
    run.current = createRun(id, data.current)
    acc.current = 0
    sweep.current = -1
    setStats({ compares: 0, swaps: 0, writes: 0, steps: 0, done: false })
  }

  function play(v: boolean) {
    if (v && run.current.done && sweep.current >= run.current.a.length) restart(algo, makeData(size, pattern))
    setRunning(v)
  }

  function beep(value: number, n: number) {
    const now = performance.now()
    if (!sound || now - lastTone.current < 35) return
    lastTone.current = now
    tone(180 + (value / n) * 900, 45, 'triangle', 0.04)
  }

  function step() {
    const r = run.current
    r.hotCompare.fill(0)
    r.hotMove.fill(0)
    advance(r, 1)
    if (r.last >= 0) beep(r.a[r.last], r.a.length)
    setStats({ compares: r.compares, swaps: r.swaps, writes: r.writes, steps: r.steps, done: r.done })
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`${info.name} sorting ${size} bars. ${stats.compares} comparisons and ${stats.writes} writes so far.`}
            onFrame={(ctx, f) => {
              const r = run.current
              const n = r.a.length
              if (f.running) {
                if (!r.done) {
                  acc.current += stepsPerFrame(speed)
                  const budget = Math.floor(acc.current)
                  acc.current -= budget
                  if (budget > 0) {
                    r.last = -1
                    advance(r, budget)
                    if (r.last >= 0) beep(r.a[r.last], n)
                  }
                } else if (sweep.current < n) {
                  // Victory sweep: light every bar up from left to right.
                  sweep.current = Math.min(n, sweep.current + Math.max(1, n / 45))
                  const k = Math.min(n - 1, Math.floor(sweep.current))
                  beep(r.a[k], n)
                  if (sweep.current >= n) setRunning(false)
                }
              }
              if (f.frame % 6 === 0 || r.done !== stats.done)
                setStats({ compares: r.compares, swaps: r.swaps, writes: r.writes, steps: r.steps, done: r.done })

              clear(ctx, W, H, theme.sunken)
              const bw = (W - 40) / n
              const gap = bw > 5 ? Math.min(2, bw * 0.15) : 0
              const hmax = BOTTOM - TOP
              let max = 1
              for (let i = 0; i < n; i++) max = Math.max(max, r.a[i])
              const decay = f.running ? 0.78 : 1
              const base = alpha(theme.muted, 0.55)
              for (let i = 0; i < n; i++) {
                const x = 20 + i * bw
                const h = (r.a[i] / max) * hmax
                const swept = r.done && i < sweep.current
                let color = r.sorted[i] || swept ? alpha(theme.ok, swept ? 0.95 : 0.6) : base
                if (r.hotMove[i] > 0.05) color = alpha(theme.accent, 0.35 + 0.65 * r.hotMove[i])
                else if (r.hotCompare[i] > 0.05) color = alpha(COMPARE, 0.35 + 0.65 * r.hotCompare[i])
                ctx.fillStyle = color
                ctx.fillRect(x + gap / 2, BOTTOM - h, Math.max(0.6, bw - gap), h)
                r.hotMove[i] *= decay
                r.hotCompare[i] *= decay
              }
              if (r.done && sweep.current >= 0 && sweep.current < n) {
                const x = 20 + sweep.current * bw
                line(ctx, x, TOP - 6, x, BOTTOM, theme.ok, 2)
              }
              line(ctx, 16, BOTTOM + 0.5, W - 16, BOTTOM + 0.5, theme.border)
              text(ctx, info.name, 20, 28, { color: theme.text, size: 17, weight: 700, mono: false })
              text(ctx, `${fmt(r.compares)} comparisons · ${fmt(r.writes)} writes`, W - 20, 28, { color: theme.muted, size: 13, align: 'right' })
              if (r.done && sweep.current >= n) text(ctx, 'Sorted!', 20, 46, { color: theme.ok, size: 13, weight: 700 })
            }}
          />
          <Legend items={[[alpha(theme.muted, 0.55), 'unsorted'], [COMPARE, 'comparing'], [theme.accent, 'swap / write'], [theme.ok, 'in final place']]} />
          <Readout
            items={[
              ['Comparisons', fmt(stats.compares)],
              ['Swaps', fmt(stats.swaps)],
              ['Writes', fmt(stats.writes)],
              ['Steps', fmt(stats.steps)],
              ['Best', info.best],
              ['Average', info.avg],
              ['Worst', info.worst],
              ['Extra memory', info.space],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={() => restart(algo, makeData(size, pattern))} resetLabel="Shuffle" />
      <Select
        label="Algorithm"
        value={algo}
        options={ALGOS}
        onChange={(v) => {
          setAlgo(v)
          restart(v)
        }}
      />
      <Select
        label="Starting order"
        value={pattern}
        options={PATTERNS}
        onChange={(v) => {
          setPattern(v)
          restart(algo, makeData(size, v))
        }}
      />
      <Slider
        label="Bars"
        value={size}
        min={8}
        max={300}
        onChange={(v) => {
          setSize(v)
          restart(algo, makeData(v, pattern))
        }}
      />
      <Slider label="Speed" value={speed} min={0} max={100} format={(v) => `${fmt(stepsPerFrame(v), stepsPerFrame(v) < 1 ? 2 : 0)} steps/frame`} onChange={setSpeed} />
      <Toggle label="Sound (pitch = bar height)" checked={sound} onChange={setSound} />
      <Hint>Pick an algorithm and press Play. Blue bars are being compared, orange ones are moving, and green ones have reached their final place. Try Nearly sorted with insertion sort, then with quicksort.</Hint>
    </SimLayout>
  )
}
