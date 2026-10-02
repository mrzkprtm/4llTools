import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint, Slider } from '../../sim/controls'
import { CHECKUPS, dayNum, dueDate, isoOf, progress, sizeFor, SIZES, weekStart, type Basis, type Input } from './pregnancy'
import './tool.css'

const STORE = '4lltools:pregnancy-week'
const nice = (iso: string, long = false) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: long ? 'long' : undefined, day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' })
const LABEL: Record<Basis, string> = { lmp: 'First day of last period (HPHT)', conception: 'Conception date', ivf: 'Embryo transfer date' }
const R = 86
const C = 2 * Math.PI * R

export default function PregnancyWeek() {
  const [today, setToday] = useState('2026-01-01')
  const [input, setInput] = useState<Input>({ basis: 'lmp', date: '2025-10-01', cycle: 28, embryoDays: 5 })
  const [pick, setPick] = useState<number | null>(null)
  const strip = useRef<HTMLOListElement>(null)
  const ready = useRef(false)

  useEffect(() => {
    const d = new Date()
    const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setToday(t)
    let loaded = false
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s && /^\d{4}-\d\d-\d\d$/.test(s.date) && ['lmp', 'conception', 'ivf'].includes(s.basis)) {
        setInput({ basis: s.basis, date: s.date, cycle: Number(s.cycle) || 28, embryoDays: s.embryoDays === 3 ? 3 : 5 })
        loaded = true
      }
    } catch {
      // Use the example.
    }
    // Example: about 20 weeks along, so the page opens mid-journey.
    if (!loaded) setInput((i) => ({ ...i, date: isoOf(dayNum(t) - 20 * 7 - 3) }))
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(STORE, JSON.stringify(input))
    } catch {
      // Not saved.
    }
  }, [input])

  const due = dueDate(input)
  const p = progress(input, today)
  const valid = p.gaDays >= 0 && p.gaDays <= 44 * 7
  const current = Math.max(4, Math.min(40, p.weeks))
  const week = pick ?? current
  const size = sizeFor(week)
  const scale = 0.25 + 0.75 * (Math.log(size.cm + 0.2) - Math.log(0.3)) / (Math.log(51.4) - Math.log(0.3))

  // Keep the selected week in view in the strip.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-week="${week}"]`)
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.clientWidth / 2 + el.offsetWidth / 2, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [week])

  return (
    <div className="pg">
      <Choice label="Calculate from" value={input.basis} options={[['lmp', 'Last period'], ['conception', 'Conception'], ['ivf', 'IVF transfer']]} onChange={(basis) => setInput({ ...input, basis })} />
      <div className="pg-inputs">
        <label>{LABEL[input.basis]}<input type="date" value={input.date} max={today} onChange={(e) => e.target.value && setInput({ ...input, date: e.target.value })} /></label>
        {input.basis === 'lmp' && <Slider label="Cycle length" value={input.cycle ?? 28} min={21} max={40} unit=" days" onChange={(cycle) => setInput({ ...input, cycle })} />}
        {input.basis === 'ivf' && <Choice label="Embryo age" value={input.embryoDays ?? 5} options={[[3, 'Day 3'], [5, 'Day 5']]} onChange={(embryoDays) => setInput({ ...input, embryoDays })} />}
      </div>

      <div className="pg-hero">
        <div className="pg-ring-wrap">
          <svg viewBox="0 0 200 200" className="pg-ring" aria-hidden="true">
            <circle cx="100" cy="100" r={R} className="pg-track" />
            {[14, 28].map((w) => {
              const a = (w / 40) * Math.PI * 2 - Math.PI / 2
              return <line key={w} x1={100 + Math.cos(a) * (R - 9)} y1={100 + Math.sin(a) * (R - 9)} x2={100 + Math.cos(a) * (R + 9)} y2={100 + Math.sin(a) * (R + 9)} className="pg-tick" />
            })}
            <circle cx="100" cy="100" r={R} className={`pg-fill t${p.trimester}`} strokeDasharray={C} strokeDashoffset={C * (1 - (valid ? p.fraction : 0))} style={{ ['--c' as string]: C }} />
          </svg>
          <div className="pg-ring-text">
            {valid ? (
              <>
                <b><Roll>{String(p.weeks)}</Roll><small>w</small> <Roll>{String(p.days)}</Roll><small>d</small></b>
                <span>Trimester {p.trimester}</span>
              </>
            ) : (
              <span className="muted">Pick a date in the last 44 weeks</span>
            )}
          </div>
        </div>
        <div className="pg-due">
          <span className="muted">Estimated due date (HPL)</span>
          <b key={due}>{nice(due, true)}</b>
          {valid && <span>{p.daysLeft > 0 ? `${p.daysLeft} days to go` : p.daysLeft === 0 ? 'Today!' : `${-p.daysLeft} days past the due date`}</span>}
          <span className="muted pg-small">Estimated conception: {nice(p.conception)}</span>
          <div className="pg-bar"><i style={{ width: `${(valid ? p.fraction : 0) * 100}%` }} /></div>
        </div>
      </div>

      <h3 className="pg-h">Week by week</h3>
      <ol className="pg-strip" ref={strip}>
        {SIZES.map((s) => (
          <li key={s.week} data-week={s.week}>
            <button type="button" className={`${s.week === week ? 'on' : ''} ${s.week === current && valid ? 'now' : ''} ${s.week < current ? 'past' : ''}`} onClick={() => setPick(s.week === current ? null : s.week)}>
              <span aria-hidden="true">{s.emoji}</span>
              {s.week}
            </button>
          </li>
        ))}
      </ol>

      <div className="pg-card">
        <svg viewBox="-60 -60 120 120" className="pg-fruit" aria-hidden="true">
          <circle r="54" className="pg-halo" />
          <g className="pg-grow" style={{ transform: `scale(${scale})` }} key={size.week}>
            <text textAnchor="middle" dominantBaseline="central" fontSize="80">{size.emoji}</text>
          </g>
        </svg>
        <div className="pg-info" key={week}>
          <span className="muted">Week {week} · starts {nice(weekStart(input, week))}</span>
          <b>About the size of a {size.fruit.toLowerCase()}</b>
          <span className="muted">({size.id})</span>
          <span>≈ {size.cm < 1 ? `${Math.round(size.cm * 10)} mm` : `${size.cm} cm`}{size.g ? ` · ${size.g >= 1000 ? `${(size.g / 1000).toFixed(1)} kg` : `${size.g} g`}` : ''}</span>
          {size.note && <p>{size.note}</p>}
          {pick !== null && <button type="button" className="btn" onClick={() => setPick(null)}>Back to this week</button>}
        </div>
      </div>

      <h3 className="pg-h">Typical checkups</h3>
      <ul className="pg-checks">
        {CHECKUPS.map((c) => {
          const state = week > c.to ? 'done' : week >= c.from ? 'due' : 'later'
          return (
            <li key={c.title} className={state}>
              <span className="pg-wk">wk {c.from}–{c.to}</span>
              <div><b>{c.title}</b><p>{c.detail}</p></div>
            </li>
          )
        })}
      </ul>
      <p className="pg-warn"><b>Not medical advice.</b> Dates are estimates; an early ultrasound is more accurate than a period date. Follow your midwife or doctor, and get care right away for bleeding, severe pain, headaches with blurred vision, or fewer baby movements.</p>
      <Hint>Enter the first day of your last period (or conception or IVF transfer date). Tap any week in the strip to see baby's size then; tap the current week to come back.</Hint>
    </div>
  )
}
