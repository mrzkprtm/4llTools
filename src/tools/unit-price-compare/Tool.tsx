import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Product {
  id: number
  name: string
  price: number
  quantity: number
  unit: 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'oz' | 'lb'
  color: string
}

const COLORS = ['#e11d48', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']
const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'oz', 'lb']

function normalizeToBase(quantity: number, unit: string): { baseQty: number; baseUnit: string } {
  if (unit === 'kg') return { baseQty: quantity * 1000, baseUnit: 'g' }
  if (unit === 'l') return { baseQty: quantity * 1000, baseUnit: 'ml' }
  if (unit === 'lb') return { baseQty: quantity * 16, baseUnit: 'oz' }
  return { baseQty: quantity, baseUnit: unit }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

export default function UnitPriceComparer() {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('unit-price-compare')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Brand A', price: 4.99, quantity: 500, unit: 'g', color: COLORS[0] },
      { id: 2, name: 'Brand B', price: 8.99, quantity: 1, unit: 'kg', color: COLORS[1] },
      { id: 3, name: 'Brand C', price: 3.49, quantity: 300, unit: 'g', color: COLORS[2] },
    ]
  })
  const [formData, setFormData] = useState({ name: '', price: '', quantity: '', unit: 'g' as Product['unit'] })

  useEffect(() => { try { localStorage.setItem('unit-price-compare', JSON.stringify(products)) } catch {} }, [products])

  const normalized = products.map(p => {
    const { baseQty, baseUnit } = normalizeToBase(p.quantity, p.unit)
    const perUnit = p.price / baseQty
    return { ...p, baseQty, baseUnit, perUnit }
  })

  const cheapest = normalized.reduce((min, p) => p.perUnit < min.perUnit ? p : min, normalized[0])

  const addProduct = () => {
    if (!formData.name || !formData.price || !formData.quantity) return
    setProducts([...products, { id: Date.now(), name: formData.name, price: Number(formData.price), quantity: Number(formData.quantity), unit: formData.unit, color: COLORS[products.length % COLORS.length] }])
    setFormData({ name: '', price: '', quantity: '', unit: 'g' })
  }

  const updateProduct = (id: number, field: keyof Product, value: string | number) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const deleteProduct = (id: number) => {
    setProducts(products.filter(p => p.id !== id))
  }

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" placeholder="Product name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
        <input type="number" step="0.01" min="0" placeholder="Price" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} style={{ width: 100 }} />
        <input type="number" step="0.01" min="0" placeholder="Qty" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} style={{ width: 80 }} />
        <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value as Product['unit'] })} style={{ width: 80 }}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button className="btn primary" onClick={addProduct} disabled={!formData.name || !formData.price || !formData.quantity}>Add</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: '1.2rem' }}>Cheapest per unit:</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ok)' }}>
            <b>{cheapest.name}</b> at <b><Roll>{formatCurrency(cheapest.perUnit)}</Roll></b>/{cheapest.baseUnit}
          </span>
        </div>

        <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflow: 'auto' }}>
          {normalized.map((p, i) => (
            <div key={p.id} className="pop-row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 10,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              borderLeft: p.id === cheapest.id ? '4px solid var(--ok)' : 'none',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`
            }}>
              <span style={{ width: 12, height: 12, borderRadius: 4, background: p.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
              <span className="muted" style={{ minWidth: 120 }}>{formatCurrency(p.price)} / {p.quantity}{p.unit}</span>
              <span style={{ fontFamily: 'var(--mono)', minWidth: 140, textAlign: 'right' }}>
                <b><Roll>{formatCurrency(p.perUnit)}</Roll></b>/{p.baseUnit}
              </span>
              <span className={p.id === cheapest.id ? 'chip good' : ''} style={{ fontSize: '0.7rem' }}>
                {p.id === cheapest.id ? 'BEST' : ''}
              </span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, height: 200, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <canvas
            width={600}
            height={200}
            style={{ width: '100%', height: '100%', display: 'block' }}
            ref={canvas => {
              if (!canvas) return
              const ctx = canvas.getContext('2d')!
              const dpr = window.devicePixelRatio || 1
              canvas.width = canvas.offsetWidth * dpr
              canvas.height = canvas.offsetHeight * dpr
              ctx.scale(dpr, dpr)

              const w = canvas.width / dpr
              const h = canvas.height / dpr
              const maxPerUnit = Math.max(...normalized.map(p => p.perUnit))
              const barH = 30
              const gap = 10
              const startY = 30

              normalized.forEach((p, i) => {
                const y = startY + i * (barH + gap)
                const barW = (p.perUnit / maxPerUnit) * (w - 60)
                // Background
                ctx.fillStyle = 'var(--border)'
                ctx.fillRect(30, y, w - 60, barH)
                // Bar
                const grad = ctx.createLinearGradient(30, 0, 30 + barW, 0)
                grad.addColorStop(0, p.color + '80')
                grad.addColorStop(1, p.color)
                ctx.fillStyle = grad
                ctx.fillRect(30, y, barW, barH)
                // Label
                ctx.fillStyle = 'var(--text)'
                ctx.font = '12px var(--font)'
                ctx.textAlign = 'right'
                ctx.fillText(p.name, 25, y + barH * 0.7)
                // Value
                ctx.font = 'bold 12px var(--mono)'
                ctx.textAlign = 'left'
                ctx.fillText(`${formatCurrency(p.perUnit)}/${p.baseUnit}`, 30 + barW + 10, y + barH * 0.7)
                // Winner marker
                if (p.id === cheapest.id) {
                  ctx.fillStyle = 'var(--ok)'
                  ctx.font = '14px var(--font)'
                  ctx.fillText('✓', 30 + barW + 120, y + barH * 0.7)
                }
              })
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {products.map((p, i) => (
          <div key={p.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: p.color, flexShrink: 0 }} />
            <input type="text" value={p.name} onChange={e => updateProduct(p.id, 'name', e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)' }} />
            <input type="number" step="0.01" min={0} value={p.price} onChange={e => updateProduct(p.id, 'price', Number(e.target.value))} style={{ width: 80 }} />
            <input type="number" step="0.01" min={0} value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', Number(e.target.value))} style={{ width: 70 }} />
            <select value={p.unit} onChange={e => updateProduct(p.id, 'unit', e.target.value)} style={{ width: 80 }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <span style={{ fontFamily: 'var(--mono)', minWidth: 140, textAlign: 'right' }}>
              <Roll>{formatCurrency(normalizeToBase(p.quantity, p.unit).baseQty ? p.price / normalizeToBase(p.quantity, p.unit).baseQty : 0)}</Roll>/{normalizeToBase(p.quantity, p.unit).baseUnit}
            </span>
            <button className="btn" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => deleteProduct(p.id)}>✕</button>
          </div>
        ))}
      </div>

      <Hint>Enter products with price and quantity. Bars race to show cheapest per base unit (g, ml, pc). Winner highlighted in green.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}