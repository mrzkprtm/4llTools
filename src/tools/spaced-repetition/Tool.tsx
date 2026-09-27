import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Item {
  id: number
  name: string
  ease: number
  interval: number
  due: number
  reviews: number
  lapses: number
  created: number
}

const DEFAULT_ITEMS: Item[] = [
  { id: 1, name: 'Spanish: hola = hello', ease: 2.5, interval: 0, due: 0, reviews: 0, lapses: 0, created: Date.now() },
  { id: 2, name: 'Capital of Australia', ease: 2.5, interval: 0, due: 0, reviews: 0, lapses: 0, created: Date.now() },
  { id: 3, name: 'Formula: F = ma', ease: 2.5, interval: 0, due: 0, reviews: 0, lapses: 0, created: Date.now() },
]

export default function SpacedRepetition() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('spaced-repetition')
    return saved ? JSON.parse(saved) : DEFAULT_ITEMS
  })
  const [newItem, setNewItem] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('spaced-repetition', JSON.stringify(items)) } catch {}
  }, [items])

  const now = useMemo(() => Date.now(), [])

  const addItem = () => {
    if (!newItem.trim()) return
    setItems([...items, { id: Date.now(), name: newItem, ease: 2.5, interval: 0, due: 0, reviews: 0, lapses: 0, created: Date.now() }])
    setNewItem('')
  }

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id))
  }

  const gradeItem = (id: number, grade: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item

      let { ease, interval, reviews, lapses } = item
      const today = now

      if (grade === 0) {
        interval = 0
        ease = Math.max(1.3, ease - 0.2)
        lapses++
      } else if (grade === 1) {
        interval = 0
        ease = Math.max(1.3, ease - 0.15)
      } else if (grade === 2) {
        if (reviews === 0) interval = 1
        else if (reviews === 1) interval = 6
        else interval = Math.round(interval * ease)
        ease = ease - 0.15 + 0.1
      } else if (grade === 3) {
        if (reviews === 0) interval = 1
        else if (reviews === 1) interval = 6
        else interval = Math.round(interval * ease * 1.3)
        ease = Math.min(2.5, ease + 0.1)
      }

      const due = today + interval * 24 * 60 * 60 * 1000
      reviews++

      return { ...item, ease: Number(ease.toFixed(2)), interval, due, reviews, lapses }
    }))
  }

  const dueItems = items.filter(i => i.due <= now)
  const futureItems = items.filter(i => i.due > now).sort((a, b) => a.due - b.due)

  const formatDue = (due: number) => {
    if (due <= now) return 'Due now'
    const diff = due - now
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
    if (days === 1) return 'Tomorrow'
    if (days < 7) return `In ${days} days`
    if (days < 30) return `In ${Math.ceil(days / 7)} weeks`
    return `In ${Math.ceil(days / 30)} months`
  }

  const getStats = () => {
    const total = items.length
    const due = dueItems.length
    const mature = items.filter(i => i.interval >= 21).length
    const young = items.filter(i => i.reviews > 0 && i.interval < 21).length
    const new_ = items.filter(i => i.reviews === 0).length
    return { total, due, mature, young, new: new_ }
  }

  const stats = getStats()

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Spaced Repetition Scheduler (SM-2)</h3>
        <div className="row" style={{ gap: 8 }}>
          <input type="text" placeholder="Item to remember" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} style={{ width: 250 }} />
          <button className="btn" onClick={addItem}>Add</button>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={stats.total} /></b><span className="muted">Total Items</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={stats.due} /></b><span className="muted">Due Now</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={stats.mature} /></b><span className="muted">Mature (≥21d)</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={stats.young} /></b><span className="muted">Young (&lt;21d)</span></div>
        <div className="stat"><b><Roll value={stats.new} /></b><span className="muted">New (0 reviews)</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          <span>Show future reviews</span>
        </label>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {dueItems.length === 0 ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--ok)' }}>All Caught Up!</h3>
            <p className="muted">No items due for review. Check back tomorrow or add new items.</p>
          </div>
        ) : (
          dueItems.map((item, i) => (
            <div key={item.id} className="pop-row" style={{
              display: 'grid', gap: 12, padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div style={{ fontWeight: 500, fontSize: '1.1rem' }}>{item.name}</div>
              <div className="row" style={{ gap: 16, flexWrap: 'wrap', fontSize: '0.85rem' }}>
                <span className="muted">Interval: <b>{item.interval}d</b></span>
                <span className="muted">Ease: <b>{item.ease.toFixed(2)}</b></span>
                <span className="muted">Reviews: <b>{item.reviews}</b></span>
                <span className="muted">Lapses: <b>{item.lapses}</b></span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => gradeItem(item.id, 0)} style={{ background: 'var(--danger)', flex: 1 }}>Again (0)</button>
                <button className="btn" onClick={() => gradeItem(item.id, 1)} style={{ background: '#f59e0b', flex: 1 }}>Hard (1)</button>
                <button className="btn" onClick={() => gradeItem(item.id, 2)} style={{ background: 'var(--ok)', flex: 1 }}>Good (2)</button>
                <button className="btn" onClick={() => gradeItem(item.id, 3)} style={{ background: '#3b82f6', flex: 1 }}>Easy (3)</button>
                <button className="btn" onClick={() => removeItem(item.id)} style={{ color: 'var(--danger)' }}>Remove</button>
              </div>
            </div>
          ))
        )}

        {showAll && futureItems.length > 0 && (
          <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Upcoming Reviews ({futureItems.length})</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
              {futureItems.slice(0, 30).map((item, i) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                  <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>IVL: {item.interval}d</span>
                    <span style={{ fontWeight: 500, color: item.due <= now + 86400000 ? 'var(--danger)' : 'var(--text)' }}>
                      {formatDue(item.due)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        SM-2 algorithm: Grade 0=Again (reset), 1=Hard (reset, ease-), 2=Good (normal), 3=Easy (interval×1.3, ease+). Ease min 1.3.
      </p>
    </div>
  )
}