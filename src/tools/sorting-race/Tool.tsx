import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { SORTS, advance, createRun, makeData, sortInfo, type Pattern, type SortId, type SortRun } from '../sorting-visualizer/sorts'
import { gridShape, raceSteps } from './race'

const W = 800
const H = 520
const PAD = 10
const MEDALS = ['#e0a800', '#9aa4ad', '#c47a3a']
const PATTERNS = [['random', 'Random'], ['nearly', 'Nearly sorted'], ['reversed', 'Reversed'], ['few', 'Few unique']] as const
const DEFAULT: SortId[] = ['bubble', 'insertion', 'shell', 'merge', 'quick', 'heap']

interface Lane {
  id: SortId
  run: SortRun
  place: number
  finishedAt: number
}

export default function SortingRace() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [picked, setPicked] = useState<SortId[]>(DEFAULT)
  const [size, setSize] = useState(100)
  const [pattern, setPattern] = useState<Pattern>('random')
  const [speed, setSpeed] = useState(50)
  const [clock, setClock] = useState(0)
  const [ranking, setRanking] = useState<{ id: SortId; steps: number; compares: number }[]>([])
  const data = useRef(makeData(100, 'random'))
  const lanes = useRef<Lane[]>(DEFAULT.map((id) => ({ id, run: createRun(id, data.current), place: 0, finishedAt: 0 })))
  const acc = useRef(0)
  const elapsed = useRef(0)

  function restart(ids = picked, fresh?: number[]) {
    if (fresh) data.current = fresh
    lanes.current = ids.map((id) => ({ id, run: createRun(id, data.current), place: 0, finishedAt: 0 }))
    acc.current = 0
    elapsed.current = 0
    setClock(0)
    setRanking([])
  }

  function toggle(id: SortId, on: boolean) {
    const next = SORTS.map((s) => s.id).filter((s) => (s === id ? on : picked.includes(s)))
    setPicked(next)
    restart(next)
  }

  function tick(budget: number) {
    elapsed.current += budget
    for (const lane of lanes.current) {
      if (lane.run.done) continue
      advance(lane.run, budget)
      if (lane.run.done) lane.finishedAt = lane.run.steps
    }
    // Places follow the exact number of steps each sort needed, so ties within a frame resolve fairly.
    const finished = lanes.current.filter((l) => l.run.done).sort((a, b) => a.finishedAt - b.finishedAt)
    finished.forEach((l, i) => (l.place = i + 1))
    if (finished.length === lanes.current.length) {
      setRanking(finished.map((l) => ({ id: l.id, steps: l.finishedAt, compares: l.run.compares })))
      setRunning(false)
    }
  }

  function play(v: boolean) {
    if (v && lanes.current.every((l) => l.run.done)) restart(picked, makeData(size, pattern))
    setRunning(v)
  }

  const finishedCount = lanes.current.filter((l) => l.run.done).length
  const leader = lanes.current.find((l) => l.place === 1)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`Sorting race between ${picked.map((id) => sortInfo(id).name).join(', ')} on ${size} items.`}
            onFrame={(ctx, f) => {
              if (f.running) {
                acc.current += raceSteps(speed)
                const budget = Math.floor(acc.current)
                acc.current -= budget
                if (budget > 0) tick(budget)
              }
              if (f.frame % 8 === 0) setClock(elapsed.current)
              clear(ctx, W, H, theme.sunken)
              const ls = lanes.current
              const { cols, rows } = gridShape(ls.length)
              const pw = (W - PAD * (cols + 1)) / cols
              const ph = (H - PAD * (rows + 1)) / rows
              const decay = f.running ? 0.75 : 1
              ls.forEach((lane, k) => {
                const r = lane.run
                const px = PAD + (k % cols) * (pw + PAD)
                const py = PAD + Math.floor(k / cols) * (ph + PAD)
                rrect(ctx, px, py, pw, ph, 8, theme.surface, lane.place === 1 ? MEDALS[0] : theme.border, lane.place === 1 ? 2 : 1)
                const info = sortInfo(lane.id)
                text(ctx, info.name, px + 10, py + 20, { color: theme.text, size: 14, weight: 700, mono: false })
                text(ctx, `${fmt(r.compares)} cmp · ${fmt(r.steps)} steps`, px + 10, py + 37, { color: theme.muted, size: 12 })
                const n = r.a.length
                const bx = px + 8
                const by = py + 46
                const bw = (pw - 16) / n
                const bh = ph - 54
                let max = 1
                for (let i = 0; i < n; i++) max = Math.max(max, r.a[i])
                for (let i = 0; i < n; i++) {
                  const h = (r.a[i] / max) * bh
                  ctx.fillStyle = r.done
                    ? alpha(theme.ok, 0.75)
                    : r.hotMove[i] > 0.1
                      ? theme.accent
                      : r.hotCompare[i] > 0.1
                        ? '#1c7ed6'
                        : r.sorted[i]
                          ? alpha(theme.ok, 0.55)
                          : alpha(theme.muted, 0.5)
                  ctx.fillRect(bx + i * bw, by + bh - h, Math.max(0.5, bw - (bw > 3 ? 1 : 0)), h)
                  r.hotMove[i] *= decay
                  r.hotCompare[i] *= decay
                }
                if (lane.place) {
                  const mx = px + pw - 24
                  const my = py + 24
                  const c = MEDALS[lane.place - 1] ?? alpha(theme.muted, 0.6)
                  circle(ctx, mx, my, 16, c, theme.surface, 2)
                  text(ctx, String(lane.place), mx, my + 1, { color: '#fff', size: 15, weight: 800, align: 'center', baseline: 'middle' })
                }
              })
            }}
          />
          <Readout
            items={[
              ['Race clock', `${fmt(clock)} steps`],
              ['Finished', `${finishedCount} / ${picked.length}`],
              ['Items', size],
              ['Winner', leader ? sortInfo(leader.id).short : '—'],
            ]}
          />
          {ranking.length > 0 && (
            <div className="sim-cells" aria-label="Final ranking">
              {ranking.map((r, i) => (
                <span key={r.id} className={i === 0 ? 'on' : ''}>
                  {i + 1}. {sortInfo(r.id).name} — {fmt(r.steps)} steps, {fmt(r.compares)} comparisons
                </span>
              ))}
            </div>
          )}
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onReset={() => restart(picked, makeData(size, pattern))} resetLabel="New race" />
      <div className="sim-field">
        <span className="sim-label">
          <span>Racers</span>
          <span className="sim-val">{picked.length} of 4–9</span>
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
          {SORTS.map((s) => {
            const on = picked.includes(s.id)
            return (
              <label key={s.id} className="sim-toggle">
                <input type="checkbox" checked={on} disabled={on ? picked.length <= 4 : picked.length >= 9} onChange={(e) => toggle(s.id, e.target.checked)} />
                {s.short}
              </label>
            )
          })}
        </div>
      </div>
      <Select
        label="Starting order"
        value={pattern}
        options={PATTERNS}
        onChange={(v) => {
          setPattern(v)
          restart(picked, makeData(size, v))
        }}
      />
      <Slider
        label="Items"
        value={size}
        min={10}
        max={300}
        onChange={(v) => {
          setSize(v)
          restart(picked, makeData(v, pattern))
        }}
      />
      <Slider label="Speed" value={speed} min={0} max={100} format={(v) => `${fmt(raceSteps(v), raceSteps(v) < 1 ? 1 : 0)} steps/frame`} onChange={setSpeed} />
      <Hint>Every sort gets the same number of steps (a comparison, swap or write) each frame, so the ones with less work finish first. Try Nearly sorted: insertion sort suddenly beats quicksort.</Hint>
    </SimLayout>
  )
}
