import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    tier: 'Basic',
    color: '#64748b',
    baseDaily: 15000,
    coverage: {
      medical: 50000000,
      evacuation: 100000000,
      baggage: 5000000,
      cancellation: 20000000,
      delay: 1000000,
      personalLiability: 100000000,
    },
    exclusions: ['Pre-existing conditions', 'Adventure sports', 'Alcohol-related incidents'],
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    tier: 'Standard',
    color: '#3b82f6',
    baseDaily: 35000,
    coverage: {
      medical: 200000000,
      evacuation: 500000000,
      baggage: 15000000,
      cancellation: 50000000,
      delay: 3000000,
      personalLiability: 200000000,
    },
    exclusions: ['Pre-existing conditions', 'Extreme sports'],
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    tier: 'Premium',
    color: '#9333ea',
    baseDaily: 65000,
    coverage: {
      medical: 1000000000,
      evacuation: 1000000000,
      baggage: 30000000,
      cancellation: 100000000,
      delay: 5000000,
      personalLiability: 500000000,
    },
    exclusions: ['Pre-existing conditions (waiver available)'],
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Plan',
    tier: 'Comprehensive',
    color: '#16a34a',
    baseDaily: 95000,
    coverage: {
      medical: 2000000000,
      evacuation: 2000000000,
      baggage: 50000000,
      cancellation: 200000000,
      delay: 10000000,
      personalLiability: 1000000000,
    },
    exclusions: ['Intentional acts', 'War/terrorism (separate policy)'],
  },
]

const DESTINATION_MULTIPLIERS = {
  'domestic': 0.8,
  'asean': 1.0,
  'asia': 1.2,
  'worldwide': 1.5,
  'worldwide-usa': 2.0,
}

const AGE_MULTIPLIERS = [
  { max: 17, mult: 0.8 },
  { max: 30, mult: 1.0 },
  { max: 45, mult: 1.2 },
  { max: 60, mult: 1.5 },
  { max: 70, mult: 2.0 },
  { max: 99, mult: 3.0 },
]

export default function TravelInsurance() {
  const [days, setDays] = useState(7)
  const [age, setAge] = useState(30)
  const [destination, setDestination] = useState<'domestic' | 'asean' | 'asia' | 'worldwide' | 'worldwide-usa'>('asean')
  const [travelers, setTravelers] = useState(1)
  const [addOns, setAddOns] = useState<string[]>([])

  const ageMult = useMemo(() => {
    return AGE_MULTIPLIERS.find(a => age <= a.max)?.mult || 3.0
  }, [age])

  const destMult = DESTINATION_MULTIPLIERS[destination]

  const addOnOptions = [
    { id: 'adventure', name: 'Adventure Sports Coverage', daily: 15000 },
    { id: 'gadget', name: 'Gadget Protection (up to 20M)', daily: 8000 },
    { id: 'rental', name: 'Rental Car Excess Waiver', daily: 12000 },
    { id: 'cruise', name: 'Cruise Coverage', daily: 10000 },
    { id: 'preexisting', name: 'Pre-existing Condition Waiver', daily: 25000 },
  ]

  const plansWithPrice = useMemo(() => {
    return PLANS.map(plan => {
      let daily = plan.baseDaily * destMult * ageMult
      addOns.forEach(addonId => {
        const addon = addOnOptions.find(a => a.id === addonId)
        if (addon) daily += addon.daily
      })
      const total = daily * days * travelers
      return { ...plan, daily: Math.round(daily), total: Math.round(total) }
    })
  }, [days, age, destination, travelers, addOns])

  const fmt = (n: number) => 'Rp' + Math.round(n).toLocaleString()

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Travel Insurance Comparator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Trip Duration (days)</span>
          <input type="number" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Your Age</span>
          <input type="number" min={0} max={99} value={age} onChange={e => setAge(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Travelers</span>
          <input type="number" min={1} max={10} value={travelers} onChange={e => setTravelers(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <span>Destination Region</span>
          <select value={destination} onChange={e => setDestination(e.target.value as any)}>
            <option value="domestic">Domestic (Indonesia)</option>
            <option value="asean">ASEAN</option>
            <option value="asia">Asia (excl. ASEAN)</option>
            <option value="worldwide">Worldwide (excl. USA/Canada)</option>
            <option value="worldwide-usa">Worldwide (incl. USA/Canada)</option>
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Add-ons</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {addOnOptions.map(addon => (
            <label key={addon.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={addOns.includes(addon.id)} onChange={e => setAddOns(e.target.checked ? [...addOns, addon.id] : addOns.filter(a => a !== addon.id))} />
              <span style={{ flex: 1 }}>{addon.name}</span>
              <span className="muted">{fmt(addon.daily)}/day</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {plansWithPrice.map((plan, i) => (
          <div key={plan.id} className="pop-row" style={{
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            overflow: 'hidden',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 80}ms`,
          }}>
            <div style={{ padding: 16, background: plan.color + '20', borderBottom: `2px solid ${plan.color}` }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
                    background: plan.color, color: 'white'
                  }}>
                    {plan.tier}
                  </span>
                  <h4 style={{ margin: 0, color: plan.color }}>{plan.name}</h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Per day per person</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: plan.color, fontFamily: 'var(--mono)' }}>
                    <Roll value={fmt(plan.daily)} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Total for {travelers} traveler{travelers > 1 ? 's' : ''} × {days} days</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                  <Roll value={fmt(plan.total)} />
                </div>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              <h5 style={{ margin: '0 0 12px' }}>Coverage Limits</h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                {Object.entries(plan.coverage).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                    <span className="muted" style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{fmt(value)}</span>
                  </div>
                ))}
              </div>

              <h5 style={{ margin: '16px 0 8px' }}>Key Exclusions</h5>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', lineHeight: 1.8 }}>
                {plan.exclusions.map((exc, ei) => (
                  <li key={ei} style={{ color: 'var(--muted)' }}>{exc}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <h4 style={{ margin: '0 0 12px' }}>Recommendation</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, color: 'var(--ok)', marginBottom: 4 }}>Budget Pick: Standard Plan</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>Good balance of coverage and cost for most trips</div>
          </div>
          <div style={{ padding: 12, background: 'var(--accent)20', border: '1px solid var(--accent)40', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>Best Value: Premium Plan</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>High medical limits, covers most needs</div>
          </div>
          <div style={{ padding: 12, background: '#16a34a20', border: '1px solid #16a34a40', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>Peace of Mind: Comprehensive</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>Maximum coverage for expensive trips/families</div>
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Premiums are estimates based on Indonesian market averages. Actual quotes vary by provider. Always read policy wording before purchase.
      </p>
    </div>
  )
}