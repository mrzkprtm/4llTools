import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Item {
  id: number
  name: string
  price: number
  assignee: number | null
}

interface Person {
  id: number
  name: string
}

const DEFAULT_PEOPLE = ['Alice', 'Bob', 'Charlie'].map((n, i) => ({ id: i, name: n }))

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

export default function BillSplitter() {
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('bill-splitter-items')
    return saved ? JSON.parse(saved) : [{ id: Date.now(), name: 'Pizza', price: 25.00, assignee: null }]
  })
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('bill-splitter-people')
    return saved ? JSON.parse(saved) : DEFAULT_PEOPLE
  })
  const [taxRate, setTaxRate] = useState(8)
  const [serviceRate, setServiceRate] = useState(10)
  const [tipRate, setTipRate] = useState(15)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')

  useEffect(() => { try { localStorage.setItem('bill-splitter-items', JSON.stringify(items)) } catch {} }, [items])
  useEffect(() => { try { localStorage.setItem('bill-splitter-people', JSON.stringify(people)) } catch {} }, [people])

  const subtotal = items.reduce((s, i) => s + i.price, 0)
  const tax = subtotal * taxRate / 100
  const service = subtotal * serviceRate / 100
  const tip = (subtotal + tax + service) * tipRate / 100
  const total = subtotal + tax + service + tip

  const totals = people.map(p => ({
    ...p,
    amount: items.filter(i => i.assignee === p.id).reduce((s, i) => s + i.price, 0)
  }))

  const addItem = () => {
    if (!newItemName || !newItemPrice) return
    setItems([...items, { id: Date.now(), name: newItemName, price: Number(newItemPrice), assignee: null }])
    setNewItemName('')
    setNewItemPrice('')
  }

  const assignItem = (itemId: number, personId: number | null) => {
    setItems(items.map(i => i.id === itemId ? { ...i, assignee: personId } : i))
  }

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id))
  }

  const addPerson = () => {
    const name = prompt('Name:')
    if (name) setPeople([...people, { id: Date.now(), name }])
  }

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" placeholder="Item name" value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
        <input type="number" step="0.01" min="0" placeholder="Price" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} style={{ width: 100 }} />
        <button className="btn primary" onClick={addItem} disabled={!newItemName || !newItemPrice}>Add Item</button>
      </div>

      <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--sunken)' }}>
        {items.map(item => (
          <div key={item.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            borderBottom: '1px solid var(--border)', background: item.assignee !== null ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both'
          }}>
            <span style={{ flex: 1, fontWeight: 500 }}>{item.name}</span>
            <span style={{ fontFamily: 'var(--mono)', minWidth: 80 }}><Roll>{formatCurrency(item.price)}</Roll></span>
            <div className="row" style={{ gap: 4 }}>
              {people.map(p => (
                <button
                  key={p.id}
                  className={`btn ${item.assignee === p.id ? 'primary' : ''}`}
                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                  onClick={() => assignItem(item.id, item.assignee === p.id ? null : p.id)}
                >
                  {p.name}
                </button>
              ))}
              <button className="btn" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => removeItem(item.id)}>✕</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>No items yet</div>}
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="row" style={{ gap: 8 }}>
          <label style={{ margin: 0 }}>Tax %</label>
          <input type="number" min={0} max={100} step={0.5} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} style={{ width: 70 }} />
          <label style={{ margin: 0 }}>Service %</label>
          <input type="number" min={0} max={100} step={0.5} value={serviceRate} onChange={e => setServiceRate(Number(e.target.value))} style={{ width: 70 }} />
          <label style={{ margin: 0 }}>Tip %</label>
          <input type="number" min={0} max={100} step={0.5} value={tipRate} onChange={e => setTipRate(Number(e.target.value))} style={{ width: 70 }} />
        </div>
        <button className="btn" onClick={addPerson} style={{ marginLeft: 'auto' }}>+ Add Person</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <table className="simple">
          <thead><tr><th>Person</th><th>Subtotal</th><th>+ Tax</th><th>+ Service</th><th>+ Tip</th><th>Total</th></tr></thead>
          <tbody>
            {totals.map(p => (
              <tr key={p.id}>
                <td><b>{p.name}</b></td>
                <td><Roll>{formatCurrency(p.amount)}</Roll></td>
                <td><Roll>{formatCurrency(p.amount * taxRate / 100)}</Roll></td>
                <td><Roll>{formatCurrency(p.amount * serviceRate / 100)}</Roll></td>
                <td><Roll>{formatCurrency((p.amount + p.amount * taxRate / 100 + p.amount * serviceRate / 100) * tipRate / 100)}</Roll></td>
                <td><b><Roll>{formatCurrency(p.amount * (1 + taxRate/100 + serviceRate/100) * (1 + tipRate/100))}</Roll></b></td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
              <td>Total</td>
              <td><Roll>{formatCurrency(subtotal)}</Roll></td>
              <td><Roll>{formatCurrency(tax)}</Roll></td>
              <td><Roll>{formatCurrency(service)}</Roll></td>
              <td><Roll>{formatCurrency(tip)}</Roll></td>
              <td><Roll>{formatCurrency(total)}</Roll></td>
            </tr>
          </tbody>
        </table>
      </div>
      <Hint>Add items, tap names to assign. Coins animate to each person's total.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}