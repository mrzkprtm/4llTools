import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import MorphText from '../../motion/MorphText'
import Roll from '../../motion/Roll'
import { contrast, parseColor, rgbToHex, rgbToHsl } from './color'

/** The new color spreads out from the middle over the previous one. */
function Swatch({ color }: { color: string }) {
  const prev = useRef(color)
  const [under, setUnder] = useState(color)
  useEffect(() => {
    setUnder(prev.current)
    prev.current = color
  }, [color])
  return (
    <div className="swatch swatch-stack" style={{ background: under }}>
      <i key={color} style={{ background: color }} />
    </div>
  )
}

function Readable({ ratio }: { ratio: number }) {
  return ratio >= 4.5 ? <span className="chip good calm"><Check size={14} /> readable</span> : <span className="chip bad calm">✗ too low</span>
}

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
          <Swatch color={hex} />
          {formats.map(([name, value]) => (
            <div key={name} className="row" style={{ flexWrap: 'nowrap' }}>
              <b style={{ width: 48 }}>{name}</b>
              <div className="output" style={{ flex: 1 }}><MorphText text={value} /></div>
              <CopyButton text={value} />
            </div>
          ))}
          <p className="muted">
            Contrast with white text: <b><Roll>{onWhite.toFixed(2)}</Roll></b> <Readable key={`w${onWhite >= 4.5}`} ratio={onWhite} /> · with black text: <b><Roll>{onBlack.toFixed(2)}</Roll></b> <Readable key={`b${onBlack >= 4.5}`} ratio={onBlack} />
          </p>
        </>
      )}
    </div>
  )
}
