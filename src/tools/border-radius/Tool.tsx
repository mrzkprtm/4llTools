import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { clampRadius, radiusCss, tailwindClasses, type RadiusValues, type Unit } from './radius'

const CORNERS: { key: keyof RadiusValues; label: string }[] = [
  { key: 'tl', label: 'Top left' },
  { key: 'tr', label: 'Top right' },
  { key: 'br', label: 'Bottom right' },
  { key: 'bl', label: 'Bottom left' },
]

const ZERO: RadiusValues = { tl: 0, tr: 0, br: 0, bl: 0 }

export default function BorderRadius() {
  const [corners, setCorners] = useState<RadiusValues>({ tl: 24, tr: 24, br: 24, bl: 24 })
  const [vertical, setVertical] = useState<RadiusValues>({ tl: 24, tr: 24, br: 24, bl: 24 })
  const [linked, setLinked] = useState(true)
  const [unit, setUnit] = useState<Unit>('px')
  const [elliptical, setElliptical] = useState(false)
  const [second, setSecond] = useState(false)
  const [out, setOut] = useState<'css' | 'tailwind'>('css')

  const max = unit === '%' ? 50 : 200
  const radiusValue = radiusCss({ ...corners, linked, unit: unit, v: second ? vertical : null })
    .replace(/^border-radius: /, '')
    .replace(/;$/, '')
  const code = out === 'css' ? `border-radius: ${radiusValue};` : tailwindClasses(corners, unit)

  const set = (key: keyof RadiusValues, value: number, vert = false) => {
    const v = clampRadius(value)
    const apply = (prev: RadiusValues) => (linked ? { tl: v, tr: v, br: v, bl: v } : { ...prev, [key]: v })
    if (vert) setVertical(apply)
    else setCorners(apply)
  }

  const reset = () => {
    setCorners(ZERO)
    setVertical(ZERO)
  }

  return (
    <div>
      <div style={{ display: 'grid', placeItems: 'center', padding: '28px 12px', background: 'var(--sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <div
          aria-hidden="true"
          style={{
            width: 'min(320px, 100%)',
            height: 180,
            background: 'linear-gradient(135deg, var(--accent), #ec4899)',
            border: '2px solid var(--surface)',
            borderRadius: radiusValue,
            transition: 'border-radius 0.15s var(--ease-out)',
          }}
        />
      </div>

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="br-unit">Unit</label>
          <select id="br-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="px">px</option>
            <option value="%">percent</option>
          </select>

          <div className="row" style={{ marginTop: 14 }}>
            <label className="row" style={{ fontWeight: 400, gap: 8, margin: 0 }}>
              <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
              Link all corners
            </label>
            <button type="button" className="btn" onClick={reset}>Reset</button>
          </div>

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={second} onChange={(e) => setSecond(e.target.checked)} />
            Elliptical radii (horizontal / vertical)
          </label>
        </div>

        <div>
          {CORNERS.map((c) => (
            <div key={c.key} style={{ marginBottom: 10 }}>
              <label htmlFor={`br-${c.key}`} style={{ margin: '0 0 4px' }}>
                <span>{c.label}</span> <span className="muted">{corners[c.key]}{unit}</span>
              </label>
              <input id={`br-${c.key}`} type="range" min={0} max={max} value={corners[c.key]} onChange={(e) => set(c.key, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>

      {second && (
        <>
          <h3 className="eyebrow" style={{ marginTop: 18 }}>Vertical radii</h3>
          {CORNERS.map((c) => (
            <div key={c.key} style={{ marginBottom: 10 }}>
              <label htmlFor={`brv-${c.key}`} style={{ margin: '0 0 4px' }}>
                <span>{c.label} vertical</span> <span className="muted">{vertical[c.key]}{unit}</span>
              </label>
              <input id={`brv-${c.key}`} type="range" min={0} max={max} value={vertical[c.key]} onChange={(e) => set(c.key, Number(e.target.value), true)} />
            </div>
          ))}
        </>
      )}

      <PillRow label="Output format">
        <button type="button" aria-pressed={out === 'css'} className={out === 'css' ? 'btn primary' : 'btn'} onClick={() => setOut('css')}>CSS</button>
        <button type="button" aria-pressed={out === 'tailwind'} className={out === 'tailwind' ? 'btn primary' : 'btn'} onClick={() => setOut('tailwind')}>Tailwind</button>
      </PillRow>
      <SettleOutput value={code} aria-label={out === 'css' ? 'Border radius CSS' : 'Tailwind classes'} rows={2} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        Corner values are written clockwise from the top left. When four values collapse to a shorter shorthand the tool uses it, so
        equal corners become a single number. Turn on elliptical radii to add a second set after a slash, which lets a corner curve
        more in one direction than the other.
      </p>
    </div>
  )
}
