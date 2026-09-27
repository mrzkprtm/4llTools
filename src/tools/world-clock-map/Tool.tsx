import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const TIMEZONES = [
  { city: 'Jakarta', tz: 'Asia/Jakarta', lat: -6.2, lng: 106.8, country: 'Indonesia' },
  { city: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.7, lng: 139.7, country: 'Japan' },
  { city: 'Singapore', tz: 'Asia/Singapore', lat: 1.3, lng: 103.8, country: 'Singapore' },
  { city: 'Dubai', tz: 'Asia/Dubai', lat: 25.2, lng: 55.3, country: 'UAE' },
  { city: 'London', tz: 'Europe/London', lat: 51.5, lng: -0.1, country: 'UK' },
  { city: 'New York', tz: 'America/New_York', lat: 40.7, lng: -74.0, country: 'USA' },
  { city: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.1, lng: -118.2, country: 'USA' },
  { city: 'São Paulo', tz: 'America/Sao_Paulo', lat: -23.5, lng: -46.6, country: 'Brazil' },
  { city: 'Sydney', tz: 'Australia/Sydney', lat: -33.9, lng: 151.2, country: 'Australia' },
  { city: 'Hong Kong', tz: 'Asia/Hong_Kong', lat: 22.3, lng: 114.2, country: 'Hong Kong' },
  { city: 'Seoul', tz: 'Asia/Seoul', lat: 37.6, lng: 127.0, country: 'South Korea' },
  { city: 'Mumbai', tz: 'Asia/Kolkata', lat: 19.1, lng: 72.9, country: 'India' },
  { city: 'Berlin', tz: 'Europe/Berlin', lat: 52.5, lng: 13.4, country: 'Germany' },
  { city: 'Paris', tz: 'Europe/Paris', lat: 48.9, lng: 2.4, country: 'France' },
  { city: 'Toronto', tz: 'America/Toronto', lat: 43.7, lng: -79.4, country: 'Canada' },
]

const SELECTED_DEFAULT = ['Jakarta', 'Tokyo', 'Singapore', 'London', 'New York', 'Los Angeles']

export default function WorldClockMap() {
  const [selectedCities, setSelectedCities] = useState<string[]>(() => {
    const saved = localStorage.getItem('world-clock-map')
    return saved ? JSON.parse(saved) : SELECTED_DEFAULT
  })
  const [meetingTime, setMeetingTime] = useState('09:00')
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [referenceCity, setReferenceCity] = useState('Jakarta')

  useEffect(() => {
    try { localStorage.setItem('world-clock-map', JSON.stringify(selectedCities)) } catch {}
  }, [selectedCities])

  const now = useMemo(() => new Date(), [])

  const getCityTime = (tz: string, refDate?: Date) => {
    const date = refDate || now
    return new Date(date.toLocaleString('en-US', { timeZone: tz }))
  }

  const formatTime = (date: Date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  const formatDate = (date: Date) => date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

  const selectedZones = TIMEZONES.filter(z => selectedCities.includes(z.city))
  const availableZones = TIMEZONES.filter(z => !selectedCities.includes(z.city))

  const meetingTimes = useMemo(() => {
    if (!meetingTime) return []
    const [h, m] = meetingTime.split(':').map(Number)
    const refZone = TIMEZONES.find(z => z.city === referenceCity)!
    const refDate = new Date(meetingDate + 'T00:00:00')
    refDate.setHours(h, m, 0, 0)
    const refTimeInUTC = new Date(refDate.toLocaleString('en-US', { timeZone: refZone.tz }))
    const utcTime = refTimeInUTC.getTime()

    return selectedZones.map(zone => {
      const localTime = new Date(utcTime)
      const localStr = localTime.toLocaleString('en-US', { timeZone: zone.tz })
      const localDate = new Date(localStr)
      return {
        city: zone.city,
        country: zone.country,
        time: formatTime(localDate),
        date: formatDate(localDate),
        isToday: localDate.toDateString() === new Date().toDateString(),
        isTomorrow: localDate.toDateString() === new Date(Date.now() + 86400000).toDateString(),
      }
    })
  }, [meetingTime, meetingDate, referenceCity, selectedZones])

  const addCity = (city: string) => {
    if (!selectedCities.includes(city)) setSelectedCities([...selectedCities, city])
  }

  const removeCity = (city: string) => {
    setSelectedCities(selectedCities.filter(c => c !== city))
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>World Clock Map</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="muted">Meeting at</span>
            <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={{ width: 150 }} />
            <span className="muted">in</span>
            <select value={referenceCity} onChange={e => setReferenceCity(e.target.value)} style={{ width: 120 }}>
              {selectedZones.map(z => <option key={z.city} value={z.city}>{z.city}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {selectedZones.map((zone, i) => {
            const localTime = getCityTime(zone.tz)
            const isDay = localTime.getHours() >= 6 && localTime.getHours() < 18
            return (
              <div key={zone.city} className="pop-row" style={{
                padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                borderTop: `4px solid ${isDay ? '#f59e0b' : '#3b82f6'}`,
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 40}ms`,
              }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{zone.city}</div>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>{zone.country}</div>
                  </div>
                  <button className="btn" onClick={() => removeCity(zone.city)} style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)' }}>Remove</button>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                  <Roll value={formatTime(localTime)} />
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{formatDate(localTime)}</div>
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: isDay ? '#f59e0b' : '#3b82f6' }}>
                  {isDay ? '☀️ Daytime' : '🌙 Nighttime'}
                </div>
              </div>
            )
          })}
        </div>

        <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Add More Cities</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginTop: 12 }}>
            {availableZones.map(zone => (
              <button key={zone.city} className="btn" onClick={() => addCity(zone.city)} style={{ padding: '8px 12px', justifyContent: 'flex-start' }}>
                {zone.city} ({zone.country})
              </button>
            ))}
          </div>
        </details>

        {meetingTimes.length > 0 && (
          <div>
            <h4 style={{ marginBottom: 12 }}>Meeting Planner</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {meetingTimes.map((mt, i) => (
                <div key={mt.city} className="pop-row" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
                  background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{mt.city}, {mt.country}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{mt.date} {mt.isTomorrow ? '(+1 day)' : ''}</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {mt.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Click "Add More Cities" to select time zones. Meeting planner converts a reference time to all selected cities.
      </p>
    </div>
  )
}