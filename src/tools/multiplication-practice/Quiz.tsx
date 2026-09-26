import { useCallback, useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { tone } from '../../sim/audio'
import { EMPTY_SCORE, MILESTONE, factKey, makeQuiz, quizFrom, scoreAnswer, type Fact, type Score } from './logic'
import { Confetti, NumPad, useNumberKeys } from './parts'

type Phase = 'setup' | 'play' | 'done'
type Feedback = null | { ok: boolean }

export default function Quiz() {
  const [tables, setTables] = useState<number[]>([2, 3, 4, 5, 6, 7, 8, 9])
  const [length, setLength] = useState(10)
  const [phase, setPhase] = useState<Phase>('setup')
  const [facts, setFacts] = useState<Fact[]>([])
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState('')
  const [score, setScore] = useState<Score>(EMPTY_SCORE)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [missed, setMissed] = useState<Fact[]>([])
  const [burst, setBurst] = useState(0)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const start = (list: Fact[]) => {
    if (!list.length) return
    setFacts(list)
    setIdx(0)
    setTyped('')
    setScore(EMPTY_SCORE)
    setMissed([])
    setFeedback(null)
    setPhase('play')
  }

  const fact = facts[idx]
  const submit = useCallback(() => {
    if (!fact || feedback || !typed) return
    const ok = Number(typed) === fact.a * fact.b
    const next = scoreAnswer(score, ok)
    setScore(next)
    setFeedback({ ok })
    tone(ok ? 880 : 196, ok ? 90 : 180, ok ? 'sine' : 'triangle')
    if (!ok) setMissed((m) => (m.some((f) => factKey(f) === factKey(fact)) ? m : [...m, fact]))
    if (next.milestone) setBurst((b) => b + 1)
    timer.current = window.setTimeout(
      () => {
        setFeedback(null)
        setTyped('')
        if (idx + 1 >= facts.length) setPhase('done')
        else setIdx(idx + 1)
      },
      ok ? 650 : 1500,
    )
  }, [fact, feedback, typed, score, idx, facts.length])

  const onKey = useCallback(
    (k: string) => {
      if (feedback) return
      if (k === 'ok') submit()
      else if (k === 'back') setTyped((t) => t.slice(0, -1))
      else setTyped((t) => (t.length >= 3 ? t : (t + k).replace(/^0+(?=\d)/, '')))
    },
    [feedback, submit],
  )
  useNumberKeys(phase === 'play', onKey)

  if (phase === 'setup')
    return (
      <div className="mp-quiz settle-in">
        <p className="mp-label">Tables to practice</p>
        <div className="mp-tables">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((t) => {
            const on = tables.includes(t)
            return (
              <button key={t} type="button" className={`btn ${on ? 'primary' : ''}`} aria-pressed={on} onClick={() => setTables(on ? tables.filter((x) => x !== t) : [...tables, t])}>
                {t}×
              </button>
            )
          })}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setTables([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])}>All</button>
          <button type="button" className="btn" onClick={() => setTables([])}>None</button>
          <label className="mp-len">
            Questions{' '}
            <select value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[10, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="btn primary mp-go" disabled={!tables.length} onClick={() => start(makeQuiz(tables, length))}>
          Start quiz
        </button>
      </div>
    )

  if (phase === 'done') {
    const total = score.correct + score.wrong
    return (
      <div className="mp-quiz settle-in">
        <div className="stats">
          <div className="stat"><b><Roll>{score.score}</Roll></b>points</div>
          <div className="stat"><b>{score.correct}/{total}</b>correct</div>
          <div className="stat"><b>{score.best}</b>best streak</div>
        </div>
        {missed.length ? (
          <>
            <p className="mp-label">Facts to review</p>
            <div className="mp-missed">
              {missed.map((f, i) => (
                <span key={factKey(f)} className="chip bad calm" style={{ animationDelay: `${i * 60}ms` }}>
                  {f.a} × {f.b} = {f.a * f.b}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="ok mp-perfect pop">Perfect round. Every answer was right!</p>
        )}
        <div className="row">
          {missed.length > 0 && (
            <button type="button" className="btn primary" onClick={() => start(quizFrom(missed, missed.length * 2))}>
              Practice missed ({missed.length * 2})
            </button>
          )}
          <button type="button" className="btn" onClick={() => setPhase('setup')}>New quiz</button>
        </div>
      </div>
    )
  }

  const meter = score.streak % MILESTONE === 0 && score.streak > 0 ? MILESTONE : score.streak % MILESTONE
  return (
    <div className="mp-quiz mp-play">
      <Confetti burst={burst} />
      <div className="mp-top">
        <span className="muted">Question {idx + 1} of {facts.length}</span>
        <span className="mp-score"><Roll>{score.score}</Roll> pts</span>
      </div>
      <div className="mp-meter" aria-label={`Streak ${score.streak}`}>
        {Array.from({ length: MILESTONE }, (_, i) => <i key={i} className={i < meter ? 'on' : ''} />)}
        <span>🔥 {score.streak}</span>
      </div>
      <div key={idx} className={`mp-card ${feedback ? (feedback.ok ? 'is-ok' : 'is-bad') : ''}`} aria-live="polite">
        <span>{fact.a} × {fact.b} =</span>
        <b className="mp-answer">{typed || '?'}</b>
        {feedback && !feedback.ok && <small className="mp-correct">It's {fact.a * fact.b}</small>}
      </div>
      <NumPad onKey={onKey} disabled={!!feedback} />
    </div>
  )
}
