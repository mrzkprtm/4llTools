import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const AIRPORTS = [
  { code: 'CGK', name: 'Soekarno-Hatta', city: 'Jakarta', country: 'Indonesia', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'DPS', name: 'Ngurah Rai', city: 'Bali', country: 'Indonesia', terminals: ['Domestic', 'International'], type: 'international' },
  { code: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore', terminals: ['T1', 'T2', 'T3', 'T4'], type: 'international' },
  { code: 'KUL', name: 'Kuala Lumpur', city: 'Kuala Lumpur', country: 'Malaysia', terminals: ['KLIA Main', 'KLIA2'], type: 'international' },
  { code: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand', terminals: ['Main'], type: 'international' },
  { code: 'HKG', name: 'Hong Kong', city: 'Hong Kong', country: 'Hong Kong', terminals: ['T1'], type: 'international' },
  { code: 'ICN', name: 'Incheon', city: 'Seoul', country: 'South Korea', terminals: ['T1', 'T2'], type: 'international' },
  { code: 'NRT', name: 'Narita', city: 'Tokyo', country: 'Japan', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'HND', name: 'Haneda', city: 'Tokyo', country: 'Japan', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'LHR', name: 'Heathrow', city: 'London', country: 'UK', terminals: ['T2', 'T3', 'T4', 'T5'], type: 'international' },
  { code: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany', terminals: ['T1', 'T2'], type: 'international' },
  { code: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands', terminals: ['Main'], type: 'international' },
  { code: 'DXB', name: 'Dubai', city: 'Dubai', country: 'UAE', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'JFK', name: 'JFK', city: 'New York', country: 'USA', terminals: ['T1', 'T4', 'T5', 'T7', 'T8'], type: 'international' },
  { code: 'LAX', name: 'LAX', city: 'Los Angeles', country: 'USA', terminals: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'TBIT'], type: 'international' },
  { code: 'SYD', name: 'Sydney', city: 'Sydney', country: 'Australia', terminals: ['T1', 'T2', 'T3'], type: 'international' },
  { code: 'MEL', name: 'Melbourne', city: 'Melbourne', country: 'Australia', terminals: ['T1', 'T2', 'T3', 'T4'], type: 'international' },
]

const MIN_CONNECT_TIMES = {
  'domestic-domestic': 45,
  'domestic-international': 90,
  'international-domestic': 90,
  'international-international': 120,
  'same-terminal': -15,
  'different-terminal': 30,
  'different-airport': 120,
  'schengen-schengen': -15,
  'visa-required': 60,
}

export default function FlightLayover() {
  const [arrivalAirport, setArrivalAirport] = useState('CGK')
  const [arrivalTerminal, setArrivalTerminal] = useState('T3')
  const [departureAirport, setDepartureAirport] = useState('SIN')
  const [departureTerminal, setDepartureTerminal] = useState('T3')
  const [layoverMinutes, setLayoverMinutes] = useState(120)
  const [flightType, setFlightType] = useState<'international-international' | 'domestic-domestic' | 'domestic-international' | 'international-domestic'>('international-international')
  const [sameTicket, setSameTicket] = useState(true)
  const [visaRequired, setVisaRequired] = useState(false)
  const [schengen, setSchengen] = useState(false)

  const arrival = AIRPORTS.find(a => a.code === arrivalAirport)!
  const departure = AIRPORTS.find(a => a.code === departureAirport)!

  const minConnectTime = useMemo(() => {
    let base = MIN_CONNECT_TIMES[flightType] || 60
    if (arrivalAirport === departureAirport) {
      if (arrivalTerminal === departureTerminal) base += MIN_CONNECT_TIMES['same-terminal']
      else base += MIN_CONNECT_TIMES['different-terminal']
    } else {
      base += MIN_CONNECT_TIMES['different-airport']
    }
    if (schengen) base += MIN_CONNECT_TIMES['schengen-schengen']
    if (visaRequired) base += MIN_CONNECT_TIMES['visa-required']
    if (!sameTicket) base += 60
    return Math.max(30, base)
  }, [arrivalAirport, departureAirport, arrivalTerminal, departureTerminal, flightType, sameTicket, visaRequired, schengen])

  const buffer = layoverMinutes - minConnectTime
  const riskLevel = buffer >= 60 ? 'low' : buffer >= 30 ? 'medium' : buffer >= 0 ? 'high' : 'critical'
  const riskColors = { low: 'var(--ok)', medium: 'var(--accent)', high: '#f59e0b', critical: 'var(--danger)' }
  const riskLabels = { low: 'Low Risk ✓', medium: 'Medium Risk ⚠', high: 'High Risk ⚠', critical: 'Critical Risk ✗' }

  const terminals = arrivalAirport === departureAirport ? arrival.terminals : departure.terminals

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Flight Layover Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 12, color: 'var(--accent)' }}>Arrival</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Airport</span>
              <select value={arrivalAirport} onChange={e => { setArrivalAirport(e.target.value); setArrivalTerminal(AIRPORTS.find(a => a.code === e.target.value)?.terminals[0] || '') }}>
                {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}, {a.city}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Terminal</span>
              <select value={arrivalTerminal} onChange={e => setArrivalTerminal(e.target.value)}>
                {arrival.terminals.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 280 }}>
          <h4 style={{ marginBottom: 12, color: 'var(--ok)' }}>Departure</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Airport</span>
              <select value={departureAirport} onChange={e => { setDepartureAirport(e.target.value); setDepartureTerminal(AIRPORTS.find(a => a.code === e.target.value)?.terminals[0] || '') }}>
                {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}, {a.city}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Terminal</span>
              <select value={departureTerminal} onChange={e => setDepartureTerminal(e.target.value)}>
                {departure.terminals.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <span>Layover Duration</span>
          <input type="number" min={0} max={1440} value={layoverMinutes} onChange={e => setLayoverMinutes(Number(e.target.value))} style={{ width: 100 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Flight Type</span>
          <select value={flightType} onChange={e => setFlightType(e.target.value as any)}>
            <option value="international-international">International → International</option>
            <option value="domestic-domestic">Domestic → Domestic</option>
            <option value="domestic-international">Domestic → International</option>
            <option value="international-domestic">International → Domestic</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={sameTicket} onChange={e => setSameTicket(e.target.checked)} />
          <span>Same ticket / protected connection</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={visaRequired} onChange={e => setVisaRequired(e.target.checked)} />
          <span>Transit visa required</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={schengen} onChange={e => setSchengen(e.target.checked)} />
          <span>Schengen to Schengen</span>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Minimum Connection Time (MCT)</h4>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
              <Roll value={minConnectTime} /> minutes
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Your Layover</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              <Roll value={layoverMinutes} /> minutes
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Buffer</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: riskColors[riskLevel] }}>
              <Roll value={buffer >= 0 ? '+' : ''} {buffer} /> minutes
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: riskColors[riskLevel] + '20',
                border: `3px solid ${riskColors[riskLevel]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', fontWeight: 700, color: riskColors[riskLevel]
              }}>
                {riskLevel === 'low' ? '✓' : riskLevel === 'medium' ? '⚠' : riskLevel === 'high' ? '⚠' : '✗'}
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: riskColors[riskLevel] }}>{riskLabels[riskLevel]}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {buffer >= 0 ? `You have ${buffer} minutes buffer` : `Short by ${Math.abs(buffer)} minutes`}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="btn" onClick={() => setLayoverMinutes(minConnectTime + 60)} style={{ background: 'var(--ok)' }}>Set to Safe (MCT + 60min)</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>MCT Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
              <span>Base MCT ({flightType.replace('-', ' → ')})</span>
              <b><Roll value={MIN_CONNECT_TIMES[flightType as keyof typeof MIN_CONNECT_TIMES] || 60} /> min</b>
            </div>
            {arrivalAirport === departureAirport ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                  <span>Terminal Transfer</span>
                  <b style={{ color: arrivalTerminal === departureTerminal ? 'var(--ok)' : 'var(--accent)' }}>
                    <Roll value={arrivalTerminal === departureTerminal ? MIN_CONNECT_TIMES['same-terminal'] : MIN_CONNECT_TIMES['different-terminal']} /> min
                  </b>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                <span>Different Airport Transfer</span>
                <b style={{ color: 'var(--danger)' }}><Roll value={MIN_CONNECT_TIMES['different-airport']} /> min</b>
              </div>
            )}
            {schengen && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}><span>Schengen to Schengen</span><b style={{ color: 'var(--ok)' }}><Roll value={MIN_CONNECT_TIMES['schengen-schengen']} /> min</b></div>}
            {visaRequired && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}><span>Transit Visa Required</span><b style={{ color: 'var(--danger)' }}><Roll value={MIN_CONNECT_TIMES['visa-required']} /> min</b></div>}
            {!sameTicket && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}><span>Separate Tickets (recheck bags)</span><b style={{ color: 'var(--danger)' }}>+60 min</b></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--accent)20', borderRadius: 4, border: '1px solid var(--accent)40' }}>
              <span><b>Total Minimum Connection Time</b></span>
              <b style={{ color: 'var(--accent)' }}><Roll value={minConnectTime} /> min</b>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Guidelines</h4>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: '0.9rem' }}>
            <li><b>Low Risk (60+ min buffer):</b> Comfortable, time for food/shopping</li>
            <li><b>Medium Risk (30-59 min buffer):</b> Proceed directly to gate, no delays acceptable</li>
            <li><b>High Risk (0-29 min buffer):</b> Rush needed, ask staff for assistance</li>
            <li><b>Critical Risk (negative buffer):</b> Misconnect likely, rebook if possible</li>
            <li>Same ticket = airline protects you. Separate tickets = you're on your own.</li>
            <li>Always confirm MCT with your airline/airport - these are general guidelines.</li>
          </ul>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        MCT varies by airport, airline, and time of day. Check with your carrier for official minimums. This tool provides general estimates.
      </p>
    </div>
  )
}