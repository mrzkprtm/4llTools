import { useState } from 'react'
import { Roll } from '../../motion/Roll'

export default function HeartRateZones() {
  const [age, setAge] = useState(30)
  const [restingHR, setRestingHR] = useState(65)
  const [currentHR, setCurrentHR] = useState(120)

  const maxHR = 220 - age
  const hrReserve = maxHR - restingHR

  const zones = [
    { name: 'Zone 1: Recovery', min: 50, max: 60, color: '#06b6d4', desc: 'Very light, warm-up/cool-down' },
    { name: 'Zone 2: Aerobic Base', min: 60, max: 70, color: '#84cc16', desc: 'Light, fat burning, endurance' },
    { name: 'Zone 3: Aerobic', min: 70, max: 80, color: '#eab308', desc: 'Moderate, fitness improvement' },
    { name: 'Zone 4: Threshold', min: 80, max: 90, color: '#f97316', desc: 'Hard, lactate threshold' },
    { name: 'Zone 5: Maximum', min: 90, max: 100, color: '#e11d48', desc: 'Very hard, VO2 max, sprints' },
  ].map(z => ({
    ...z,
    minBPM: Math.round(restingHR + hrReserve * z.min / 100),
    maxBPM: Math.round(restingHR + hrReserve * z.max / 100),
  }))

  const currentZone = zones.find(z => currentHR >= z.minBPM && currentHR <= z.maxBPM)

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Age</label>
          <input type="number" min={10} max={100} value={age} onChange={e => setAge(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Resting HR (bpm)</label>
          <input type="number" min={30} max={120} value={restingHR} onChange={e => setRestingHR(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current HR (bpm)</label>
          <input type="number" min={30} max={250} value={currentHR} onChange={e => setCurrentHR(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{220 - age}</Roll></b><span className="muted">Max HR (est.)</span></div>
        <div className="stat"><b><Roll>{hrReserve}</Roll></b><span className="muted">HR Reserve</span></div>
        <div className="stat"><b style={{ color: currentZone?.color || 'var(--text)' }}><Roll>{currentHR}</Roll></b><span className="muted">Current HR</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Your Zones (Karvonen)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {zones.map((z, i) => (
            <div key={i} className="pop-row" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              borderLeft: `4px solid ${z.color}`,
            }}>
              <span style={{ fontWeight: 600, color: z.color }}>{z.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 700, color: z.color }}><Roll>{z.minBPM}–{z.maxBPM}</Roll> bpm</span>
              <span className="muted" style={{ fontSize: '0.75rem', textAlign: 'center' }}>{z.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <div style={{ width: 200, height: 200, margin: '0 auto', position: 'relative', borderRadius: '50%', border: '8px solid var(--border)' }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border)" strokeWidth="16" />
            {zones.map((z, i) => {
              const start = i === 0 ? 0 : zones.slice(0, i).reduce((sum, z) => sum + (z.max - z.min), 0)
              const sweep = z.max - z.min
              return (
                <path key={i}
                  d={`M 100 10 A 90 90 0 ${sweep > 50 ? 1 : 0} 1 ${100 + 90 * Math.cos((start + sweep) * Math.PI / 50)} ${100 + 90 * Math.sin((start + sweep) * Math.PI / 50)}`}
                  fill="none" stroke={z.color} strokeWidth="16" strokeLinecap="round"
                  strokeDasharray={`${sweep * 1.8} 360`}
                  strokeDashoffset={-start * 1.8}
                />
              )
            })}
            <circle cx="100" cy="100" r="70" fill="var(--surface)" />
            <text x="100" y="115" textAnchor="middle" fontFamily="var(--mono)" fontSize="24" fontWeight="700" fill="var(--text)"><Roll>{currentHR}</Roll></text>
            <text x="100" y="140" textAnchor="middle" fontSize="12" fill="var(--muted)">bpm</text>
            {currentZone && (
              <text x="100" y="85" textAnchor="middle" fontSize="11" fontWeight="600" fill={currentZone.color}>{currentZone.name}</text>
            )}
          </svg>
        </div>
      </div>

      <Hint>Enter age and resting HR. Zones calculated using Karvonen formula (HR Reserve). Gauge shows current HR zone.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}