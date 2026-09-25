import { useState } from 'react'
import { addDays, daysBetween, diffYmd, parseDate, toInputValue } from './dates'

export default function DateCalculator() {
  const today = toInputValue(new Date())
  const [from, setFrom] = useState('2000-01-01')
  const [to, setTo] = useState(today)
  const [base, setBase] = useState(today)
  const [offset, setOffset] = useState('30')

  const a = parseDate(from)
  const b = parseDate(to)
  const [start, end] = a && b && a > b ? [b, a] : [a, b]
  const ymd = start && end ? diffYmd(start, end) : null
  const days = start && end ? daysBetween(start, end) : null
  const baseDate = parseDate(base)
  const shifted = baseDate && Number.isFinite(Number(offset)) ? addDays(baseDate, Math.trunc(Number(offset))) : null
  const long = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Age or time between two dates</h3>
      <div className="row">
        <label style={{ margin: 0 }} htmlFor="dc-from">From</label>
        <input id="dc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label style={{ margin: 0 }} htmlFor="dc-to">To</label>
        <input id="dc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {ymd && days !== null && (
        <div className="stats">
          <div className="stat"><b>{ymd.years}y {ymd.months}m {ymd.days}d</b><span className="muted">Years, months, days</span></div>
          <div className="stat"><b>{days.toLocaleString()}</b><span className="muted">Days</span></div>
          <div className="stat"><b>{Math.floor(days / 7).toLocaleString()}w {days % 7}d</b><span className="muted">Weeks</span></div>
          <div className="stat"><b>{(days * 24).toLocaleString()}</b><span className="muted">Hours</span></div>
        </div>
      )}
      <h3>Add or subtract days</h3>
      <div className="row">
        <input type="date" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Start date" />
        <span>+</span>
        <input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} style={{ width: 100 }} aria-label="Days to add (negative to subtract)" />
        <span>days =</span>
        <b>{shifted ? long(shifted) : '—'}</b>
      </div>
    </div>
  )
}
