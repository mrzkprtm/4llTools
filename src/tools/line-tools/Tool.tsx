import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { applyLineAction, type LineAction } from './lines'

const ACTIONS: [LineAction, string][] = [
  ['sort', 'Sort A→Z'],
  ['sort-desc', 'Sort Z→A'],
  ['sort-num', 'Sort by number'],
  ['dedupe', 'Remove duplicates'],
  ['remove-empty', 'Remove empty lines'],
  ['trim', 'Trim spaces'],
  ['reverse', 'Reverse order'],
  ['shuffle', 'Shuffle'],
]

export default function LineTools() {
  const [text, setText] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(true)
  const count = text ? text.split('\n').length : 0

  return (
    <div>
      <label htmlFor="lines-in">Lines ({count})</label>
      <textarea id="lines-in" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 240 }} spellCheck={false} />
      <div className="row">
        {ACTIONS.map(([action, label]) => (
          <button key={action} type="button" className="btn" onClick={() => setText(applyLineAction(text, action, caseSensitive))} disabled={!text}>
            {label}
          </button>
        ))}
      </div>
      <div className="row">
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Case sensitive
        </label>
        <CopyButton text={text} />
      </div>
    </div>
  )
}
