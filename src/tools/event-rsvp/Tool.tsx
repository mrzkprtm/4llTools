import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Guest {
  id: number
  name: string
  email: string
  phone: string
  partySize: number
  rsvp: 'pending' | 'yes' | 'no' | 'maybe'
  dietary: string
  notes: string
  plusOne: boolean
  plusOneName: string
}

const DIETARY_OPTIONS = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut Allergy', 'Halal', 'Kosher', 'Other']

export default function EventRSVP() {
  const [event, setEvent] = useState({
    name: '',
    date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    time: '18:00',
    location: '',
    rsvpDeadline: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    maxGuests: 100,
  })
  const [guests, setGuests] = useState<Guest[]>(() => {
    const saved = localStorage.getItem('event-rsvp')
    return saved ? JSON.parse(saved) : []
  })
  const [filterRSVP, setFilterRSVP] = useState<'all' | 'pending' | 'yes' | 'no' | 'maybe'>('all')
  const [newGuest, setNewGuest] = useState({ name: '', email: '', phone: '', partySize: 1, dietary: 'None', plusOne: false, plusOneName: '', notes: '' })
  const [importText, setImportText] = useState('')

  useEffect(() => {
    try { localStorage.setItem('event-rsvp', JSON.stringify({ event, guests })) } catch {}
  }, [event, guests])

  const addGuest = () => {
    if (!newGuest.name.trim()) return
    setGuests([...guests, { ...newGuest, id: Date.now(), rsvp: 'pending' }])
    setNewGuest({ name: '', email: '', phone: '', partySize: 1, dietary: 'None', plusOne: false, plusOneName: '', notes: '' })
  }

  const removeGuest = (id: number) => {
    setGuests(guests.filter(g => g.id !== id))
  }

  const updateGuest = (id: number, field: string, value: string | number | boolean) => {
    setGuests(guests.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  const importCSV = () => {
    const lines = importText.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim())
    const newGuests = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      return {
        id: Date.now() + Math.random(),
        name: values[0] || '',
        email: values[1] || '',
        phone: values[2] || '',
        partySize: parseInt(values[3]) || 1,
        dietary: values[4] || 'None',
        notes: values[5] || '',
        plusOne: values[6]?.toLowerCase() === 'yes',
        plusOneName: values[7] || '',
        rsvp: 'pending' as const,
      }
    }).filter(g => g.name)
    setGuests([...guests, ...newGuests])
    setImportText('')
  }

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Party Size', 'RSVP', 'Dietary', 'Plus One', 'Plus One Name', 'Notes']
    const rows = guests.map(g => [g.name, g.email, g.phone, g.partySize, g.rsvp, g.dietary, g.plusOne ? 'Yes' : 'No', g.plusOneName, g.notes])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `guest-list-${event.name.replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const stats = useMemo(() => {
    const counts = { pending: 0, yes: 0, no: 0, maybe: 0 }
    let totalAttending = 0
    guests.forEach(g => {
      counts[g.rsvp]++
      if (g.rsvp === 'yes') totalAttending += g.partySize + (g.plusOne ? 1 : 0)
    })
    return { counts, totalAttending }
  }, [guests])

  const filteredGuests = guests.filter(g => filterRSVP === 'all' || g.rsvp === filterRSVP)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Event RSVP Tracker</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Event Details</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Event Name</span>
            <input type="text" value={event.name} onChange={e => setEvent({ ...event, name: e.target.value })} placeholder="Event name" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Date</span>
            <input type="date" value={event.date} onChange={e => setEvent({ ...event, date: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Time</span>
            <input type="time" value={event.time} onChange={e => setEvent({ ...event, time: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Location</span>
            <input type="text" value={event.location} onChange={e => setEvent({ ...event, location: e.target.value })} placeholder="Venue address" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>RSVP Deadline</span>
            <input type="date" value={event.rsvpDeadline} onChange={e => setEvent({ ...event, rsvpDeadline: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Max Guests</span>
            <input type="number" min={1} value={event.maxGuests} onChange={e => setEvent({ ...event, maxGuests: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={guests.length} /></b><span className="muted">Total Invited</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={stats.counts.yes} /></b><span className="muted">Attending</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={stats.counts.no} /></b><span className="muted">Declined</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={stats.counts.maybe} /></b><span className="muted">Maybe</span></div>
        <div className="stat"><b style={{ color: 'var(--muted)' }}><Roll value={stats.counts.pending} /></b><span className="muted">Pending</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={stats.totalAttending} /></b><span className="muted">Total Attending</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Filter by RSVP Status</span>
          <select value={filterRSVP} onChange={e => setFilterRSVP(e.target.value as any)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </select>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Guest
          <span className="muted" style={{ fontSize: '0.8rem' }}>{guests.length} guests total</span>
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Full Name *" value={newGuest.name} onChange={e => setNewGuest({ ...newGuest, name: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
            <input type="email" placeholder="Email" value={newGuest.email} onChange={e => setNewGuest({ ...newGuest, email: e.target.value })} style={{ flex: 1 }} />
            <input type="tel" placeholder="Phone" value={newGuest.phone} onChange={e => setNewGuest({ ...newGuest, phone: e.target.value })} style={{ width: 150 }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="number" min={1} max={10} placeholder="Party Size" value={newGuest.partySize} onChange={e => setNewGuest({ ...newGuest, partySize: Number(e.target.value) })} style={{ width: 100 }} />
            <select value={newGuest.dietary} onChange={e => setNewGuest({ ...newGuest, dietary: e.target.value })} style={{ width: 180 }}>
              {DIETARY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={newGuest.plusOne} onChange={e => setNewGuest({ ...newGuest, plusOne: e.target.checked })} />
              <span>Plus One</span>
            </label>
            <input type="text" placeholder="Plus One Name" value={newGuest.plusOneName} onChange={e => setNewGuest({ ...newGuest, plusOneName: e.target.value })} style={{ width: 180 }} disabled={!newGuest.plusOne} />
          </div>
          <input type="text" placeholder="Notes/Special Requests" value={newGuest.notes} onChange={e => setNewGuest({ ...newGuest, notes: e.target.value })} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={addGuest} disabled={!newGuest.name.trim()}>Add Guest</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="file" accept=".csv" onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = e => setImportText(e.target?.result as string)
                reader.readAsText(file)
              }} style={{ display: 'none' }} id="csvImport" />
              <button className="btn" type="button" onClick={() => document.getElementById('csvImport')?.click()}>Import CSV</button>
              <textarea placeholder="Or paste CSV data here..." value={importText} onChange={e => setImportText(e.target.value)} rows={2} style={{ flex: 1 }} />
              <button className="btn" onClick={importCSV} disabled={!importText.trim()}>Import</button>
            </label>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Filter by RSVP</span>
          <select value={filterRSVP} onChange={e => setFilterRSVP(e.target.value as any)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </select>
        </label>
        <span className="muted" style={{ alignSelf: 'flex-end' }}>{guests.length} total guests</span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {guests.length === 0 ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <p className="muted">No guests added yet. Add guests manually or import from CSV.</p>
          </div>
        ) : (
          filteredGuests.length === 0 ? (
            <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <p className="muted">No guests match the current filter</p>
            </div>
          ) : (
            filteredGuests.map((guest, i) => (
              <div key={guest.id} className="pop-row" style={{
                display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, padding: 12,
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                borderLeft: guest.rsvp === 'yes' ? '4px solid var(--ok)' : guest.rsvp === 'no' ? '4px solid var(--danger)' : guest.rsvp === 'maybe' ? '4px solid var(--accent)' : '4px solid var(--muted)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 30}ms`,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{guest.name}</div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>
                    {guest.email} \u2022 {guest.phone}
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Party: {guest.partySize} {guest.plusOne ? `+ ${guest.plusOneName}` : ''}
                  </div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>Dietary: {guest.dietary}</div>
                  {guest.notes && <div className="muted" style={{ fontSize: '0.75rem' }}>Notes: {guest.notes}</div>}
                </div>
                <div>
                  <select value={guest.rsvp} onChange={e => updateGuest(guest.id, 'rsvp', e.target.value)} style={{ padding: '8px 12px', fontSize: '1rem', fontWeight: 600, background: guest.rsvp === 'yes' ? 'var(--ok)20' : guest.rsvp === 'no' ? 'var(--danger)20' : guest.rsvp === 'maybe' ? 'var(--accent)20' : 'var(--muted)20', color: guest.rsvp === 'yes' ? 'var(--ok)' : guest.rsvp === 'no' ? 'var(--danger)' : guest.rsvp === 'maybe' ? 'var(--accent)' : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <option value="pending">Pending</option>
                    <option value="yes">\u2713 Attending</option>
                    <option value="no">\u2717 Declined</option>
                    <option value="maybe">? Maybe</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>{guest.partySize + (guest.plusOne ? 1 : 0)} attending</div>
                  <button className="btn" onClick={() => setGuests(guests.filter(g => g.id !== guest.id))} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
                </div>
              </div>
            ))
          )
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Track RSVPs for any event. Import/export CSV. Track dietary needs, plus-ones, and special notes. Export guest list for seating charts.
      </p>
    </div>
  )
}