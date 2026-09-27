import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Attendee {
  id: number
  name: string
  hourlyRate: number
}

export default function MeetingCost() {
  const [attendees, setAttendees] = useState<Attendee[]>(() => {
    const saved = localStorage.getItem('meeting-cost')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Senior Dev', hourlyRate: 150000 },
      { id: 2, name: 'Designer', hourlyRate: 120000 },
      { id: 3, name: 'PM', hourlyRate: 180000 },
      { id: 4, name: 'Stakeholder', hourlyRate: 200000 },
    ]
  })

  const [durationMinutes, setDurationMinutes] = useState(60)
  const [running, setRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    try { localStorage.setItem('meeting-cost', JSON.stringify(attendees)) } catch {}
  }, [attendees])

  const addAttendee = () => {
    setAttendees([...attendees, { id: Date.now(), name: `Attendee ${attendees.length + 1}`, hourlyRate: 100000 }])
  }

  const removeAttendee = (id: number) => {
    setAttendees(attendees.filter(a => a.id !== id))
  }

  const updateAttendee = (id: number, field: string, value: string | number) => {
    setAttendees(attendees.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const totalHourlyRate = attendees.reduce((sum, a) => sum + a.hourlyRate, 0)
  const costPerMinute = totalHourlyRate / 60
  const estimatedCost = costPerMinute * durationMinutes
  const liveCost = costPerMinute * (elapsedSeconds / 60)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (running) {
      interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [running])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatCurrency = (n: number) => 'Rp' + Math.round(n).toLocaleString()

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Meeting Cost Calculator</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={addAttendee}>+ Add Attendee</button>
          <button className="btn" onClick={() => { setRunning(!running); if (!running) setElapsedSeconds(0) }} style={{ background: running ? 'var(--danger)' : 'var(--ok)' }}>
            {running ? 'Stop Timer' : 'Start Timer'}
          </button>
          <button className="btn" onClick={() => { setRunning(false); setElapsedSeconds(0) }} disabled={!running && elapsedSeconds === 0}>Reset</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Meeting Duration</span>
          <input type="number" min={1} max={480} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} style={{ width: 100 }} />
        </label>
        <div className="stat"><b>Rate:</b> <Roll value={formatCurrency(totalHourlyRate)}/>/hr</div>
        <div className="stat"><b>Per Min:</b> <Roll value={formatCurrency(costPerMinute)}/></div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {attendees.map((attendee, i) => (
          <div key={attendee.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <input type="text" value={attendee.name} onChange={e => updateAttendee(attendee.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, minWidth: 120 }} />
            <span className="muted">Rp</span>
            <input type="number" min={0} step={1000} value={attendee.hourlyRate} onChange={e => updateAttendee(attendee.id, 'hourlyRate', Number(e.target.value))} style={{ width: 120 }} />
            <span className="muted">/hr</span>
            <div className="stat" style={{ marginLeft: 'auto' }}><b><Roll value={formatCurrency(attendee.hourlyRate * durationMinutes / 60)}/></b><span className="muted">est. cost</span></div>
            <button className="btn" onClick={() => removeAttendee(attendee.id)} style={{ color: 'var(--danger)' }}>Remove</button>
          </div>
        ))}
      </div>

      <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', borderTop: '4px solid var(--accent)' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Estimated Cost ({durationMinutes} min)</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
          <Roll value={formatCurrency(estimatedCost)} />
        </div>
      </div>

      {running && (
        <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', borderTop: '4px solid var(--danger)', marginTop: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Live Cost</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--danger)', fontFamily: 'var(--mono)' }}>
            <Roll value={formatCurrency(liveCost)} />
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'var(--mono)', color: 'var(--muted)', marginTop: 8 }}>
            {formatTime(elapsedSeconds)}
          </div>
        </div>
      )}

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Add attendees with hourly rates. Estimated cost based on duration. Live timer ticks cost per second.
      </p>
    </div>
  )
}