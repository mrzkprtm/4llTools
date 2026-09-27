import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface CategoryDef {
  base: string
  units: Record<string, number>
  special?: boolean
}

const CATEGORIES: Record<string, CategoryDef> = {
  Length: {
    base: 'm',
    units: {
      mm: 0.001, cm: 0.01, m: 1, km: 1000,
      in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
      nmi: 1852, ly: 9.461e15, au: 1.496e11,
    },
  },
  Weight: {
    base: 'kg',
    units: {
      mg: 1e-6, g: 0.001, kg: 1, t: 1000,
      oz: 0.0283495, lb: 0.453592, st: 6.35029,
      oz_troy: 0.0311035, ct: 0.0002,
    },
  },
  Temperature: {
    base: 'C',
    units: {
      C: 1, F: 1, K: 1,
    },
    special: true,
  },
  Volume: {
    base: 'L',
    units: {
      ml: 0.001, cl: 0.01, dl: 0.1, L: 1,
      m3: 1000, cm3: 0.001,
      tsp: 0.00492892, tbsp: 0.0147868, cup: 0.236588,
      pint: 0.473176, qt: 0.946353, gal: 3.78541,
      floz: 0.0295735,
    },
  },
  Area: {
    base: 'm2',
    units: {
      mm2: 1e-6, cm2: 1e-4, m2: 1, km2: 1e6,
      ha: 10000, acre: 4046.86,
      in2: 0.00064516, ft2: 0.092903, yd2: 0.836127, ac: 4046.86, mi2: 2.59e6,
    },
  },
  Speed: {
    base: 'm/s',
    units: {
      'm/s': 1, 'km/h': 1/3.6, mph: 0.44704,
      knot: 0.514444, 'ft/s': 0.3048, mach: 343, c: 299792458,
    },
  },
  Time: {
    base: 's',
    units: {
      ns: 1e-9, µs: 1e-6, ms: 1e-3, s: 1,
      min: 60, h: 3600, d: 86400,
      week: 604800, month: 2.628e6, year: 3.154e7,
    },
  },
  Data: {
    base: 'B',
    units: {
      B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4, PB: 1024**5,
      kbit: 125, Mbit: 125000, Gbit: 125000000,
      KiB: 1024, MiB: 1024**2, GiB: 1024**3, TiB: 1024**4,
    },
  },
  Pressure: {
    base: 'Pa',
    units: {
      Pa: 1, kPa: 1000, MPa: 1e6, GPa: 1e9,
      bar: 100000, mbar: 100, atm: 101325,
      psi: 6894.76, torr: 133.322, mmHg: 133.322,
    },
  },
  Energy: {
    base: 'J',
    units: {
      J: 1, kJ: 1000, MJ: 1e6, GJ: 1e9,
      cal: 4.184, kcal: 4184, kWh: 3.6e6, MWh: 3.6e9,
      BTU: 1055.06, therm: 1.055e8, eV: 1.602e-19,
    },
  },
}

type CategoryKey = keyof typeof CATEGORIES

export default function UnitConverter() {
  const [category, setCategory] = useState<CategoryKey>('Length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('ft')
  const [value, setValue] = useState(1)
  const [precision, setPrecision] = useState(6)
  const [swapDirection, setSwapDirection] = useState(false)

  const cat = CATEGORIES[category]
  const units = Object.keys(cat.units)

  useEffect(() => {
    if (!units.includes(fromUnit)) setFromUnit(units[0])
    if (!units.includes(toUnit)) setToUnit(units[1] || units[0])
  }, [category])

  const convert = useMemo(() => {
    if (category === 'Temperature') {
      const fromC = toCelsius(fromUnit, value)
      const toC = fromCelsius(toUnit, fromC)
      return toC
    }

    const baseValue = value * cat.units[fromUnit]
    return baseValue / cat.units[toUnit]
  }, [value, category, fromUnit, toUnit])

  const toCelsius = (unit: string, value: number) => {
    switch (unit) {
      case 'C': return value
      case 'F': return (value - 32) * 5/9
      case 'K': return value - 273.15
      default: return value
    }
  }

  const fromCelsius = (unit: string, celsius: number) => {
    switch (unit) {
      case 'C': return celsius
      case 'F': return celsius * 9/5 + 32
      case 'K': return celsius + 273.15
      default: return celsius
    }
  }

  const swap = () => {
    setSwapDirection(!swapDirection)
    setFromUnit(toUnit)
    setToUnit(fromUnit)
  }

  const quickValues = [1, 10, 100, 1000, 10000]

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Unit Converter</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value as any)}>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Precision</span>
          <select value={precision} onChange={e => setPrecision(Number(e.target.value))}>
            {[0,1,2,3,4,5,6,8,10].map(p => <option key={p} value={p}>{p} decimals</option>)}
          </select>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="muted">From</span>
                <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontSize: '1rem', minWidth: 150 }}>
                  {Object.keys(cat.units).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <input type="number" step="any" value={value} onChange={e => setValue(Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '12px 16px', fontSize: '1.5rem', fontFamily: 'var(--mono)', width: '100%', textAlign: 'right' }} />
            </label>
          </div>

          <button className="btn" onClick={swap} style={{ padding: '12px 16px', fontSize: '1.2rem', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ↻
          </button>

          <div style={{ flex: 1, minWidth: 200, textAlign: 'right' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <select value={toUnit} onChange={e => setToUnit(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontSize: '1rem', minWidth: 150 }}>
                  {Object.keys(cat.units).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <span className="muted">To</span>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 16px', fontSize: '1.5rem', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', minWidth: 200, textAlign: 'right' }}>
                <Roll value={category === 'Temperature' ? convert.toFixed(precision) : convert.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })} />
                <span className="muted" style={{ fontSize: '0.8rem', marginLeft: 8 }}>{toUnit}</span>
              </div>
            </label>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {quickValues.map(q => (
            <button key={q} className="btn" onClick={() => setValue(q)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>{q}</button>
          ))}
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
        <h4 style={{ margin: '0 0 12px' }}>Quick Conversion Table</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{fromUnit}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{toUnit}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{toUnit}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{fromUnit}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 5, 10, 25, 50, 100, 250, 500, 1000, 10000].map(val => {
                const fromBase = val * cat.units[fromUnit]
                const toVal = category === 'Temperature' 
                  ? fromCelsius(toUnit, toCelsius(fromUnit, val))
                  : fromBase / cat.units[toUnit]
                const toBase = val * cat.units[toUnit]
                const fromVal = category === 'Temperature'
                  ? fromCelsius(fromUnit, toCelsius(toUnit, val))
                  : toBase / cat.units[fromUnit]
                return (
                  <tr key={val} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
                    <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>{val.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>{category === 'Temperature' ? fromCelsius(toUnit, toCelsius(fromUnit, val)).toFixed(precision) : toVal.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>{val.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>{category === 'Temperature' ? fromCelsius(fromUnit, toCelsius(toUnit, val)).toFixed(precision) : fromVal.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}</td>
                  </tr>
                )})}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
        <h4 style={{ margin: '0 0 12px' }}>Common Conversions</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(CATEGORIES).map(([catName, catData]) => {
            const firstUnit = Object.keys(catData.units)[0]
            const secondUnit = Object.keys(catData.units)[1] || firstUnit
            const base1 = 1 * catData.units[firstUnit]
            const conv = catData.special 
              ? fromCelsius(secondUnit, toCelsius(firstUnit, 1))
              : base1 / catData.units[secondUnit]
            return (
              <div key={catName} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{catName}</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '0.9rem' }}>
                  1 {firstUnit} = {conv.toFixed(4)} {secondUnit}
                </div>
              </div>
            )})}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Convert between units in {Object.keys(CATEGORIES).length} categories. Temperature uses proper conversion formulas. Click ↻ to swap units. Quick values for common amounts.
      </p>
    </div>
  )
}