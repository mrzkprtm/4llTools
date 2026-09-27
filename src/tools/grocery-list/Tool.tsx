import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Item {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  price: number
  purchased: boolean
  storeSection: string
}

const CATEGORIES = [
  { name: 'Produce', section: 'Produce', color: '#16a34a' },
  { name: 'Meat & Seafood', section: 'Meat', color: '#e11d48' },
  { name: 'Dairy & Eggs', section: 'Dairy', color: '#3b82f6' },
  { name: 'Bakery', section: 'Bakery', color: '#ca8a04' },
  { name: 'Pantry', section: 'Center Aisles', color: '#9333ea' },
  { name: 'Frozen', section: 'Frozen', color: '#0891b2' },
  { name: 'Beverages', section: 'Beverages', color: '#db2777' },
  { name: 'Snacks', section: 'Snacks', color: '#f59e0b' },
  { name: 'Household', section: 'Household', color: '#64748b' },
  { name: 'Personal Care', section: 'Health & Beauty', color: '#ec4899' },
]

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box', 'can', 'bottle', 'bag', 'dozen']

export default function GroceryList() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('grocery-list')
    return saved ? JSON.parse(saved) : []
  })
  const [filterCategory, setFilterCategory] = useState('')
  const [showPurchased, setShowPurchased] = useState(true)
  const [newItem, setNewItem] = useState({ name: '', category: 'Produce', quantity: 1, unit: 'pcs', price: 0, storeSection: 'Produce' })

  useEffect(() => {
    try { localStorage.setItem('grocery-list', JSON.stringify(items)) } catch {}
  }, [items])

  const addItem = () => {
    if (!newItem.name.trim()) return
    const cat = CATEGORIES.find(c => c.name === newItem.category)
    setItems([...items, { ...newItem, id: Date.now(), purchased: false, storeSection: cat?.section || 'Produce' }])
    setNewItem({ name: '', category: 'Produce', quantity: 1, unit: 'pcs', price: 0, storeSection: 'Produce' })
  }

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id))
  }

  const togglePurchased = (id: number) => {
    setItems(items.map(i => i.id === id ? { ...i, purchased: !i.purchased } : i))
  }

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const clearPurchased = () => {
    setItems(items.filter(i => !i.purchased))
  }

  const filteredItems = useMemo(() => {
    return items
      .filter(i => !filterCategory || i.category === filterCategory)
      .filter(i => showPurchased || !i.purchased)
      .sort((a, b) => {
        if (a.purchased !== b.purchased) return a.purchased ? 1 : -1
        const sectionOrder = CATEGORIES.findIndex(c => c.section === a.storeSection) - CATEGORIES.findIndex(c => c.section === b.storeSection)
        if (sectionOrder !== 0) return sectionOrder
        return a.name.localeCompare(b.name)
      })
  }, [items, filterCategory, showPurchased])

  const totals = useMemo(() => {
    const pending = items.filter(i => !i.purchased)
    return {
      totalItems: items.length,
      pendingItems: pending.length,
      estimatedCost: pending.reduce((sum, i) => sum + i.price * i.quantity, 0),
      spentCost: items.filter(i => i.purchased).reduce((sum, i) => sum + i.price * i.quantity, 0),
    }
  }, [items])

  const fmt = (n: number) => '$' + n.toFixed(2)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Grocery List</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={clearPurchased} disabled={items.filter(i => i.purchased).length === 0}>Clear Purchased</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Filter by Category</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={showPurchased} onChange={e => setShowPurchased(e.target.checked)} />
          <span>Show Purchased</span>
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={totals.totalItems} /></b><span className="muted">Total Items</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={totals.pendingItems} /></b><span className="muted">To Buy</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(totals.estimatedCost)} /></b><span className="muted">Est. Cost</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(totals.spentCost)} /></b><span className="muted">Spent</span></div>
      </div>

      <div style={{ marginBottom: 16, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Item
          <button className="btn" onClick={addItem} disabled={!newItem.name.trim()} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Add</button>
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Item name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ flex: 1 }} />
            <select value={newItem.category} onChange={e => { const cat = CATEGORIES.find(c => c.name === e.target.value); setNewItem({ ...newItem, category: e.target.value, storeSection: cat?.section || 'Produce' }) }} style={{ width: 180 }}>
              {CATEGORIES.map(c => <option key={c.name} value={c.name} style={{ borderLeft: `4px solid ${c.color}` }}>{c.name}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="number" min={0.01} step={0.1} placeholder="Quantity" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} style={{ width: 80 }} />
            <select value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} style={{ width: 100 }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min={0} step={0.01} placeholder="Est. Price" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: Number(e.target.value) })} style={{ width: 100 }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.map((cat, ci) => {
          const catItems = filteredItems.filter(i => i.storeSection === cat.section)
          if (catItems.length === 0) return null

          const pendingCount = catItems.filter(i => !i.purchased).length
          return (
            <details key={cat.section} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, background: cat.color + '20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color }} />
                  <span style={{ fontWeight: 600 }}>{cat.name}</span>
                </div>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span className="muted">{catItems.length} items</span>
                  <span style={{ color: pendingCount > 0 ? 'var(--danger)' : 'var(--ok)' }}>{pendingCount} to buy</span>
                </div>
              </summary>
              <div style={{ padding: 12 }}>
                {catItems.map((item, i) => (
                  <label key={item.id} className="pop-row" style={{
                    display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 100px 80px 50px', gap: 8, padding: 8,
                    background: item.purchased ? 'var(--ok)10' : 'var(--bg)',
                    border: item.purchased ? '2px solid var(--ok)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    opacity: item.purchased ? 0.7 : 1,
                    animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                    animationDelay: `${i * 30}ms`,
                  }}>
                    <input type="checkbox" checked={item.purchased} onChange={() => togglePurchased(item.id)} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 500, textDecoration: item.purchased ? 'line-through' : 'none' }}>{item.name}</span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>{item.quantity} {item.unit}</span>
                    </div>
                    <input type="number" min={0.1} step={0.1} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} style={{ width: 70, textAlign: 'right' }} />
                    <input type="number" min={0} step={0.01} value={item.price} onChange={e => updateItem(item.id, 'price', Number(e.target.value))} placeholder="Price" style={{ width: 80, textAlign: 'right' }} />
                    <span style={{ fontWeight: 600, fontFamily: 'var(--mono)', textAlign: 'right', minWidth: 80 }}>{fmt(item.price * item.quantity)}</span>
                    <button className="btn" onClick={() => removeItem(item.id)} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
                  </label>
                ))}
              </div>
            </details>
          )
        })}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Organized by store sections. Check items as you shop. Tracks estimated vs actual spending. Data saved locally.
      </p>
    </div>
  )
}