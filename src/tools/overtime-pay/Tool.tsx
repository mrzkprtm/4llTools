import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { Choice, Hint } from '../../sim/controls'
import { hourlyWage, overtimeBasis, segments, weekPay, weightedHours, type DayEntry, type DayType, type WorkWeek } from './logic'
import './tool.css'

const KEY = '4lltools:overtime-pay'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MULT_CLASS: Record<number, string> = { 1.5: 'm15', 2: 'm2', 3: 'm3', 4: 'm4' }
const rp = (v: number) => 'Rp ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const defaultWeek = (week: WorkWeek): DayEntry[] =>
  DAYS.map((_, i) => ({ day: i === 6 || (week === 5 && i === 5) ? 'rest' : 'work', hours: [2, 0, 3, 0, 1, week === 5 ? 6 : 2, 0][i] }))

function Timeline({ hours, day, week, label }: { hours: number; day: DayType; week: WorkWeek; label?: string }) {
  const segs = segments(hours, day, week)
  const blocks: { mult: number; w: number }[] = []
  for (const s of segs) for (let h = s.from; h < s.to - 1e-9; h = Math.min(s.to, Math.floor(h) + 1)) blocks.push({ mult: s.mult, w: Math.min(s.to, Math.floor(h) + 1) - h })
  return (
    <div className="ot-line">
      {label && <span className="ot-day">{label}</span>}
      <div className="ot-track" aria-label={`${hours} hours: ${segs.map((s) => `${s.to - s.from} h at ${s.mult}×`).join(', ') || 'none'}`}>
        {blocks.map((b, i) => (
          <i key={`${i}-${b.mult}`} className={`ot-h ${MULT_CLASS[b.mult]}`} style={{ flexGrow: b.w, animationDelay: `${i * 45}ms` }}>
            {b.w >= 0.99 ? `${b.mult}×` : ''}
          </i>
        ))}
        {Array.from({ length: Math.max(0, 12 - Math.ceil(hours)) }, (_, i) => <i key={`e${i}`} className="ot-empty" />)}
      </div>
    </div>
  )
}

export default function OvertimePay() {
  const [wage, setWage] = useState(5_396_761)
  const [nonFixed, setNonFixed] = useState(0)
  const [week, setWeek] = useState<WorkWeek>(5)
  const [mode, setMode] = useState<'single' | 'week'>('single')
  const [day, setDay] = useState<DayType>('work')
  const [hours, setHours] = useState(3)
  const [entries, setEntries] = useState<DayEntry[]>(() => defaultWeek(5))
  const ready = useRef(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { wage?: number; nonFixed?: number; week?: WorkWeek } | null
      if (s?.wage) setWage(s.wage)
      if (s?.nonFixed) setNonFixed(s.nonFixed)
      if (s?.week === 5 || s?.week === 6) {
        setWeek(s.week)
        setEntries(defaultWeek(s.week))
      }
    } catch {
      // Defaults.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ wage, nonFixed, week }))
    } catch {
      // Storage is optional.
    }
  }, [wage, nonFixed, week])

  const basis = overtimeBasis(wage, nonFixed)
  const hourly = hourlyWage(basis)
  const dayOpts: [DayType, string][] = week === 6 ? [['work', 'Workday'], ['rest', 'Rest day / holiday'], ['short', 'Holiday on short day']] : [['work', 'Workday'], ['rest', 'Rest day / holiday']]
  const single = { weighted: weightedHours(hours, day, week) }
  const wk = weekPay(basis, entries, week, DAYS)
  const total = mode === 'single' ? Math.round(hourly * single.weighted) : wk.pay
  const weighted = mode === 'single' ? single.weighted : wk.weighted
  const warn = mode === 'single' ? weekPay(basis, [{ day, hours }], week, ['This day']).warnings : wk.warnings

  function changeWeek(w: WorkWeek) {
    setWeek(w)
    setEntries(defaultWeek(w))
    if (w === 5 && day === 'short') setDay('rest')
  }
  const setEntry = (i: number, p: Partial<DayEntry>) => setEntries(entries.map((e, j) => (j === i ? { ...e, ...p } : e)))

  return (
    <div>
      <div className="ot-inputs">
        <label>Monthly wage (base + fixed allowances)
          <input type="number" min={0} step={50000} value={wage} onChange={(e) => setWage(Math.max(0, Number(e.target.value)))} />
        </label>
        <label>Non-fixed allowances (optional)
          <input type="number" min={0} step={50000} value={nonFixed} onChange={(e) => setNonFixed(Math.max(0, Number(e.target.value)))} />
        </label>
      </div>
      <div className="row ot-choices">
        <Choice label="Work week" value={week} options={[[5, '5 days'], [6, '6 days']] as const} onChange={changeWeek} />
        <Choice label="Enter" value={mode} options={[['single', 'One day'], ['week', 'A week']] as const} onChange={setMode} />
      </div>

      {mode === 'single' ? (
        <div className="ot-single">
          <Choice label="Kind of day" value={day} options={dayOpts} onChange={setDay} />
          <label className="ot-hours">Overtime hours <b>{hours} h</b>
            <input type="range" min={0} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
          <Timeline key={`${day}-${week}`} hours={hours} day={day} week={week} />
        </div>
      ) : (
        <div className="ot-week">
          {entries.map((e, i) => (
            <div key={i} className="ot-wrow">
              <Timeline key={`${e.day}-${week}`} hours={e.hours} day={e.day} week={week} label={DAYS[i]} />
              <select aria-label={`${DAYS[i]} kind of day`} value={e.day} onChange={(ev) => setEntry(i, { day: ev.target.value as DayType })}>
                {dayOpts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
              <input type="number" aria-label={`${DAYS[i]} overtime hours`} min={0} max={14} step={0.5} value={e.hours} onChange={(ev) => setEntry(i, { hours: Math.max(0, Math.min(14, Number(ev.target.value))) })} />
            </div>
          ))}
        </div>
      )}

      <div className="ot-legend">
        <span><i className="m15" />1.5×</span><span><i className="m2" />2×</span><span><i className="m3" />3×</span><span><i className="m4" />4×</span>
      </div>

      <div className="stats">
        <div className="stat ot-total"><b><Roll>{rp(total)}</Roll></b>estimated overtime pay</div>
        <div className="stat"><b><Roll>{rp(hourly)}</Roll></b>hourly wage (1/173)</div>
        <div className="stat"><b><Roll>{String(Math.round(weighted * 10) / 10)}</Roll></b>hours × multiplier</div>
        {nonFixed > 0 && <div className="stat"><b><Roll>{rp(basis)}</Roll></b>wage basis {basis > wage ? '(75% rule)' : ''}</div>}
      </div>
      {warn.map((w) => <p key={w} className="error ot-warn">{w}</p>)}

      <details className="ot-rules">
        <summary>The rules used</summary>
        <ul>
          <li>Hourly wage = 1/173 × monthly wage (PP 35/2021, Art. 32). If you also get non-fixed allowances and base + fixed allowances are under 75% of the total, 75% of the total is used.</li>
          <li>Workday: the first hour at 1.5×, every hour after at 2×. At most 4 hours a day and 18 hours a week.</li>
          <li>Rest day or public holiday, 5-day week: hours 1–8 at 2×, hour 9 at 3×, hours 10–12 at 4×.</li>
          <li>6-day week: hours 1–7 at 2×, hour 8 at 3×, hours 9–11 at 4×. If the holiday falls on the shortest workday: hours 1–5 at 2×, hour 6 at 3×, hours 7–9 at 4×.</li>
        </ul>
      </details>
      <p className="muted ot-note">This is an estimate. Your employment contract, company regulation or collective agreement may set better terms, and some roles (such as certain managers) are paid differently.</p>
      <Hint>Enter the monthly wage, pick the kind of day and slide the hours; each block on the timeline is one hour colored by its multiplier. Switch to “A week” to plan several days.</Hint>
    </div>
  )
}
