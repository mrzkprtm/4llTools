import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
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
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase hex letters
      </label>
    </div>
  )
}
