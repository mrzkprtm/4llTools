import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Subject {
  id: number
  name: string
  color: string
  goalHours: number
}

interface Session {
  id: number
  subjectId: number
  date: string
  startTime: string
  endTime: string
  topic: string
  completed: boolean
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function StudyPlanner() {
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:study-planner')
      if (saved) return (JSON.parse(saved) as { subjects: Subject[] }).subjects
    } catch {}
    return [
      { id: 1, name: 'Math', color: COLORS[0], goalHours: 5 },
      { id: 2, name: 'Physics', color: COLORS[1], goalHours: 4 },
      { id: 3, name: 'Chemistry', color: COLORS[2], goalHours: 3 },
    ]
  })
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:study-planner')
      if (saved) return (JSON.parse(saved) as { sessions: Session[] }).sessions
    } catch {}
    return []
  })
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toISOString().split('T')[0]
  })
  const [newSubject, setNewSubject] = useState({ name: '', color: COLORS[0], goalHours: 5 })
  const [newSession, setNewSession] = useState({ subjectId: 0, date: '', startTime: '09:00', endTime: '11:00', topic: '' })

  useEffect(() => {
    try { localStorage.setItem('4lltools:study-planner', JSON.stringify({ subjects, sessions })) } catch {}
  }, [subjects, sessions])

  const addSubject = () => {
    if (!newSubject.name.trim()) return
    setSubjects([...subjects, { ...newSubject, id: Date.now() }])
    setNewSubject({ name: '', color: COLORS[subjects.length % COLORS.length], goalHours: 5 })
  }

  const removeSubject = (id: number) => {
    setSubjects(subjects.filter(s => s.id !== id))
    setSessions(sessions.filter(s => s.subjectId !== id))
  }

  const addSession = () => {
    if (!newSession.subjectId || !newSession.date) return
    setSessions([...sessions, { ...newSession, id: Date.now(), completed: false }])
    setNewSession({ ...newSession, topic: '' })
  }

  const removeSession = (id: number) => {
    setSessions(sessions.filter(s => s.id !== id))
  }

  const toggleComplete = (id: number) => {
    setSessions(sessions.map(s => s.id === id ? { ...s, completed: !s.completed } : s))
  }

  const weekDates = useMemo(() => {
    const start = new Date(weekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [weekStart])

  const sessionsByDay = useMemo(() => {
    const grouped: Record<string, Session[]> = {}
    weekDates.forEach(d => grouped[d] = [])
    sessions.forEach(s => {
      if (grouped[s.date]) grouped[s.date].push(s)
    })
    Object.keys(grouped).forEach(d => grouped[d].sort((a, b) => a.startTime.localeCompare(b.startTime)))
    return grouped
  }, [sessions, weekDates])

  const subjectStats = useMemo(() => {
    return subjects.map(subj => {
      const subjSessions = sessions.filter(s => s.subjectId === subj.id)
      const totalHours = subjSessions.reduce((sum, s) => {
        const start = new Date(`2000-01-01T${s.startTime}`)
        const end = new Date(`2000-01-01T${s.endTime}`)
        return sum + (end.getTime() - start.getTime()) / 3600000
      }, 0)
      const completedHours = subjSessions.filter(s => s.completed).reduce((sum, s) => {
        const start = new Date(`2000-01-01T${s.startTime}`)
        const end = new Date(`2000-01-01T${s.endTime}`)
        return sum + (end.getTime() - start.getTime()) / 3600000
      }, 0)
      return { ...subj, totalHours, completedHours, progress: subj.goalHours > 0 ? Math.min(100, (completedHours / subj.goalHours) * 100) : 0 }
    })
  }, [subjects, sessions])

  const weekTotalHours = sessionsByDay[weekDates[0]]?.reduce((sum, s) => {
    const start = new Date(`2000-01-01T${s.startTime}`)
    const end = new Date(`2000-01-01T${s.endTime}`)
    return sum + (end.getTime() - start.getTime()) / 3600000
  }, 0) || 0

  const weekCompletedHours = sessionsByDay[weekDates[0]]?.filter(s => s.completed).reduce((sum, s) => {
    const start = new Date(`2000-01-01T${s.startTime}`)
    const end = new Date(`2000-01-01T${s.endTime}`)
    return sum + (end.getTime() - start.getTime()) / 3600000
  }, 0) || 0

  const formatTime = (time: string) => time.slice(0, 5)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Study Planner</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() - 7 * 86400000)).toISOString().split('T')[0])}>← Prev</button>
          <span style={{ fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
            {new Date(weekStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() + 7 * 86400000)).toISOString().split('T')[0])}>Next →</button>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={subjectStats.reduce((s, subj) => s + subj.completedHours, 0).toFixed(1)} /></b><span className="muted">Hrs Done</span></div>
        <div className="stat"><b><Roll value={subjectStats.reduce((s, subj) => s + subj.goalHours, 0)} /></b><span className="muted">Weekly Goal</span></div>
        <div className="stat"><b><Roll value={sessions.filter(s => s.completed).length} /></b><span className="muted">Sessions Done</span></div>
        <div className="stat"><b><Roll value={sessions.length} /></b><span className="muted">Total Sessions</span></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Subjects</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {subjects.map((subj, i) => {
                const stats = subjectStats.find(st => st.id === subj.id)
                const progress = stats?.progress ?? 0
                const completedHours = stats?.completedHours ?? 0
                return (
                <div key={subj.id} className="pop-row" style={{
                  padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  borderLeft: `4px solid ${subj.color}`,
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 60}ms`,
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: subj.color }} />
                      <input type="text" value={subj.name} onChange={e => setSubjects(subjects.map(s => s.id === subj.id ? { ...s, name: e.target.value } : s))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, width: 100 }} />
                    </div>
                    <button className="btn" onClick={() => removeSubject(subj.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="muted" style={{ fontSize: '0.7rem' }}>Goal (hrs)</span>
                      <input type="number" min={0} max={50} step={0.5} value={subj.goalHours} onChange={e => setSubjects(subjects.map(s => s.id === subj.id ? { ...s, goalHours: Number(e.target.value) } : s))} style={{ width: 60 }} />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, flex: 1, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: subj.color, borderRadius: 3 }} />
                      </div>
                      <span className="muted" style={{ fontSize: '0.7rem', minWidth: 40, textAlign: 'right' }}>{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    {completedHours.toFixed(1)} / {subj.goalHours}h completed
                  </div>
                </div>
                )
              })}
              <button className="btn" onClick={addSubject} style={{ marginTop: 8 }}>+ Add Subject</button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Add Session</h4>
            <div style={{ display: 'grid', gap: 8, padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div className="row" style={{ gap: 8 }}>
                <select value={newSession.subjectId} onChange={e => setNewSession({ ...newSession, subjectId: Number(e.target.value) })} style={{ flex: 1 }}>
                  <option value={0}>Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input type="date" value={newSession.date} onChange={e => setNewSession({ ...newSession, date: e.target.value })} style={{ width: 120 }} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input type="time" value={newSession.startTime} onChange={e => setNewSession({ ...newSession, startTime: e.target.value })} style={{ flex: 1 }} />
                <input type="time" value={newSession.endTime} onChange={e => setNewSession({ ...newSession, endTime: e.target.value })} style={{ flex: 1 }} />
              </div>
              <input type="text" placeholder="Topic / Notes" value={newSession.topic} onChange={e => setNewSession({ ...newSession, topic: e.target.value })} />
              <button className="btn" onClick={addSession} style={{ justifySelf: 'start' }}>Add Session</button>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ marginBottom: 12 }}>Weekly Calendar</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weekDates.map((date, di) => {
              const daySessions = sessionsByDay[date] || []
              const isToday = date === new Date().toISOString().split('T')[0]
              return (
                <div key={date} style={{
                  background: 'var(--sunken)', border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius)',
                  minHeight: 400, display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ padding: 8, background: isToday ? 'var(--accent)20' : 'var(--bg)', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius) var(--radius) 0 0', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{DAYS[di]}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{new Date(date).getDate()}</div>
                  </div>
                  <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
                    {daySessions.length === 0 ? (
                      <p className="muted" style={{ textAlign: 'center', padding: '20px 0', fontSize: '0.8rem' }}>No sessions</p>
                    ) : (
                      daySessions.map((session, si) => {
                        const subject = subjects.find(s => s.id === session.subjectId)
                        const start = new Date(`2000-01-01T${session.startTime}`)
                        const end = new Date(`2000-01-01T${session.endTime}`)
                        const hours = ((end.getTime() - start.getTime()) / 3600000).toFixed(1)
                        return (
                          <div key={session.id} className="pop-row" style={{
                            marginBottom: 8, padding: 8,
                            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            borderLeft: subject ? `3px solid ${subject.color}` : '3px solid transparent',
                            opacity: session.completed ? 0.6 : 1,
                            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                            animationDelay: `${si * 40}ms`,
                          }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                              <input type="checkbox" checked={session.completed} onChange={() => toggleComplete(session.id)} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatTime(session.startTime)} – {formatTime(session.endTime)} ({hours}h)
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {session.topic || subject?.name}
                                </div>
                              </div>
                              <button onClick={() => removeSession(session.id)} style={{ color: 'var(--danger)', padding: '2px 6px', fontSize: '0.7rem' }}>✕</button>
                            </label>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Plan study sessions by subject with time blocks. Track completion and progress toward weekly goals. Drag not implemented - use date picker.
      </p>
    </div>
  )
}