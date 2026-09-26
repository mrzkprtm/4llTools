import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint } from '../../sim/controls'
import { tone } from '../../sim/audio'
import { skipCount } from './logic'
import Quiz from './Quiz'
import './tool.css'

type View = 'dots' | 'table' | 'quiz'

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mp-stepper">
      <span className="mp-label">{label}</span>
      <div className="row">
        <button type="button" className="btn" aria-label={`${label} minus one`} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
        <b>{value}</b>
        <button type="button" className="btn" aria-label={`${label} plus one`} onClick={() => onChange(Math.min(12, value + 1))}>+</button>
      </div>
    </div>
  )
}

function Dots() {
  const [a, setA] = useState(3)
  const [b, setB] = useState(4)
  const [count, setCount] = useState(0)
  const [counting, setCounting] = useState(false)
  const timer = useRef(0)
  const total = a * b
  const cell = 26
  const pad = 16

  useEffect(() => {
    clearInterval(timer.current)
    setCount(0)
    setCounting(false)
  }, [a, b])
  useEffect(() => () => clearInterval(timer.current), [])

  const countUp = () => {
    clearInterval(timer.current)
    if (reducedMotion()) return setCount(total)
    setCounting(true)
    setCount(0)
    let n = 0
    timer.current = window.setInterval(() => {
      n++
      setCount(n)
      if (n % b === 0) tone(440 + (n / b) * 40, 70)
      if (n >= total) {
        clearInterval(timer.current)
        setCounting(false)
      }
    }, Math.max(45, Math.min(260, 3000 / total)))
  }

  const rowsDone = Math.floor(count / b)
  const W = pad * 2 + b * cell + 44
  const H = pad * 2 + a * cell
  return (
    <div className="mp-dots">
      <div className="row mp-steppers">
        <Stepper label="Rows" value={a} onChange={setA} />
        <span className="mp-times">×</span>
        <Stepper label="In each row" value={b} onChange={setB} />
      </div>
      <svg key={`${a}x${b}`} className="mp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${a} rows of ${b} dots`}>
        {Array.from({ length: a }, (_, r) => (
          <g key={r}>
            {r < rowsDone && <rect className="mp-group" x={pad - 11} y={pad + r * cell - 11} width={b * cell - 4} height={22} rx={11} />}
            {Array.from({ length: b }, (_, c) => {
              const i = r * b + c
              return <circle key={c} className={`mp-dot ${i < count ? 'on' : ''}`} cx={pad + c * cell} cy={pad + r * cell} r={9} style={{ animationDelay: `${r * 110 + c * 18}ms` }} />
            })}
            {r < rowsDone && (
              <text className="mp-skip" x={pad + b * cell + 4} y={pad + r * cell + 5}>
                {(r + 1) * b}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="mp-eq">
        <span>{a} × {b} =</span>
        <b className={count === total ? 'mp-done' : ''}><Roll>{count === total ? total : counting ? count : '?'}</Roll></b>
      </div>
      <div className="row mp-center">
        <button type="button" className="btn primary" onClick={countUp} disabled={counting}>
          {count === total ? 'Count again' : 'Count the dots'}
        </button>
      </div>
      {count === total && (
        <p className="mp-skipline settle-in">
          Skip count by {b}: {skipCount(b, a).join(', ')}
          {a !== b && <> · and {b} × {a} is also {total}</>}
        </p>
      )}
    </div>
  )
}

function Table() {
  const [pick, setPick] = useState<[number, number]>([6, 7])
  const [r, c] = pick
  const nums = Array.from({ length: 12 }, (_, i) => i + 1)
  return (
    <div className="mp-table-wrap">
      <p className="mp-eq mp-eq-sm" aria-live="polite">
        <span>{r} × {c} =</span> <b><Roll>{r * c}</Roll></b>
      </p>
      <div className="mp-table" role="grid" aria-label="Times table">
        <span className="mp-h mp-corner">×</span>
        {nums.map((n) => <span key={`h${n}`} className={`mp-h ${n <= c ? 'in' : ''}`}>{n}</span>)}
        {nums.map((i) => (
          <div key={i} role="row" className="mp-trow">
            <span className={`mp-h ${i <= r ? 'in' : ''}`}>{i}</span>
            {nums.map((j) => (
              <button
                key={j}
                type="button"
                className={`mp-cell ${i <= r && j <= c ? 'in' : ''} ${i === r && j === c ? 'hit' : ''} ${i === j ? 'sq' : ''}`}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setPick([i, j])}
                onFocus={() => setPick([i, j])}
                onClick={() => setPick([i, j])}
                aria-label={`${i} times ${j} is ${i * j}`}
                style={{ transitionDelay: `${(i + j) * 8}ms` }}
              >
                {i * j}
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="muted mp-note">The shaded rectangle holds {r} × {c} = {r * c} squares. Diagonal cells are square numbers.</p>
    </div>
  )
}

export default function MultiplicationPractice() {
  const [view, setView] = useState<View>('dots')
  return (
    <div className="mp">
      <Choice value={view} onChange={setView} options={[['dots', 'Dots'], ['table', 'Times table'], ['quiz', 'Quiz']]} />
      <div key={view} className="settle-in">
        {view === 'dots' ? <Dots /> : view === 'table' ? <Table /> : <Quiz />}
      </div>
      <Hint>Build a × b from rows of dots and count them in groups, hover or tap the times table to see each product as a rectangle, then test yourself in the quiz. Missed facts come back for review at the end.</Hint>
    </div>
  )
}
