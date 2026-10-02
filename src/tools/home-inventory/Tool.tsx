import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Item {
  id: number
  name: string
  room: string
  category: string
  purchaseDate: string
  purchasePrice: number
  currentValue: number
  warrantyExpiry: string
  serialNumber: string
  brand: string
  model: string
  notes: string
  receipt: string
}

const ROOMS = ['Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 'Office', 'Garage', 'Basement', 'Attic', 'Outdoor', 'Other']
const CATEGORIES = ['Electronics', 'Furniture', 'Appliances', 'Decor', 'Clothing', 'Jewelry', 'Art', 'Tools', 'Sports', 'Toys', 'Books', 'Other']

export default function HomeInventory() {
  const [items, setItems] = useState<Item[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:home-inventory')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [rooms, setRooms] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:home-inventory-rooms')
      return saved ? JSON.parse(saved) : ROOMS
    } catch {
      return ROOMS
    }
  })
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:home-inventory-categories')
      return saved ? JSON.parse(saved) : CATEGORIES
    } catch {
      return CATEGORIES
    }
  })
  const [filterRoom, setFilterRoom] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')
  const [newItem, setNewItem] = useState({ name: '', room: 'Living Room', category: 'Electronics', purchaseDate: new Date().toISOString().split('T')[0], purchasePrice: 0, currentValue: 0, warrantyExpiry: '', serialNumber: '', brand: '', model: '', notes: '', receipt: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', room: 'Living Room', category: 'Electronics', purchaseDate: '', purchasePrice: 0, currentValue: 0, warrantyExpiry: '', serialNumber: '', brand: '', model: '', notes: '', receipt: '' })

  useEffect(() => { try { localStorage.setItem('4lltools:home-inventory', JSON.stringify(items)) } catch {} }, [items])
  useEffect(() => { try { localStorage.setItem('4lltools:home-inventory-rooms', JSON.stringify(rooms)) } catch {} }, [rooms])
  useEffect(() => { try { localStorage.setItem('4lltools:home-inventory-categories', JSON.stringify(categories)) } catch {} }, [categories])

  const addItem = () => {
    if (!newItem.name.trim()) return
    setItems([...items, { ...newItem, id: Date.now() }])
    setNewItem({ name: '', room: 'Living Room', category: 'Electronics', purchaseDate: new Date().toISOString().split('T')[0], purchasePrice: 0, currentValue: 0, warrantyExpiry: '', serialNumber: '', brand: '', model: '', notes: '', receipt: '' })
  }

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id))
  }

  const startEdit = (item: Item) => {
    setEditingId(item.id)
    setEditForm({ ...item })
  }

  const saveEdit = () => {
    if (!editingId) return
    setItems(items.map(i => i.id === editingId ? { ...i, ...editForm } : i))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const removeItemConfirm = (id: number) => {
    setItems(items.filter(i => i.id !== id))
  }

  const addRoom = () => {
    const name = prompt('Room name:')
    if (name && !rooms.includes(name)) setRooms([...rooms, name])
  }

  const removeRoom = (room: string) => {
    if (items.some(i => i.room === room)) { alert('Cannot delete room with items'); return }
    setRooms(rooms.filter(r => r !== room))
  }

  const addCategory = () => {
    const name = prompt('Category name:')
    if (name && !categories.includes(name)) setCategories([...categories, name])
  }

  const removeCategory = (cat: string) => {
    if (items.some(i => i.category === cat)) { alert('Cannot delete category with items'); return }
    setCategories(categories.filter(c => c !== cat))
  }

  const filteredItems = useMemo(() => {
    return items
      .filter(i => !filterRoom || i.room === filterRoom)
      .filter(i => !filterCategory || i.category === filterCategory)
      .filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.brand.toLowerCase().includes(search.toLowerCase()) || i.model.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
  }, [items, filterRoom, filterCategory, search])

  const totals = useMemo(() => {
    return {
      totalItems: items.length,
      totalPurchaseValue: items.reduce((sum, i) => sum + i.purchasePrice, 0),
      totalCurrentValue: items.reduce((sum, i) => sum + i.currentValue, 0),
      warrantyExpiring: items.filter(i => i.warrantyExpiry && new Date(i.warrantyExpiry) <= new Date(Date.now() + 30 * 86400000)).length,
    }
  }, [items])

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const exportCSV = () => {
    const headers = ['Name', 'Room', 'Category', 'Purchase Date', 'Purchase Price', 'Current Value', 'Warranty Expiry', 'Serial', 'Brand', 'Model', 'Notes', 'Receipt']
    const rows = items.map(i => [i.name, i.room, i.category, i.purchaseDate, i.purchasePrice, i.currentValue, i.warrantyExpiry, i.serialNumber, i.brand, i.model, i.notes, i.receipt])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `home-inventory-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmtDate = (date: string) => date ? new Date(date).toLocaleDateString() : '—'

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Home Inventory</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <span>Filter by Room</span>
          <select value={filterRoom} onChange={e => setFilterRoom(e.target.value)}>
            <option value="">All Rooms</option>
            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <span>Filter by Category</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <input type="text" placeholder="Search name, brand, model..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 250 }} />
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={totals.totalItems} /></b><span className="muted">Items</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(totals.totalPurchaseValue)} /></b><span className="muted">Purchase Value</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(totals.totalCurrentValue)} /></b><span className="muted">Current Value</span></div>
        <div className="stat"><b style={{ color: totals.warrantyExpiring > 0 ? 'var(--danger)' : 'var(--ok)' }}><Roll value={totals.warrantyExpiring} /></b><span className="muted">Warranty Expiring (30d)</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Item
            <span className="muted" style={{ fontSize: '0.8rem' }}>{items.length} items total</span>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Item Name *" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} style={{ flex: 1 }} />
              <select value={newItem.room} onChange={e => setNewItem({ ...newItem, room: e.target.value })} style={{ width: 150 }}>
                {rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })} style={{ width: 150 }}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="date" value={newItem.purchaseDate} onChange={e => setNewItem({ ...newItem, purchaseDate: e.target.value })} style={{ width: 140 }} />
              <input type="number" min={0} step={0.01} placeholder="Purchase Price" value={newItem.purchasePrice} onChange={e => setNewItem({ ...newItem, purchasePrice: Number(e.target.value) })} style={{ width: 130 }} />
              <input type="number" min={0} step={0.01} placeholder="Current Value" value={newItem.currentValue} onChange={e => setNewItem({ ...newItem, currentValue: Number(e.target.value) })} style={{ width: 130 }} />
              <input type="date" placeholder="Warranty Expiry" value={newItem.warrantyExpiry} onChange={e => setNewItem({ ...newItem, warrantyExpiry: e.target.value })} style={{ width: 140 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Serial Number" value={newItem.serialNumber} onChange={e => setNewItem({ ...newItem, serialNumber: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="Brand" value={newItem.brand} onChange={e => setNewItem({ ...newItem, brand: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="Model" value={newItem.model} onChange={e => setNewItem({ ...newItem, model: e.target.value })} style={{ flex: 1 }} />
            </div>
            <input type="text" placeholder="Receipt # / Link" value={newItem.receipt} onChange={e => setNewItem({ ...newItem, receipt: e.target.value })} />
            <textarea placeholder="Notes" value={newItem.notes} onChange={e => setNewItem({ ...newItem, notes: e.target.value })} rows={2} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={addItem} disabled={!newItem.name.trim()}>Add Item</button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Search</span>
            <input type="text" placeholder="Search name, brand, model..." value={search} onChange={e => setSearch(e.target.value)} />
          </label>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {filteredItems.length === 0 ? (
            <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <p className="muted">No items found. Add your first item above.</p>
            </div>
          ) : (
            filteredItems.map((item, i) => (
              <details key={item.id} defaultOpen={editingId === item.id} style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="row" style={{ gap: 12, alignItems: 'center', flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.name}</span>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>{item.room} • {item.category}</span>
                    <span className="muted">{fmt(item.currentValue)}</span>
                    {item.warrantyExpiry && new Date(item.warrantyExpiry) <= new Date(Date.now() + 30 * 86400000) && (
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'var(--danger)20', color: 'var(--danger)', borderRadius: 4 }}>Warranty Expiring Soon!</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn" onClick={() => startEdit(item)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
                    <button className="btn" onClick={() => removeItemConfirm(item.id)} style={{ color: 'var(--danger)', padding: '4px 10px', fontSize: '0.75rem' }}>Delete</button>
                  </div>
                </summary>
                <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                  {editingId === item.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" style={{ flex: 1 }} />
                        <select value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })} style={{ width: 150 }}>
                          {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={{ width: 150 }}>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value })} style={{ width: 140 }} />
                        <input type="number" step={0.01} min={0} value={editForm.purchasePrice} onChange={e => setEditForm({ ...editForm, purchasePrice: Number(e.target.value) })} style={{ width: 130 }} />
                        <input type="number" step={0.01} min={0} value={editForm.currentValue} onChange={e => setEditForm({ ...editForm, currentValue: Number(e.target.value) })} style={{ width: 130 }} />
                        <input type="date" value={editForm.warrantyExpiry} onChange={e => setEditForm({ ...editForm, warrantyExpiry: e.target.value })} style={{ width: 140 }} />
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <input type="text" value={editForm.serialNumber} onChange={e => setEditForm({ ...editForm, serialNumber: e.target.value })} placeholder="Serial" style={{ flex: 1 }} />
                        <input type="text" value={editForm.brand} onChange={e => setEditForm({ ...editForm, brand: e.target.value })} placeholder="Brand" style={{ flex: 1 }} />
                        <input type="text" value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} placeholder="Model" style={{ flex: 1 }} />
                      </div>
                      <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" rows={2} style={{ width: '100%' }} />
                      <input type="text" value={editForm.receipt} onChange={e => setEditForm({ ...editForm, receipt: e.target.value })} placeholder="Receipt #" style={{ width: '100%' }} />
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn" onClick={saveEdit}>Save</button>
                        <button className="btn" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Room / Category</div>
                        <div style={{ fontWeight: 500 }}>{item.room} / {item.category}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Brand / Model</div>
                        <div style={{ fontWeight: 500 }}>{item.brand} / {item.model}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Purchase Date</div>
                        <div>{fmtDate(item.purchaseDate)}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Purchase Price</div>
                        <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmt(item.purchasePrice)}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Current Value</div>
                        <div style={{ fontWeight: 600, color: 'var(--ok)' }}>{fmt(item.currentValue)}</div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Depreciation</div>
                        <div style={{ fontWeight: 600, color: item.currentValue < item.purchasePrice ? 'var(--danger)' : 'var(--ok)' }}>
                          {fmt(item.currentValue - item.purchasePrice)} ({((item.currentValue / item.purchasePrice) * 100).toFixed(0)}%)
                        </div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Warranty Expiry</div>
                        <div style={{ color: item.warrantyExpiry && new Date(item.warrantyExpiry) <= new Date(Date.now() + 30 * 86400000) ? 'var(--danger)' : 'var(--text)' }}>
                          {fmtDate(item.warrantyExpiry)}
                        </div>
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>Serial / Receipt</div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>{item.serialNumber || '—'} / {item.receipt || '—'}</div>
                      </div>
                      {item.notes && (
                        <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Notes</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </details>
            ))
          )}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Catalog your belongings by room and category. Track purchase price, current value, warranty, and serial numbers. Export for insurance claims.
        </p>
      </div>
    </div>
  )
}