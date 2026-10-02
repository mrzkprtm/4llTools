import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint, Toggle } from '../../sim/controls'
import { DATA_STATUS, HOLIDAYS } from './holidays'
import { addDays, addWorkingDays, countWorkingDays, isWeekend, offMap, toMs, weekday } from './logic'
import './tool.css'

const MAX_MONTHS = 12
const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => new Date(toMs(iso)).toLocaleDateString('en-GB', { timeZone: 'UTC', ...o })

/** Counts up to `target` over about a second, in step with the calendar lighting up. */
function useCountUp(target: number, key: string) {
  const [v, setV] = useState(target)
  useEffect(() => {
    if (reducedMotion()) return setV(target)
    let raf = 0
    const t0 = performance.now()
    const dur = Math.min(1400, 300 + target * 25)
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setV(Math.round(target * p))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return v
}

export default function WorkingDays() {
  const [start, setStart] = useState('2026-03-02')
  const [end, setEnd] = useState('2026-04-30')
  const [incStart, setIncStart] = useState(true)
  const [incEnd, setIncEnd] = useState(true)
  const [week, setWeek] = useState<5 | 6>(5)
  const [cuti, setCuti] = useState(true)
  const [info, setInfo] = useState('')
  const [addFrom, setAddFrom] = useState('2026-09-28')
  const [addN, setAddN] = useState(10)

  // Open on the current month so the example is relevant.
  useEffect(() => {
    const d = new Date()
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    setStart(iso(new Date(d.getFullYear(), d.getMonth(), 1)))
    setEnd(iso(new Date(d.getFullYear(), d.getMonth() + 2, 0)))
    setAddFrom(iso(d))
  }, [])

  const opts = useMemo(() => ({ week, off: offMap(HOLIDAYS, cuti) }), [week, cuti])
  const valid = /^\d{4}-\d\d-\d\d$/.test(start) && /^\d{4}-\d\d-\d\d$/.test(end) && Math.abs(toMs(end) - toMs(start)) < 20 * 366 * 86400000
  const tally = useMemo(() => (valid ? countWorkingDays(start, end, opts, incStart, incEnd) : null), [valid, start, end, opts, incStart, incEnd])
  const key = `${start}|${end}|${week}|${cuti}|${incStart}|${incEnd}`
  const shown = useCountUp(tally?.working ?? 0, key)
  const order = useMemo(() => new Map(tally?.days.map((d, i) => [d, i]) ?? []), [tally])
  const delay = tally ? Math.min(40, 1200 / Math.max(1, tally.working)) : 0

  const [lo, hi] = start <= end ? [start, end] : [end, start]
  const months: string[] = []
  if (valid) for (let m = lo.slice(0, 7); m <= hi.slice(0, 7) && months.length < MAX_MONTHS; m = addDays(`${m}-28`, 7).slice(0, 7)) months.push(m)
  const years = [...new Set([lo.slice(0, 4), hi.slice(0, 4)].map(Number))]
  const added = /^\d{4}-\d\d-\d\d$/.test(addFrom) && Math.abs(addN) <= 2000 ? addWorkingDays(addFrom, addN, opts) : ''

  return (
    <div className="wd">
      <div className="wd-inputs">
        <label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label>To<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <div className="row wd-opts">
        <Choice value={week} options={[[5, 'Mon–Fri'], [6, 'Mon–Sat']]} onChange={setWeek} />
        <Toggle label="Include start" checked={incStart} onChange={setIncStart} />
        <Toggle label="Include end" checked={incEnd} onChange={setIncEnd} />
        <Toggle label="Cuti bersama is a day off" checked={cuti} onChange={setCuti} />
      </div>

      {tally ? (
        <div className="stats wd-stats">
          <div className="stat wd-main"><b><Roll>{String(shown)}</Roll></b>working days</div>
          <div className="stat"><b>{tally.calendar}</b>calendar days</div>
          <div className="stat"><b>{tally.weekend}</b>weekend days</div>
          <div className="stat"><b>{tally.holidays.length}</b>holidays on weekdays</div>
        </div>
      ) : (
        <p className="error">Pick two valid dates (up to 20 years apart).</p>
      )}

      <p className="wd-info" aria-live="polite">{info || 'Tap a marked day to see the holiday.'}</p>
      <div className="wd-months" key={key}>
        {months.map((m) => {
          const first = `${m}-01`
          const lead = (weekday(first) + 6) % 7
          const days = new Date(toMs(addDays(`${m}-28`, 7).slice(0, 7) + '-01') - 86400000).getUTCDate()
          return (
            <section key={m} className="wd-month">
              <h3>{fmt(first, { month: 'long', year: 'numeric' })}</h3>
              <div className="wd-grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="wd-dow">{d}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                  const d = `${m}-${String(i + 1).padStart(2, '0')}`
                  const inRange = d >= lo && d <= hi
                  const hol = opts.off.get(d) ?? (cuti ? undefined : HOLIDAYS.find((x) => x.date === d))
                  const idx = order.get(d)
                  const cls = ['wd-day', inRange ? 'in' : 'out', idx !== undefined ? 'work' : '', isWeekend(d, week) ? 'wkend' : '', hol ? hol.kind : ''].join(' ')
                  return (
                    <button key={d} type="button" className={cls} style={idx !== undefined ? ({ '--d': `${idx * delay}ms` } as CSSProperties) : undefined} title={hol ? `${fmt(d)}: ${hol.name}` : fmt(d)} onClick={() => setInfo(hol ? `${fmt(d)}: ${hol.name}${hol.kind === 'cuti' && !cuti ? ' (counted as a working day)' : ''}` : `${fmt(d)}: ${idx !== undefined ? 'working day' : inRange ? 'day off' : 'outside the range'}`)}>
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {valid && months.length === MAX_MONTHS && hi.slice(0, 7) > months[MAX_MONTHS - 1] && <p className="muted">Showing the first {MAX_MONTHS} months; the count covers the whole range.</p>}
      <div className="wd-legend muted">
        <span><i className="work" /> Working day</span><span><i className="holiday" /> National holiday</span><span><i className="cuti" /> Cuti bersama</span>
      </div>

      {tally && tally.holidays.length > 0 && (
        <details className="wd-list">
          <summary>{tally.holidays.length} days off in this range</summary>
          <ul>{tally.holidays.map((h) => <li key={h.date}><b>{fmt(h.date)}</b> {h.name}</li>)}</ul>
        </details>
      )}

      <h3 className="wd-h">Add working days</h3>
      <div className="wd-inputs">
        <label>Start date<input type="date" value={addFrom} onChange={(e) => setAddFrom(e.target.value)} /></label>
        <label>Working days to add<input type="number" value={addN} min={-2000} max={2000} onChange={(e) => setAddN(Math.trunc(Number(e.target.value) || 0))} /></label>
      </div>
      {added && <p className="output wd-added pop" key={added}>{addN} working days {addN < 0 ? 'before' : 'after'} {fmt(addFrom)} is <b>{fmt(added, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>.</p>}

      <Hint>Pick a date range to count business days, skipping weekends, Indonesian national holidays and (optionally) cuti bersama. Islamic holiday dates follow the government decree and can move after the sidang isbat.</Hint>
      <ul className="wd-status muted">{years.filter((y) => DATA_STATUS[y]).map((y) => <li key={y}><b>{y}:</b> {DATA_STATUS[y]}</li>)}{years.some((y) => !DATA_STATUS[y]) && <li>Holiday data covers 2025–2027 only; other years skip weekends only.</li>}</ul>
    </div>
  )
}
