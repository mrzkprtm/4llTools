import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import Icon from '../../components/Icon'
import { reducedMotion, SPRINGS } from '../../motion/springs'
import { useFlip } from '../../motion/useFlip'
import { Hint } from '../../sim/controls'
import CardEditor from './CardEditor'
import { addCard, deleteCard, findCard, LABELS, moveCard, overLimit, parseBoard, updateCard, type Board, type Card } from './logic'
import './tool.css'

const KEY = '4lltools:kanban-board'
const uid = () => Math.random().toString(36).slice(2, 9)

function example(): Board {
  const d = (n: number) => {
    const t = new Date(Date.now() + n * 86400000)
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }
  return {
    columns: [
      { id: 'todo', title: 'To do', wip: 0, cards: [
        { id: uid(), title: 'Plan next sprint', label: 1, due: d(3) },
        { id: uid(), title: 'Pay electricity bill (PLN)', label: 5, due: d(1) },
        { id: uid(), title: 'Research dark mode', label: 4 },
      ] },
      { id: 'doing', title: 'Doing', wip: 2, cards: [
        { id: uid(), title: 'Fix login redirect', label: 2, due: d(-1) },
        { id: uid(), title: 'Write onboarding email', label: 1 },
      ] },
      { id: 'done', title: 'Done', wip: 0, cards: [{ id: uid(), title: 'Clean up old branches', label: 3 }] },
    ],
  }
}

interface Drag {
  id: string
  pointerId: number
  x: number
  y: number
  ox: number
  oy: number
  w: number
  toCol: string
  index: number
}

export default function KanbanBoard() {
  const [board, setBoard] = useState<Board>({ columns: [] })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ col: string; text: string } | null>(null)
  const [today, setToday] = useState('')
  const [msg, setMsg] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const pending = useRef<{ id: string; pointerId: number; sx: number; sy: number; ox: number; oy: number; w: number; col: string; index: number } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const dropped = useRef<{ id: string; left: number; top: number } | null>(null)
  const suppressClick = useRef(false)
  const ready = useRef(false)
  const file = useRef<HTMLInputElement>(null)
  dragRef.current = drag
  useFlip(root)

  useEffect(() => {
    let saved: Board | null = null
    try {
      saved = parseBoard(localStorage.getItem(KEY) ?? '')
    } catch {
      saved = null
    }
    setBoard(saved ?? example())
    setToday(new Date().toISOString().slice(0, 10))
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(board))
    } catch {
      // Storage is optional.
    }
  }, [board])

  // After a drop, spring the card from where the finger let go into its slot.
  useLayoutEffect(() => {
    const d = dropped.current
    if (!d || !root.current) return
    dropped.current = null
    const el = root.current.querySelector<HTMLElement>(`[data-card="${d.id}"]`)
    if (!el || reducedMotion()) return
    const r = el.getBoundingClientRect()
    el.animate([{ transform: `translate(${d.left - r.left}px, ${d.top - r.top}px) rotate(3deg) scale(1.04)` }, { transform: 'none' }], { duration: SPRINGS.snap.duration, easing: SPRINGS.snap.easing })
  })

  function target(x: number, y: number, id: string): { toCol: string; index: number } | null {
    const cols = [...(root.current?.querySelectorAll<HTMLElement>('[data-col]') ?? [])]
    if (!cols.length) return null
    let best = cols[0]
    let bestD = Infinity
    for (const c of cols) {
      const r = c.getBoundingClientRect()
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0
      const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0
      const dd = dx * dx + dy * dy
      if (dd < bestD) [best, bestD] = [c, dd]
    }
    const cards = [...best.querySelectorAll<HTMLElement>('[data-card]')].filter((e) => e.dataset.card !== id)
    const index = cards.filter((e) => {
      const r = e.getBoundingClientRect()
      return r.top + r.height / 2 < y
    }).length
    return { toCol: best.dataset.col!, index }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pending.current
      const d = dragRef.current
      if (d && e.pointerId === d.pointerId) {
        e.preventDefault()
        const t = target(e.clientX, e.clientY, d.id)
        setDrag({ ...d, x: e.clientX, y: e.clientY, ...(t ?? {}) })
        if (e.clientY < 60) window.scrollBy(0, -14)
        else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 14)
      } else if (p && e.pointerId === p.pointerId && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) {
        pending.current = null
        setEditing(null)
        setDrag({ id: p.id, pointerId: p.pointerId, x: e.clientX, y: e.clientY, ox: p.ox, oy: p.oy, w: p.w, toCol: p.col, index: p.index })
      }
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      pending.current = null
      if (!d || e.pointerId !== d.pointerId) return
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
      dropped.current = { id: d.id, left: d.x - d.ox, top: d.y - d.oy }
      setBoard((b) => moveCard(b, d.id, d.toCol, d.index))
      setDrag(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  function down(e: RPointerEvent<HTMLElement>, card: Card) {
    if (e.button !== 0 || editing === card.id) return
    // On touch screens the grip starts a drag so the page can still scroll.
    if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('.kb-grip')) return
    const r = e.currentTarget.getBoundingClientRect()
    const at = findCard(board, card.id)!
    pending.current = { id: card.id, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, col: board.columns[at.col].id, index: at.index }
  }

  const view = drag ? moveCard(board, drag.id, drag.toCol, drag.index) : board
  const ghost = drag ? findCard(board, drag.id) : null
  const ghostCard = ghost ? board.columns[ghost.col].cards[ghost.index] : null

  function exportJson() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'kanban-board.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importJson(f: File) {
    const b = parseBoard(await f.text())
    if (b) {
      setBoard(b)
      setMsg(`Imported ${b.columns.reduce((n, c) => n + c.cards.length, 0)} cards.`)
    } else setMsg('That file does not look like a board export.')
  }

  const setCol = (id: string, patch: { title?: string; wip?: number }) => setBoard((b) => ({ columns: b.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  return (
    <div className="kb">
      <div ref={root} className={`kb-board ${drag ? 'dragging' : ''}`} style={{ '--n': view.columns.length } as CSSProperties}>
        {view.columns.map((col) => (
          <section key={col.id} className={`kb-col ${overLimit(col) ? 'over' : ''} ${drag?.toCol === col.id ? 'target' : ''}`} data-col={col.id}>
            <header className="kb-col-head">
              <input className="kb-col-title" value={col.title} aria-label="Column name" onChange={(e) => setCol(col.id, { title: e.target.value })} />
              <span className="kb-count" title="Cards / WIP limit">
                {col.cards.length}
                {col.wip > 0 && `/${col.wip}`}
              </span>
              <label className="kb-wip" title="WIP limit (0 = none)">
                WIP
                <input type="number" min={0} max={99} value={col.wip} onChange={(e) => setCol(col.id, { wip: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
              <button type="button" className="kb-icon" aria-label={`Delete column ${col.title}`} onClick={() => (!col.cards.length || confirm(`Delete "${col.title}" and its ${col.cards.length} cards?`)) && setBoard((b) => ({ columns: b.columns.filter((c) => c.id !== col.id) }))}>
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="kb-cards">
              {col.cards.map((card) =>
                editing === card.id ? (
                  <CardEditor key={card.id} card={card} columns={board.columns} colId={col.id} onSave={(patch, to) => {
                    setBoard((b) => {
                      const nb = updateCard(b, card.id, patch)
                      return to !== col.id ? moveCard(nb, card.id, to, Infinity) : nb
                    })
                    setEditing(null)
                  }} onDelete={() => { setBoard((b) => deleteCard(b, card.id)); setEditing(null) }} onCancel={() => setEditing(null)} />
                ) : (
                  <article
                    key={card.id}
                    data-flip={card.id}
                    data-card={card.id}
                    className={`kb-card ${drag?.id === card.id ? 'placeholder' : ''}`}
                    style={{ '--lc': LABELS[card.label].color } as CSSProperties}
                    onPointerDown={(e) => down(e, card)}
                    onClick={() => !suppressClick.current && setEditing(card.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(card.id)}
                  >
                    <span className="kb-grip" aria-hidden="true">⠿</span>
                    <span className="kb-card-title">{card.title || 'Untitled'}</span>
                    <span className="kb-meta">
                      {card.label > 0 && <span className="kb-label">{LABELS[card.label].name}</span>}
                      {card.due && <span className={`kb-due ${today && card.due < today ? 'late' : ''}`}>Due {new Date(card.due + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </span>
                  </article>
                ),
              )}
            </div>
            {adding?.col === col.id ? (
              <form className="kb-add-form" onSubmit={(e) => {
                e.preventDefault()
                if (adding.text.trim()) setBoard((b) => addCard(b, col.id, { id: uid(), title: adding.text.trim(), label: 0 }))
                setAdding({ col: col.id, text: '' })
              }}>
                <input autoFocus type="text" placeholder="Card title" value={adding.text} onChange={(e) => setAdding({ col: col.id, text: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setAdding(null)} />
                <div className="row">
                  <button type="submit" className="btn primary">Add</button>
                  <button type="button" className="btn" onClick={() => setAdding(null)}>Done</button>
                </div>
              </form>
            ) : (
              <button type="button" className="kb-add btn-icon" onClick={() => setAdding({ col: col.id, text: '' })}>
                <Icon name="plus" size={16} /> Add card
              </button>
            )}
          </section>
        ))}
      </div>

      {drag && ghostCard && (
        <div className="kb-card kb-ghost" style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w, '--lc': LABELS[ghostCard.label].color } as CSSProperties} aria-hidden="true">
          <span className="kb-grip">⠿</span>
          <span className="kb-card-title">{ghostCard.title}</span>
        </div>
      )}

      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => setBoard((b) => ({ columns: [...b.columns, { id: uid(), title: 'New column', wip: 0, cards: [] }] }))}>
          <Icon name="plus" size={18} /> Column
        </button>
        <button type="button" className="btn btn-icon" onClick={exportJson}>
          <Icon name="save" size={18} /> Export JSON
        </button>
        <button type="button" className="btn btn-icon" onClick={() => file.current?.click()}>
          <Icon name="share" size={18} /> Import
        </button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '' }} />
        <button type="button" className="btn" onClick={() => confirm('Replace the board with the example?') && setBoard(example())}>Reset</button>
        {msg && <span className="muted" aria-live="polite">{msg}</span>}
      </div>
      <Hint>Drag a card to move it (on phones, drag by the ⠿ grip). Tap a card to edit its label, due date or column. A column glows red when it goes over its WIP limit.</Hint>
    </div>
  )
}
