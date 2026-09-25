import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { BASES, formatInBase, parseInBase } from './base'

export default function NumberBase() {
  const [value, setValue] = useState<bigint | null>(255n)
  const [editing, setEditing] = useState<{ base: number; text: string } | null>(null)
  const [upper, setUpper] = useState(true)

  return (
    <div>
      {BASES.map(({ base, name, prefix }) => {
        const shown = editing?.base === base ? editing.text : value === null ? '' : formatInBase(value, base)
        const out = upper ? shown.toUpperCase() : shown
        const invalid = editing?.base === base && editing.text.trim() !== '' && value === null
        return (
          <div key={base}>
            <label htmlFor={`base-${base}`}>
              {name} <span className="muted">(base {base})</span>
            </label>
            <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
              <input
                id={`base-${base}`}
                type="text"
                value={out}
                spellCheck={false}
                style={{ fontFamily: 'ui-monospace, monospace' }}
                onChange={(e) => {
                  setEditing({ base, text: e.target.value })
                  setValue(parseInBase(e.target.value, base))
                }}
                onBlur={() => setEditing(null)}
              />
              <CopyButton text={prefix + (value === null ? '' : formatInBase(value, base))} label={`Copy ${prefix || 'value'}`} />
            </div>
            {invalid && <p className="error" style={{ margin: '4px 0' }}>That isn't a valid {name.toLowerCase()} number.</p>}
          </div>
        )
      })}
      {value !== null && value >= 0n && value < 1n << 64n && <Bits value={value} onChange={(v) => { setEditing(null); setValue(v) }} />}
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase hex letters
      </label>
    </div>
  )
}

/** The value as a strip of bit switches; clicking one flips that bit. */
function Bits({ value, onChange }: { value: bigint; onChange: (v: bigint) => void }) {
  const width = value < 1n << 8n ? 8 : value < 1n << 16n ? 16 : value < 1n << 32n ? 32 : 64
  return (
    <div className="bits-wrap">
      <label>Bits <span className="muted">(<Roll>{width}</Roll>-bit, tap to flip)</span></label>
      <div className="bits" role="group" aria-label="Bits" style={{ gridTemplateColumns: `repeat(${Math.min(width, 16)}, minmax(0, 1fr))` }}>
        {Array.from({ length: width }, (_, k) => {
          const i = width - 1 - k
          const on = ((value >> BigInt(i)) & 1n) === 1n
          return (
            <button key={i} type="button" className={`bit ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Bit ${i}`} title={`Bit ${i}`}
              onClick={() => onChange(value ^ (1n << BigInt(i)))}>
              <span key={String(on)}>{on ? 1 : 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
