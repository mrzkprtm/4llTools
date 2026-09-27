import { useState } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function SleepCalculator() {
  const [mode, setMode] = useState<'bedtime' | 'waketime'>('waketime')
  const [time, setTime] = useState('07:00')
  const [cycles, setCycles] = useState(5)

  // Each option is a whole number of 90-minute cycles plus ~15 minutes to fall asleep.
  // Entering a wake-up time gives bedtimes; entering a bedtime gives wake-up times.
  const valid = /^\d{1,2}:\d{2}/.test(time)
  const times = valid
    ? Array.from({ length: 6 }, (_, i) => i + 3).map(c => {
        const offset = c * 90 + 15
        return { time: shiftTime(time, mode === 'waketime' ? -offset : offset), cycles: c, isOptimal: c === cycles }
      })
    : []
  if (mode === 'waketime') times.reverse() // earliest bedtime first

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>I want to</span>
          <select value={mode} onChange={e => setMode(e.target.value as typeof mode)} className="btn" style={{ width: '100%' }}>
            <option value="waketime">Wake up at</option>
            <option value="bedtime">Go to bed at</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="btn" style={{ width: '100%' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Cycles</span>
          <input type="number" min={3} max={8} value={cycles} onChange={e => setCycles(Math.max(3, Math.min(8, Number(e.target.value))))} className="btn" style={{ width: '100%' }} />
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
          {times.map((t, i) => (
            <div key={t.cycles} className={`pop-row ${t.isOptimal ? 'settle' : ''}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              background: t.isOptimal ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : 'var(--sunken)',
              border: t.isOptimal ? '2px solid var(--ok)' : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.4s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: t.isOptimal ? 'var(--ok)' : 'var(--text)' }}>
                <Roll>{t.time}</Roll>
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                {mode === 'waketime' ? 'Go to bed' : 'Wake up'} · {t.cycles} cycles ({Math.floor(t.cycles * 1.5)}h{t.cycles % 2 ? ' 30m' : ''})
                {t.isOptimal && <span className="chip good" style={{ fontSize: '0.65rem', marginLeft: 8 }}>Optimal</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Sleep Tips</h4>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: 'var(--muted)' }}>
          <li>Fall asleep ~15 min after bedtime</li>
          <li>Each cycle = 90 min (light → deep → REM)</li>
          <li>Wake at cycle end for best alertness</li>
          <li>Avoid screens 1 hr before bed</li>
          <li>Keep room cool (65-68°F / 18-20°C)</li>
        </ul>
      </div>

      <Hint>Choose wake-up or bedtime and how many cycles you want. Green cards = optimal sleep times (cycle boundaries).</Hint>
    </div>
  )
}

function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}