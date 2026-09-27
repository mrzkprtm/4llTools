import { useState, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const INDONESIAN_HOLIDAYS_2024 = [
  '2024-01-01', '2024-02-10', '2024-03-11', '2024-04-10', '2024-04-11', '2024-05-01',
  '2024-05-09', '2024-05-23', '2024-06-01', '2024-06-17', '2024-07-07', '2024-08-17',
  '2024-09-16', '2024-12-25',
]

const INDONESIAN_HOLIDAYS_2025 = [
  '2025-01-01', '2025-01-29', '2025-03-30', '2025-04-01', '2025-05-01', '2025-05-12',
  '2025-05-29', '2025-06-06', '2025-06-27', '2025-08-17', '2025-09-05', '2025-12-25',
]

const ALL_HOLIDAYS = [...INDONESIAN_HOLIDAYS_2024, ...INDONESIAN_HOLIDAYS_2025]

export default function WorkingDays() {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  })
  const [mode, setMode] = useState<'between' | 'add' | 'subtract'>('between')
  const [daysToAdd, setDaysToAdd] = useState(10)
  const [includeHolidays, setIncludeHolidays] = useState(true)
  const [customHolidays, setCustomHolidays] = useState('')

  const holidays = useMemo(() => {
    const custom = customHolidays.split('\n').map(d => d.trim()).filter(Boolean)
    return includeHolidays ? [...ALL_HOLIDAYS, ...custom] : custom
  }, [includeHolidays, customHolidays])

  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6
  const isHoliday = (date: Date) => holidays.includes(date.toISOString().split('T')[0])
  const isWorkDay = (date: Date) => !isWeekend(date) && !isHoliday(date)

  const calculateBetween = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) return { workDays: 0, totalDays: 0, weekends: 0, holidays: 0, details: [] }
    let workDays = 0, totalDays = 0, weekends = 0, holidayCount = 0
    const details: string[] = []
    const current = new Date(start)
    while (current <= end) {
      totalDays++
      if (isWeekend(current)) { weekends++; details.push(`${current.toISOString().split('T')[0]}: Weekend`) }
      else if (isHoliday(current)) { holidayCount++; details.push(`${current.toISOString().split('T')[0]}: Holiday`) }
      else { workDays++; details.push(`${current.toISOString().split('T')[0]}: Work day`) }
      current.setDate(current.getDate() + 1)
    }
    return { workDays, totalDays, weekends, holidays: holidayCount, details }
  }

  const calculateAddSubtract = () => {
    const start = new Date(startDate)
    let count = 0
    let current = new Date(start)
    const direction = mode === 'add' ? 1 : -1
    const details: string[] = []
    while (count < Math.abs(daysToAdd)) {
      current.setDate(current.getDate() + direction)
      if (isWorkDay(current)) {
        count++
        details.push(`${current.toISOString().split('T')[0]}: Work day #${count}`)
      } else {
        details.push(`${current.toISOString().split('T')[0]}: Skipped (${isWeekend(current) ? 'Weekend' : 'Holiday'})`)
      }
    }
    return { resultDate: current, details }
  }

  const betweenResult = useMemo(calculateBetween, [startDate, endDate, holidays])
  const addSubResult = useMemo(calculateAddSubtract, [startDate, daysToAdd, mode, holidays])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Working Days Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Start Date</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>End Date</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Mode</span>
          <select value={mode} onChange={e => setMode(e.target.value as any)}>
            <option value="between">Days Between</option>
            <option value="add">Add Work Days</option>
            <option value="subtract">Subtract Work Days</option>
          </select>
        </label>
        {(mode === 'add' || mode === 'subtract') && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span>Work Days</span>
            <input type="number" min={1} max={365} value={daysToAdd} onChange={e => setDaysToAdd(Number(e.target.value))} />
          </label>
        )}
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={includeHolidays} onChange={e => setIncludeHolidays(e.target.checked)} />
          <span>Include Indonesian Holidays 2024-2025</span>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Custom Holidays (one per line, YYYY-MM-DD)</span>
          <textarea value={customHolidays} onChange={e => setCustomHolidays(e.target.value)} rows={3} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.85rem' }} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>{mode === 'between' ? 'Days Between' : mode === 'add' ? 'Add Work Days' : 'Subtract Work Days'}</h4>
          {mode === 'between' && (
            <div className="stats">
              <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={betweenResult.workDays} /></b><span className="muted">Work Days</span></div>
              <div className="stat"><b><Roll value={betweenResult.totalDays} /></b><span className="muted">Total Days</span></div>
              <div className="stat"><b style={{ color: 'var(--muted)' }}><Roll value={betweenResult.weekends} /></b><span className="muted">Weekends</span></div>
              <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={betweenResult.holidays} /></b><span className="muted">Holidays</span></div>
            </div>
          )}
          {mode !== 'between' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Result Date</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                {addSubResult.resultDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 8 }}>
                {mode === 'add' ? '+' : '-'}{daysToAdd} work days from {new Date(startDate).toLocaleDateString('id-ID')}
              </div>
            </div>
          )}
        </div>

        <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Day-by-day Breakdown</summary>
          <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto', fontSize: '0.8rem', fontFamily: 'var(--mono)' }}>
            {(mode === 'between' ? betweenResult.details : addSubResult.details).map((d, i) => (
              <div key={i} style={{ padding: '2px 8px', borderBottom: '1px solid var(--border)' }}>{d}</div>
            ))}
          </div>
        </details>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Calculates business days (Mon-Fri) excluding weekends and Indonesian holidays. Add custom holidays in YYYY-MM-DD format.
      </p>
    </div>
  )
}