import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const CITIES = [
  { name: 'Jakarta', tz: 'Asia/Jakarta', country: 'Indonesia' },
  { name: 'Tokyo', tz: 'Asia/Tokyo', country: 'Japan' },
  { name: 'Singapore', tz: 'Asia/Singapore', country: 'Singapore' },
  { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', country: 'Malaysia' },
  { name: 'Bangkok', tz: 'Asia/Bangkok', country: 'Thailand' },
  { name: 'Hong Kong', tz: 'Asia/Hong_Kong', country: 'Hong Kong' },
  { name: 'Seoul', tz: 'Asia/Seoul', country: 'South Korea' },
  { name: 'Shanghai', tz: 'Asia/Shanghai', country: 'China' },
  { name: 'Mumbai', tz: 'Asia/Kolkata', country: 'India' },
  { name: 'Dubai', tz: 'Asia/Dubai', country: 'UAE' },
  { name: 'London', tz: 'Europe/London', country: 'UK' },
  { name: 'Paris', tz: 'Europe/Paris', country: 'France' },
  { name: 'Berlin', tz: 'Europe/Berlin', country: 'Germany' },
  { name: 'New York', tz: 'America/New_York', country: 'USA' },
  { name: 'Chicago', tz: 'America/Chicago', country: 'USA' },
  { name: 'Denver', tz: 'America/Denver', country: 'USA' },
  { name: 'Los Angeles', tz: 'America/Los_Angeles', country: 'USA' },
  { name: 'São Paulo', tz: 'America/Sao_Paulo', country: 'Brazil' },
  { name: 'Sydney', tz: 'Australia/Sydney', country: 'Australia' },
  { name: 'Melbourne', tz: 'Australia/Melbourne', country: 'Australia' },
  { name: 'Auckland', tz: 'Pacific/Auckland', country: 'New Zealand' },
]

const DEFAULT_SELECTED = ['Jakarta', 'Singapore', 'Tokyo', 'London', 'New York', 'Los Angeles']

export default function TimeZonePlanner() {
  const [selectedCities, setSelectedCities] = useState<string[]>(() => {
    const saved = localStorage.getItem('time-zone-planner')
    return saved ? JSON.parse(saved) : DEFAULT_SELECTED
  })
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0])
  const [referenceCity, setReferenceCity] = useState('Jakarta')
  const [meetingTime, setMeetingTime] = useState('09:00')
  const [workHoursStart, setWorkHoursStart] = useState(9)
  const [workHoursEnd, setWorkHoursEnd] = useState(17)

  useEffect(() => {
    try { localStorage.setItem('time-zone-planner', JSON.stringify(selectedCities)) } catch {}
  }, [selectedCities])

  const now = useMemo(() => new Date(), [])

  const getCityTime = (tz: string, date?: Date) => {
    const d = date || now
    return new Date(d.toLocaleString('en-US', { timeZone: tz }))
  }

  const formatTime = (date: Date) => date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  const formatDate = (date: Date) => date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

  const selectedZones = CITIES.filter(c => selectedCities.includes(c.name))
  const availableCities = CITIES.filter(c => !selectedCities.includes(c.name))

  const meetingTimes = useMemo(() => {
    const [h, m] = meetingTime.split(':').map(Number)
    const refZone = CITIES.find(c => c.name === referenceCity)!
    const refDate = new Date(meetingDate + 'T00:00:00')
    refDate.setHours(h, m, 0, 0)
    const utcTime = new Date(refDate.toLocaleString('en-US', { timeZone: refZone.tz })).getTime()

    return selectedZones.map(zone => {
      const localTime = new Date(utcTime)
      const localStr = localTime.toLocaleString('en-US', { timeZone: zone.tz })
      const localDate = new Date(localStr)
      return {
        city: zone.name,
        country: zone.country,
        tz: zone.tz,
        time: formatTime(localDate),
        date: formatDate(localDate),
        hour: localDate.getHours(),
        isWorkHour: localDate.getHours() >= workHoursStart && localDate.getHours() < workHoursEnd,
        isToday: localDate.toDateString() === now.toDateString(),
        isTomorrow: localDate.toDateString() === new Date(now.getTime() + 86400000).toDateString(),
      }
    })
  }, [meetingTime, meetingDate, referenceCity, selectedZones, workHoursStart, workHoursEnd])

  const addCity = (city: string) => {
    if (!selectedCities.includes(city)) setSelectedCities([...selectedCities, city])
  }

  const removeCity = (city: string) => {
    setSelectedCities(selectedCities.filter(c => c !== city))
  }

  const workHourOverlap = useMemo(() => {
    const workHours = selectedZones.map(z => {
      const localNow = getCityTime(z.tz)
      const today = new Date(localNow)
      today.setHours(workHoursStart, 0, 0, 0)
      const start = new Date(today.toLocaleString('en-US', { timeZone: z.tz })).getTime()
      const end = start + (workHoursEnd - workHoursStart) * 3600000
      return { city: z.name, start, end }
    })

    let bestOverlap = { start: 0, end: 0, count: 0 }
    for (let h = 0; h < 24; h++) {
      const testStart = new Date(meetingDate + 'T00:00:00')
      testStart.setHours(h, 0, 0, 0)
      const testTime = testStart.getTime()
      const testEnd = testTime + 3600000

      let count = 0
      workHours.forEach(wh => {
        const localTestStart = new Date(testTime)
        const localStr = localTestStart.toLocaleString('en-US', { timeZone: CITIES.find(c => c.name === wh.city)!.tz })
        const localHour = new Date(localStr).getHours()
        if (localHour >= workHoursStart && localHour < workHoursEnd) count++
      })

      if (count > bestOverlap.count) {
        bestOverlap = { start: testTime, end: testEnd, count }
      }
    }
    return bestOverlap
  }, [meetingDate, selectedZones, workHoursStart, workHoursEnd])

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Time Zone Planner</h3>
        <div className="row" style={{ gap: 8 }}>
          <details>
            <summary className="btn" style={{ cursor: 'pointer' }}>Add Cities</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginTop: 8, padding: 8 }}>
              {availableCities.map(city => (
                <button key={city.name} className="btn" onClick={() => addCity(city.name)} style={{ padding: '6px 10px', justifyContent: 'flex-start' }}>
                  {city.name} ({city.country})
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted">Meeting at</span>
          <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
          <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={{ width: 140 }} />
          <span className="muted">in</span>
          <select value={referenceCity} onChange={e => setReferenceCity(e.target.value)} style={{ width: 130 }}>
            {selectedZones.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted">Work hours:</span>
          <input type="number" min={0} max={23} value={workHoursStart} onChange={e => setWorkHoursStart(Number(e.target.value))} style={{ width: 50 }} />
          <span>–</span>
          <input type="number" min={1} max={24} value={workHoursEnd} onChange={e => setWorkHoursEnd(Number(e.target.value))} style={{ width: 50 }} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>City Clocks</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {selectedZones.map((zone, i) => {
              const localTime = getCityTime(zone.tz)
              const isWork = localTime.getHours() >= workHoursStart && localTime.getHours() < workHoursEnd
              return (
                <div key={zone.name} style={{
                  padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  borderLeft: `4px solid ${isWork ? 'var(--ok)' : 'var(--muted)'}`,
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{zone.name}</div>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>{zone.country}</div>
                    </div>
                    <button className="btn" onClick={() => removeCity(zone.name)} style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)' }}>Remove</button>
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    <Roll value={formatTime(localTime)} />
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>{formatDate(localTime)} {localTime.toDateString() === now.toDateString() ? '' : localTime.toDateString() === new Date(now.getTime() + 86400000).toDateString() ? '(+1)' : '(-1)'}</span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: isWork ? 'var(--ok)20' : 'var(--muted)20', color: isWork ? 'var(--ok)' : 'var(--muted)' }}>
                      {isWork ? '🟢 Work Hours' : '🔴 Off Hours'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {meetingTimes.length > 0 && (
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
            <h4 style={{ margin: '0 0 12px' }}>Meeting Time Conversion</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {meetingTimes.map((mt, i) => (
                <div key={mt.city} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10,
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                }}>
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{mt.city}, {mt.country}</span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: mt.isWorkHour ? 'var(--ok)20' : 'var(--danger)20', color: mt.isWorkHour ? 'var(--ok)' : 'var(--danger)' }}>
                        {mt.isWorkHour ? '✓ Work Hours' : '✗ Off Hours'}
                      </span>
                    </div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{mt.date} {mt.isTomorrow ? '(+1 day)' : mt.isToday ? '' : '(-1 day)'}</div>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {mt.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Best Meeting Time (Work Hours Overlap)</h4>
          {workHourOverlap.count > 0 ? (
            <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Best slot ({workHourOverlap.count}/{selectedZones.length} cities in work hours)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                  {new Date(workHourOverlap.start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })} – {new Date(workHourOverlap.end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>In {referenceCity} time</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selectedZones.map(z => {
                  const localStart = new Date(workHourOverlap.start)
                  const localStr = localStart.toLocaleString('en-US', { timeZone: z.tz })
                  const localHour = new Date(localStr).getHours()
                  return (
                    <span key={z.name} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 4, background: (localHour >= workHoursStart && localHour < workHoursEnd) ? 'var(--ok)20' : 'var(--danger)20', color: (localHour >= workHoursStart && localHour < workHoursEnd) ? 'var(--ok)' : 'var(--danger)' }}>
                      {z.name}: {localHour}:00
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="muted">No overlapping work hours found for selected cities.</p>
          )}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Select cities to compare time zones. Set meeting time in one city to see converted times. Work hours highlight shows best overlap.
      </p>
    </div>
  )
}