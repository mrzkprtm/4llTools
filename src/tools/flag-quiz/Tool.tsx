import { useEffect, useMemo, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { tone } from '../../sim/audio'
import { Choice, Hint } from '../../sim/controls'
import { COUNTRIES, REGIONS, type Country, type Region } from './countries'
import { flagEmoji, makeQuestion, makeRound, optionLabel, type Mode, type Question } from './logic'
import './tool.css'

type Phase = 'setup' | 'play' | 'done'
const STREAK_GOAL = 10

function Prompt({ c, mode }: { c: Country; mode: Mode }) {
  if (mode === 'flag') return <span className="fq-flag" role="img" aria-label="Flag of the country to guess">{flagEmoji(c.code)}</span>
  if (mode === 'capital')
    return (
      <span className="fq-name">
        <span className="fq-small-flag">{flagEmoji(c.code)}</span> {c.name}
        <small>What is the capital?</small>
      </span>
    )
  return (
    <span className="fq-name">
      {c.capital}
      <small>is the capital of which country?</small>
    </span>
  )
}

export default function FlagQuiz() {
  const [mode, setMode] = useState<Mode>('flag')
  const [regions, setRegions] = useState<Region[]>([])
  const [length, setLength] = useState(10)
  const [phase, setPhase] = useState<Phase>('setup')
  const [round, setRound] = useState<Country[]>([])
  const [idx, setIdx] = useState(0)
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [missed, setMissed] = useState<Country[]>([])
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const pool = useMemo(() => (regions.length ? COUNTRIES.filter((c) => regions.includes(c.region)) : COUNTRIES), [regions])

  const ask = (list: Country[], i: number) => {
    setIdx(i)
    setPicked(null)
    // Distractors come from the whole dataset so small filters still get 4 choices.
    setQ(makeQuestion(list[i], COUNTRIES, mode))
  }
  const start = (list: Country[]) => {
    if (!list.length) return
    setRound(list)
    setScore(0)
    setStreak(0)
    setBest(0)
    setMissed([])
    setPhase('play')
    ask(list, 0)
  }

  const answer = (c: Country) => {
    if (!q || picked) return
    const ok = c.code === q.answer.code
    setPicked(c.code)
    tone(ok ? 880 : 180, ok ? 100 : 220, ok ? 'sine' : 'triangle')
    if (ok) {
      const s = streak + 1
      setStreak(s)
      setBest((b) => Math.max(b, s))
      setScore((x) => x + 10 + Math.min(10, streak))
    } else {
      setStreak(0)
      setMissed((m) => [...m, q.answer])
    }
    timer.current = window.setTimeout(() => (idx + 1 >= round.length ? setPhase('done') : ask(round, idx + 1)), ok ? 900 : 1900)
  }

  useEffect(() => {
    if (phase !== 'play' || !q) return
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) answer(q.options[n - 1])
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  return (
    <div className="fq">
      {phase === 'setup' && (
        <div className="fq-setup settle-in">
          <Choice label="Mode" value={mode} onChange={setMode} options={[['flag', 'Flag → country'], ['capital', 'Country → capital'], ['reverse', 'Capital → country']]} />
          <p className="fq-label">Regions</p>
          <div className="row fq-regions">
            <button type="button" className={`btn ${regions.length === 0 ? 'primary' : ''}`} onClick={() => setRegions([])}>World</button>
            {REGIONS.map((r) => {
              const on = regions.includes(r)
              return (
                <button key={r} type="button" className={`btn ${on ? 'primary' : ''}`} aria-pressed={on} onClick={() => setRegions(on ? regions.filter((x) => x !== r) : [...regions, r])}>
                  {r}
                </button>
              )
            })}
          </div>
          <Choice label="Questions" value={length} onChange={setLength} options={[[10, '10'], [20, '20'], [0, `All ${pool.length}`]]} />
          <button type="button" className="btn primary fq-go" onClick={() => start(makeRound(pool, length))}>Start quiz</button>
          <div className="fq-preview" aria-hidden="true">
            {pool.slice(0, 24).map((c, i) => <span key={c.code} style={{ animationDelay: `${i * 30}ms` }}>{flagEmoji(c.code)}</span>)}
          </div>
        </div>
      )}

      {phase === 'play' && q && (
        <div className="fq-play">
          <div className="fq-top">
            <span className="muted">{idx + 1} / {round.length}</span>
            <span className="fq-score"><Roll>{score}</Roll> pts</span>
          </div>
          <div className="fq-meter" aria-label={`Streak ${streak}`}>
            <i style={{ transform: `scaleX(${Math.min(1, streak / STREAK_GOAL)})` }} />
            <span>🔥 {streak}</span>
          </div>
          <div className="fq-prompt" key={idx}>
            <Prompt c={q.answer} mode={mode} />
          </div>
          <div className="fq-options">
            {q.options.map((c, i) => {
              const state = picked ? (c.code === q.answer.code ? 'good' : c.code === picked ? 'bad' : 'dim') : ''
              return (
                <button key={`${idx}-${c.code}`} type="button" className={`btn fq-opt ${state}`} style={{ animationDelay: `${i * 50}ms` }} onClick={() => answer(c)} disabled={!!picked && state === 'dim'}>
                  <small>{i + 1}</small>
                  {optionLabel(c, mode)}
                </button>
              )
            })}
          </div>
          {picked && picked !== q.answer.code && (
            <p className="fq-reveal settle-in">
              {flagEmoji(q.answer.code)} {q.answer.name} · capital {q.answer.capital}
            </p>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="fq-done settle-in">
          <div className="stats">
            <div className="stat"><b><Roll>{score}</Roll></b>points</div>
            <div className="stat"><b>{round.length - missed.length}/{round.length}</b>correct</div>
            <div className="stat"><b>{best}</b>best streak</div>
          </div>
          {missed.length ? (
            <>
              <p className="fq-label">To review</p>
              <ul className="fq-missed">
                {missed.map((c, i) => (
                  <li key={c.code} style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="fq-mflag">{flagEmoji(c.code)}</span>
                    <b>{c.name}</b>
                    <span className="muted">{c.capital}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="ok fq-perfect pop">A perfect round!</p>
          )}
          <div className="row">
            {missed.length > 0 && <button type="button" className="btn primary" onClick={() => start(makeRound(missed, 0))}>Retry missed ({missed.length})</button>}
            <button type="button" className="btn" onClick={() => start(makeRound(pool, length))}>Play again</button>
            <button type="button" className="btn" onClick={() => setPhase('setup')}>Change settings</button>
          </div>
        </div>
      )}
      <Hint>Pick a mode and regions, then choose one of four answers (keys 1–4 work too). Wrong choices come from the same region, and every miss is listed at the end for review.</Hint>
    </div>
  )
}
