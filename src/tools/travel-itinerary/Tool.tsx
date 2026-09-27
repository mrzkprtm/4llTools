import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Activity {
  id: number
  day: number
  time: string
  title: string
  location: string
  notes: string
  color: string
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

export default function TravelItinerary() {
  const [tripName, setTripName] = useState(() => {
    const saved = localStorage.getItem('travel-itinerary-name')
    return saved || 'My Trip'
  })
  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem('travel-itinerary-start')
    return saved || new Date().toISOString().split('T')[0]
  })
  const [days, setDays] = useState(() => {
    const saved = localStorage.getItem('travel-itinerary-days')
    return saved ? Number(saved) : 5
  })
  const [activities, setActivities] = useState<Activity[]>(() => {
    const saved = localStorage.getItem('travel-itinerary')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => { try { localStorage.setItem('travel-itinerary-name', tripName) } catch {} }, [tripName])
  useEffect(() => { try { localStorage.setItem('travel-itinerary-start', startDate) } catch {} }, [startDate])
  useEffect(() => { try { localStorage.setItem('travel-itinerary-days', String(days)) } catch {} }, [days])
  useEffect(() => { try { localStorage.setItem('travel-itinerary', JSON.stringify(activities)) } catch {} }, [activities])

  const addActivity = (day: number) => {
    setActivities([...activities, { id: Date.now(), day, time: '09:00', title: 'New Activity', location: '', notes: '', color: COLORS[activities.length % COLORS.length] }])
  }

  const removeActivity = (id: number) => {
    setActivities(activities.filter(a => a.id !== id))
  }

  const updateActivity = (id: number, field: string, value: string) => {
    setActivities(activities.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const moveActivity = (id: number, newDay: number) => {
    updateActivity(id, 'day', newDay)
  }

  const daysArray = useMemo(() => Array.from({ length: days }, (_, i) => i + 1), [days])

  const activitiesByDay = useMemo(() => {
    const grouped: Record<number, Activity[]> = {}
    daysArray.forEach(d => { grouped[d] = [] })
    activities.forEach(a => { if (grouped[a.day]) grouped[a.day].push(a) })
    Object.keys(grouped).forEach(d => {
      grouped[Number(d)].sort((a, b) => a.time.localeCompare(b.time))
    })
    return grouped
  }, [activities, daysArray])

  const exportJSON = () => {
    const data = { tripName, startDate, days, activities }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tripName.replace(/\s+/g, '-')}-itinerary.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatDate = (dayNum: number) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + dayNum - 1)
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <input type="text" value={tripName} onChange={e => setTripName(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, width: 250 }} />
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted">Start:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: 140 }} />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted">Days:</span>
              <input type="number" min={1} max={30} value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 60 }} />
            </label>
            <button className="btn" onClick={exportJSON}>Export JSON</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {daysArray.map((day, di) => {
          const dayActivities = activitiesByDay[day] || []
          return (
            <details key={day} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', minWidth: 40 }}>Day {day}</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDate(day)}</span>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="muted">{dayActivities.length} activities</span>
                  <button className="btn" onClick={() => addActivity(day)} style={{ padding: '6px 12px' }}>+ Add</button>
                </div>
              </summary>
              <div style={{ padding: '0 16 16' }}>
                {dayActivities.length === 0 ? (
                  <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No activities yet. Click + Add to start planning.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {dayActivities.map((activity, ai) => (
                      <div key={activity.id} className="pop-row" style={{
                        display: 'grid', gap: 8, padding: 12,
                        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        borderLeft: `4px solid ${activity.color}`,
                        animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                        animationDelay: `${ai * 40}ms`,
                      }}>
                        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input type="time" value={activity.time} onChange={e => updateActivity(activity.id, 'time', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontFamily: 'var(--mono)', fontWeight: 600, width: 100 }} />
                          <input type="text" placeholder="Title" value={activity.title} onChange={e => updateActivity(activity.id, 'title', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, flex: 1, minWidth: 200 }} />
                          <input type="text" placeholder="Location" value={activity.location} onChange={e => updateActivity(activity.id, 'location', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', flex: 1, minWidth: 150 }} />
                          <select value={activity.day} onChange={e => moveActivity(activity.id, Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', width: 100 }}>
                            {daysArray.map(d => <option key={d} value={d}>Day {d}</option>)}
                          </select>
                          <button className="btn" onClick={() => removeActivity(activity.id)} style={{ color: 'var(--danger)', padding: '6px 12px' }}>Delete</button>
                        </div>
                        <textarea
                          placeholder="Notes..."
                          value={activity.notes}
                          onChange={e => updateActivity(activity.id, 'notes', e.target.value)}
                          rows={1}
                          style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', width: '100%', fontSize: '0.85rem', padding: 8, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <h4 style={{ margin: '0 0 12px' }}>Quick Summary</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div className="stat"><b><Roll value={days} /></b><span className="muted">Days</span></div>
          <div className="stat"><b><Roll value={activities.length} /></b><span className="muted">Total Activities</span></div>
          <div className="stat"><b><Roll value={daysArray.reduce((sum, d) => sum + (activitiesByDay[d]?.length || 0), 0)} /></b><span className="muted">Avg/Day</span></div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Build your day-by-day itinerary. Drag not implemented - use Day dropdown to move activities. Export as JSON for backup/sharing.
      </p>
    </div>
  )
}