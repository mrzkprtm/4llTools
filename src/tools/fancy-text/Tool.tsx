import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import { useFlip } from '../../motion/useFlip'
import { GROUPS, STYLES, lengths } from './fancy'
import './tool.css'

export default function FancyText() {
  const [text, setText] = useState('Hello World 2026')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('All')
  const [copied, setCopied] = useState<{ id: string; n: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const timer = useRef(0)
  useFlip(list, { max: 40 })

  useEffect(() => () => clearTimeout(timer.current), [])

  const source = text || 'Type something'
  const styles = group === 'All' ? STYLES : STYLES.filter((s) => s.group === group)

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setFailed(false)
      setCopied((c) => ({ id, n: (c?.n ?? 0) + 1 }))
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div>
      <label htmlFor="ft-in">Your text</label>
      <input id="ft-in" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your name or bio…" maxLength={500} autoComplete="off" />
      <PillRow label="Style group">
        {GROUPS.map((g) => (
          <button key={g} type="button" className={`btn ${group === g ? 'primary' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </PillRow>
      {failed && <p className="error" role="alert">Copying was blocked by the browser. Select the text and copy it manually.</p>}
      <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>Tap a style to copy it.</p>

      <ul ref={list} className="ft-list">
        {styles.map((s) => {
          const out = s.convert(source)
          const isCopied = copied?.id === s.id
          const len = lengths(out)
          return (
            <li key={s.id} data-flip={s.id}>
              <button type="button" className={`ft-row ${isCopied ? 'is-copied' : ''}`} onClick={() => copy(s.id, out)} aria-label={`Copy ${s.name} style`}>
                <span className="ft-name">{s.name}</span>
                <span className="ft-out" key={isCopied ? `c${copied?.n}` : 'x'}>{out}</span>
                <span className="ft-meta">
                  {isCopied ? (
                    <span className="chip good" key={copied?.n}><Icon name="clipboard-check" size={14} /> Copied</span>
                  ) : (
                    <span className="ft-len" title="Length most apps count (UTF-16 units)">{len.units}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="ft-sr" aria-live="polite">{copied ? `${STYLES.find((s) => s.id === copied.id)?.name} copied` : ''}</p>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        These aren’t real fonts: each letter is swapped for a look-alike Unicode symbol (mostly from the Mathematical Alphanumeric block), so they paste anywhere
        plain text goes. The number on each row is the length most apps count, which can be twice the letters because many symbols take two UTF-16 units; keep that in mind
        for Instagram’s 150-character bio limit.
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Accessibility: screen readers often read these symbols letter by letter (“mathematical bold capital H…”) or skip them, and search won’t match them.
        Use them for a name or a short accent, not for whole posts or important information.
      </p>
    </div>
  )
}
