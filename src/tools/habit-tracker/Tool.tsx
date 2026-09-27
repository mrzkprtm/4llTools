import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const DAYS = 49

export default function HabitTracker() {
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('habit-tracker')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Exercise', color: '#e11d48' },
      { id: 2, name: 'Read 20 min', color: '#2563eb' },
      { id: 3, name: 'Meditate', color: '#16a34a' },
    ]
  })

  useEffect(() => {
    try { localStorage.setItem('habit-tracker', JSON.stringify(habits)) } catch {}
  }, [habits])

  const today = new Date()
  today.setHours(0,0,0,0)

  const addHabit = () => {
    const colors = ['#e11d48','#2563eb','#16a34a','#ca8a04','#9333ea','#0891b2','#db2777']
    setHabits([...habits, { id: Date.now(), name: `Habit ${habits.length + 1}`, color: colors[habits.length % colors.length] }])
  }

  const toggleDay = (habitId: number, dayOffset: number) => {
    setHabits(habits.map(h => {
      if (h.id !== habitId) return h
      const key = `d${dayOffset}`
      const newCompleted = { ...h.completed, [key]: !h.completed?.[key] }
      return { ...h, completed: newCompleted }
    }))
  }

  const getStreak = (completed: Record<string, boolean>) => {
    let streak = 0
    for (let i = 0; i < DAYS; i++) {
      if (completed[`d${i}`]) streak++
      else break
    }
    return streak
  }

  const getLongestStreak = (completed: Record<string, boolean>) => {
    let max = 0, current = 0
    for (let i = 0; i < DAYS; i++) {
      if (completed[`d${i}`]) { current++; max = Math.max(max, current) }
      else current = 0
    }
    return max
  }

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      arr.push({ offset: i, date: d, label: d.getDate(), isToday: i === 0, isWeekend: d.getDay() === 0 || d.getDay() === 6 })
    }
    return arr
  }, [])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Habit Tracker</h3>
        <button className="btn" onClick={addHabit}>+ Add Habit</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr>
              <th style={{ width: 160, textAlign: 'left', padding: '8px 12px' }}>Habit</th>
              {days.map(d => (
                <th key={d.offset} style={{ width: 36, textAlign: 'center', padding: '4px', fontSize: '0.7rem', color: d.isWeekend ? 'var(--danger)' : 'var(--muted)' }}>
                  {d.label}
                </th>
              ))}
              <th style={{ width: 80, textAlign: 'center', padding: '8px 12px', fontSize: '0.8rem' }}>Streak</th>
              <th style={{ width: 100, textAlign: 'center', padding: '8px 12px', fontSize: '0.8rem' }}>Best</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((habit, hi) => (
              <tr key={habit.id} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${hi * 60}ms` }}>
                <td style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: habit.color }} />
                  <input type="text" value={habit.name} onChange={e => setHabits(habits.map(h => h.id === habit.id ? { ...h, name: e.target.value } : h))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, width: 120 }} />
                  <button className="btn" onClick={() => setHabits(habits.filter(h => h.id !== habit.id))} style={{ padding: '2px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                </td>
                {days.map(d => (
                  <td key={d.offset} style={{ textAlign: 'center', padding: 4 }}>
                    <button
                      onClick={() => toggleDay(habit.id, d.offset)}
                      style={{
                        width: 28, height: 28, borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: habit.completed?.[`d${d.offset}`] ? habit.color : (d.isWeekend ? 'rgba(239,68,68,0.1)' : 'var(--sunken)'),
                        boxShadow: habit.completed?.[`d${d.offset}`] ? `0 0 0 2px ${habit.color}40` : 'none',
                        transition: 'transform 0.15s, background 0.15s',
                      }}
                      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)' }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      {habit.completed?.[`d${d.offset}`] && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
                    </button>
                  </td>
                ))}
                <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>
                  <Roll value={getStreak(habit.completed || {})} />
                </td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--muted)' }}>
                  <Roll value={getLongestStreak(habit.completed || {})} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Click a day to toggle. Streak counts consecutive days from today backwards. Data saved locally.
      </p>
    </div>
  )
}