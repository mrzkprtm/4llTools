import { useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
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
  const [removed, setRemoved] = useState(0)
  const list = useRef<HTMLOListElement>(null)
  useFlip(list, { max: 150 })

  // Each line keeps an identity (its text plus which copy it is) so rows can glide to their new place.
  const rows = useMemo(() => {
    const seen = new Map<string, number>()
    return text.split('\n').slice(0, 150).map((line) => {
      const n = (seen.get(line) ?? 0) + 1
      seen.set(line, n)
      return { key: `${n}:${line}`, line }
    })
  }, [text])

  function run(action: LineAction) {
    const next = applyLineAction(text, action, caseSensitive)
    setRemoved(Math.max(0, count - (next ? next.split('\n').length : 0)))
    setText(next)
  }

  return (
    <div>
      <label htmlFor="lines-in">Lines ({count})</label>
      <textarea id="lines-in" value={text} onChange={(e) => { setText(e.target.value); setRemoved(0) }} style={{ minHeight: 240 }} spellCheck={false} />
      <div className="row">
        {ACTIONS.map(([action, label]) => (
          <button key={action} type="button" className="btn" onClick={() => run(action)} disabled={!text}>
            {label}
          </button>
        ))}
      </div>
      {text && (
        <>
          <p className="muted" style={{ margin: '4px 0 6px', fontSize: '0.88rem' }}>
            <Roll>{count}</Roll> lines{removed > 0 && <span className="chip" style={{ marginLeft: 8 }}><Roll>{removed}</Roll> removed</span>}
          </p>
          <ol ref={list} className="line-list" aria-label="Preview">
            {rows.map((r) => (
              <li key={r.key} data-flip={r.key}>{r.line || '\u00a0'}</li>
            ))}
          </ol>
        </>
      )}
      <div className="row">
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Case sensitive
        </label>
        <CopyButton text={text} />
      </div>
    </div>
  )
}
