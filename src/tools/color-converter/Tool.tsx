import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { contrast, parseColor, rgbToHex, rgbToHsl } from './color'

export default function ColorConverter() {
  const [input, setInput] = useState('#4f46e5')
  const rgb = parseColor(input)

  const hex = rgb ? rgbToHex(rgb) : ''
  const hsl = rgb ? rgbToHsl(rgb) : null
  const formats = rgb && hsl
    ? [
        ['HEX', hex],
        ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`],
        ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
      ]
    : []
  const onWhite = rgb ? contrast(rgb, { r: 255, g: 255, b: 255 }) : 0
  const onBlack = rgb ? contrast(rgb, { r: 0, g: 0, b: 0 }) : 0

  return (
    <div>
      <div className="row">
        <input type="color" value={hex || '#000000'} onChange={(e) => setInput(e.target.value)} style={{ width: 56, height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Pick a color" />
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="#4f46e5, rgb(79, 70, 229) or hsl(243, 75%, 59%)" style={{ flex: 1, minWidth: 180 }} aria-label="Color value" />
      </div>
      {!rgb && input.trim() && <p className="error">Enter a color like #4f46e5, rgb(79, 70, 229) or hsl(243, 75%, 59%).</p>}
      {rgb && (
        <>
          <div className="swatch" style={{ background: hex }} />
          {formats.map(([name, value]) => (
            <div key={name} className="row" style={{ flexWrap: 'nowrap' }}>
              <b style={{ width: 48 }}>{name}</b>
              <div className="output" style={{ flex: 1 }}>{value}</div>
              <CopyButton text={value} />
            </div>
          ))}
          <p className="muted">
            Contrast with white text: <b>{onWhite.toFixed(2)}</b> {onWhite >= 4.5 ? '✓ readable' : '✗ too low'} · with black text: <b>{onBlack.toFixed(2)}</b> {onBlack >= 4.5 ? '✓ readable' : '✗ too low'}
          </p>
        </>
      )}
    </div>
  )
}
