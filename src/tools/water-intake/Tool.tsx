import { useState, useEffect, useRef } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const DAILY_GOAL_ML = 2000

interface DayEntry {
  date: string // YYYY-MM-DD, local time
  amount: number // ml
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WaterIntakeTracker() {
  const [weight, setWeight] = useState(70)
  const [activity, setActivity] = useState<'sedentary' | 'light' | 'moderate' | 'intense'>('light')
  const [goal, setGoal] = useState(DAILY_GOAL_ML)
  // One entry per day; today's entry is the current amount, so the count starts fresh each day
  const [history, setHistory] = useState<DayEntry[]>(() => {
    try {
      const saved = localStorage.getItem('water-intake-history')
      if (saved) return JSON.parse(saved) as DayEntry[]
    } catch {}
    return []
  })
  const waveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem('water-intake-history', JSON.stringify(history)) } catch {}
  }, [history])

  useEffect(() => {
    const base = weight * 35
    const activityMultiplier = { sedentary: 1, light: 1.1, moderate: 1.2, intense: 1.3 }
    setGoal(Math.round(base * activityMultiplier[activity]))
  }, [weight, activity])

  const today = localDate(new Date())
  const todayHistory = history.find(h => h.date === today)
  const amount = todayHistory?.amount ?? 0

  const setAmount = (value: number) => {
    setHistory(prev => [...prev.filter(h => h.date !== today), { date: today, amount: value }]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30))
  }

  const addWater = (ml: number) => {
    setAmount(Math.min(goal, amount + ml))
  }

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Weight (kg)</label>
          <input type="number" min={30} max={200} step={0.5} value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Activity Level</label>
          <select value={activity} onChange={e => setActivity(e.target.value as typeof activity)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="intense">Intense</option>
          </select>
        </div>
      </div>

      <div style={{ position: 'relative', width: 200, height: 300, margin: '0 auto 16px' }}>
        <div style={{ position: 'absolute', bottom: 20, left: 50, right: 50, height: 260, border: '3px solid var(--accent)', borderRadius: '0 0 80px 80px', background: 'var(--sunken)', overflow: 'hidden' }}>
          <div
            ref={waveRef}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${goal > 0 ? Math.min(1, amount / goal) * 100 : 0}%`,
              background: 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 60%, transparent))',
              borderRadius: '0 0 77px 77px',
              transition: reducedMotion() ? 'none' : 'height 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </div>
        <div style={{ position: 'absolute', bottom: 20, left: 50, right: 50, height: 260, border: '3px solid var(--accent)', borderRadius: '0 0 80px 80px', pointerEvents: 'none' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', bottom: `${i * 32.5}px`, left: '-20px', right: '-20px', borderTop: '1px dashed var(--border)', fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', paddingTop: '2px' }}>
              {Math.round(goal * (i + 1) / 8)} ml
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {[50, 100, 200, 250, 500].map(ml => (
          <button key={ml} className="btn" onClick={() => addWater(ml)} disabled={amount >= goal}>
            +{ml} ml
          </button>
        ))}
        <button className="btn" onClick={() => setAmount(0)} disabled={amount === 0}>Reset</button>
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{amount}</Roll></b><span className="muted">ml consumed</span></div>
        <div className="stat"><b><Roll>{goal}</Roll></b><span className="muted">ml goal</span></div>
        <div className="stat"><b><Roll>{goal > 0 ? Math.round((amount / goal) * 100) : 0}</Roll>%</b><span className="muted">Complete</span></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Recent History</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {history.slice(-7).reverse().map(h => (
            <div key={h.date} className="stat" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(`${h.date}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}><Roll>{h.amount}</Roll> ml</div>
            </div>
          ))}
        </div>
      </div>

      <Hint>Tap buttons to add water. The glass fills as you drink and resets each day. Goal adjusts by weight and activity.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}