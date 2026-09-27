import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Entry {
  id: number
  date: string
  project: string
  client: string
  task: string
  startTime: string
  endTime: string
  hours: number
  billable: boolean
  description: string
}

interface Project {
  id: number
  name: string
  client: string
  rate: number
  color: string
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

export default function Timesheet() {
  const [entries, setEntries] = useState<Entry[]>(() => {
    const saved = localStorage.getItem('timesheet')
    return saved ? JSON.parse(saved) : []
  })
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('timesheet-projects')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Website Redesign', client: 'Acme Corp', rate: 100, color: COLORS[0] },
      { id: 2, name: 'Mobile App', client: 'StartupXYZ', rate: 120, color: COLORS[1] },
      { id: 3, name: 'API Integration', client: 'Enterprise Inc', rate: 110, color: COLORS[2] },
    ]
  })
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toISOString().split('T')[0]
  })
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [newEntry, setNewEntry] = useState({ projectId: 0, date: '', task: '', startTime: '09:00', endTime: '17:00', billable: true, description: '' })
  const [newProject, setNewProject] = useState({ name: '', client: '', rate: 100, color: COLORS[0] })

  useEffect(() => {
    try { localStorage.setItem('timesheet', JSON.stringify(entries)) } catch {}
  }, [entries])
  useEffect(() => {
    try { localStorage.setItem('timesheet-projects', JSON.stringify(projects)) } catch {}
  }, [projects])

  const weekStart = useMemo(() => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() - d.getDay() + 1)
    return d
  }, [viewDate])

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [weekStart])

  const weekEntries = useMemo(() => {
    return entries.filter(e => weekDates.includes(e.date))
  }, [entries, weekDates])

  const addEntry = () => {
    if (!newEntry.projectId || !newEntry.date || !newEntry.task) return
    const project = projects.find(p => p.id === newEntry.projectId)
    if (!project) return

    const start = new Date(`2000-01-01T${newEntry.startTime}`)
    const end = new Date(`2000-01-01T${newEntry.endTime}`)
    const hours = (end.getTime() - start.getTime()) / 3600000

    setEntries([...entries, { ...newEntry, id: Date.now(), hours }])
    setNewEntry({ projectId: 0, date: '', task: '', startTime: '09:00', endTime: '17:00', billable: true, description: '' })
  }

  const removeEntry = (id: number) => {
    setEntries(entries.filter(e => e.id !== id))
  }

  const addProject = () => {
    if (!newProject.name.trim() || !newProject.client.trim()) return
    setProjects([...projects, { ...newProject, id: Date.now() }])
    setNewProject({ name: '', client: '', rate: 100, color: COLORS[projects.length % COLORS.length] })
  }

  const removeProject = (id: number) => {
    setProjects(projects.filter(p => p.id !== id))
  }

  const getDayEntries = (date: string) => {
    return entries.filter(e => e.date === date)
  }

  const dayTotals = useMemo(() => {
    const totals: Record<string, { hours: number; billable: number; earnings: number }> = {}
    weekDates.forEach(d => {
      const dayEntries = getDayEntries(d)
      totals[d] = dayEntries.reduce((sum, e) => ({
        hours: sum.hours + e.hours,
        billable: sum.billable + (e.billable ? e.hours : 0),
        earnings: sum.earnings + (e.billable ? e.hours * projects.find(p => p.name === e.project)?.rate || 0 : 0)
      }), { hours: 0, billable: 0, earnings: 0 })
    })
    return totals
  }, [entries, weekDates])

  const weeklyHours = weekEntries.reduce((sum, e) => sum + e.hours, 0)
  const weeklyBillable = weekEntries.filter(e => e.billable).reduce((sum, e) => sum + e.hours, 0)
  const weeklyEarnings = weekEntries.filter(e => e.billable).reduce((sum, e) => sum + e.hours * (projects.find(p => p.name === e.project)?.rate || 0), 0)

  const formatTime = (time: string) => time.slice(0, 5)
  const formatDay = (date: string) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const exportCSV = () => {
    const headers = ['Date', 'Project', 'Client', 'Task', 'Start', 'End', 'Hours', 'Billable', 'Description', 'Rate', 'Earnings']
    const rows = entries.map(e => {
      const project = projects.find(p => p.name === e.project)
      return [
        e.date, e.project, e.client, e.task, e.startTime, e.endTime,
        e.hours.toFixed(2), e.billable ? 'Yes' : 'No', e.description,
        project?.rate || 0, (e.billable ? e.hours * (project?.rate || 0) : 0).toFixed(2)
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Timesheet</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setViewDate((new Date(new Date(viewDate).getTime() - 7 * 86400000)).toISOString().split('T')[0])}>← Prev Week</button>
          <span style={{ fontWeight: 600, minWidth: 250, textAlign: 'center' }}>
            {new Date(viewDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <button className="btn" onClick={() => setViewDate((new Date(new Date(viewDate).getTime() + 7 * 86400000)).toISOString().split('T')[0])}>Next Week →</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => { setViewMode('week'); setViewDate(new Date().toISOString().split('T')[0]) }} style={{ background: viewMode === 'week' ? 'var(--accent)' : 'var(--bg)' }}>Week</button>
          <button className="btn" onClick={() => setViewMode('month')} style={{ background: viewMode === 'month' ? 'var(--accent)' : 'var(--bg)' }}>Month</button>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={weeklyHours.toFixed(1)} /></b><span className="muted">Total Hours</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={weeklyBillable.toFixed(1)} /></b><span className="muted">Billable</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(weeklyEarnings)} /></b><span className="muted">Earnings</span></div>
        <div className="stat"><b><Roll value={weekEntries.length} /></b><span className="muted">Entries</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Time Entry
            <button className="btn" onClick={addEntry} disabled={!newEntry.projectId || !newEntry.date || !newEntry.task} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <select value={newEntry.projectId} onChange={e => setNewEntry({ ...newEntry, projectId: Number(e.target.value) })} style={{ flex: 1, minWidth: 200 }}>
                <option value={0}>Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name} ({p.client}) - $${p.rate}/hr</option>)}
              </select>
              <input type="date" value={newEntry.date} onChange={e => setNewEntry({ ...newEntry, date: e.target.value })} style={{ width: 120 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Task description" value={newEntry.task} onChange={e => setNewEntry({ ...newEntry, task: e.target.value })} style={{ flex: 1 }} />
              <input type="time" value={newEntry.startTime} onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })} style={{ width: 100 }} />
              <input type="time" value={newEntry.endTime} onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })} style={{ width: 100 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={newEntry.billable} onChange={e => setNewEntry({ ...newEntry, billable: e.target.checked })} />
                <span>Billable</span>
              </label>
              <input type="text" placeholder="Description/Notes" value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} style={{ flex: 1 }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {weekDates.map((date, di) => {
            const dayEntries = getDayEntries(date)
            const totals = dayTotals[date]
            const isToday = date === new Date().toISOString().split('T')[0]
            return (
              <details key={date} defaultOpen={di === 0 || dayEntries.length > 0} style={{ background: 'var(--sunken)', border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <summary style={{ padding: 12, background: isToday ? 'var(--accent)20' : 'var(--bg)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatDay(date)}</span>
                    {isToday && <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--accent)', color: 'white', borderRadius: 4 }}>TODAY</span>}
                  </div>
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                    <span className="muted">{totals.hours.toFixed(1)}h total</span>
                    <span style={{ color: 'var(--ok)' }}>{totals.billable.toFixed(1)}h billable</span>
                    <span style={{ color: 'var(--accent)' }}>{fmt(totals.earnings)}</span>
                    <span className="muted">{dayEntries.length} entries</span>
                  </div>
                </summary>
                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                  {dayEntries.length === 0 ? (
                    <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No entries for this day</p>
                  ) : (
                    dayEntries.map((entry, i) => (
                      <div key={entry.id} className="pop-row" style={{
                        display: 'grid', gridTemplateColumns: '60px 1fr 80px 60px 100px 80px 50px', gap: 8, padding: 8,
                        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                        animationDelay: `${i * 30}ms`,
                      }}>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center' }}>
                          {entry.startTime.slice(0,5)}–{entry.endTime.slice(0,5)}
                        </span>
                        <div>
                          <div style={{ fontWeight: 500 }}>{entry.task}</div>
                          <div className="muted" style={{ fontSize: '0.8rem' }}>{entry.description}</div>
                        </div>
                        <span style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{entry.hours.toFixed(2)}h</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={entry.billable} onChange={e => setEntries(entries.map(e2 => e2.id === entry.id ? { ...e2, billable: e.target.checked } : e2))} disabled />
                          <span className="muted" style={{ fontSize: '0.75rem' }}>{entry.billable ? 'Billable' : 'Internal'}</span>
                        </label>
                        <span style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>$${(entry.hours * (projects.find(p => p.name === entry.project)?.rate || 0)).toFixed(2)}</span>
                        <button className="btn" onClick={() => removeEntry(entry.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                      </div>
                    ))
                  )}
                </div>
              </details>
            )
          })}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Projects</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {projects.map((project, i) => (
              <div key={project.id} className="pop-row" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                borderLeft: `4px solid ${project.color}`,
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 60}ms`,
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{project.name}</div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>{project.client} • ${project.rate}/hr</div>
                </div>
                <button className="btn" onClick={() => removeProject(project.id)} style={{ color: 'var(--danger)', padding: '4px 8px', fontSize: '0.8rem' }}>Remove</button>
              </div>
            ))}
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <h4 style={{ margin: '0 0 8px' }}>Add Project</h4>
              <div className="row" style={{ gap: 8 }}>
                <input type="text" placeholder="Project Name" value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} style={{ flex: 1 }} />
                <input type="text" placeholder="Client" value={newProject.client} onChange={e => setNewProject({ ...newProject, client: e.target.value })} style={{ flex: 1 }} />
                <input type="number" min={0} step={5} placeholder="Rate/hr" value={newProject.rate} onChange={e => setNewProject({ ...newProject, rate: Number(e.target.value) })} style={{ width: 100 }} />
                <select value={newProject.color} onChange={e => setNewProject({ ...newProject, color: e.target.value })} style={{ width: 80 }}>
                  {COLORS.map(c => <option key={c} value={c} style={{ color: c }}>{c}</option>)}
                </select>
                <button className="btn" onClick={addProject} style={{ justifySelf: 'start' }}>Add Project</button>
              </div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Log hours by project. Tracks billable vs non-billable hours and earnings. Export to CSV for payroll. Weekly view with day breakdown.
        </p>
      </div>
    </div>
  )
}