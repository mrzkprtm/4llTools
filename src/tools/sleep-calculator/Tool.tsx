import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function SleepCalculator() {
  const [mode, setMode] = useState<'bedtime' | 'waketime'>('waketime')
  const [time, setTime] = useState('07:00')
  const [cycles, setCycles] = useState(5)

  const [bedtime, waketime] = mode === 'waketime'
    ? calculateBedtime(time, cycles)
    : ['', calculateWaketime(time, cycles)]

  function calculateBedtime(wake: string, c: number) {
    const [h, m] = wake.split(':').map(Number)
    let totalMinutes = h * 60 + m
    totalMinutes -= c * 90 + 15 // 15 min to fall asleep
    if (totalMinutes < 0) totalMinutes += 24 * 60
    const bedH = Math.floor(totalMinutes / 60)
    const bedM = totalMinutes % 60
    return [`${String(bedH).padStart(2, '0')}:${String(bedM).padStart(2, '0')}`, wake]
  }

  function calculateWaketime(bed: string, c: number) {
    const [h, m] = bed.split(':').map(Number)
    let totalMinutes = h * 60 + m + 15 + c * 90
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60
    const wakeH = Math.floor(totalMinutes / 60)
    const wakeM = totalMinutes % 60
    return [bed, `${String(wakeH).padStart(2, '0')}:${String(wakeM).padStart(2, '0')}`]
  }

  const times = Array.from({ length: 10 }, (_, i) => {
    const base = mode === 'waketime' ? bedtime : waketime
    if (!base) return null
    const [h, m] = base.split(':').map(Number)
    let totalMinutes = h * 60 + m - (i - 4) * 90
    if (totalMinutes < 0) totalMinutes += 24 * 60
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60
    const h2 = Math.floor(totalMinutes / 60)
    const m2 = totalMinutes % 60
    const isOptimal = i === 4
    return { time: `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`, isOptimal }
  }).filter(Boolean)

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>I want to</span>
          <select value={mode} onChange={e => setMode(e.target.value as any)} className="btn" style={{ width: '100%' }}>
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
            <div key={i} className={`pop-row ${t!.isOptimal ? 'settle' : ''}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
              background: t!.isOptimal ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : 'var(--sunken)',
              border: t!.isOptimal ? '2px solid var(--ok)' : '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.4s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: t!.isOptimal ? 'var(--ok)' : 'var(--text)' }}>
                <Roll>{t!.time}</Roll>
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                {mode === 'waketime' ? 'Wake up' : 'Go to bed'} {' '}
                {t!.isOptimal && <span className="chip good" style={{ fontSize: '0.65rem', marginLeft: 8 }}>Optimal</span>}
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
          <li>Keep room cool (18-20°C)</li>
        </ul>
      </div>

      <Hint>Choose wake-up or bedtime. Drag to adjust cycles. Green cards = optimal sleep times (cycle boundaries).</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}