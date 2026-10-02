import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { Hint } from '../../sim/controls'
import { DAY_NEPTU, DAYS, fromJdn, jdn, NEPTU_NAMES, nextSameWeton, PASARAN, PASARAN_NEPTU, wetonOfJdn } from './weton'
import './tool.css'

const p2 = (n: number) => String(n).padStart(2, '0')
const toIso = (n: number) => { const g = fromJdn(n); return `${g.year}-${p2(g.month)}-${p2(g.day)}` }
const nice = (n: number) => { const g = fromJdn(n); return new Date(Date.UTC(g.year, g.month - 1, g.day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) }
const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f59f00', '#0ca678', '#e03131']
const PCOL = ['#fab005', '#e8590c', '#1c7ed6', '#495057', '#ae3ec9']

/** Keep a rotation continuous: move to `target` (mod 360) by the shortest way from `prev`. */
function nearest(prev: number, target: number) {
  const d = ((((target - prev) % 360) + 540) % 360) - 180
  return prev + d
}

function sector(r0: number, r1: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => `${(Math.sin(a) * r).toFixed(2)},${(-Math.cos(a) * r).toFixed(2)}`
  return `M${pt(r1, a0)} A${r1},${r1} 0 0 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0},${r0} 0 0 0 ${pt(r0, a0)} Z`
}

function Ring({ items, values, colors, r0, r1, index, label }: { items: string[]; values: number[]; colors: string[]; r0: number; r1: number; index: number; label: string }) {
  const n = items.length
  const rot = useRef(0)
  rot.current = nearest(rot.current, (-index * 360) / n)
  return (
    <g className="wt-ring" style={{ transform: `rotate(${rot.current}deg)` }} aria-label={label}>
      {items.map((name, i) => {
        const a0 = ((i - 0.5) / n) * Math.PI * 2
        const a1 = ((i + 0.5) / n) * Math.PI * 2
        const mid = (i / n) * 360
        const rm = (r0 + r1) / 2
        return (
          <g key={name} className={i === index ? 'on' : ''}>
            <path d={sector(r0, r1, a0 + 0.012, a1 - 0.012)} fill={colors[i]} className="wt-seg" />
            <g transform={`rotate(${mid}) translate(0,${-rm})`}>
              <text textAnchor="middle" y={-3} className="wt-name">{name}</text>
              <text textAnchor="middle" y={11} className="wt-val">{values[i]}</text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

export default function WetonCalculator() {
  const [day, setDay] = useState(() => jdn(1945, 8, 17))
  const [today, setToday] = useState(() => jdn(2026, 1, 1))
  useEffect(() => {
    const d = new Date()
    setToday(jdn(d.getFullYear(), d.getMonth() + 1, d.getDate()))
    try {
      const s = JSON.parse(localStorage.getItem('4lltools:weton-calculator') ?? 'null')
      if (typeof s?.day === 'number' && s.day > 2000000) setDay(s.day)
    } catch {
      // Default date.
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('4lltools:weton-calculator', JSON.stringify({ day }))
    } catch {
      // Not saved.
    }
  }, [day])

  const w = wetonOfJdn(day)
  const trad = NEPTU_NAMES[w.neptu]
  const next = nextSameWeton(day, 6, Math.max(day, today - 1))
  const todayW = wetonOfJdn(today)

  return (
    <div className="wt">
      <div className="row wt-inputs">
        <label className="sim-label" htmlFor="wt-date">Date of birth or any date</label>
        <div className="wt-date-row">
          <button type="button" className="btn" aria-label="Previous day" onClick={() => setDay(day - 1)}><Icon name="chevron-left" size={18} /></button>
          <input id="wt-date" type="date" value={toIso(day)} min="1800-01-01" max="2200-12-31" onChange={(e) => { const [y, m, d] = e.target.value.split('-').map(Number); if (y > 1000 && m && d) setDay(jdn(y, m, d)) }} />
          <button type="button" className="btn" aria-label="Next day" onClick={() => setDay(day + 1)}><Icon name="chevron-right" size={18} /></button>
          <button type="button" className="btn" onClick={() => setDay(today)}>Today</button>
        </div>
      </div>

      <div className="wt-main">
        <svg viewBox="-150 -160 300 310" className="wt-wheel" role="img" aria-label={`${w.day} ${w.pasaran}, neptu ${w.neptu}`}>
          <Ring items={DAYS} values={DAY_NEPTU} colors={COLORS} r0={92} r1={146} index={w.dayIndex} label="Day of the week" />
          <Ring items={PASARAN} values={PASARAN_NEPTU} colors={PCOL} r0={44} r1={88} index={w.pasaranIndex} label="Pasaran" />
          <circle r="40" className="wt-hub" />
          <text y="-4" textAnchor="middle" className="wt-hub-n">{w.neptu}</text>
          <text y="14" textAnchor="middle" className="wt-hub-l">neptu</text>
          <path d="M-11,-158 L11,-158 L0,-140 Z" className="wt-pointer" />
        </svg>
        <div className="wt-side">
          <p className="wt-weton" key={day}>{w.day} <span>{w.pasaran}</span></p>
          <p className="muted">{nice(day)}</p>
          <div className="wt-sum">
            <span><b>{w.dayNeptu}</b> {w.day}</span>
            <i>+</i>
            <span><b>{w.pasaranNeptu}</b> {w.pasaran}</span>
            <i>=</i>
            <span className="tot"><b><Roll>{String(w.neptu)}</Roll></b> neptu</span>
          </div>
          {trad && (
            <p className="wt-trad">
              <span className="chip">Tradition</span> Primbon calls a total of {w.neptu} <b>{trad[0]}</b> (“{trad[1]}”).
            </p>
          )}
          <p className="muted wt-small">Today is {todayW.day} {todayW.pasaran} (neptu {todayW.neptu}).</p>
        </div>
      </div>

      <h3 className="wt-h">Next {w.day} {w.pasaran}</h3>
      <ol className="wt-next">
        {next.map((n, i) => (
          <li key={n} style={{ animationDelay: `${i * 60}ms` }}>
            <button type="button" onClick={() => setDay(n)}>
              <b>{nice(n)}</b>
              <span className="muted">in {n - today} days</span>
            </button>
          </li>
        ))}
      </ol>

      <p className="muted wt-small wt-note">
        The weton pairs the 7-day week with the 5-day Javanese market week (pasaran), so the same pair returns every 35 days, a cycle called <i>selapan</i>. Families often mark a baby's first selapan and use weton in ceremonies. The neptu numbers and names above come from traditional primbon tables and are shown as cultural heritage, not as predictions.
      </p>
      <Hint>Pick a date, or step a day at a time and watch both wheels turn until the day and its pasaran line up under the pointer. Tap an upcoming date to jump to it.</Hint>
    </div>
  )
}
