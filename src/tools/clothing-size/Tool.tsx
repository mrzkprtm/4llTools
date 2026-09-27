import { useState, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const WOMEN_SIZE_CHARTS = {
  US: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
  UK: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
  EU: [32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56],
  JP: [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27],
  CN: [150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210],
  AU: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
}

const MEN_SIZE_CHARTS = {
  US: [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58],
  UK: [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58],
  EU: [44, 46, 48, 50, 52, 54, 56, 58, 60, 62, 64, 66, 68],
  JP: ['S', 'M', 'L', 'LL', '3L', '4L', '5L', '6L', '7L', '8L'],
  CN: [160, 165, 170, 175, 180, 185, 190, 195, 200, 205],
  AU: [34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58],
}

const SHOE_SIZE_CHARTS = {
  US_M: [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 15],
  US_W: [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12],
  UK_M: [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14],
  UK_W: [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10],
  EU: [35, 35.5, 36, 36.5, 37, 37.5, 38, 38.5, 39, 39.5, 40, 40.5, 41, 41.5, 42, 42.5, 43, 43.5, 44, 44.5, 45, 45.5, 46, 46.5, 47, 48, 49, 50],
  JP: [21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, 30, 30.5, 31],
  CN: [33, 34, 35, 36, 37, 38, 39, 40, 41, 41.5, 42, 42.5, 43, 43.5, 44, 44.5, 45, 45.5, 46, 46.5, 47, 48],
}

const CATEGORIES = {
  'Women\'s Clothing': { charts: WOMEN_SIZE_CHARTS, icon: '👗' },
  'Men\'s Clothing': { charts: MEN_SIZE_CHARTS, icon: '👔' },
  'Men\'s Shoes': { charts: { US: SHOE_SIZE_CHARTS.US_M, UK: SHOE_SIZE_CHARTS.UK_M, EU: SHOE_SIZE_CHARTS.EU, JP: SHOE_SIZE_CHARTS.JP, CN: SHOE_SIZE_CHARTS.CN }, icon: '👞' },
  'Women\'s Shoes': { charts: { US: SHOE_SIZE_CHARTS.US_W, UK: SHOE_SIZE_CHARTS.UK_W, EU: SHOE_SIZE_CHARTS.EU, JP: SHOE_SIZE_CHARTS.JP, CN: SHOE_SIZE_CHARTS.CN }, icon: '👠' },
}

export default function ClothingSize() {
  const [category, setCategory] = useState("Women's Clothing")
  const [fromSystem, setFromSystem] = useState('US')
  const [fromSize, setFromSize] = useState('')
  const [showAll, setShowAll] = useState(false)

  const charts = CATEGORIES[category].charts
  const systems = Object.keys(charts)

  const convertedSizes = useMemo(() => {
    if (!fromSize) return {}
    const fromSizes = charts[fromSystem]
    const idx = fromSizes.indexOf(fromSize)
    if (idx === -1) return {}

    const result: Record<string, string> = {}
    Object.entries(charts).forEach(([system, sizes]) => {
      if (sizes[idx] !== undefined) {
        result[system] = String(sizes[idx])
      }
    })
    return result
  }, [charts, fromSystem, fromSize])

  const allSizes = useMemo(() => {
    if (!fromSize) return {}
    const result: Record<string, string[]> = {}
    Object.entries(charts).forEach(([system, sizes]) => {
      result[system] = sizes.map(s => String(s))
    })
    return result
  }, [charts])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Clothing Size Converter</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Category</span>
          <select value={category} onChange={e => { setCategory(e.target.value); setFromSize('') }}>
            {Object.entries(CATEGORIES).map(([name, data]) => <option key={name} value={name}>{data.icon} {name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>From System</span>
          <select value={fromSystem} onChange={e => setFromSystem(e.target.value)}>
            {Object.keys(charts).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Your Size</span>
          <input type="text" value={fromSize} onChange={e => setFromSize(e.target.value)} placeholder="e.g., 8, 38, M, 25.5" />
        </label>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={false} onChange={e => setShowAll(e.target.checked)} />
          <span>Show all sizes for all systems</span>
        </label>
      </div>

      {fromSize && Object.keys(convertedSizes).length > 0 && (
        <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 16px' }}>Your Size: <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fromSize} ({fromSystem})</span></h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {Object.entries(convertedSizes).map(([system, size]) => (
              <div key={system} style={{ padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center', border: system === fromSystem ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                <div className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: 8 }}>{system}</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: system === fromSystem ? 'var(--accent)' : 'var(--text)' }}>
                  {size}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {Object.entries(charts).map(([system, sizes]) => (
          <details key={system} defaultOpen={!showAll || system === fromSystem} style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <summary style={{ padding: 12, background: system === fromSystem ? 'var(--accent)20' : 'var(--bg)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: system === fromSystem ? 'var(--accent)' : 'var(--text)' }}>{system}</span>
              <span className="muted">{sizes.length} sizes</span>
            </summary>
            <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
              {sizes.map((size, idx) => (
                <div key={`${system}-${idx}`} style={{
                  padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, textAlign: 'center',
                  fontWeight: String(size) === fromSize ? 700 : 400,
                  color: String(size) === fromSize ? 'var(--accent)' : 'var(--text)',
                  background: String(size) === fromSize ? 'var(--accent)20' : 'var(--bg)',
                  border: String(size) === fromSize ? '2px solid var(--accent)' : '1px solid var(--border)',
                }}>
                  {size}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Quick Reference: Body Measurements (cm)</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Measurement</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>XS</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>S</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>M</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>L</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>XL</th>
                <th style={{ textAlign: 'center', padding: '8px 12px' }}>XXL</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Bust/Chest', women: [80, 84, 88, 92, 96, 100], men: [88, 92, 96, 100, 104, 108] },
                { label: 'Waist', women: [62, 66, 70, 74, 78, 82], men: [72, 76, 80, 84, 88, 92] },
                { label: 'Hips', women: [88, 92, 96, 100, 104, 108], men: [92, 96, 100, 104, 108, 112] },
                { label: 'Inseam', women: [72, 73, 74, 75, 76, 77], men: [76, 78, 80, 82, 84, 86] },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{row.label}</td>
                  {['women', 'men'].map(gender => (
                    <td key={gender} style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {row[gender as keyof typeof row].map(v => <div key={v}>{v} cm</div>)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Enter your size in one system to see equivalents across US, UK, EU, JP, CN, AU. Charts cover women's/men's clothing and shoes. Sizes are approximate—always check brand-specific charts.
      </p>
    </div>
  )
}