import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, clear, line, rrect, text } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { createPopulation, nextGeneration, sanitize, type Population, type Selection } from './ga'

const W = 800
const H = 500
const DEFAULT = 'METHINKS IT IS LIKE A WEASEL'
const AVG = '#1c7ed6'

export default function GeneticAlgorithm() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [input, setInput] = useState(DEFAULT)
  const [size, setSize] = useState(200)
  const [mutation, setMutation] = useState(1)
  const [cross, setCross] = useState(true)
  const [selection, setSelection] = useState<Selection>('tournament')
  const [elitism, setElitism] = useState(1)
  const [rate, setRate] = useState(10)
  const target = sanitize(input) || 'A'
  const random = useRef(rng(1))
  const pop = useRef<Population>(null as unknown as Population)
  if (!pop.current) pop.current = createPopulation(size, target, random.current)
  const hist = useRef({ best: [] as number[], avg: [] as number[], solvedAt: -1 })
  const acc = useRef(0)
  const [info, setInfo] = useState({ gen: 0, best: 0, avg: 0, evals: size, solved: -1 })

  function reset(t = target, n = size) {
    random.current = rng(Math.floor(Math.random() * 1e9))
    pop.current = createPopulation(n, t, random.current)
    hist.current = { best: [], avg: [], solvedAt: -1 }
    record()
    setInfo({ gen: 0, best: pop.current.scores[0], avg: average(), evals: n, solved: -1 })
  }

  const average = () => pop.current.scores.reduce((a, b) => a + b, 0) / pop.current.scores.length

  function record() {
    const h = hist.current
    h.best.push(pop.current.scores[0])
    h.avg.push(average())
    if (h.best.length > 4000) {
      h.best.splice(0, 1)
      h.avg.splice(0, 1)
    }
  }

  function generation() {
    if (hist.current.solvedAt >= 0) return
    pop.current = nextGeneration(pop.current, { target, mutation: mutation / 100, crossover: cross, selection, elitism }, random.current)
    record()
    if (pop.current.scores[0] >= 1) hist.current.solvedAt = pop.current.generation
  }

  function step() {
    generation()
    const p = pop.current
    setInfo({ gen: p.generation, best: p.scores[0], avg: average(), evals: p.evaluations, solved: hist.current.solvedAt })
  }

  if (!hist.current.best.length) record()

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`Genetic algorithm evolving toward "${target}". Generation ${info.gen}, best fitness ${Math.round(info.best * 100)} percent.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0 && hist.current.solvedAt < 0) {
                acc.current += f.dt * rate
                let k = 0
                while (acc.current >= 1 && k++ < 30) {
                  acc.current -= 1
                  generation()
                }
                acc.current = Math.min(acc.current, 1)
                if (hist.current.solvedAt >= 0) setRunning(false)
              }
              const p = pop.current
              const best = p.members[0]
              clear(ctx, W, H, theme.sunken)
              text(ctx, `best of generation ${p.generation}`, 16, 26, { color: theme.muted, size: 13 })
              const cw = Math.min(26, (W - 32) / target.length)
              const x0 = (W - cw * target.length) / 2
              for (let i = 0; i < target.length; i++) {
                const ok = best[i] === target[i]
                rrect(ctx, x0 + i * cw + 1, 38, cw - 2, 46, 5, ok ? alpha(theme.ok, 0.85) : theme.surface, ok ? undefined : theme.border)
                text(ctx, best[i] === ' ' ? '·' : best[i], x0 + i * cw + cw / 2, 69, { color: ok ? '#fff' : theme.text, size: Math.min(22, cw * 0.95), align: 'center', weight: 700 })
                text(ctx, target[i] === ' ' ? '·' : target[i], x0 + i * cw + cw / 2, 102, { color: theme.muted, size: Math.min(13, cw * 0.8), align: 'center' })
              }
              text(ctx, 'target', x0 - 8, 102, { color: theme.muted, size: 12, align: 'right' })

              // Top candidates, best first.
              rrect(ctx, 10, 122, 380, 368, 8, theme.surface, theme.border)
              text(ctx, `top candidates of ${p.members.length}`, 22, 144, { color: theme.muted, size: 12 })
              const rows = 14
              const fs = Math.max(12, Math.min(14, 310 / (Math.max(1, target.length) * 0.62)))
              for (let r = 0; r < Math.min(rows, p.members.length); r++) {
                const y = 170 + r * 22.5
                const m = p.members[r]
                text(ctx, `${Math.round(p.scores[r] * 100)}%`.padStart(4), 22, y, { color: theme.muted, size: 12 })
                const cx = 64
                const step = fs * 0.62
                for (let i = 0; i < m.length; i++) text(ctx, m[i], cx + i * step, y, { color: m[i] === target[i] ? theme.ok : alpha(theme.text, 0.55), size: fs, weight: m[i] === target[i] ? 700 : 400 })
              }

              // Fitness chart.
              const h = hist.current
              const gx = 440
              const gy = 150
              const gw = 340
              const gh = 300
              rrect(ctx, 400, 122, 390, 368, 8, theme.surface, theme.border)
              text(ctx, 'fitness by generation', 412, 144, { color: theme.muted, size: 12 })
              for (const v of [0, 0.5, 1]) {
                line(ctx, gx, gy + gh - v * gh, gx + gw, gy + gh - v * gh, alpha(theme.text, 0.08))
                text(ctx, `${v * 100}%`, gx - 6, gy + gh - v * gh + 4, { color: theme.muted, size: 12, align: 'right' })
              }
              chart(ctx, gx, gy, gw, gh, [{ data: h.avg, color: AVG, width: 2 }, { data: h.best, color: theme.accent, width: 2.5 }], { min: 0, max: 1, axis: theme.border, span: Math.max(50, h.best.length) })
              text(ctx, '0', gx, gy + gh + 18, { color: theme.muted, size: 12, align: 'center' })
              text(ctx, `${p.generation}`, gx + gw, gy + gh + 18, { color: theme.muted, size: 12, align: 'right' })
              if (h.solvedAt >= 0) {
                rrect(ctx, 250, 230, 300, 56, 10, alpha(theme.ok, 0.95))
                text(ctx, `Found it in ${h.solvedAt} generations!`, 400, 264, { color: '#fff', size: 16, align: 'center', weight: 700 })
              }
              if (f.frame % 8 === 0) setInfo({ gen: p.generation, best: p.scores[0], avg: average(), evals: p.evaluations, solved: h.solvedAt })
            }}
          />
          <Legend items={[[theme.accent, 'Best fitness'], [AVG, 'Average fitness'], [theme.ok, 'Correct letter']]} />
          <Readout
            items={[
              ['Generation', info.gen],
              ['Best fitness', `${Math.round(info.best * 100)}%`],
              ['Average fitness', `${fmt(info.avg * 100, 1)}%`],
              ['Evaluations', fmt(info.evals, 0)],
              ['Status', info.solved >= 0 ? 'solved' : 'evolving'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} onStep={step} />
      <div className="sim-field">
        <label className="sim-label" htmlFor="ga-target">
          Target phrase
        </label>
        <input
          id="ga-target"
          className="sim-text"
          value={input}
          maxLength={40}
          onChange={(e) => {
            setInput(e.target.value)
            reset(sanitize(e.target.value) || 'A')
          }}
        />
      </div>
      <Slider label="Population" value={size} min={20} max={1000} step={10} onChange={(v) => { setSize(v); reset(target, v) }} />
      <Slider label="Mutation rate" value={mutation} min={0} max={10} step={0.1} unit="%" onChange={setMutation} />
      <Choice label="Selection" value={selection} options={[['roulette', 'Roulette'], ['tournament', 'Tournament']]} onChange={setSelection} />
      <Slider label="Elitism (best kept)" value={elitism} min={0} max={10} onChange={setElitism} />
      <Toggle label="Crossover" checked={cross} onChange={setCross} />
      <Slider label="Speed" value={rate} min={1} max={60} unit=" gen/s" onChange={setRate} />
      <Hint>Random letters are scored by how many match the target; the fitter ones breed. Roulette picks parents in proportion to fitness, tournament takes the best of three. Try mutation at 0% or 10% to see why a little mutation works best.</Hint>
    </SimLayout>
  )
}
