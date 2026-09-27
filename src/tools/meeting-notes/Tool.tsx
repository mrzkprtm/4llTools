import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Attendee {
  id: number
  name: string
  role: string
  present: boolean
}

interface AgendaItem {
  id: number
  title: string
  description: string
  owner: string
  duration: number
}

interface ActionItem {
  id: number
  description: string
  assignee: string
  dueDate: string
  status: 'open' | 'in-progress' | 'done'
  priority: 'high' | 'medium' | 'low'
}

interface Decision {
  id: number
  description: string
  decidedBy: string
  date: string
}

interface Meeting {
  id: number
  title: string
  date: string
  time: string
  duration: number
  location: string
  attendees: Attendee[]
  agenda: AgendaItem[]
  notes: string
  actionItems: ActionItem[]
  decisions: Decision[]
  created: string
}

export default function MeetingNotes() {
  const [meetings, setMeetings] = useState<Meeting[]>(() => {
    const saved = localStorage.getItem('meeting-notes')
    return saved ? JSON.parse(saved) : []
  })
  const [activeMeetingId, setActiveMeetingId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list')
  const [newMeeting, setNewMeeting] = useState({ title: '', date: new Date().toISOString().split('T')[0], time: '09:00', duration: 60, location: '' })

  useEffect(() => {
    try { localStorage.setItem('meeting-notes', JSON.stringify(meetings)) } catch {}
  }, [meetings])

  const createMeeting = () => {
    if (!newMeeting.title.trim()) return
    const meeting: Meeting = {
      id: Date.now(),
      ...newMeeting,
      attendees: [],
      agenda: [],
      notes: '',
      actionItems: [],
      decisions: [],
      created: new Date().toISOString(),
    }
    setMeetings([...meetings, meeting])
    setActiveMeetingId(meeting.id)
    setViewMode('editor')
    setNewMeeting({ title: '', date: new Date().toISOString().split('T')[0], time: '09:00', duration: 60, location: '' })
  }

  const deleteMeeting = (id: number) => {
    setMeetings(meetings.filter(m => m.id !== id))
    if (activeMeetingId === id) setActiveMeetingId(null)
  }

  const addAttendee = (meetingId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, attendees: [...m.attendees, { id: Date.now(), name: '', role: '', present: true }] } : m))
  }

  const removeAttendee = (meetingId: number, attendeeId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, attendees: m.attendees.filter(a => a.id !== attendeeId) } : m))
  }

  const updateAttendee = (meetingId: number, attendeeId: number, field: string, value: string | boolean) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, attendees: m.attendees.map(a => a.id === attendeeId ? { ...a, [field]: value } : a) } : m))
  }

  const addAgendaItem = (meetingId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, agenda: [...m.agenda, { id: Date.now(), title: '', description: '', owner: '', duration: 15 }] } : m))
  }

  const removeAgendaItem = (meetingId: number, itemId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, agenda: m.agenda.filter(a => a.id !== itemId) } : m))
  }

  const updateAgendaItem = (meetingId: number, itemId: number, field: string, value: string | number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, agenda: m.agenda.map(a => a.id === itemId ? { ...a, [field]: value } : a) } : m))
  }

  const addActionItem = (meetingId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, actionItems: [...m.actionItems, { id: Date.now(), description: '', assignee: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], status: 'open', priority: 'medium' }] } : m))
  }

  const removeActionItem = (meetingId: number, itemId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, actionItems: m.actionItems.filter(a => a.id !== itemId) } : m))
  }

  const updateActionItem = (meetingId: number, itemId: number, field: string, value: string) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, actionItems: m.actionItems.map(a => a.id === itemId ? { ...a, [field]: value } : a) } : m))
  }

  const addDecision = (meetingId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, decisions: [...m.decisions, { id: Date.now(), description: '', decidedBy: '', date: new Date().toISOString().split('T')[0] }] } : m))
  }

  const removeDecision = (meetingId: number, decisionId: number) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, decisions: m.decisions.filter(d => d.id !== decisionId) } : m))
  }

  const updateDecision = (meetingId: number, decisionId: number, field: string, value: string) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, decisions: m.decisions.map(d => d.id === decisionId ? { ...d, [field]: value } : d) } : m))
  }

  const updateMeeting = (id: number, field: string, value: string | number) => {
    setMeetings(meetings.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const updateNotes = (meetingId: number, notes: string) => {
    setMeetings(meetings.map(m => m.id === meetingId ? { ...m, notes } : m))
  }

  const exportMarkdown = (meeting: Meeting) => {
    const lines = [
      `# ${meeting.title}`,
      `**Date:** ${meeting.date} | **Time:** ${meeting.time} | **Duration:** ${meeting.duration} min`,
      `**Location:** ${meeting.location || 'Not specified'}`,
      '',
      '## Attendees',
      ...meeting.attendees.map(a => `- ${a.name} (${a.role}) ${a.present ? '✓' : '✗'}`),
      '',
      '## Agenda',
      ...meeting.agenda.map(a => `### ${a.title} (${a.duration} min)${a.owner ? ` - Owner: ${a.owner}` : ''}\n${a.description}`),
      '',
      '## Notes',
      meeting.notes || 'No notes recorded.',
      '',
      '## Action Items',
      ...meeting.actionItems.map(a => `- [${a.status === 'done' ? 'x' : ' '}] **${a.description}** - Assignee: ${a.assignee}, Due: ${a.dueDate}, Priority: ${a.priority}`),
      '',
      '## Decisions',
      ...meeting.decisions.map(d => `- **${d.description}** (Decided by: ${d.decidedBy} on ${d.date})`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-${meeting.title.replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeMeeting = meetings.find(m => m.id === activeMeetingId)

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Meeting Notes</h3>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Meeting title" value={newMeeting.title} onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })} style={{ width: 200 }} />
            <input type="date" value={newMeeting.date} onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })} style={{ width: 140 }} />
            <input type="time" value={newMeeting.time} onChange={e => setNewMeeting({ ...newMeeting, time: e.target.value })} style={{ width: 100 }} />
            <button className="btn" onClick={createMeeting}>New Meeting</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {meetings.map((meeting, i) => (
            <div key={meeting.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{meeting.title}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {meeting.date} at {meeting.time} • {meeting.duration} min • {meeting.attendees.filter(a => a.present).length}/{meeting.attendees.length} present
                </div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => { setActiveMeetingId(meeting.id); setViewMode('editor') }}>Edit</button>
                <button className="btn" onClick={() => exportMarkdown(meeting)}>Export MD</button>
                <button className="btn" onClick={() => deleteMeeting(meeting.id)} style={{ color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Create meetings with agenda, attendees, notes, action items, and decisions. Export to Markdown.
        </p>
      </div>
    )
  }

  if (viewMode === 'editor' && activeMeeting) {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <button className="btn" onClick={() => setViewMode('list')}>← Back</button>
          <h3 style={{ margin: 0 }}>{activeMeeting.title}</h3>
          <button className="btn" onClick={() => exportMarkdown(activeMeeting)}>Export Markdown</button>
        </div>

        <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span>Title</span>
            <input type="text" value={activeMeeting.title} onChange={e => updateMeeting(activeMeeting.id, 'title', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
            <span>Date</span>
            <input type="date" value={activeMeeting.date} onChange={e => updateMeeting(activeMeeting.id, 'date', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span>Time</span>
            <input type="time" value={activeMeeting.time} onChange={e => updateMeeting(activeMeeting.id, 'time', e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span>Duration (min)</span>
            <input type="number" min={15} max={480} value={activeMeeting.duration} onChange={e => updateMeeting(activeMeeting.id, 'duration', Number(e.target.value))} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span>Location</span>
            <input type="text" value={activeMeeting.location} onChange={e => updateMeeting(activeMeeting.id, 'location', e.target.value)} placeholder="Physical or virtual location" />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <details open style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Attendees</h4>
              <button className="btn" onClick={() => addAttendee(activeMeeting.id)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
            </summary>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {activeMeeting.attendees.map((attendee, i) => (
                <div key={attendee.id} className="pop-row" style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 100px 60px 50px', gap: 8, padding: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 30}ms`,
                }}>
                  <input type="text" value={attendee.name} onChange={e => updateAttendee(activeMeeting.id, attendee.id, 'name', e.target.value)} placeholder="Name" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="text" value={attendee.role} onChange={e => updateAttendee(activeMeeting.id, attendee.id, 'role', e.target.value)} placeholder="Role" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={attendee.present} onChange={e => updateAttendee(activeMeeting.id, attendee.id, 'present', e.target.checked)} />
                    <span>Present</span>
                  </label>
                  <button className="btn" onClick={() => removeAttendee(activeMeeting.id, attendee.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => addAttendee(activeMeeting.id)} style={{ justifySelf: 'start' }}>+ Add Attendee</button>
            </div>
          </details>

          <details open style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Agenda</h4>
              <button className="btn" onClick={() => addAgendaItem(activeMeeting.id)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
            </summary>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {activeMeeting.agenda.map((item, i) => (
                <div key={item.id} className="pop-row" style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 100px 100px 80px 50px', gap: 8, padding: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 30}ms`,
                }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>{i + 1}.</span>
                  <input type="text" value={item.title} onChange={e => updateAgendaItem(activeMeeting.id, item.id, 'title', e.target.value)} placeholder="Title" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="text" value={item.owner} onChange={e => updateAgendaItem(activeMeeting.id, item.id, 'owner', e.target.value)} placeholder="Owner" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="number" min={1} max={240} value={item.duration} onChange={e => updateAgendaItem(activeMeeting.id, item.id, 'duration', Number(e.target.value))} style={{ width: 70 }} />
                  <span className="muted">min</span>
                  <textarea value={item.description} onChange={e => updateAgendaItem(activeMeeting.id, item.id, 'description', e.target.value)} placeholder="Description" rows={1} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', resize: 'none' }} />
                  <button className="btn" onClick={() => removeAgendaItem(activeMeeting.id, item.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => addAgendaItem(activeMeeting.id)} style={{ justifySelf: 'start' }}>+ Add Agenda Item</button>
            </div>
          </details>

          <details open style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <summary style={{ padding: 12, cursor: 'pointer' }}>
              <h4 style={{ margin: 0 }}>Meeting Notes</h4>
            </summary>
            <div style={{ padding: 12 }}>
              <textarea
                value={activeMeeting.notes}
                onChange={e => updateNotes(activeMeeting.id, e.target.value)}
                placeholder="Take notes during the meeting..."
                rows={8}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
          </details>

          <details open style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Action Items</h4>
              <button className="btn" onClick={() => addActionItem(activeMeeting.id)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
            </summary>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {activeMeeting.actionItems.map((item, i) => (
                <div key={item.id} className="pop-row" style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 120px 120px 80px 80px 50px', gap: 8, padding: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 30}ms`,
                }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>{i + 1}.</span>
                  <input type="text" value={item.description} onChange={e => updateActionItem(activeMeeting.id, item.id, 'description', e.target.value)} placeholder="Action item" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="text" value={item.assignee} onChange={e => updateActionItem(activeMeeting.id, item.id, 'assignee', e.target.value)} placeholder="Assignee" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="date" value={item.dueDate} onChange={e => updateActionItem(activeMeeting.id, item.id, 'dueDate', e.target.value)} style={{ width: 100 }} />
                  <select value={item.status} onChange={e => updateActionItem(activeMeeting.id, item.id, 'status', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px' }}>
                    <option value="open">Open</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <select value={item.priority} onChange={e => updateActionItem(activeMeeting.id, item.id, 'priority', e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px' }}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button className="btn" onClick={() => removeActionItem(activeMeeting.id, item.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => addActionItem(activeMeeting.id)} style={{ justifySelf: 'start' }}>+ Add Action Item</button>
            </div>
          </details>

          <details open style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Decisions</h4>
              <button className="btn" onClick={() => addDecision(activeMeeting.id)} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
            </summary>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {activeMeeting.decisions.map((decision, i) => (
                <div key={decision.id} className="pop-row" style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 120px 120px 50px', gap: 8, padding: 8,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 30}ms`,
                }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>{i + 1}.</span>
                  <input type="text" value={decision.description} onChange={e => updateDecision(activeMeeting.id, decision.id, 'description', e.target.value)} placeholder="Decision" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="text" value={decision.decidedBy} onChange={e => updateDecision(activeMeeting.id, decision.id, 'decidedBy', e.target.value)} placeholder="Decided by" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                  <input type="date" value={decision.date} onChange={e => updateDecision(activeMeeting.id, decision.id, 'date', e.target.value)} style={{ width: 100 }} />
                  <button className="btn" onClick={() => removeDecision(activeMeeting.id, decision.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                </div>
              ))}
              <button className="btn" onClick={() => addDecision(activeMeeting.id)} style={{ justifySelf: 'start' }}>+ Add Decision</button>
            </div>
          </details>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Record meeting details, attendees, agenda, notes, action items, and decisions. Export to Markdown for sharing.
        </p>
      </div>
    )
  }

  return null
}