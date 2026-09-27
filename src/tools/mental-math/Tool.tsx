import { useCallback, useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { tone } from '../../sim/audio'
import { Choice, Hint } from '../../sim/controls'
import { NumPad, useNumberKeys } from '../multiplication-practice/parts'
import { bestKey, nextQuestion, points, summarize, type Attempt, type Level, type OpChoice, type Question } from './logic'
import './tool.css'

type Mode = 'sprint' | 'twenty'
type Phase = 'setup' | 'play' | 'done'
const KEY = '4lltools:mental-math'
const SPRINT_MS = 60_000
const COUNT = 20

function loadBests(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}').bests ?? {}
  } catch {
    return {}
  }
}

function Ring({ frac, label }: { frac: number; label: string }) {
  const R = 52
  const C = 2 * Math.PI * R
  return (
    <svg className="mm-ring" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx={60} cy={60} r={R} className="mm-ring-bg" />
      <circle cx={60} cy={60} r={R} className={`mm-ring-fg ${frac < 0.2 ? 'low' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, frac)))} />
      <text x={60} y={66} className="mm-ring-text">{label}</text>
    </svg>
  )
}

function Histogram({ attempts }: { attempts: Attempt[] }) {
  const max = Math.max(3000, ...attempts.map((a) => a.ms))
  const W = Math.max(200, attempts.length * 16)
  return (
    <svg className="mm-hist" viewBox={`0 0 ${W} 120`} preserveAspectRatio="none" role="img" aria-label="Seconds per question">
      {attempts.map((a, i) => {
        const h = (a.ms / max) * 100
        return <rect key={i} x={i * (W / attempts.length) + 2} y={110 - h} width={W / attempts.length - 4} height={h} rx={2} className={a.correct ? 'ok' : 'bad'} style={{ animationDelay: `${i * 30}ms` }}><title>{`${a.q.a} ${a.q.op} ${a.q.b}: ${(a.ms / 1000).toFixed(1)} s`}</title></rect>
      })}
      <line x1={0} x2={W} y1={110} y2={110} className="mm-axis" />
    </svg>
  )
}

export default function MentalMath() {
  const [op, setOp] = useState<OpChoice>('+')
  const [level, setLevel] = useState<Level>(1)
  const [mode, setMode] = useState<Mode>('sprint')
  const [phase, setPhase] = useState<Phase>('setup')
  const [q, setQ] = useState<Question | null>(null)
  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null)
  const [now, setNow] = useState(0)
  const [bests, setBests] = useState<Record<string, number>>({})
  const [newBest, setNewBest] = useState(false)
  const startAt = useRef(0)
  const askedAt = useRef(0)

  useEffect(() => setBests(loadBests()), [])

  const summary = summarize(attempts, level)
  const streak = attempts.length - 1 - attempts.map((a) => a.correct).lastIndexOf(false)
  const elapsed = now - startAt.current
  const key = bestKey(op, level, mode)

  const finish = useCallback((list: Attempt[]) => {
    setPhase('done')
    const s = summarize(list, level)
    const prev = loadBests()[key] ?? 0
    setNewBest(s.score > prev)
    if (s.score > prev) {
      const next = { ...loadBests(), [key]: s.score }
      setBests(next)
      try {
        localStorage.setItem(KEY, JSON.stringify({ bests: next }))
      } catch {
        // Storage blocked: the best only lasts this visit.
      }
      tone(1046, 200)
    }
  }, [key, level])

  const start = () => {
    setAttempts([])
    setTyped('')
    setFlash(null)
    setQ(nextQuestion(op, level, null))
    startAt.current = performance.now()
    askedAt.current = startAt.current
    setNow(startAt.current)
    setPhase('play')
  }

  // Clock for the sprint ring and the per-question timer.
  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [phase])
  useEffect(() => {
    if (phase === 'play' && mode === 'sprint' && elapsed >= SPRINT_MS) finish(attempts)
  }, [elapsed, phase, mode, attempts, finish])

  const submit = useCallback(
    (value: string) => {
      if (!q || value === '') return
      const t = performance.now()
      const correct = Number(value) === q.answer
      const list = [...attempts, { q, given: Number(value), correct, ms: t - askedAt.current }]
      setAttempts(list)
      setFlash(correct ? 'ok' : 'bad')
      tone(correct ? 760 + Math.min(10, streak) * 30 : 190, correct ? 70 : 180, correct ? 'sine' : 'triangle')
      setTyped('')
      if (mode === 'twenty' && list.length >= COUNT) return finish(list)
      setQ(nextQuestion(op, level, q))
      askedAt.current = t
    },
    [q, attempts, mode, op, level, finish, streak],
  )

  const onKey = useCallback(
    (k: string) => {
      if (k === 'ok') return submit(typed)
      if (k === 'back') return setTyped((x) => x.slice(0, -1))
      const next = (typed + k).replace(/^0+(?=\d)/, '').slice(0, 6)
      setTyped(next)
      // A right answer is accepted as soon as it is typed.
      if (q && Number(next) === q.answer && next.length === String(q.answer).length) submit(next)
    },
    [typed, submit, q],
  )
  useNumberKeys(phase === 'play', onKey)

  return (
    <div className="mm">
      {phase === 'setup' && (
        <div className="mm-setup settle-in">
          <Choice label="Operation" value={op} onChange={setOp} options={[['+', '+'], ['-', '−'], ['×', '×'], ['÷', '÷'], ['mix', 'Mix']]} />
          <Choice label="Difficulty" value={level} onChange={setLevel} options={[[1, '1 digit'], [2, '2 digits'], [3, '3 digits']]} />
          <Choice label="Mode" value={mode} onChange={setMode} options={[['sprint', '60-second sprint'], ['twenty', '20 questions']]} />
          <p className="muted">Personal best here: <b>{bests[key] ?? '—'}</b></p>
          <button type="button" className="btn primary mm-go" onClick={start}>Start</button>
        </div>
      )}

      {phase === 'play' && q && (
        <div className={`mm-play ${flash ? `flash-${flash}` : ''}`} onAnimationEnd={(e) => e.target === e.currentTarget && setFlash(null)}>
          <div className="mm-hud">
            <Ring frac={mode === 'sprint' ? 1 - elapsed / SPRINT_MS : 1 - attempts.length / COUNT} label={mode === 'sprint' ? String(Math.max(0, Math.ceil((SPRINT_MS - elapsed) / 1000))) : `${attempts.length}/${COUNT}`} />
            <div className="mm-counters">
              <div><b><Roll>{summary.score}</Roll></b>score</div>
              <div><b><Roll>{Math.max(0, streak)}</Roll></b>streak</div>
              <div><b><Roll>{summary.correct}</Roll></b>right</div>
            </div>
          </div>
          <div className="mm-q" key={attempts.length}>
            <span>{q.a} {q.op === '-' ? '−' : q.op} {q.b} =</span>
            <b>{typed || '?'}</b>
          </div>
          <p className="mm-last muted">
            {attempts.length > 0 && !attempts[attempts.length - 1].correct
              ? `${attempts[attempts.length - 1].q.a} ${attempts[attempts.length - 1].q.op} ${attempts[attempts.length - 1].q.b} = ${attempts[attempts.length - 1].q.answer}`
              : attempts.length > 0 ? `+${points(true, attempts[attempts.length - 1].ms, level, Math.max(0, streak - 1))} points` : 'Type the answer. Right answers go in automatically.'}
          </p>
          <NumPad onKey={onKey} />
          <div className="row mm-center">
            <button type="button" className="btn" onClick={() => finish(attempts)}>Stop</button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="mm-done settle-in">
          {newBest && summary.score > 0 && <p className="mm-best pop">New personal best!</p>}
          <div className="stats">
            <div className="stat"><b><Roll>{summary.score}</Roll></b>score</div>
            <div className="stat"><b>{summary.correct}/{summary.total}</b>correct ({Math.round(summary.accuracy * 100)}%)</div>
            <div className="stat"><b>{(summary.avgMs / 1000).toFixed(1)} s</b>per question</div>
            <div className="stat"><b>{bests[key] ?? summary.score}</b>personal best</div>
          </div>
          {attempts.length > 0 && (
            <>
              <p className="mm-label">Time per question <span className="muted">(green right, red wrong)</span></p>
              <Histogram attempts={attempts} />
              {attempts.some((a) => !a.correct) && (
                <div className="mm-missed">
                  {attempts.filter((a) => !a.correct).map((a, i) => (
                    <span key={i} className="chip bad calm">{a.q.a} {a.q.op} {a.q.b} = {a.q.answer}</span>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="row">
            <button type="button" className="btn primary" onClick={start}>Play again</button>
            <button type="button" className="btn" onClick={() => setPhase('setup')}>Change settings</button>
          </div>
        </div>
      )}
      <Hint>Pick an operation and level, then answer with the number pad or your keyboard. Correct answers submit themselves; press OK or Enter to lock in a wrong one. Your best score for each setting stays in this browser.</Hint>
    </div>
  )
}
