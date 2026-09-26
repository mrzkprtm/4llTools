import { useState } from 'react'
import { Roll } from '../../motion/Roll'

const ACTIVITIES = [
  { name: 'Walking (3 mph)', met: 3.5 },
  { name: 'Running (6 mph)', met: 10 },
  { name: 'Cycling (12 mph)', met: 8 },
  { name: 'Swimming (moderate)', met: 7 },
  { name: 'Weight lifting', met: 6 },
  { name: 'Yoga', met: 3 },
  { name: 'HIIT', met: 12 },
  { name: 'Dancing', met: 5 },
  { name: 'Gardening', met: 4 },
  { name: 'Cleaning', met: 3.5 },
] as const

const FOOD_EQUIVALENTS = [
  { name: 'Apple', cal: 95 },
  { name: 'Banana', cal: 105 },
  { name: 'Chocolate bar', cal: 220 },
  { name: 'Slice of pizza', cal: 285 },
  { name: 'Burger', cal: 350 },
  { name: 'Bowl of rice', cal: 200 },
] as const

export default function CalorieBurn() {
  const [weight, setWeight] = useState(70)
  const [activityIdx, setActivityIdx] = useState(0)
  const [duration, setDuration] = useState(30)

  const activity = ACTIVITIES[activityIdx]
  const calories = Math.round(activity.met * weight * (duration / 60))

  const foodEquivalents = FOOD_EQUIVALENTS.map(f => ({
    ...f,
    count: Math.round(calories / f.cal * 10) / 10,
  }))

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Weight (kg)</label>
          <input type="number" min={30} max={200} step={0.5} value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Activity</label>
          <select value={activityIdx} onChange={e => setActivityIdx(Number(e.target.value))}>
            {ACTIVITIES.map((a, i) => <option key={a.name} value={i}>{a.name} (MET {a.met})</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Duration (minutes)</label>
          <input type="number" min={1} max={480} step={1} value={duration} onChange={e => setDuration(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{calories}</Roll></b><span className="muted">Calories Burned</span></div>
        <div className="stat"><b><Roll>{Math.round(calories / 7700 * 1000) / 1000}</Roll></b><span className="muted">kg Fat Equivalent</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Food Equivalents (≈ {calories} kcal)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {foodEquivalents.map(f => (
            <div key={f.name} className="pop-row" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            }}>
              <span style={{ fontWeight: 600 }}>{f.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent)' }}><Roll>{f.count}</Roll>×</span>
              <span className="muted" style={{ fontSize: '0.75rem' }}>{f.cal} kcal each</span>
            </div>
          ))}
        </div>
      </div>

      <Hint>Select activity, enter weight and duration. See calories burned and food equivalents. Based on MET values.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}