import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const DEFAULT_COLUMNS = [
  { id: 'backlog', name: 'Backlog', limit: 0, color: '#64748b' },
  { id: 'todo', name: 'To Do', limit: 0, color: '#3b82f6' },
  { id: 'doing', name: 'In Progress', limit: 3, color: '#f59e0b' },
  { id: 'review', name: 'Review', limit: 2, color: '#8b5cf6' },
  { id: 'done', name: 'Done', limit: 0, color: '#22c55e' },
]

export default function KanbanBoard() {
  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem('kanban-board')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS.map(c => ({ ...c, cards: [] }))
  })

  useEffect(() => {
    try { localStorage.setItem('kanban-board', JSON.stringify(columns)) } catch {}
  }, [columns])

  const [draggedCard, setDraggedCard] = useState<{ cardId: number; fromCol: string } | null>(null)

  const addCard = (colId: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: [...c.cards, { id: Date.now(), title: 'New Task', description: '' }] } : c))
  }

  const deleteCard = (colId: string, cardId: number) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: c.cards.filter((card: any) => card.id !== cardId) } : c))
  }

  const updateCard = (colId: string, cardId: number, field: string, value: string) => {
    setColumns(columns.map(c => c.id === colId ? { ...c, cards: c.cards.map((card: any) => card.id === cardId ? { ...card, [field]: value } : card) } : c))
  }

  const handleDragStart = (e: React.DragEvent, cardId: number, fromCol: string) => {
    setDraggedCard({ cardId, fromCol })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, toCol: string) => {
    e.preventDefault()
    if (!draggedCard || draggedCard.fromCol === toCol) { setDraggedCard(null); return }
    const fromCol = columns.find(c => c.id === draggedCard.fromCol)
    const toColObj = columns.find(c => c.id === toCol)
    const card = fromCol?.cards.find((c: any) => c.id === draggedCard.cardId)
    if (!card || !fromCol || !toColObj) { setDraggedCard(null); return }
    if (toColObj.limit > 0 && toColObj.cards.length >= toColObj.limit) { alert(`WIP limit reached for ${toColObj.name}`); setDraggedCard(null); return }
    setColumns(columns.map(c => {
      if (c.id === fromCol.id) return { ...c, cards: c.cards.filter((card: any) => card.id !== draggedCard.cardId) }
      if (c.id === toCol) return { ...c, cards: [...c.cards, card] }
      return c
    }))
    setDraggedCard(null)
  }

  const totalCards = columns.reduce((sum, c) => sum + c.cards.length, 0)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Kanban Board</h3>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted"><Roll value={totalCards} /> tasks</span>
        </div>
      </div>

      <div className="row" style={{ gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
        {columns.map((col, ci) => (
          <div key={col.id} style={{
            minWidth: 280, maxWidth: 320, flex: '1 1 280px',
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            display: 'flex', flexDirection: 'column', minHeight: 400
          }}>
            <div style={{
              padding: '12px', borderBottom: '1px solid var(--border)', background: col.color + '20',
              borderRadius: 'var(--radius) var(--radius) 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600, color: col.color }}>{col.name}</span>
              <div className="row" style={{ gap: 4, alignItems: 'center' }}>
                {col.limit > 0 && <span className="muted" style={{ fontSize: '0.75rem' }}>{col.cards.length}/{col.limit}</span>}
                <Roll value={col.cards.length} style={{ fontWeight: 700, color: col.color }} />
              </div>
            </div>
            <div
              style={{ flex: 1, padding: 8, overflowY: 'auto', minHeight: 200 }}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {col.cards.map((card: any, i) => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={e => handleDragStart(e, card.id, col.id)}
                  style={{
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    padding: '12px', marginBottom: 8, boxShadow: 'var(--shadow-sm)',
                    animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                    animationDelay: `${i * 30}ms`,
                    opacity: draggedCard?.cardId === card.id ? 0.4 : 1,
                    cursor: 'grab',
                  }}
                >
                  <input
                    type="text"
                    value={card.title}
                    onChange={e => updateCard(col.id, card.id, 'title', e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, width: '100%', marginBottom: 8 }}
                  />
                  <textarea
                    value={card.description}
                    onChange={e => updateCard(col.id, card.id, 'description', e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', width: '100%', fontSize: '0.85rem', padding: 8, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <button className="btn" onClick={() => deleteCard(col.id, card.id)} style={{ marginTop: 8, padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => addCard(col.id)} style={{ margin: '8px 12px 12px', width: 'calc(100% - 24px)' }}>+ Add Card</button>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Drag cards between columns. WIP limits enforced on In Progress and Review. All data stored locally.
      </p>
    </div>
  )
}