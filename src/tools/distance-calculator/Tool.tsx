import { useState, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const LOCATIONS = [
  { name: 'Jakarta', lat: -6.2088, lng: 106.8456, type: 'city', country: 'Indonesia' },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7521, type: 'city', country: 'Indonesia' },
  { name: 'Bandung', lat: -6.9175, lng: 107.6191, type: 'city', country: 'Indonesia' },
  { name: 'Medan', lat: 3.5952, lng: 98.6722, type: 'city', country: 'Indonesia' },
  { name: 'Bali (Denpasar)', lat: -8.6500, lng: 115.2167, type: 'city', country: 'Indonesia' },
  { name: 'Makassar', lat: -5.1477, lng: 119.4327, type: 'city', country: 'Indonesia' },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, type: 'city', country: 'Singapore' },
  { name: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869, type: 'city', country: 'Malaysia' },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018, type: 'city', country: 'Thailand' },
  { name: 'Ho Chi Minh City', lat: 10.8231, lng: 106.6297, type: 'city', country: 'Vietnam' },
  { name: 'Manila', lat: 14.5995, lng: 120.9842, type: 'city', country: 'Philippines' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, type: 'city', country: 'Japan' },
  { name: 'Seoul', lat: 37.5665, lng: 126.9780, type: 'city', country: 'South Korea' },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, type: 'city', country: 'Hong Kong' },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737, type: 'city', country: 'China' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, type: 'city', country: 'Australia' },
  { name: 'Melbourne', lat: -37.8136, lng: 144.9631, type: 'city', country: 'Australia' },
  { name: 'London', lat: 51.5074, lng: -0.1278, type: 'city', country: 'UK' },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, type: 'city', country: 'France' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, type: 'city', country: 'UAE' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, type: 'city', country: 'USA' },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, type: 'city', country: 'USA' },
  { name: 'Jakarta (CGK)', lat: -6.1256, lng: 106.6558, type: 'airport', country: 'Indonesia' },
  { name: 'Bali (DPS)', lat: -8.7482, lng: 115.1672, type: 'airport', country: 'Indonesia' },
  { name: 'Singapore (SIN)', lat: 1.3644, lng: 103.9915, type: 'airport', country: 'Singapore' },
  { name: 'Kuala Lumpur (KUL)', lat: 2.7456, lng: 101.7072, type: 'airport', country: 'Malaysia' },
  { name: 'Bangkok (BKK)', lat: 13.6900, lng: 100.7501, type: 'airport', country: 'Thailand' },
  { name: 'Tokyo Haneda (HND)', lat: 35.5494, lng: 139.7798, type: 'airport', country: 'Japan' },
  { name: 'Tokyo Narita (NRT)', lat: 35.7720, lng: 140.3929, type: 'airport', country: 'Japan' },
  { name: 'London Heathrow (LHR)', lat: 51.4700, lng: -0.4543, type: 'airport', country: 'UK' },
  { name: 'New York JFK (JFK)', lat: 40.6413, lng: -73.7781, type: 'airport', country: 'USA' },
  { name: 'Los Angeles (LAX)', lat: 33.9416, lng: -118.4085, type: 'airport', country: 'USA' },
]

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function drivingDistance(airDist: number) {
  return airDist * 1.3
}

function flightTime(airDist: number) {
  if (airDist < 500) return airDist / 400 + 0.5
  if (airDist < 1500) return airDist / 700 + 1
  if (airDist < 5000) return airDist / 800 + 1.5
  return airDist / 850 + 2
}

function formatTime(hours: number) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

export default function DistanceCalculator() {
  const [from, setFrom] = useState('Jakarta')
  const [to, setTo] = useState('Bali (Denpasar)')
  const [customFrom, setCustomFrom] = useState({ name: '', lat: '', lng: '', type: 'custom' })
  const [customTo, setCustomTo] = useState({ name: '', lat: '', lng: '', type: 'custom' })
  const [useCustomFrom, setUseCustomFrom] = useState(false)
  const [useCustomTo, setUseCustomTo] = useState(false)

  const fromLoc = useCustomFrom ? customFrom : LOCATIONS.find(l => l.name === from)!
  const toLoc = useCustomTo ? customTo : LOCATIONS.find(l => l.name === to)!

  const airDist = useMemo(() => {
    if (!fromLoc.lat || !toLoc.lat) return 0
    return haversine(
      Number(fromLoc.lat), Number(fromLoc.lng),
      Number(toLoc.lat), Number(toLoc.lng)
    )
  }, [fromLoc, toLoc])

  const driveDist = drivingDistance(airDist)
  const flyTime = flightTime(airDist)

  const renderResults = () => {
    if (airDist <= 0) return null
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 8 }}>Straight-line Distance</div>
          <div style={{ fontSize: '3rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
            <Roll value={Math.round(airDist)} /> km
          </div>
          <div className="muted" style={{ marginTop: 8 }}>≈ <Roll value={Math.round(airDist * 0.621371)} /> miles</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
            <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.5rem' }}>🚗</span>
              <h4 style={{ margin: 0 }}>Driving Estimate</h4>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              <Roll value={Math.round(driveDist)} /> km
            </div>
            <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              ~{Math.round(driveDist / 80)}h at 80 km/h avg
            </div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>Assumes 1.3× air distance for roads</div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
            <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.5rem' }}>✈️</span>
              <h4 style={{ margin: 0 }}>Flight Estimate</h4>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
              <Roll value={formatTime(flyTime)} />
            </div>
            <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Air distance ÷ cruise speed + taxi
            </div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>Excludes layovers, security, boarding</div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '300ms' }}>
            <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.5rem' }}>🚄</span>
              <h4 style={{ margin: 0 }}>High-Speed Rail</h4>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: '#8b5cf6' }}>
              {airDist < 1000 ? (
                <Roll value={formatTime(airDist / 250 + 0.5)} />
              ) : (
                <span className="muted">N/A (&gt;1000km)</span>
              )}
            </div>
            <div className="muted" style={{ fontSize: '0.75rem' }}>Only viable for {'>'}1000km corridors</div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '400ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Coordinates</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>{fromLoc.name} ({fromLoc.type})</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>
                {Number(fromLoc.lat).toFixed(4) + '° ' + Number(fromLoc.lng).toFixed(4) + '°'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '1.5rem' }}>↓</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>{toLoc.name} ({toLoc.type})</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', textAlign: 'right' }}>
                {Number(toLoc.lat).toFixed(4) + '° ' + Number(toLoc.lng).toFixed(4) + '°'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Distance Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 12, color: 'var(--accent)' }}>From</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="radio" name="fromType" checked={!useCustomFrom} onChange={() => setUseCustomFrom(false)} />
            <span>Select from list</span>
          </label>
          {!useCustomFrom && (
            <select value={from} onChange={e => setFrom(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>
              {LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name} ({l.type})</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input type="radio" name="fromType" checked={useCustomFrom} onChange={() => setUseCustomFrom(true)} />
            <span>Custom coordinates</span>
          </label>
          {useCustomFrom && (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input type="text" placeholder="Name" value={customFrom.name} onChange={e => setCustomFrom({ ...customFrom, name: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
              <div className="row" style={{ gap: 8 }}>
                <input type="number" step="0.0001" placeholder="Latitude" value={customFrom.lat} onChange={e => setCustomFrom({ ...customFrom, lat: e.target.value })} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
                <input type="number" step="0.0001" placeholder="Longitude" value={customFrom.lng} onChange={e => setCustomFrom({ ...customFrom, lng: e.target.value })} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 12, color: 'var(--ok)' }}>To</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="radio" name="toType" checked={!useCustomTo} onChange={() => setUseCustomTo(false)} />
            <span>Select from list</span>
          </label>
          {!useCustomTo && (
            <select value={to} onChange={e => setTo(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>
              {LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name} ({l.type})</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
            <input type="radio" name="toType" checked={useCustomTo} onChange={() => setUseCustomTo(true)} />
            <span>Custom coordinates</span>
          </label>
          {useCustomTo && (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              <input type="text" placeholder="Name" value={customTo.name} onChange={e => setCustomTo({ ...customTo, name: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
              <div className="row" style={{ gap: 8 }}>
                <input type="number" step="0.0001" placeholder="Latitude" value={customTo.lat} onChange={e => setCustomTo({ ...customTo, lat: e.target.value })} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
                <input type="number" step="0.0001" placeholder="Longitude" value={customTo.lng} onChange={e => setCustomTo({ ...customTo, lng: e.target.value })} style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {airDist > 0 && <>{renderResults()}</>}
    </div>
  )
}