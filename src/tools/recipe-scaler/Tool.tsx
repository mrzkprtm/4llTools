import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Ingredient {
  id: number
  name: string
  amount: number
  unit: string
}

const UNITS = [
  { name: 'g', type: 'weight', toBase: 1 },
  { name: 'kg', type: 'weight', toBase: 1000 },
  { name: 'oz', type: 'weight', toBase: 28.3495 },
  { name: 'lb', type: 'weight', toBase: 453.592 },
  { name: 'ml', type: 'volume', toBase: 1 },
  { name: 'L', type: 'volume', toBase: 1000 },
  { name: 'tsp', type: 'volume', toBase: 4.92892 },
  { name: 'tbsp', type: 'volume', toBase: 14.7868 },
  { name: 'cup', type: 'volume', toBase: 236.588 },
  { name: 'fl oz', type: 'volume', toBase: 29.5735 },
  { name: 'pint', type: 'volume', toBase: 473.176 },
  { name: 'quart', type: 'volume', toBase: 946.353 },
  { name: 'gal', type: 'volume', toBase: 3785.41 },
  { name: 'pcs', type: 'count', toBase: 1 },
  { name: 'dozen', type: 'count', toBase: 12 },
  { name: 'pinch', type: 'volume', toBase: 0.31 },
  { name: 'dash', type: 'volume', toBase: 0.62 },
]

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {}
UNITS.forEach(u1 => {
  UNIT_CONVERSIONS[u1.name] = {}
  UNITS.forEach(u2 => {
    if (u1.type === u2.type) {
      UNIT_CONVERSIONS[u1.name][u2.name] = u1.toBase / u2.toBase
    }
  })
}

interface Ingredient {
  id: number
  name: string
  amount: number
  unit: string
}

export default function RecipeScaler() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    const saved = localStorage.getItem('recipe-scaler')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Flour', amount: 500, unit: 'g' },
      { id: 2, name: 'Sugar', amount: 200, unit: 'g' },
      { id: 3, name: 'Butter', amount: 250, unit: 'g' },
      { id: 4, name: 'Eggs', amount: 4, unit: 'pcs' },
      { id: 5, name: 'Milk', amount: 250, unit: 'ml' },
    ]
  })
  const [originalServings, setOriginalServings] = useState(8)
  const [targetServings, setTargetServings] = useState(12)
  const [scaleMethod, setScaleMethod] = useState<'servings' | 'ingredient' | 'weight'>('servings')
  const [referenceIngredient, setReferenceIngredient] = useState('')
  const [targetAmount, setTargetAmount] = useState(0)
  const [targetUnit, setTargetUnit] = useState('g')

  useEffect(() => {
    try { localStorage.setItem('recipe-scaler', JSON.stringify(ingredients)) } catch {}
  }, [ingredients])

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now(), name: '', amount: 0, unit: 'g' }])
  }

  const removeIngredient = (id: number) => {
    setIngredients(ingredients.filter(i => i.id !== id))
  }

  const updateIngredient = (id: number, field: string, value: string | number) => {
    setIngredients(ingredients.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const scaleFactor = useMemo(() => {
    if (scaleMethod === 'servings') {
      return targetServings / originalServings
    } else if (scaleMethod === 'ingredient' && referenceIngredient && targetAmount > 0) {
      const ref = ingredients.find(i => i.name === referenceIngredient)
      if (!ref) return 1
      const refUnit = UNITS.find(u => u.name === ref.unit)
      const targetU = UNITS.find(u => u.name === targetUnit)
      if (!refUnit || !targetU || refUnit.type !== targetU.type) return 1
      const refBase = ref.amount * refUnit.toBase
      const targetBase = targetAmount * targetU.toBase
      return targetBase / refBase
    } else if (scaleMethod === 'weight') {
      const totalWeight = ingredients.reduce((sum, ing) => {
        const u = UNITS.find(u => u.name === ing.unit)
        return sum + (u ? ing.amount * u.toBase : 0)
      }, 0)
      return targetAmount / totalWeight
    }
    return 1
  }, [scaleMethod, originalServings, targetServings, referenceIngredient, targetAmount, targetUnit, ingredients])

  const scaledIngredients = useMemo(() => {
    return ingredients.map(ing => {
      const u = UNITS.find(u => u.name === ing.unit)
      if (!u) return { ...ing, scaledAmount: ing.amount, scaledUnit: ing.unit }
      const baseAmount = ing.amount * u.toBase
      const scaledBase = baseAmount * scaleFactor
      // Find best unit for scaled amount
      const sameTypeUnits = UNITS.filter(u2 => u2.type === u.type)
      let bestUnit = u
      for (const u2 of sameTypeUnits) {
        const val = scaledBase / u2.toBase
        if (val >= 1 && val < 1000) {
          bestUnit = u2
        }
      }
      const scaledAmount = scaledBase / bestUnit.toBase
      return { ...ing, scaledAmount, scaledUnit: bestUnit.name }
    })
  }, [ingredients, scaleFactor])

  const originalTotalWeight = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      const u = UNITS.find(u => u.name === ing.unit)
      return sum + (u ? ing.amount * u.toBase : 0)
    }, 0)
  }, [ingredients])

  const scaledTotalWeight = originalTotalWeight * scaleFactor

  const cookingTimeAdjustment = useMemo(() => {
    if (scaleMethod !== 'servings') return 1
    // Rough approximation: time scales with volume^(2/3) for baking, linearly for stovetop
    return Math.pow(scaleFactor, 2/3)
  }, [scaleFactor])

  const formatAmount = (amount: number) => {
    if (amount >= 1000) return (amount / 1000).toFixed(2)
    if (amount >= 100) return amount.toFixed(1)
    if (amount >= 10) return amount.toFixed(1)
    if (amount >= 1) return amount.toFixed(2)
    if (amount >= 0.1) return amount.toFixed(3)
    return amount.toFixed(4)
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Recipe Scaler</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Scale Method</span>
          <select value={scaleMethod} onChange={e => setScaleMethod(e.target.value as any)}>
            <option value="servings">By Servings</option>
            <option value="ingredient">By Ingredient Amount</option>
            <option value="weight">By Total Weight</option>
          </select>
        </label>

        {scaleMethod === 'servings' && (
          <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Original Servings</span>
              <input type="number" min={1} max={1000} value={originalServings} onChange={e => setOriginalServings(Number(e.target.value))} style={{ width: 100 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Target Servings</span>
              <input type="number" min={1} max={1000} value={targetServings} onChange={e => setTargetServings(Number(e.target.value))} style={{ width: 100 }} />
            </label>
            <div className="stat"><b>Scale Factor: </b><Roll value={scaleFactor.toFixed(2)} />x</div>
          </div>
        )}

        {scaleMethod === 'ingredient' && (
          <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Reference Ingredient</span>
              <select value={referenceIngredient} onChange={e => setReferenceIngredient(e.target.value)}>
                <option value="">Select...</option>
                {ingredients.map(i => <option key={i.name} value={i.name}>{i.name} ({i.amount} {i.unit})</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Target Amount</span>
              <input type="number" min={0.01} step={0.01} value={targetAmount} onChange={e => setTargetAmount(Number(e.target.value))} style={{ width: 100 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Target Unit</span>
              <select value={targetUnit} onChange={e => setTargetUnit(e.target.value)}>
                {UNITS.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
            </label>
            <div className="stat"><b>Scale Factor: </b><Roll value={scaleFactor.toFixed(2)} />x</div>
          </div>
        )}

        {scaleMethod === 'weight' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
            <span>Target Total Weight (g)</span>
            <input type="number" min={1} step={1} value={targetAmount} onChange={e => setTargetAmount(Number(e.target.value))} />
            <div className="stat"><b>Scale Factor: </b><Roll value={scaleFactor.toFixed(2)} />x</div>
          </label>
        )}
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b>Scale Factor: </b><Roll value={scaleFactor.toFixed(2)} />x</div>
        <div className="stat"><b>Cooking Time: </b>×<Roll value={Math.pow(scaleFactor, 2/3).toFixed(2)} /> (approx for baking)</div>
        <div className="stat"><b>Total Weight: </b><Roll value={ingredients.reduce((s, i) => s + (UNITS.find(u => u.name === i.unit)?.toBase || 1) * i.amount, 0).toFixed(1)} g → <Roll value={(ingredients.reduce((s, i) => s + (UNITS.find(u => u.name === i.unit)?.toBase || 1) * i.amount, 0) * scaleFactor).toFixed(1)} /> g</div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Ingredients
            <button className="btn" onClick={() => setIngredients([...ingredients, { id: Date.now(), name: '', amount: 0, unit: 'g' }])} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {ingredients.map((ing, i) => (
              <div key={ing.id} className="pop-row" style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 100px 50px', gap: 8, padding: 8,
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 30}ms`,
              }}>
                <input type="text" placeholder="Ingredient name" value={ingredients[i].name} onChange={e => setIngredients(ingredients.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                <input type="number" step={0.01} min={0} value={ingredients[i].amount} onChange={e => setIngredients(ingredients.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} style={{ width: 100 }} />
                <select value={ingredients[i].unit} onChange={e => setIngredients(ingredients.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} style={{ width: 100 }}>
                  {UNITS.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                </select>
                <button className="btn" onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
              </div>
            ))}
            <button className="btn" onClick={() => setIngredients([...ingredients, { id: Date.now(), name: '', amount: 0, unit: 'g' }])} style={{ justifySelf: 'start', marginTop: 8 }}>+ Add Ingredient</button>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Scaled Recipe</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {ingredients.map((ing, i) => {
                const u = UNITS.find(u => u.name === ing.unit)
                const baseAmount = ing.amount * (u?.toBase || 1)
                const scaledBase = baseAmount * scaleFactor
                const sameType = UNITS.filter(u2 => u2.type === (UNITS.find(u => u.name === ingredients[i].unit)?.type || 'weight'))
                let bestUnit = UNITS.find(u => u.name === ingredients[i].unit)!
                for (const u2 of sameType) {
                  const val = (ingredients[i].amount * (UNITS.find(u => u.name === ingredients[i].unit)?.toBase || 1) * scaleFactor) / u2.toBase
                  if (val >= 1 && val < 1000) bestUnit = u2
                }
                const scaledAmount = (ingredients[i].amount * (UNITS.find(u => u.name === ingredients[i].unit)?.toBase || 1) * scaleFactor) / bestUnit.toBase
                return (
                  <div key={i} className="pop-row" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8,
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                    animationDelay: `${i * 30}ms`,
                  }}>
                    <span style={{ fontWeight: 500 }}>{ingredients[i].name}</span>
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
                        {scaledAmount.toFixed(ingredients[i].amount < 10 ? 2 : 1)} {UNITS.find(u => u.name === bestUnit.name)?.name}
                      </span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        (was {ingredients[i].amount} {ingredients[i].unit})
                      </span>
                    </div>
                  </div>
                )}
              )}
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Cooking Time Adjustment</h4>
          <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Scale Factor</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                <Roll value={scaleFactor.toFixed(2)} />x
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Baking Time Multiplier</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                ×<Roll value={Math.pow(scaleFactor, 2/3).toFixed(2)} />
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Volume^(2/3) approximation</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Stovetop Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                ×<Roll value={scaleFactor.toFixed(2)} />
              </div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>Linear scaling</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Pan Size</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                ×<Roll value={Math.sqrt(scaleFactor).toFixed(2)} />
              </div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>Area scales with sqrt</div>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Unit Converter</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="number" step={0.01} min={0} placeholder="Amount" style={{ width: 100 }} />
              <select style={{ width: 120 }}>
                {UNITS.map(u => <option key={u.name} value={u.name}>{u.name} ({u.type})</option>)}
              </select>
              <span>=</span>
              <select style={{ width: 120 }}>
                {UNITS.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>Select units of same type (weight/volume/count) to convert.</p>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Scale recipes by servings, ingredient amount, or total weight. Automatic unit conversion finds best units. Cooking time scales with volume^(2/3) for baking.
        </p>
      </div>
    </div>
  )
}