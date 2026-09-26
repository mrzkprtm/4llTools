import { useState } from 'react'
import { Roll } from '../../motion/Roll'

export default function MacroCalculator() {
  const [weight, setWeight] = useState(70)
  const [height, setHeight] = useState(175)
  const [age, setAge] = useState(30)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [activity, setActivity] = useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very'>('moderate')
  const [goal, setGoal] = useState<'cut' | 'maintain' | 'bulk'>('maintain')

  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  const activityMultiplier = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 }
  const tdee = Math.round(bmr * activityMultiplier[activity])

  const goalMultiplier = { cut: 0.85, maintain: 1, bulk: 1.15 }
  const targetCalories = Math.round(tdee * goalMultiplier[goal])

  const proteinRatio = goal === 'cut' ? 0.35 : goal === 'bulk' ? 0.3 : 0.25
  const fatRatio = 0.25
  const carbRatio = 1 - proteinRatio - fatRatio

  const proteinG = Math.round(targetCalories * proteinRatio / 4)
  const fatG = Math.round(targetCalories * fatRatio / 9)
  const carbG = Math.round(targetCalories * carbRatio / 4)

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Weight (kg)</label>
          <input type="number" min={30} max={200} step={0.5} value={weight} onChange={e => setWeight(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Height (cm)</label>
          <input type="number" min={100} max={250} value={height} onChange={e => setHeight(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Age</label>
          <input type="number" min={10} max={100} value={age} onChange={e => setAge(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Gender</label>
          <select value={gender} onChange={e => setGender(e.target.value as any)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Activity</label>
          <select value={activity} onChange={e => setActivity(e.target.value as any)}>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="active">Active</option>
            <option value="very">Very Active</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Goal</label>
          <select value={goal} onChange={e => setGoal(e.target.value as any)}>
            <option value="cut">Cut (Lose Fat)</option>
            <option value="maintain">Maintain</option>
            <option value="bulk">Bulk (Gain Muscle)</option>
          </select>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{Math.round(bmr)}</Roll></b><span className="muted">BMR</span></div>
        <div className="stat"><b><Roll>{tdee}</Roll></b><span className="muted">TDEE</span></div>
        <div className="stat"><b><Roll>{targetCalories}</Roll></b><span className="muted">Target</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Macro Split</h4>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div className="pop-row" style={{
            flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>Protein</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}><Roll>{proteinG}</Roll>g</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{Math.round(proteinRatio * 100)}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{proteinG * 4} kcal</div>
          </div>
          <div className="pop-row" style={{
            flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
            background: 'color-mix(in srgb, var(--ok) 10%, transparent)', border: '1px solid var(--ok)', borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--ok)', fontWeight: 600, textTransform: 'uppercase' }}>Carbs</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--ok)' }}><Roll>{carbG}</Roll>g</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{Math.round(carbRatio * 100)}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{carbG * 4} kcal</div>
          </div>
          <div className="pop-row" style={{
            flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16,
            background: 'color-mix(in srgb, #eab308 10%, transparent)', border: '1px solid #eab308', borderRadius: 'var(--radius)',
          }}>
            <div style={{ fontSize: '0.75rem', color: '#eab308', fontWeight: 600, textTransform: 'uppercase' }}>Fat</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '2rem', fontWeight: 700, color: '#eab308' }}><Roll>{fatG}</Roll>g</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{Math.round(fatRatio * 100)}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{fatG * 9} kcal</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Daily Targets</h4>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div className="stat"><b><Roll>{targetCalories}</Roll></b><span className="muted">Calories</span></div>
          <div className="stat"><b><Roll>{proteinG}</Roll>g</b><span className="muted">Protein</span></div>
          <div className="stat"><b><Roll>{carbG}</Roll>g</b><span className="muted">Carbs</span></div>
          <div className="stat"><b><Roll>{fatG}</Roll>g</b><span className="muted">Fat</span></div>
        </div>
      </div>

      <Hint>Adjust weight, activity, and goal. Plate sections animate live. Protein higher for cut, carbs higher for bulk.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}