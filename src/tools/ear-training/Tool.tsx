import { useEffect, useRef, useState } from 'react'
import { Choice, Hint } from '../../sim/controls'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import Roll from '../../motion/Roll'
import { lazySynth } from '../piano-keyboard/synth'
import { accuracy, ITEMS, LEVELS, makeQuestion, record, type Direction, type Mode, type Question, type Stats } from './logic'
import './tool.css'

type Phase = 'idle' | 'asking' | 'right' | 'wrong'
const DIRS: [Direction, string][] = [['up', 'Up'], ['down', 'Down'], ['harmonic', 'Together'], ['mixed', 'Mixed']]
const DIR_LABEL = { up: 'ascending', down: 'descending', harmonic: 'played together' }

/** The same question re-voiced as another answer, from the same lowest note. */
function voiced(q: Question, it: Question['item']): Question {
  const root = Math.min(...q.notes)
  const notes = it.steps.map((s) => root + s)
  return { ...q, item: it, notes: q.direction === 'down' ? notes.reverse() : notes }
}

export default function EarTraining() {
  const [mode, setMode] = useState<Mode>('interval')
  const [dir, setDir] = useState<Direction>('up')
  const [ids, setIds] = useState<string[]>(LEVELS.interval[1].ids)
  const [q, setQ] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({})
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [playing, setPlaying] = useState(false)
  const synth = useRef(lazySynth())
  const timer = useRef(0)

  useEffect(() => {
    const s = synth.current
    return () => {
      clearTimeout(timer.current)
      s.close()
    }
  }, [])

  function play(question: Question) {
    const s = synth.current.get()
    if (!s) return
    const t = s.ctx.currentTime + 0.05
    const gap = mode === 'scale' ? 0.3 : 0.6
    question.notes.forEach((m, i) => s.play(m, question.harmonic ? t : t + i * gap, question.harmonic ? 1.6 : gap * 1.3, 0.75))
    const dur = question.harmonic ? 1.4 : question.notes.length * gap + 0.4
    setPlaying(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPlaying(false), dur * 1000)
  }

  function next(m = mode, pool = ids, d = dir) {
    const question = makeQuestion(m, pool, d, Math.random, q?.item.id)
    setQ(question)
    setPicked(null)
    setPhase('asking')
    play(question)
  }

  function answer(id: string) {
    if (!q || phase !== 'asking') return
    const ok = id === q.item.id
    setPicked(id)
    setPhase(ok ? 'right' : 'wrong')
    setStats((s) => record(s, q.item.id, ok))
    if (ok) {
      const n = streak + 1
      setStreak(n)
      setBest((b) => Math.max(b, n))
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => next(), 1100)
    } else setStreak(0)
  }

  function changeMode(m: Mode) {
    setMode(m)
    const pool = LEVELS[m][1].ids
    setIds(pool)
    setQ(null)
    setPhase('idle')
  }

  function toggleId(id: string) {
    setIds((cur) => (cur.includes(id) ? (cur.length > 2 ? cur.filter((x) => x !== id) : cur) : [...cur, id]))
  }

  const items = ITEMS[mode]
  const pool = items.filter((i) => ids.includes(i.id))
  const acc = accuracy(stats)
  const total = Object.values(stats).reduce((a, s) => a + s.total, 0)

  return (
    <div className="et">
      <div className="two-col">
        <Choice label="Practice" value={mode} options={[['interval', 'Intervals'], ['chord', 'Chords'], ['scale', 'Scales']]} onChange={changeMode} />
        {mode === 'interval' && <Choice label="Direction" value={dir} options={DIRS} onChange={setDir} />}
      </div>

      <div className="et-stage">
        <div className="et-score">
          <div><b><Roll>{String(streak)}</Roll></b><span>streak</span></div>
          <div><b><Roll>{String(best)}</Roll></b><span>best</span></div>
          <div><b><Roll>{`${Math.round(acc * 100)}%`}</Roll></b><span>{total} answered</span></div>
        </div>
        <button type="button" className={`et-play ${playing ? 'on' : ''}`} onClick={() => (q && phase === 'asking' ? play(q) : next())} aria-label={q && phase === 'asking' ? 'Replay' : 'New question'}>
          <Icon key={q && phase === 'asking' ? 'r' : 'p'} name={q && phase === 'asking' ? 'reload' : 'play-circle'} size={30} />
          <span>{!q || phase === 'idle' ? 'Start' : phase === 'asking' ? 'Replay' : 'Next'}</span>
        </button>
        <p className="et-prompt" aria-live="polite">
          {!q && 'Press Start and listen.'}
          {q && phase === 'asking' && `What ${mode === 'interval' ? `interval (${DIR_LABEL[q.direction]})` : mode === 'chord' ? 'chord' : 'scale'} is this?`}
          {q && phase === 'right' && <span className="ok et-verdict"><Check /> {q.item.name}!</span>}
          {q && phase === 'wrong' && <span className="et-verdict">It was <b>{q.item.name}</b>. Replay to compare.</span>}
        </p>
      </div>

      <div className="et-answers" role="group" aria-label="Answers">
        {pool.map((it) => {
          const state = phase === 'asking' || !q ? '' : it.id === q.item.id ? 'right' : it.id === picked ? 'wrong' : 'dim'
          return (
            <button key={it.id} type="button" className={`btn et-ans ${state}`} disabled={!q || phase === 'idle'} onClick={() => (phase === 'asking' ? answer(it.id) : q && play(voiced(q, it)))}>
              <b>{it.short}</b>
              {mode === 'interval' && <small>{it.name}</small>}
            </button>
          )
        })}
      </div>
      {phase === 'wrong' && <p className="muted et-tip">Tap any answer to hear it, then press Next.</p>}

      <section className="et-chart">
        <div className="et-chart-head">
          <h3>Session progress</h3>
          <div className="row et-levels">
            {LEVELS[mode].map((l) => (
              <button key={l.name} type="button" className="btn" onClick={() => setIds(l.ids)}>{l.name}</button>
            ))}
          </div>
        </div>
        <div className="et-bars">
          {items.map((it) => {
            const s = stats[it.id]
            const a = s ? s.right / s.total : 0
            const on = ids.includes(it.id)
            return (
              <button key={it.id} type="button" className={`et-bar ${on ? 'on' : ''}`} onClick={() => toggleId(it.id)} aria-pressed={on} aria-label={`${it.name}: ${s ? `${s.right} of ${s.total} right` : 'no answers yet'}. ${on ? 'Included' : 'Not included'} in the quiz.`}>
                <span className="et-bar-track">
                  <i style={{ transform: `scaleY(${s ? Math.max(0.04, a) : 0})`, background: a >= 0.75 ? 'var(--ok)' : a >= 0.5 ? '#f59f00' : 'var(--danger)' }} />
                </span>
                <small>{s ? `${s.right}/${s.total}` : '–'}</small>
                <b>{it.short}</b>
              </button>
            )
          })}
        </div>
        <p className="muted et-tip">Tap a column to add or remove it from the quiz (at least two stay on).</p>
      </section>
      <Hint>Press Start, listen, and pick the answer. Right answers move on by themselves; wrong ones let you hear every option. Start with Easy and add items as your streak grows.</Hint>
    </div>
  )
}
