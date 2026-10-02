import { useState } from 'react'
import Icon from '../../components/Icon'
import { BOX, GLYPHS } from './glyphs'
import type { Pt } from './logic'

const ADV = 66 // horizontal advance per glyph
const PAGE_W = 700
const ROW_H = 118

const d = (pts: readonly Pt[], ox: number, oy: number) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + ox).toFixed(1)} ${(y + oy).toFixed(1)}`).join('')

function Glyph({ ch, x, y, solid }: { ch: string; x: number; y: number; solid?: boolean }) {
  const strokes = GLYPHS[ch]
  if (!strokes) return null
  return (
    <g className={solid ? 'hw-solid' : 'hw-dotted'}>
      {strokes.map((s, i) => <path key={i} d={d(s, x, y)} />)}
      {solid && strokes.map((s, i) => <circle key={`s${i}`} cx={s[0][0] + x} cy={s[0][1] + y} r={2.6} className="hw-start" />)}
    </g>
  )
}

/** A printable page of dotted tracing rows for letters or a word. */
export default function Worksheet() {
  const [textIn, setTextIn] = useState('Aa')
  const [rows, setRows] = useState(7)
  const [perLetter, setPerLetter] = useState(true)
  const chars = [...textIn].filter((c) => GLYPHS[c] || c === ' ')
  const perRow = Math.floor((PAGE_W - 20) / ADV)

  // Either one row per character (repeated), or the whole text repeated across each row.
  const lines: string[][] =
    perLetter && chars.length
      ? Array.from({ length: rows }, (_, r) => {
          const c = chars.filter((x) => x !== ' ')[r % Math.max(1, chars.filter((x) => x !== ' ').length)]
          return Array(perRow).fill(c)
        })
      : Array.from({ length: rows }, () => {
          const out: string[] = []
          while (chars.length && out.length + chars.length <= perRow) out.push(...chars, ' ')
          return out.length ? out : chars.slice(0, perRow)
        })

  return (
    <div className="hw-sheet-wrap">
      <div className="row hw-sheet-tools">
        <label className="hw-field">
          Letters or word
          <input value={textIn} maxLength={24} onChange={(e) => setTextIn(e.target.value)} placeholder="e.g. Budi or abc" />
        </label>
        <label className="hw-field">
          Rows
          <select value={rows} onChange={(e) => setRows(Number(e.target.value))}>
            {[4, 5, 6, 7, 8, 9].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="sim-toggle">
          <input type="checkbox" checked={perLetter} onChange={(e) => setPerLetter(e.target.checked)} /> One row per letter
        </label>
        <button type="button" className="btn primary btn-icon" onClick={() => window.print()} disabled={!chars.length}>
          <Icon name="printer" size={18} />
          Print
        </button>
      </div>
      {!chars.length && <p className="error">Type letters A–Z, a–z or digits 0–9.</p>}
      <svg className="hw-sheet" viewBox={`0 0 ${PAGE_W} ${rows * ROW_H + 50}`} role="img" aria-label={`Tracing worksheet for ${textIn}`}>
        <text x={10} y={26} className="hw-sheet-title">Name: ____________________    Date: __________</text>
        {lines.map((row, r) => {
          const oy = 40 + r * ROW_H - 4
          return (
            <g key={`${r}-${row.join('')}`} className="hw-row" style={{ animationDelay: `${r * 50}ms` }}>
              <line x1={6} x2={PAGE_W - 6} y1={oy + BOX.top} y2={oy + BOX.top} className="hw-l" />
              <line x1={6} x2={PAGE_W - 6} y1={oy + BOX.mid} y2={oy + BOX.mid} className="hw-l hw-mid" />
              <line x1={6} x2={PAGE_W - 6} y1={oy + BOX.base} y2={oy + BOX.base} className="hw-l hw-base" />
              {row.map((c, i) => (c === ' ' ? null : <Glyph key={i} ch={c} x={10 + i * ADV} y={oy} solid={i === 0 || (!perLetter && i < chars.length)} />))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
