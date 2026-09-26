import { useState } from 'react'
import { Roll } from '../../motion/Roll'

const INGREDIENT_DENSITIES: Record<string, number> = {
  'All-purpose flour': 125,
  'Bread flour': 130,
  'Cake flour': 115,
  'Granulated sugar': 200,
  'Brown sugar (packed)': 220,
  'Powdered sugar': 120,
  'Butter': 227,
  'Vegetable oil': 218,
  'Milk': 244,
  'Water': 236,
  'Honey': 340,
  'Maple syrup': 320,
  'Cocoa powder': 100,
  'Baking powder': 192,
  'Baking soda': 288,
  'Salt': 288,
  'Rolled oats': 90,
  'Rice (uncooked)': 185,
  'Quinoa (uncooked)': 170,
}

const OVEN_TEMPS = [
  { c: 150, f: 300, gas: 2 },
  { c: 160, f: 325, gas: 3 },
  { c: 175, f: 350, gas: 4 },
  { c: 180, f: 355, gas: 4 },
  { c: 190, f: 375, gas: 5 },
  { c: 200, f: 400, gas: 6 },
  { c: 210, f: 410, gas: 7 },
  { c: 220, f: 425, gas: 7 },
  { c: 230, f: 450, gas: 8 },
  { c: 240, f: 465, gas: 9 },
]

const PAN_SIZES = [
  { name: '8" round', area: 50.3 },
  { name: '9" round', area: 63.6 },
  { name: '10" round', area: 78.5 },
  { name: '8" square', area: 64 },
  { name: '9" square', area: 81 },
  { name: '9x13"', area: 117 },
  { name: '10" tube', area: 78.5 },
]

export default function BakingConverter() {
  const [cups, setCups] = useState(1)
  const [ingredient, setIngredient] = useState('All-purpose flour')
  const [ovenC, setOvenC] = useState(180)
  const [fromPan, setFromPan] = useState(1)
  const [toPan, setToPan] = useState(2)
  const [depthFrom, setDepthFrom] = useState(2.5)
  const [depthTo, setDepthTo] = useState(2.5)

  const density = INGREDIENT_DENSITIES[ingredient] || 125
  const grams = Math.round(cups * 236.588 * density / 100) * 100 / 100

  const ovenF = Math.round(ovenC * 9/5 + 32)
  const ovenGas = OVEN_TEMPS.find(t => t.c === ovenC)?.gas || '—'

  const areaRatio = PAN_SIZES[toPan].area / PAN_SIZES[fromPan].area
  const depthRatio = depthTo / depthFrom
  const scaleFactor = areaRatio * depthRatio

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Ingredient</label>
          <select value={ingredient} onChange={e => setIngredient(e.target.value)}>
            {Object.keys(INGREDIENT_DENSITIES).map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Cups</label>
          <input type="number" step="0.125" min={0.0625} value={cups} onChange={e => setCups(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Oven °C</label>
          <input type="number" min={100} max={260} value={ovenC} onChange={e => setOvenC(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{grams.toFixed(1)}</Roll></b><span className="muted">Grams</span></div>
        <div className="stat"><b><Roll>{ovenF}</Roll>°F</b><span className="muted">Oven °F</span></div>
        <div className="stat"><b><Roll>{ovenGas}</Roll></b><span className="muted">Gas Mark</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Pan Size Scaling</h4>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>From Pan</label>
            <select value={fromPan} onChange={e => setFromPan(Number(e.target.value))}>
              {PAN_SIZES.map((p, i) => <option key={p.name} value={i}>{p.name} ({p.area.toFixed(1)} cm²)</option>)}
            </select>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <span>Depth (cm)</span>
              <input type="number" step="0.1" min={0.5} max={10} value={depthFrom} onChange={e => setDepthFrom(Number(e.target.value))} />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>To Pan</label>
            <select value={toPan} onChange={e => setToPan(Number(e.target.value))}>
              {PAN_SIZES.map((p, i) => <option key={p.name} value={i}>{p.name} ({p.area.toFixed(1)} cm²)</option>)}
            </select>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <span>Depth (cm)</span>
              <input type="number" step="0.1" min={0.5} max={10} value={depthTo} onChange={e => setDepthTo(Number(e.target.value))} />
            </label>
          </div>
        </div>

        <div className="stats" style={{ marginTop: 16 }}>
          <div className="stat"><b><Roll>{(scaleFactor * 100).toFixed(0)}</Roll>%</b><span className="muted">Scale Factor</span></div>
          <div className="stat"><b><Roll>{scaleFactor.toFixed(2)}</Roll>×</b><span className="muted">Multiply Recipe</span></div>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          {PAN_SIZES.map((p, i) => (
            <div key={p.name} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
              background: i === fromPan ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : i === toPan ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : 'var(--sunken)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            }}>
              <span>{p.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: i === toPan ? 'var(--ok)' : 'var(--text)' }}>
                {i === fromPan ? '1.00×' : (p.area / PAN_SIZES[fromPan].area * depthTo / depthFrom).toFixed(2)}×
              </span>
            </div>
          ))}
        </div>
      </div>

      <Hint>Enter cups to get grams. Oven converts °C/°F/Gas. Pan scaling shows multiplier for any pan size.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}