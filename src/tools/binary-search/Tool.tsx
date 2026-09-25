import { useId, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import { binarySearch, halvingGuesses, linearSearch, sortedData, worstCase, type BinaryStep, type LinearStep } from './search'

const W = 800
const H = 520
const PER_LINE = 32
const CELL_H = 28
const LINE_H = 54

interface Run {
  bin: Generator<BinaryStep, number, undefined>
  lin: Generator<LinearStep, number, undefined>
  b: BinaryStep | null
  l: LinearStep | null
  bDone: boolean
  lDone: boolean
  bResult: number
  lResult: number
  bCount: number
  lCount: number
  probes: number[]
  started: boolean
}

const newRun = (a: number[], target: number): Run => ({ bin: binarySearch(a, target), lin: linearSearch(a, target), b: null, l: null, bDone: false, lDone: false, bResult: -1, lResult: -1, bCount: 0, lCount: 0, probes: [], started: false })

function randomTarget(a: number[]) {
  // Mostly a value that is present; sometimes one that is missing.
  if (Math.random() < 0.8) return a[Math.floor(Math.random() * a.length)]
  const i = Math.floor(Math.random() * (a.length - 1))
  return a[i + 1] - a[i] > 1 ? a[i] + 1 : a[a.length - 1] + 2
}

export default function BinarySearch() {
  const theme = useTheme()
  const id = useId()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(32)
  const [speed, setSpeed] = useState(2)
  const [data, setData] = useState(() => sortedData(32))
  const [target, setTarget] = useState(() => data[21])
  const [draft, setDraft] = useState(String(data[21]))
  const [, setTick] = useState(0)
  const r = useRef<Run>(newRun(data, target))
  const acc = useRef(0)

  function restart(a = data, t = target) {
    r.current = newRun(a, t)
    acc.current = 0
    setTick((k) => k + 1)
  }

  function stepBoth() {
    const s = r.current
    s.started = true
    if (!s.bDone) {
      const x = s.bin.next()
      if (x.done) {
        s.bDone = true
        s.bResult = x.value
      } else {
        s.b = x.value
        s.bCount++
        s.probes.push(x.value.mid)
        if (x.value.cmp === 0) {
          s.bDone = true
          s.bResult = x.value.mid
        }
      }
    }
    if (!s.lDone) {
      const x = s.lin.next()
      if (x.done) {
        s.lDone = true
        s.lResult = x.value
      } else {
        s.l = x.value
        s.lCount++
        if (x.value.match) {
          s.lDone = true
          s.lResult = x.value.i
        }
      }
    }
    setTick((k) => k + 1)
  }

  function play(v: boolean) {
    const s = r.current
    if (v && s.bDone && s.lDone) {
      const t = randomTarget(data)
      setTarget(t)
      setDraft(String(t))
      restart(data, t)
    }
    setRunning(v)
  }

  function searchFor(t: number) {
    setTarget(t)
    setDraft(String(t))
    restart(data, t)
    setRunning(true)
  }

  const s = r.current
  const per = Math.min(n, PER_LINE)
  const lines = Math.ceil(n / per)
  const cw = Math.min(56, (W - 40) / per)
  const x0 = (W - cw * per) / 2
  const sectionH = 40 + lines * LINE_H
  const top0 = Math.max(8, (H - 2 * sectionH - 16) / 2)
  const cellX = (i: number) => x0 + (i % per) * cw
  const cellY = (i: number, top: number) => top + 40 + Math.floor(i / per) * LINE_H

  const bText = !s.started
    ? `Looking for ${target}: press Play or Step`
    : s.bDone
      ? s.bResult >= 0
        ? `Found ${target} at index ${s.bResult} after ${s.bCount} comparisons`
        : `${target} is not here: low passed high after ${s.bCount} comparisons`
      : s.b
        ? `a[${s.b.mid}] = ${data[s.b.mid]} ${s.b.cmp < 0 ? '<' : '>'} ${target}, so drop the ${s.b.cmp < 0 ? 'left' : 'right'} half`
        : ''
  const lText = !s.started
    ? 'Checks every cell from the left'
    : s.lDone
      ? s.lResult >= 0
        ? `Found at index ${s.lResult} after ${s.lCount} comparisons`
        : `Not found after checking all ${s.lCount} cells`
      : s.l
        ? `a[${s.l.i}] = ${data[s.l.i]} ≠ ${target}, keep going`
        : ''

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            label={`Binary search and linear search for ${target} in ${n} sorted numbers. Binary: ${s.bCount} comparisons, linear: ${s.lCount}.`}
            onFrame={(ctx, f) => {
              const cur = r.current
              if (f.running && f.dt > 0) {
                if (cur.bDone && cur.lDone) setRunning(false)
                else {
                  acc.current += f.dt * speed
                  if (acc.current >= 1) {
                    acc.current = Math.min(acc.current - 1, 1)
                    stepBoth()
                  }
                }
              }
              clear(ctx, W, H, theme.surface)
              const pulse = 0.5 + 0.5 * Math.sin(f.t * 6)
              ;(['binary', 'linear'] as const).forEach((kind, k) => {
                const top = top0 + k * (sectionH + 16)
                const isBin = kind === 'binary'
                rrect(ctx, 10, top, W - 20, sectionH, 10, alpha(theme.sunken, 0.7), theme.border)
                text(ctx, isBin ? 'Binary search' : 'Linear search', 24, top + 24, { color: theme.text, size: 16, weight: 700, mono: false })
                const done = isBin ? cur.bDone : cur.lDone
                const found = isBin ? cur.bResult >= 0 : cur.lResult >= 0
                text(ctx, isBin ? bText : lText, W - 24, top + 24, { color: done ? (found ? theme.ok : theme.danger) : theme.muted, size: 13, align: 'right' })
                for (let i = 0; i < n; i++) {
                  const x = cellX(i)
                  const y = cellY(i, top)
                  let fill = theme.surface
                  let ink = theme.text
                  let dim = false
                  if (isBin) {
                    const b = cur.b
                    if (b && !(cur.bDone && cur.bResult < 0)) {
                      const lo = b.cmp < 0 ? b.mid + 1 : b.lo
                      const hi = b.cmp > 0 ? b.mid - 1 : b.hi
                      if ((i < lo || i > hi) && i !== b.mid) dim = true
                      if (i === b.mid) {
                        fill = b.cmp === 0 ? theme.ok : theme.accent
                        ink = '#fff'
                        dim = false
                      }
                    } else if (cur.bDone) dim = true
                  } else if (cur.l) {
                    if (i < cur.l.i) dim = true
                    if (i === cur.l.i) {
                      fill = cur.l.match ? theme.ok : theme.accent
                      ink = '#fff'
                    }
                  } else if (cur.lDone) dim = true
                  rrect(ctx, x + 1.5, y, cw - 3, CELL_H, 5, dim ? alpha(theme.text, 0.05) : fill, dim ? alpha(theme.border, 0.5) : theme.border)
                  text(ctx, String(data[i]), x + cw / 2, y + CELL_H / 2 + 1, { color: dim ? alpha(theme.muted, 0.55) : ink, size: 12, align: 'center', baseline: 'middle', weight: 600 })
                }
                if (isBin && cur.b) {
                  // Probed positions get a dot; the live range [lo, hi] gets a bracket underneath.
                  for (const p of cur.probes) circle(ctx, cellX(p) + cw / 2, cellY(p, top) - 5, 2.5, alpha(theme.accent, 0.8))
                  const b = cur.b
                  const lo = b.cmp < 0 ? b.mid + 1 : b.lo
                  const hi = b.cmp > 0 ? b.mid - 1 : b.hi
                  if (lo <= hi && !cur.bDone) {
                    for (let ln = Math.floor(lo / per); ln <= Math.floor(hi / per); ln++) {
                      const a = Math.max(lo, ln * per)
                      const z = Math.min(hi, ln * per + per - 1)
                      const y = cellY(a, top) + CELL_H + 7
                      line(ctx, cellX(a) + 2, y, cellX(z) + cw - 2, y, alpha(theme.accent, 0.5 + 0.3 * pulse), 3)
                    }
                    const ly = (i: number) => cellY(i, top) + CELL_H + 22
                    if (lo === hi) text(ctx, 'low = high', cellX(lo) + cw / 2, ly(lo), { color: theme.accent, size: 12, align: 'center', weight: 700 })
                    else {
                      text(ctx, 'low', cellX(lo) + 2, ly(lo), { color: theme.accent, size: 12, weight: 700 })
                      text(ctx, 'high', cellX(hi) + cw - 2, ly(hi), { color: theme.accent, size: 12, align: 'right', weight: 700 })
                    }
                  }
                }
                if (!isBin && cur.l && !cur.lDone) {
                  const x = cellX(cur.l.i) + cw / 2
                  const y = cellY(cur.l.i, top) + CELL_H + 20
                  text(ctx, 'i', x, y, { color: theme.accent, size: 13, align: 'center', weight: 700 })
                }
              })
            }}
          />
          <Readout
            items={[
              ['Binary comparisons', s.bCount],
              ['Linear comparisons', s.lCount],
              ['Binary worst case', `⌈log₂(${n}+1)⌉ = ${worstCase(n)}`],
              ['Linear worst case', n],
            ]}
          />
        </>
      }
      below={<GuessGame />}
    >
      <PlayBar running={running} setRunning={play} onStep={stepBoth} onReset={() => restart()} resetLabel="Restart" />
      <Slider
        label="Array size n"
        value={n}
        min={8}
        max={128}
        onChange={(v) => {
          const a = sortedData(v)
          const t = a[Math.floor(Math.random() * v)]
          setN(v)
          setData(a)
          setTarget(t)
          setDraft(String(t))
          restart(a, t)
        }}
      />
      <div className="sim-field">
        <label className="sim-label" htmlFor={id}>
          Target <span className="sim-val">{data.includes(target) ? 'in the array' : 'not in the array'}</span>
        </label>
        <input
          id={id}
          type="number"
          className="sim-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim() !== '' && Number.isFinite(Number(draft))) searchFor(Math.round(Number(draft)))
          }}
        />
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn primary" disabled={draft.trim() === '' || !Number.isFinite(Number(draft))} onClick={() => searchFor(Math.round(Number(draft)))}>
          Search
        </button>
        <button type="button" className="btn" onClick={() => searchFor(randomTarget(data))}>
          Random target
        </button>
      </div>
      <Slider label="Speed" value={speed} min={0.5} max={12} step={0.5} unit=" steps/s" onChange={setSpeed} />
      <Hint>Both searches make one comparison per step. Binary search looks at the middle of what is left and throws away half each time; greyed cells are ruled out. Double n and it needs just one more step.</Hint>
    </SimLayout>
  )
}

/** Guess a number from 1 to 100 and compare yourself with the halving strategy. */
function GuessGame() {
  const id = useId()
  const [secret, setSecret] = useState(() => 1 + Math.floor(Math.random() * 100))
  const [guesses, setGuesses] = useState<number[]>([])
  const [draft, setDraft] = useState('')
  const won = guesses[guesses.length - 1] === secret
  const halving = halvingGuesses(secret)

  function guess() {
    const g = Math.round(Number(draft))
    if (!draft.trim() || !Number.isFinite(g) || g < 1 || g > 100 || won) return
    setGuesses([...guesses, g])
    setDraft('')
  }

  return (
    <div className="sim-about">
      <p style={{ margin: '0 0 8px' }}>
        <b>Guess my number.</b> I am thinking of a whole number from 1 to 100. Halving the range each time always finds it in at most {worstCase(100)} guesses. Can you match that?
      </p>
      <div className="row sim-bar" style={{ margin: '0 0 8px' }}>
        <label htmlFor={id} className="sim-label" style={{ margin: 0 }}>
          Your guess
        </label>
        <input id={id} type="number" min={1} max={100} value={draft} disabled={won} style={{ width: 110 }} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && guess()} />
        <button type="button" className="btn primary" disabled={won} onClick={guess}>
          Guess
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setSecret(1 + Math.floor(Math.random() * 100))
            setGuesses([])
          }}
        >
          New number
        </button>
      </div>
      {guesses.length > 0 && (
        <div className="sim-cells" aria-live="polite">
          {guesses.map((g, i) => (
            <span key={i} className={g === secret ? 'on' : ''}>
              {g} {g === secret ? '✓' : g < secret ? '↑ higher' : '↓ lower'}
            </span>
          ))}
        </div>
      )}
      {won && (
        <p style={{ margin: '8px 0 0' }}>
          Got it in {guesses.length} {guesses.length === 1 ? 'guess' : 'guesses'}. The halving strategy needed {halving.length}: {halving.join(' → ')}.
        </p>
      )}
    </div>
  )
}
