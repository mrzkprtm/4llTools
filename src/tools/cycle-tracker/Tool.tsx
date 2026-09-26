import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'

export default function CycleTracker() {
  const [lastPeriod, setLastPeriod] = useState(() => {
    const saved = localStorage.getItem('cycle-tracker-last')
    return saved || new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  })
  const [cycleLength, setCycleLength] = useState(() => Number(localStorage.getItem('cycle-tracker-length')) || 28)
  const [periodLength, setPeriodLength] = useState(() => Number(localStorage.getItem('cycle-tracker-period')) || 5)
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('cycle-tracker-last', lastPeriod) } catch {}
    try { localStorage.setItem('cycle-tracker-length', String(cycleLength)) } catch {}
    try { localStorage.setItem('cycle-tracker-period', String(periodLength)) } catch {}
  }, [lastPeriod, cycleLength, periodLength])

  const today = new Date()
  const last = new Date(lastPeriod)
  const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000)
  const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1
  const isPeriod = dayInCycle <= periodLength
  const ovulationDay = Math.round(cycleLength / 2)
  const isFertile = dayInCycle >= ovulationDay - 4 && dayInCycle <= ovulationDay + 1
  const nextPeriod = new Date(last.getTime() + Math.ceil(diffDays / cycleLength) * cycleLength * 86400000)
  const nextOvulation = new Date(last.getTime() + (Math.floor((diffDays + cycleLength - ovulationDay) / cycleLength) + 1) * ovulationDay * 86400000)

  const daysUntilPeriod = Math.ceil((nextPeriod.getTime() - today.getTime()) / 86400000)
  const daysUntilOvulation = Math.ceil((nextOvulation.getTime() - today.getTime()) / 86400000)

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Last Period Start</label>
          <input type="date" value={lastPeriod} onChange={e => setLastPeriod(e.target.value)} max={new Date().toISOString().split('T')[0]} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Cycle Length (days)</label>
          <input type="number" min={20} max={45} value={cycleLength} onChange={e => setCycleLength(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Period Length (days)</label>
          <input type="number" min={2} max={10} value={periodLength} onChange={e => setPeriodLength(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: isPeriod ? 'var(--accent)' : isFertile ? '#eab308' : 'var(--text)' }}><Roll>{dayInCycle}</Roll></b><span className="muted">Day in Cycle</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll>{daysUntilPeriod}</Roll></b><span className="muted">Days to Period</span></div>
        <div className="stat"><b style={{ color: '#eab308' }}><Roll>{daysUntilOvulation}</Roll></b><span className="muted">Days to Ovulation</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className={`chip ${isPeriod ? '' : 'calm'}`} style={{ background: isPeriod ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--sunken)', borderColor: isPeriod ? 'var(--accent)' : 'var(--border)', color: isPeriod ? 'var(--accent)' : 'var(--text)' }}>
              🩸 Period: Days 1–{periodLength}
            </span>
            <span className={`chip ${isFertile ? '' : 'calm'}`} style={{ background: isFertile ? 'color-mix(in srgb, #eab308 10%, transparent)' : 'var(--sunken)', borderColor: isFertile ? '#eab308' : 'var(--border)', color: isFertile ? '#eab308' : 'var(--text)' }}>
              🥚 Fertile Window: Days {ovulationDay - 4}–{ovulationDay + 1}
            </span>
            <span className="chip calm" style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', borderColor: 'var(--ok)', color: 'var(--ok)' }}>
              🌟 Ovulation ~Day {ovulationDay}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Next Predictions</h4>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="stat" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}><Roll>{nextPeriod.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Roll></div>
            <div className="muted">Next Period</div>
          </div>
          <div className="stat" style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: '#eab308' }}><Roll>{nextOvulation.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Roll></div>
            <div className="muted">Next Ovulation</div>
          </div>
        </div>
      </div>

      <button className="btn" onClick={() => setShowCalendar(!showCalendar)} style={{ marginBottom: 16 }}>
        {showCalendar ? 'Hide' : 'Show'} Calendar View
      </button>

      {showCalendar && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12 }}>{today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', padding: '4px' }}>{d}</div>
            ))}
            {Array.from({ length: 42 }, (_, i) => {
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay()
              const dayNum = i - firstDay + 1
              const date = dayNum > 0 && dayNum <= new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
                ? new Date(today.getFullYear(), today.getMonth(), dayNum)
                : null
              if (!date) return <div key={i} style={{ aspectRatio: '1' }} />
              const dInCycle = ((Math.floor((date.getTime() - last.getTime()) / 86400000) % cycleLength) + cycleLength) % cycleLength + 1
              const isPeriodDay = dInCycle <= periodLength
              const isFertileDay = dInCycle >= ovulationDay - 4 && dInCycle <= ovulationDay + 1
              const isOvulationDay = dInCycle === ovulationDay
              return (
                <div key={i} style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: isPeriodDay ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : isFertileDay ? 'color-mix(in srgb, #eab308 15%, transparent)' : 'transparent',
                  border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.75rem',
                }}>
                  <span style={{ fontWeight: date.getDate() === today.getDate() ? 700 : 400 }}>{dayNum}</span>
                  {isOvulationDay && <span style={{ color: '#eab308', fontSize: '0.6rem' }}>🌟</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Hint>Enter last period date. Cycle ring shows current day, fertile window (green), ovulation (yellow), period (red). Data stored locally only.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}