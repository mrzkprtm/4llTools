import { useState, useMemo } from 'react'
import { reducedMotion } from '../../motion/springs'

const PASSPORTS = [
  { code: 'ID', name: 'Indonesia', rank: 72 },
  { code: 'US', name: 'United States', rank: 7 },
  { code: 'SG', name: 'Singapore', rank: 1 },
  { code: 'MY', name: 'Malaysia', rank: 12 },
  { code: 'TH', name: 'Thailand', rank: 65 },
  { code: 'JP', name: 'Japan', rank: 1 },
  { code: 'KR', name: 'South Korea', rank: 2 },
  { code: 'CN', name: 'China', rank: 62 },
  { code: 'AU', name: 'Australia', rank: 6 },
  { code: 'GB', name: 'United Kingdom', rank: 4 },
  { code: 'DE', name: 'Germany', rank: 2 },
  { code: 'FR', name: 'France', rank: 2 },
  { code: 'CA', name: 'Canada', rank: 7 },
  { code: 'AE', name: 'UAE', rank: 11 },
  { code: 'SA', name: 'Saudi Arabia', rank: 61 },
  { code: 'IN', name: 'India', rank: 80 },
  { code: 'PH', name: 'Philippines', rank: 75 },
  { code: 'VN', name: 'Vietnam', rank: 88 },
  { code: 'BR', name: 'Brazil', rank: 17 },
  { code: 'ZA', name: 'South Africa', rank: 53 },
]

const COUNTRIES = [
  { code: 'ID', name: 'Indonesia', region: 'Southeast Asia' },
  { code: 'SG', name: 'Singapore', region: 'Southeast Asia' },
  { code: 'MY', name: 'Malaysia', region: 'Southeast Asia' },
  { code: 'TH', name: 'Thailand', region: 'Southeast Asia' },
  { code: 'VN', name: 'Vietnam', region: 'Southeast Asia' },
  { code: 'PH', name: 'Philippines', region: 'Southeast Asia' },
  { code: 'JP', name: 'Japan', region: 'East Asia' },
  { code: 'KR', name: 'South Korea', region: 'East Asia' },
  { code: 'CN', name: 'China', region: 'East Asia' },
  { code: 'HK', name: 'Hong Kong', region: 'East Asia' },
  { code: 'TW', name: 'Taiwan', region: 'East Asia' },
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'MX', name: 'Mexico', region: 'North America' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'IT', name: 'Italy', region: 'Europe' },
  { code: 'ES', name: 'Spain', region: 'Europe' },
  { code: 'NL', name: 'Netherlands', region: 'Europe' },
  { code: 'CH', name: 'Switzerland', region: 'Europe' },
  { code: 'AE', name: 'UAE', region: 'Middle East' },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East' },
  { code: 'QA', name: 'Qatar', region: 'Middle East' },
  { code: 'TR', name: 'Turkey', region: 'Europe/Asia' },
  { code: 'AU', name: 'Australia', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania' },
  { code: 'BR', name: 'Brazil', region: 'South America' },
  { code: 'AR', name: 'Argentina', region: 'South America' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
]

const VISA_DATA: Record<string, Record<string, { type: 'visa-free' | 'e-visa' | 'visa-on-arrival' | 'embassy-visa' | 'eta'; days?: number; note?: string }>> = {
  'ID': {
    'SG': { type: 'visa-free', days: 30 },
    'MY': { type: 'visa-free', days: 30 },
    'TH': { type: 'visa-free', days: 30 },
    'VN': { type: 'e-visa', days: 30, note: '30-day single entry' },
    'PH': { type: 'visa-free', days: 30 },
    'JP': { type: 'embassy-visa', note: 'Apply at embassy' },
    'KR': { type: 'e-visa', days: 90, note: 'K-ETA required' },
    'CN': { type: 'embassy-visa' },
    'HK': { type: 'visa-free', days: 14 },
    'TW': { type: 'e-visa', note: 'Travel authorization cert' },
    'US': { type: 'embassy-visa' },
    'CA': { type: 'embassy-visa' },
    'GB': { type: 'embassy-visa' },
    'DE': { type: 'embassy-visa' },
    'FR': { type: 'embassy-visa' },
    'AE': { type: 'visa-on-arrival', days: 30 },
    'SA': { type: 'e-visa', days: 90 },
    'AU': { type: 'embassy-visa' },
    'NZ': { type: 'embassy-visa' },
    'TR': { type: 'e-visa', days: 30 },
    'BR': { type: 'embassy-visa' },
    'ZA': { type: 'embassy-visa' },
  },
  'US': {
    'ID': { type: 'visa-on-arrival', days: 30 },
    'SG': { type: 'visa-free', days: 90 },
    'MY': { type: 'visa-free', days: 90 },
    'TH': { type: 'visa-free', days: 30 },
    'VN': { type: 'e-visa', days: 30 },
    'PH': { type: 'visa-free', days: 30 },
    'JP': { type: 'visa-free', days: 90 },
    'KR': { type: 'visa-free', days: 90, note: 'K-ETA required' },
    'CN': { type: 'embassy-visa' },
    'HK': { type: 'visa-free', days: 90 },
    'TW': { type: 'visa-free', days: 90 },
    'GB': { type: 'visa-free', days: 180 },
    'DE': { type: 'visa-free', days: 90, note: 'Schengen area' },
    'FR': { type: 'visa-free', days: 90, note: 'Schengen area' },
    'AE': { type: 'visa-on-arrival', days: 30 },
    'SA': { type: 'e-visa', days: 90 },
    'AU': { type: 'eta', days: 90, note: 'ETA required' },
    'NZ': { type: 'eta', days: 90, note: 'NZeTA required' },
    'TR': { type: 'e-visa', days: 90 },
    'BR': { type: 'visa-free', days: 90 },
    'ZA': { type: 'visa-free', days: 90 },
  },
}

const TYPE_COLORS = {
  'visa-free': 'var(--ok)',
  'e-visa': 'var(--accent)',
  'visa-on-arrival': '#f59e0b',
  'embassy-visa': 'var(--danger)',
  'eta': '#8b5cf6',
}

const TYPE_LABELS = {
  'visa-free': 'Visa Free ✓',
  'e-visa': 'E-Visa 🌐',
  'visa-on-arrival': 'Visa on Arrival 🛬',
  'embassy-visa': 'Embassy Visa 🏛️',
  'eta': 'ETA 📱',
}

export default function VisaChecker() {
  const [passport, setPassport] = useState('ID')
  const [destination, setDestination] = useState('SG')
  const [showAll, setShowAll] = useState(false)

  const visaInfo = useMemo(() => {
    const data = VISA_DATA[passport]?.[destination]
    if (data) return data
    if (passport === destination) return { type: 'visa-free' as const, days: 0, note: 'Your home country' }
    return { type: 'embassy-visa' as const, note: 'Data not available - check embassy' }
  }, [passport, destination])

  const allDestinations = useMemo(() => {
    const data = VISA_DATA[passport] || {}
    return COUNTRIES.map(c => ({
      ...c,
      visa: data[c.code] || { type: 'embassy-visa' as const, note: 'Check embassy' }
    }))
  }, [passport])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Visa Requirements Checker</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Your Passport</span>
          <select value={passport} onChange={e => setPassport(e.target.value)}>
            {PASSPORTS.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name} (Rank #{p.rank})</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Destination</span>
          <select value={destination} onChange={e => setDestination(e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name} ({c.region})</option>)}
          </select>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 24, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, textAlign: 'center', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ fontSize: '0.9rem' }}>Passport</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{passport}</div>
          </div>
          <span style={{ fontSize: '2rem' }}>→</span>
          <div>
            <div className="muted" style={{ fontSize: '0.9rem' }}>Destination</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{destination}</div>
          </div>
        </div>

        <div style={{
          display: 'inline-block', padding: '16px 32px', borderRadius: 'var(--radius)',
          background: TYPE_COLORS[visaInfo.type] + '20', border: `2px solid ${TYPE_COLORS[visaInfo.type]}`,
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: TYPE_COLORS[visaInfo.type], marginBottom: 8 }}>
            {TYPE_LABELS[visaInfo.type]}
          </div>
          {visaInfo.days && visaInfo.days > 0 && (
            <div style={{ fontSize: '1.1rem', color: 'var(--text)' }}>Stay: <b>{visaInfo.days} days</b></div>
          )}
          {visaInfo.note && (
            <div className="muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>{visaInfo.note}</div>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16, justifyContent: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          <span>Show all destinations for this passport</span>
        </label>
      </div>

      {showAll && (
        <div style={{ display: 'grid', gap: 8 }}>
          {allDestinations
            .filter(c => c.code !== passport)
            .sort((a, b) => {
              const order = { 'visa-free': 0, 'eta': 1, 'e-visa': 2, 'visa-on-arrival': 3, 'embassy-visa': 4 }
              return order[a.visa.type] - order[b.visa.type]
            })
            .map((c, i) => (
              <div key={c.code} className="pop-row" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 20}ms`,
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name} ({c.code})</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{c.region}</div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                    background: TYPE_COLORS[c.visa.type] + '20', color: TYPE_COLORS[c.visa.type]
                  }}>
                    {TYPE_LABELS[c.visa.type]}
                  </span>
                  {c.visa.days && visaInfo.days && c.visa.days > 0 && (
                    <span className="muted" style={{ fontSize: '0.8rem' }}>{c.visa.days} days</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Legend</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
              <div style={{ width: 12, height: 12, borderRadius: 4, background: TYPE_COLORS[key as keyof typeof TYPE_COLORS] }} />
              <span style={{ fontSize: '0.85rem' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Data is for reference only. Always verify with official embassy/immigration websites before travel. Rules change frequently.
      </p>
    </div>
  )
}