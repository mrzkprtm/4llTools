import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Roll from '../../motion/Roll'
import { Choice, Hint } from '../../sim/controls'
import BellChart from './BellChart'
import { fasterThan, randomDelay, stats, verdict, type Mode } from './reaction'
import './tool.css'

const STORE = '4lltools:reaction-time'
const ROUND = 5
type Phase = 'idle' | 'wait' | 'go' | 'early' | 'result' | 'wrong'

export default function ReactionTime() {
  const [mode, setMode] = useState<Mode>('simple')
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<number[]>([])
  const [last, setLast] = useState(0)
  const [target, setTarget] = useState<0 | 1>(0)
  const [records, setRecords] = useState<Record<Mode, number>>({ simple: 0, choice: 0 })
  const t0 = useRef(0)
  const timer = useRef(0)
  const st = useRef({ phase, results, mode, target })
  st.current = { phase, results, mode, target }

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s && typeof s === 'object') setRecords({ simple: Number(s.simple) || 0, choice: Number(s.choice) || 0 })
    } catch {
      // No records yet.
    }
    return () => clearTimeout(timer.current)
  }, [])

  function arm() {
    clearTimeout(timer.current)
    setPhase('wait')
    timer.current = window.setTimeout(() => {
      setTarget(Math.random() < 0.5 ? 0 : 1)
      setPhase('go')
      // Start timing on the frame that shows the signal.
      requestAnimationFrame(() => { t0.current = performance.now() })
    }, randomDelay())
  }

  function press(side: 0 | 1 | null) {
    const { phase: ph, results: rs, mode: md, target: tg } = st.current
    if (ph === 'wait') {
      clearTimeout(timer.current)
      setPhase('early')
      return
    }
    if (ph === 'go') {
      const rt = performance.now() - t0.current
      if (md === 'choice' && side !== tg) {
        setPhase('wrong')
        return
      }
      const next = [...rs, rt]
      setLast(rt)
      setResults(next)
      setPhase('result')
      if (next.length === ROUND) {
        const avg = stats(next).mean
        setRecords((r) => {
          if (r[md] && r[md] <= avg) return r
          const nr = { ...r, [md]: avg }
          try {
            localStorage.setItem(STORE, JSON.stringify(nr))
          } catch {
            // Not saved.
          }
          return nr
        })
      }
      return
    }
    if (rs.length >= ROUND) setResults([])
    arm()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return
      if (e.repeat) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(null) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); press(0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); press(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button > 0) return
    const r = e.currentTarget.getBoundingClientRect()
    press(e.clientX - r.left < r.width / 2 ? 0 : 1)
  }

  const s = stats(results)
  const done = results.length >= ROUND
  const ms = (v: number) => String(Math.round(v))
  const choice = mode === 'choice'
  let title = ''
  let sub = ''
  if (phase === 'idle') { title = 'Tap to start'; sub = choice ? 'When one side lights up, tap that side (or press ← / →).' : 'Wait for green, then tap as fast as you can.' }
  else if (phase === 'wait') { title = 'Wait…'; sub = choice ? 'Watch both sides' : 'Wait for green' }
  else if (phase === 'go') { title = choice ? '' : 'Tap!'; sub = '' }
  else if (phase === 'early') { title = 'Too soon!'; sub = 'Tap to try that one again.' }
  else if (phase === 'wrong') { title = 'Wrong side'; sub = 'Tap to try that one again.' }
  else { title = `${ms(last)} ms`; sub = done ? 'Round complete. Tap to start a new round.' : `Tap for attempt ${results.length + 1} of ${ROUND}` }

  return (
    <div className="rt">
      <Choice value={mode} options={[['simple', 'Simple (wait for green)'], ['choice', 'Visual choice (left / right)']]} onChange={(m) => { clearTimeout(timer.current); setMode(m); setResults([]); setPhase('idle') }} />
      <div className={`rt-panel ${phase} ${choice ? 'choice' : ''}`} onPointerDown={onDown} role="button" tabIndex={0} aria-label={`${title}. ${sub}`}>
        {choice && phase === 'go' && <div className={`rt-light ${target ? 'r' : 'l'}`} />}
        <div className="rt-text" key={phase + results.length}>
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        <div className="rt-dots">{Array.from({ length: ROUND }, (_, i) => <i key={i} className={i < results.length ? 'on' : ''} />)}</div>
      </div>

      <div className="stats">
        <div className="stat"><b><Roll>{s.count ? ms(s.mean) : '0'}</Roll> ms</b>Average</div>
        <div className="stat"><b><Roll>{s.count ? ms(s.best) : '0'}</Roll> ms</b>Best</div>
        <div className="stat"><b><Roll>{s.count ? fasterThan(s.mean, mode).toFixed(0) : '0'}</Roll>%</b>Faster than (approx.)</div>
        <div className="stat"><b><Roll>{records[mode] ? ms(records[mode]) : '0'}</Roll> ms</b>Your best round</div>
      </div>
      {done && <p className="rt-verdict">{verdict(s.mean, mode)}: your average of {ms(s.mean)} ms beats about {fasterThan(s.mean, mode).toFixed(0)}% of people.</p>}

      <ol className="rt-list">
        {results.map((r, i) => (
          <li key={i} className={r === s.best ? 'best' : ''}>
            <span>#{i + 1}</span>
            <i style={{ width: `${Math.min(100, (r / 600) * 100)}%` }} />
            <b>{ms(r)} ms</b>
          </li>
        ))}
      </ol>

      <BellChart results={results} mode={mode} />
      <Hint>Tap the panel (or press Space) to start. Don't guess: tapping before the signal counts as too soon. Five attempts make a round; the typical curve is an approximate reference for adults on screens.</Hint>
    </div>
  )
}
