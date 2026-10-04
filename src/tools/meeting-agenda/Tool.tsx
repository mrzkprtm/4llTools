import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { exampleItems, formatClock, moveItem, parseClock, schedule, toMarkdown, totalLabel, totalMinutes, type AgendaItem } from './agenda'

let nextId = 1
const blankItem = (): AgendaItem => ({ id: `n${nextId++}`, title: '', minutes: 5, owner: '' })

export default function MeetingAgenda() {
  const [title, setTitle] = useState('Weekly team meeting')
  const [start, setStart] = useState('09:00')
  const [items, setItems] = useState<AgendaItem[]>([])

  const startMinutes = parseClock(start)
  const valid = startMinutes !== null
  const slotted = valid ? schedule(items, startMinutes) : []
  const markdown = valid ? toMarkdown(slotted, title) : ''
  const total = totalMinutes(items)

  const setItem = (id: string, patch: Partial<AgendaItem>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="ma-title">Agenda title</label>
          <input id="ma-title" type="text" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />

          <label htmlFor="ma-start">Start time</label>
          <input
            id="ma-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-invalid={valid ? undefined : true}
          />
          {!valid && <p className="error" role="alert">Enter a start time like 09:00.</p>}

          <h3 className="eyebrow" style={{ marginTop: 22 }}>Items</h3>
          {items.map((it, i) => (
            <div className="row" key={it.id} style={{ margin: '8px 0', alignItems: 'flex-end' }}>
              <span style={{ flex: '3 1 160px' }}>
                <label htmlFor={`ma-${it.id}-title`} style={{ marginTop: 0 }}>Topic</label>
                <input id={`ma-${it.id}-title`} type="text" value={it.title} maxLength={100} placeholder="What will be discussed" onChange={(e) => setItem(it.id, { title: e.target.value })} />
              </span>
              <span style={{ flex: '1 1 80px' }}>
                <label htmlFor={`ma-${it.id}-min`} style={{ marginTop: 0 }}>Minutes</label>
                <input
                  id={`ma-${it.id}-min`}
                  type="number"
                  min={1}
                  max={600}
                  value={it.minutes}
                  onChange={(e) => setItem(it.id, { minutes: Math.max(1, Math.min(600, Number(e.target.value) || 1)) })}
                />
              </span>
              <span style={{ flex: '2 1 120px' }}>
                <label htmlFor={`ma-${it.id}-owner`} style={{ marginTop: 0 }}>Owner</label>
                <input id={`ma-${it.id}-owner`} type="text" value={it.owner} maxLength={40} placeholder="Who leads it" onChange={(e) => setItem(it.id, { owner: e.target.value })} />
              </span>
              <span className="row" style={{ margin: 0, gap: 6 }}>
                <button type="button" className="btn" onClick={() => setItems((l) => moveItem(l, i, i - 1))} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>↑</button>
                <button type="button" className="btn" onClick={() => setItems((l) => moveItem(l, i, i + 1))} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} down`}>↓</button>
                <button type="button" className="btn" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} aria-label={`Remove item ${i + 1}`}>✕</button>
              </span>
            </div>
          ))}

          <div className="row">
            <button type="button" className="btn btn-icon" onClick={() => setItems((l) => [...l, blankItem()])}><Icon name="plus" size={18} /> Add item</button>
            <button type="button" className="btn" onClick={() => setItems(exampleItems.map((it) => ({ ...it })))}>Use an example</button>
            {items.length > 0 && <button type="button" className="btn" onClick={() => setItems([])}>Clear items</button>}
          </div>
        </div>

        <div>
          <h3 className="eyebrow">Live schedule</h3>
          {valid && slotted.length > 0 ? (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--sunken)', fontFamily: 'var(--mono)', fontSize: '0.84rem' }}>
              {slotted.map((it) => (
                <li key={it.id} style={{ padding: '8px 12px', display: 'flex', gap: 10, alignItems: 'baseline', borderBottom: '1px solid var(--border)' }}>
                  <b style={{ minWidth: 112, fontVariantNumeric: 'tabular-nums' }}>{formatClock(it.start)} – {formatClock(it.end)}</b>
                  <span style={{ flex: 1 }}>{it.title.trim() || 'Untitled item'}</span>
                  {it.owner.trim() && <span className="muted" style={{ fontSize: '0.85rem' }}>{it.owner}</span>}
                  <span className="muted" style={{ fontSize: '0.82rem' }}>{it.minutes} min</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Add an item to see the times. Each item starts where the one before it ends.</p>
          )}

          <div className="stats">
            <div className="stat"><b>{items.length}</b>Item{items.length === 1 ? '' : 's'}</div>
            <div className="stat"><b>{totalLabel(total)}</b>Planned length</div>
            <div className="stat"><b>{valid ? formatClock((startMinutes ?? 0) + total) : '—'}</b>Finishes at</div>
          </div>

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={() => window.print()} disabled={!valid}><Icon name="printer" size={18} /> Print</button>
            <CopyButton text={markdown} label="Copy Markdown" />
          </div>

          <label htmlFor="ma-markdown">Markdown</label>
          <textarea id="ma-markdown" readOnly value={markdown} style={{ minHeight: 180, fontFamily: 'var(--mono)', fontSize: '0.85rem' }} aria-label="Agenda as Markdown" />
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Times are worked out from the start time and each item's length, so changing a duration shifts everything after it.
        Paste the Markdown into notes, a ticket or a calendar invite. Nothing is uploaded and nothing is stored.
      </p>
    </div>
  )
}
