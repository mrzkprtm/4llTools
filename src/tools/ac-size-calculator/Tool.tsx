import { useState } from 'react'
import { Roll } from '../../motion/Roll'

const ORIENTATION_FACTORS = { north: 1.1, south: 0.9, east: 1.15, west: 1.15 }
const INSULATION_FACTORS = { poor: 1.2, average: 1.0, good: 0.8 }
const CEILING_FACTORS = { low: 0.9, standard: 1.0, high: 1.1 }

export default function AcSizeCalculator() {
  const [length, setLength] = useState(4)
  const [width, setWidth] = useState(3)
  const [height, setHeight] = useState(2.7)
  const [orientation, setOrientation] = useState<'north' | 'south' | 'east' | 'west'>('south')
  const [insulation, setInsulation] = useState<'poor' | 'average' | 'good'>('average')
  const [ceiling, setCeiling] = useState<'low' | 'standard' | 'high'>('standard')
  const [people, setPeople] = useState(2)
  const [appliances, setAppliances] = useState(500) // watts
  const [sunExposure, setSunExposure] = useState<'full' | 'partial' | 'shaded'>('partial')

  const area = length * width
  const volume = area * height
  const baseBtu = area * 600 // Basic rule: 600 BTU per m²

  const orientationFactor = ORIENTATION_FACTORS[orientation]
  const insulationFactor = INSULATION_FACTORS[insulation]
  const ceilingFactor = CEILING_FACTORS[ceiling]
  const peopleBtu = people * 600
  const applianceBtu = appliances * 3.412 // watts to BTU
  const sunFactor = sunExposure === 'full' ? 1.15 : sunExposure === 'partial' ? 1.0 : 0.85

  const totalBtu = Math.round(baseBtu * orientationFactor * insulationFactor * ceilingFactor * sunFactor + peopleBtu + applianceBtu)
  const pk = Math.round(totalBtu / 9000 * 2) / 2 // PK in 0.5 increments
  const btuPerPk = 9000

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Length (m)</span>
          <input type="number" step="0.1" min={1} max={20} value={length} onChange={e => setLength(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Width (m)</span>
          <input type="number" step="0.1" min={1} max={20} value={width} onChange={e => setWidth(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Height (m)</span>
          <input type="number" step="0.1" min={2} max={5} value={height} onChange={e => setHeight(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Window Orientation</span>
          <select value={orientation} onChange={e => setOrientation(e.target.value as any)}>
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </select>
        </label>
      </div>

      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Insulation</span>
          <select value={insulation} onChange={e => setInsulation(e.target.value as any)}>
            <option value="poor">Poor</option>
            <option value="average">Average</option>
            <option value="good">Good</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Ceiling Height</span>
          <select value={ceiling} onChange={e => setCeiling(e.target.value as any)}>
            <option value="low">Low (less than 2.5m)</option>
            <option value="standard">Standard (2.5-3m)</option>
            <option value="high">High (over 3m)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>People</span>
          <input type="number" min={0} max={20} value={people} onChange={e => setPeople(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Appliances (W)</span>
          <input type="number" min={0} max={5000} step={50} value={appliances} onChange={e => setAppliances(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Sun Exposure</span>
          <select value={sunExposure} onChange={e => setSunExposure(e.target.value as any)}>
            <option value="full">Full Sun</option>
            <option value="partial">Partial</option>
            <option value="shaded">Shaded</option>
          </select>
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{totalBtu.toLocaleString()}</Roll></b><span className="muted">BTU/h Required</span></div>
        <div className="stat"><b><Roll>{pk}</Roll></b><span className="muted">PK ({pk * 9000} BTU)</span></div>
        <div className="stat"><b><Roll>{Math.ceil(totalBtu / 9000 * 10) / 10}</Roll></b><span className="muted">Exact PK</span></div>
        <div className="stat"><b><Roll>{area.toFixed(1)}</Roll></b><span className="muted">Room Area (m²)</span></div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Heat Load Breakdown</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { name: 'Base (Area × 600)', btu: Math.round(area * 600) },
            { name: `Orientation (${orientation})`, btu: Math.round(area * 600 * (orientationFactor - 1)) },
            { name: `Insulation (${insulation})`, btu: Math.round(area * 600 * (insulationFactor - 1)) },
            { name: `Ceiling (${ceiling})`, btu: Math.round(area * 600 * (ceilingFactor - 1)) },
            { name: `Sun Exposure (${sunExposure})`, btu: Math.round(area * 600 * (sunFactor - 1)) },
            { name: `People (${people})`, btu: peopleBtu },
            { name: `Appliances (${appliances}W)`, btu: applianceBtu },
          ].map((item, i) => (
            <div key={item.name} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              animation: 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 50}ms`
            }}>
              <span>{item.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: item.btu >= 0 ? 'var(--accent)' : 'var(--ok)' }}>
                <Roll>{item.btu >= 0 ? '+' : ''}{item.btu.toLocaleString()}</Roll> BTU
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ marginTop: 0, marginBottom: 12 }}>Recommendation</h4>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          For a {area.toFixed(1)} m² room, you need <b>{totalBtu.toLocaleString()} BTU/h</b> ({pk} PK).
          Consider a {pk} PK unit. For better efficiency, choose inverter type.
        </p>
      </div>

      <Hint>Sketch room dimensions. Heat arrows show load from sun, people, appliances. Recommends BTU and PK with 0.5 increments.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}