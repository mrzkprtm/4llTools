import { useState } from 'react'
import Icon from '../../components/Icon'
import { LABELS, type Card, type Column } from './logic'

interface Props {
  card: Card
  columns: Column[]
  colId: string
  onSave: (patch: Partial<Omit<Card, 'id'>>, toCol: string) => void
  onDelete: () => void
  onCancel: () => void
}

/** Inline editor that replaces a card while it is being edited. */
export default function CardEditor({ card, columns, colId, onSave, onDelete, onCancel }: Props) {
  const [title, setTitle] = useState(card.title)
  const [label, setLabel] = useState(card.label)
  const [due, setDue] = useState(card.due ?? '')
  const [col, setCol] = useState(colId)

  return (
    <form
      className="kb-editor pop"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ title: title.trim() || card.title, label, due: due || undefined }, col)
      }}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <input autoFocus type="text" aria-label="Card title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="kb-swatches" role="radiogroup" aria-label="Label">
        {LABELS.map((l, i) => (
          <button key={l.name} type="button" role="radio" aria-checked={label === i} title={l.name} aria-label={l.name} className={label === i ? 'on' : ''} style={{ background: l.color }} onClick={() => setLabel(i)} />
        ))}
      </div>
      <div className="kb-editor-row">
        <label>
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          Column
          <select value={col} onChange={(e) => setCol(e.target.value)}>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button type="submit" className="btn primary">Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-icon kb-danger" onClick={onDelete}>
          <Icon name="delete-bin" size={16} /> Delete
        </button>
      </div>
    </form>
  )
}
