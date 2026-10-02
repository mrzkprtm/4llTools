import { useEffect, useMemo, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { tone } from '../../sim/audio'
import { Choice, Hint, Slider } from '../../sim/controls'
import { additionSteps, beadsToValue, valueToBeads, type Rod } from './logic'
import Soroban, { changedBeads } from './Soroban'
import './tool.css'

const LESSONS: [number, number][] = [[3, 4], [2, 3], [7, 5], [6, 8], [26, 38], [45, 67], [123, 989]]
const RULE_NAMES = { direct: 'Direct', five: '5-complement', ten: '10-complement' }

export default function Abacus() {
  const [size, setSize] = useState(9)
  const [rods, setRods] = useState<Rod[]>(() => valueToBeads(2026, 9))
  const [stagger, setStagger] = useState(false)
  const [mode, setMode] = useState<'free' | 'lesson'>('free')
  const [input, setInput] = useState('1234')
  const [lesson, setLesson] = useState<[number, number]>([3, 4])
  const [step, setStep] = useState(-1)
  const [custom, setCustom] = useState(['58', '67'])
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const value = beadsToValue(rods)
  const max = 10 ** size - 1

  const setValue = (v: number, n = size) => {
    setStagger(!reducedMotion())
    setRods(valueToBeads(v, n))
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStagger(false), 900)
  }
  const resize = (n: number) => {
    setSize(n)
    setRods(valueToBeads(Math.min(beadsToValue(rods), 10 ** n - 1), n))
  }

  const steps = useMemo(() => additionSteps(lesson[0], lesson[1]), [lesson])
  const cur = step >= 0 ? steps[step] : null
  const highlight = useMemo(() => (cur ? changedBeads(valueToBeads(cur.before, size), valueToBeads(cur.after, size)) : undefined), [cur, size])
  const finished = mode === 'lesson' && step >= steps.length

  const startLesson = (a: number, b: number) => {
    if (a + b > max) return
    setLesson([a, b])
    setStep(0)
    setValue(a)
  }
  const doStep = () => {
    if (!cur) return
    setValue(cur.after)
    tone(880, 90)
    setStep(step + 1)
  }
  // Moving the beads yourself to the right place also completes the step.
  const onBeads = (r: Rod[]) => {
    setRods(r)
    if (mode === 'lesson' && cur && beadsToValue(r) === cur.after) {
      tone(988, 110)
      setStep(step + 1)
    }
  }

  return (
    <div className="ab">
      <div className="ab-top">
        <div className="ab-value" aria-live="polite">
          <Roll>{value.toLocaleString('en-US')}</Roll>
        </div>
        <Choice value={mode} onChange={(m) => { setMode(m); setStep(-1) }} options={[['free', 'Free play'], ['lesson', 'Addition lessons']]} />
      </div>
      <div className="ab-wrap">
        <Soroban rods={rods} onChange={onBeads} highlight={highlight} stagger={stagger} />
      </div>
      {mode === 'free' ? (
        <div className="ab-controls">
          <form className="row" onSubmit={(e) => { e.preventDefault(); setValue(Number(input) || 0) }}>
            <input className="ab-input" value={input} inputMode="numeric" onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, size))} aria-label="Number to show" />
            <button type="submit" className="btn primary">Show number</button>
            <button type="button" className="btn" onClick={() => setValue(0)}>Clear</button>
          </form>
          <Slider label="Rods" value={size} min={9} max={13} onChange={resize} />
        </div>
      ) : (
        <div className="ab-lesson">
          <div className="row ab-presets">
            {LESSONS.map(([a, b]) => (
              <button key={`${a}+${b}`} type="button" className={`btn ${lesson[0] === a && lesson[1] === b && step >= 0 ? 'primary' : ''}`} onClick={() => startLesson(a, b)}>
                {a} + {b}
              </button>
            ))}
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); startLesson(Number(custom[0]) || 0, Number(custom[1]) || 0) }}>
            <input className="ab-input sm" value={custom[0]} inputMode="numeric" aria-label="First number" onChange={(e) => setCustom([e.target.value.replace(/\D/g, '').slice(0, 6), custom[1]])} />
            <b>+</b>
            <input className="ab-input sm" value={custom[1]} inputMode="numeric" aria-label="Second number" onChange={(e) => setCustom([custom[0], e.target.value.replace(/\D/g, '').slice(0, 6)])} />
            <button type="submit" className="btn">Start</button>
          </form>
          {step < 0 ? (
            <p className="muted">Pick a sum. The first number is set on the beads, then each digit of the second is added from left to right.</p>
          ) : finished ? (
            <div className="ab-card ok-card pop">
              <b>{lesson[0]} + {lesson[1]} = {lesson[0] + lesson[1]}</b>
              <p>Done! Read the answer from the beads touching the beam.</p>
              <button type="button" className="btn" onClick={() => startLesson(lesson[0], lesson[1])}>Try it again</button>
            </div>
          ) : cur ? (
            <div className="ab-card" key={step}>
              <div className="ab-card-top">
                <span>Step {step + 1} of {steps.length}</span>
                <span className={`chip ab-rule-${cur.rule}`}>{RULE_NAMES[cur.rule]}</span>
              </div>
              <p>{cur.text}</p>
              <p className="muted">Move the glowing beads yourself, or let the abacus do it.</p>
              <button type="button" className="btn primary" onClick={doStep}>Show me</button>
            </div>
          ) : (
            <p className="muted">Nothing to add: the second number is 0.</p>
          )}
        </div>
      )}
      <Hint>Tap a bead, or flick it toward the beam to count it and away to clear it. Heaven beads (top) are worth 5 and earth beads 1; the dots on the beam mark the ones rod and every third rod after it.</Hint>
    </div>
  )
}
