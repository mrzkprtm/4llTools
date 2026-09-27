import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Event {
  id: number
  name: string
  date: string
  color: string
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

export default function EventCountdown() {
  const [events, setEvents] = useState<Event[]>(() => {
    const saved = localStorage.getItem('event-countdown')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'New Year', date: new Date(new Date().getFullYear() + 1, 0, 1).toISOString().split('T')[0], color: COLORS[0] },
    ]
  })

  useEffect(() => {
    try { localStorage.setItem('event-countdown', JSON.stringify(events)) } catch {}
  }, [events])

  const now = useMemo(() => new Date(), [])

  const addEvent = () => {
    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    setEvents([...events, { id: Date.now(), name: `Event ${events.length + 1}`, date: nextYear.toISOString().split('T')[0], color: COLORS[events.length % COLORS.length] }])
  }

  const deleteEvent = (id: number) => {
    setEvents(events.filter(e => e.id !== id))
  }

  const getTimeLeft = (targetDate: string) => {
    const target = new Date(targetDate + 'T23:59:59')
    const diff = target.getTime() - now.getTime()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true, totalDays: 0 }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    const totalDays = diff / (1000 * 60 * 60 * 24)
    return { days, hours, minutes, seconds, past: false, totalDays }
  }

  const getProgress = (targetDate: string) => {
    const target = new Date(targetDate + 'T23:59:59')
    const start = new Date(target)
    start.setFullYear(start.getFullYear() - 1)
    const total = target.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    return Math.max(0, Math.min(100, (elapsed / total) * 100))
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Event Countdown</h3>
        <button className="btn" onClick={addEvent}>+ Add Event</button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {events.map((event, i) => {
          const timeLeft = getTimeLeft(event.date)
          const progress = getProgress(event.date)
          return (
            <div key={event.id} className="pop-row" style={{
              display: 'grid', gap: 12, padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              gridTemplateColumns: 'auto 1fr auto', alignItems: 'center',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
              borderLeft: `4px solid ${event.color}`,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <input type="text" value={event.name} onChange={e => setEvents(events.map(ev => ev.id === event.id ? { ...ev, name: e.target.value } : ev))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem' }} />
                  <input type="color" value={event.color} onChange={e => setEvents(events.map(ev => ev.id === event.id ? { ...ev, color: e.target.value } : ev))} style={{ width: 32, height: 32, border: 'none', borderRadius: '50%', cursor: 'pointer' }} />
                  <input type="date" value={event.date} onChange={e => setEvents(events.map(ev => ev.id === event.id ? { ...ev, date: e.target.value } : ev))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', padding: '4px 8px' }} />
                  <button className="btn" onClick={() => deleteEvent(event.id)} style={{ color: 'var(--danger)', padding: '4px 8px' }}>Delete</button>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: event.color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{Math.round(progress)}% of the year elapsed</span>
              </div>

              <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                {!timeLeft.past && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                      <Roll value={timeLeft.days} style={{ fontSize: '2rem', fontWeight: 700, color: event.color, lineHeight: 1 }} />
                      <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Days</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                      <Roll value={timeLeft.hours} style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }} />
                      <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Hours</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                      <Roll value={timeLeft.minutes} style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--muted)', lineHeight: 1 }} />
                      <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Mins</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
                      <Roll value={timeLeft.seconds} style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--muted)', lineHeight: 1 }} />
                      <span className="muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>Secs</span>
                    </div>
                  </>
                )}
                {timeLeft.past && (
                  <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '1.2rem' }}>Event Passed!</div>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(event.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                {!timeLeft.past && (
                  <div style={{ fontWeight: 600, color: event.color, marginTop: 4 }}>
                    <Roll value={Math.ceil(timeLeft.totalDays)} /> days total
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Countdowns update live. Progress bar shows year progress. All data stored locally.
      </p>
    </div>
  )
}