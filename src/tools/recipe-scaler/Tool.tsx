import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const INGREDIENTS = [
  { name: 'Flour', amount: 2, unit: 'cups' },
  { name: 'Sugar', amount: 1, unit: 'cup' },
  { name: 'Butter', amount: 0.5, unit: 'cup' },
  { name: 'Eggs', amount: 2, unit: 'pcs' },
  { name: 'Milk', amount: 1, unit: 'cup' },
  { name: 'Baking Powder', amount: 1, unit: 'tsp' },
  { name: 'Salt', amount: 0.5, unit: 'tsp' },
]

const UNIT_CONVERSIONS: Record<string, { base: string; factor: number }> = {
  'tsp': { base: 'ml', factor: 4.92892 },
  'tbsp': { base: 'ml', factor: 14.7868 },
  'cup': { base: 'ml', factor: 236.588 },
  'ml': { base: 'ml', factor: 1 },
  'l': { base: 'ml', factor: 1000 },
  'g': { base: 'g', factor: 1 },
  'kg': { base: 'g', factor: 1000 },
  'oz': { base: 'g', factor: 28.3495 },
  'lb': { base: 'g', factor: 453.592 },
  'pcs': { base: 'pcs', factor: 1 },
}

function formatAmount(amount: number, unit: string): string {
  const conv = UNIT_CONVERSIONS[unit]
  if (!conv) return `${amount} ${unit}`
  const baseAmount = amount * conv.factor
  // Convert to best unit
  if (conv.base === 'ml') {
    if (baseAmount >= 1000) return `${(baseAmount / 1000).toFixed(2)} l`
    if (baseAmount >= 236.588) return `${(baseAmount / 236.588).toFixed(2)} cup`
    if (baseAmount >= 14.7868) return `${(baseAmount / 14.7868).toFixed(2)} tbsp`
    return `${baseAmount.toFixed(1)} ml`
  }
  if (conv.base === 'g') {
    if (baseAmount >= 1000) return `${(baseAmount / 1000).toFixed(2)} kg`
    return `${baseAmount.toFixed(1)} g`
  }
  return `${amount} ${unit}`
}

export default function RecipeScaler() {
  const [servings, setServings] = useState(4)
  const [ingredients, setIngredients] = useState(() => {
    const saved = localStorage.getItem('recipe-scaler')
    return saved ? JSON.parse(saved) : INGREDIENTS.map((i, idx) => ({ ...i, id: idx, originalAmount: i.amount, originalUnit: i.unit }))
  })
  const originalServings = 4

  useEffect(() => {
    try { localStorage.setItem('recipe-scaler', JSON.stringify(ingredients)) } catch {}
  }, [ingredients])

  const factor = servings / originalServings

  const scaledIngredients = ingredients.map(ing => ({
    ...ing,
    amount: Math.round(ing.originalAmount * factor * 100) / 100,
    displayAmount: formatAmount(ing.originalAmount * factor, ing.originalUnit),
  }))

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 300 }}>
          <span style={{ fontWeight: 600 }}>Servings:</span>
          <input type="range" min={1} max={20} value={servings} onChange={e => setServings(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, minWidth: 40, textAlign: 'center' }}><Roll>{servings}</Roll></span>
        </label>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Ingredients</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {scaledIngredients.map((ing, i) => (
            <div key={ing.id} className="pop-row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`
            }}>
              <span style={{ flex: 1, fontWeight: 500 }}>{ing.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 700, minWidth: 100, textAlign: 'right' }}>
                <Roll>{ing.displayAmount}</Roll>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {scaledIngredients.map((ing, i) => (
          <div key={ing.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: 8,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <input type="text" value={ing.name} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? { ...x, name: e.target.value } : x))} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)' }} />
            <input type="number" step="0.01" min={0} value={ing.originalAmount} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? { ...x, originalAmount: Number(e.target.value) } : x))} style={{ width: 80 }} />
            <select value={ing.originalUnit} onChange={e => setIngredients(ingredients.map(x => x.id === ing.id ? { ...x, originalUnit: e.target.value } : x))} style={{ width: 80 }}>
              {Object.keys(UNIT_CONVERSIONS).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        ))}
      </div>

      <Hint>Move slider to scale recipe. Units auto-convert (tsp→tbsp→cup, g→kg). Edit ingredients to customize.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}