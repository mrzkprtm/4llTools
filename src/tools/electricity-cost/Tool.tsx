import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'

const APPLIANCES = [
  { name: 'Air Conditioner (1 PK)', watts: 800, hours: 8 },
  { name: 'Air Conditioner (2 PK)', watts: 1600, hours: 8 },
  { name: 'Refrigerator', watts: 150, hours: 24 },
  { name: 'Washing Machine', watts: 500, hours: 2 },
  { name: 'Iron', watts: 1000, hours: 1 },
  { name: 'Rice Cooker', watts: 400, hours: 1 },
  { name: 'Water Dispenser', watts: 100, hours: 24 },
  { name: 'TV (LED 42")', watts: 80, hours: 5 },
  { name: 'Fan', watts: 75, hours: 12 },
  { name: 'Light Bulb (LED 10W)', watts: 10, hours: 6 },
  { name: 'Laptop', watts: 60, hours: 8 },
  { name: 'Phone Charger', watts: 5, hours: 4 },
] as const

const PLN_TARIFFS = [
  { name: '450 VA (R1)', rate: 415, threshold: 450 },
  { name: '900 VA (R1)', rate: 1352, threshold: 900 },
  { name: '1300 VA (R1)', rate: 1444, threshold: 1300 },
  { name: '2200 VA (R1)', rate: 1444, threshold: 2200 },
  { name: 'Over 2200 VA (R2/R3)', rate: 1699, threshold: Infinity },
]

export default function ElectricityCost() {
  const [appliances, setAppliances] = useState(() => {
    const saved = localStorage.getItem('electricity-cost')
    return saved ? JSON.parse(saved) : APPLIANCES.map((a, i) => ({ ...a, id: i, enabled: true }))
  })
  const [tariffIdx, setTariffIdx] = useState(1)

  useEffect(() => {
    try { localStorage.setItem('electricity-cost', JSON.stringify(appliances)) } catch {}
  }, [appliances])

  const tariff = PLN_TARIFFS[tariffIdx]
  const dailyKwh = appliances.filter(a => a.enabled).reduce((sum, a) => sum + a.watts * a.hours / 1000, 0)
  const monthlyKwh = dailyKwh * 30
  const monthlyCost = monthlyKwh * tariff.rate

  const addAppliance = () => {
    setAppliances([...appliances, { id: Date.now(), name: 'New Appliance', watts: 100, hours: 1, enabled: true }])
  }

  const removeAppliance = (id: number) => {
    setAppliances(appliances.filter(a => a.id !== id))
  }

  const updateAppliance = (id: number, field: string, value: string | number | boolean) => {
    setAppliances(appliances.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>PLN Tariff</span>
          <select value={tariffIdx} onChange={e => setTariffIdx(Number(e.target.value))}>
            {PLN_TARIFFS.map((t, i) => <option key={t.name} value={i}>{t.name} — Rp{t.rate.toLocaleString()}/kWh</option>)}
          </select>
        </label>
        <div className="stat"><b>Rate: </b><span><Roll>Rp{tariff.rate.toLocaleString()}</Roll>/kWh</span></div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {appliances.map((app, i) => (
          <div key={app.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            opacity: app.enabled ? 1 : 0.5,
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <input type="checkbox" checked={app.enabled} onChange={e => updateAppliance(app.id, 'enabled', e.target.checked)} />
              <span style={{ flex: 1, fontWeight: 500 }}>{app.name}</span>
            </label>
            <span className="muted" style={{ minWidth: 60 }}><Roll>{app.watts}</Roll>W</span>
            <input type="number" min={0.1} max={24} step={0.5} value={app.hours} onChange={e => updateAppliance(app.id, 'hours', Number(e.target.value))} style={{ width: 70 }} />
            <span className="muted" style={{ minWidth: 30 }}>h</span>
            <span style={{ fontFamily: 'var(--mono)', minWidth: 100, textAlign: 'right' }}><Roll>{(app.watts * app.hours / 1000).toFixed(2)}</Roll> kWh/day</span>
            <span style={{ fontFamily: 'var(--mono)', minWidth: 100, textAlign: 'right', color: 'var(--accent)' }}><Roll>{(app.watts * app.hours / 1000 * 30 * tariff.rate).toLocaleString()}</Roll>/mo</span>
            <button className="btn" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => removeAppliance(app.id)}>✕</button>
          </div>
        ))}
      </div>

      <button className="btn" onClick={addAppliance}>+ Add Appliance</button>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{dailyKwh.toFixed(2)}</Roll></b><span className="muted">kWh/day</span></div>
        <div className="stat"><b><Roll>{monthlyKwh.toFixed(1)}</Roll></b><span className="muted">kWh/month</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll>Rp{monthlyCost.toLocaleString()}</Roll></b><span className="muted">Est. Monthly Cost</span></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Top Consumers</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {appliances.filter(a => a.enabled)
            .sort((a, b) => b.watts * b.hours - a.watts * a.hours)
            .slice(0, 5).map((app, i) => (
              <div key={app.id} className="pop-row" style={{
                display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                animation: 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 60}ms`
              }}>
                <span style={{ fontWeight: 500 }}>{app.name}</span>
                <div className="row" style={{ gap: 16 }}>
                  <span><b><Roll>{(app.watts * app.hours / 1000).toFixed(2)}</Roll></b> kWh/day</span>
                  <span style={{ color: 'var(--accent)' }}><b><Roll>{(app.watts * app.hours / 1000 * 30 * tariff.rate).toLocaleString()}</Roll></b>/mo</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      <Hint>Add appliances with watts and hours/day. Spinning meter shows monthly cost with PLN tariff. Top consumers ranked.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}