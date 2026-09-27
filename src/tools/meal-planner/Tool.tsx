import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Recipe {
  id: number
  name: string
  cuisine: string
  prepTime: number
  cookTime: number
  servings: number
  ingredients: { name: string; amount: number; unit: string }[]
  instructions: string
  calories: number
  tags: string[]
}

interface MealPlan {
  id: number
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId: number
  servings: number
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const CUISINES = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian', 'Other']

const SAMPLE_RECIPES: Recipe[] = [
  {
    id: 1, name: 'Avocado Toast', cuisine: 'American', prepTime: 5, cookTime: 5, servings: 1,
    ingredients: [{ name: 'Bread', amount: 2, unit: 'slices' }, { name: 'Avocado', amount: 1, unit: 'pc' }, { name: 'Egg', amount: 2, unit: 'pc' }],
    instructions: 'Toast bread. Mash avocado. Fry eggs. Assemble.',
    calories: 350, tags: ['quick', 'vegetarian']
  },
  {
    id: 2, name: 'Chicken Stir Fry', cuisine: 'Asian', prepTime: 15, cookTime: 10, servings: 4,
    ingredients: [{ name: 'Chicken breast', amount: 500, unit: 'g' }, { name: 'Mixed vegetables', amount: 300, unit: 'g' }, { name: 'Soy sauce', amount: 3, unit: 'tbsp' }, { name: 'Rice', amount: 2, unit: 'cups' }],
    instructions: 'Cut chicken. Stir fry with veg. Add sauce. Serve over rice.',
    calories: 450, tags: ['high-protein', 'quick']
  },
  {
    id: 3, name: 'Spaghetti Bolognese', cuisine: 'Italian', prepTime: 10, cookTime: 20, servings: 4,
    ingredients: [{ name: 'Spaghetti', amount: 400, unit: 'g' }, { name: 'Ground beef', amount: 400, unit: 'g' }, { name: 'Tomato sauce', amount: 500, unit: 'ml' }, { name: 'Onion', amount: 1, unit: 'pc' }, { name: 'Garlic', amount: 3, unit: 'cloves' }],
    instructions: 'Cook pasta. Brown beef with onion/garlic. Add sauce. Simmer. Combine.',
    calories: 550, tags: ['family', 'comfort']
  },
  {
    id: 4, name: 'Greek Salad', cuisine: 'Mediterranean', prepTime: 10, cookTime: 0, servings: 4,
    ingredients: [{ name: 'Cucumber', amount: 1, unit: 'pc' }, { name: 'Tomatoes', amount: 3, unit: 'pc' }, { name: 'Feta cheese', amount: 200, unit: 'g' }, { name: 'Olives', amount: 100, unit: 'g' }, { name: 'Olive oil', amount: 3, unit: 'tbsp' }],
    instructions: 'Chop vegetables. Combine with feta and olives. Dress with olive oil.',
    calories: 280, tags: ['vegetarian', 'healthy', 'no-cook']
  },
]

export default function MealPlanner() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('meal-planner-recipes')
    return saved ? JSON.parse(saved) : SAMPLE_RECIPES
  })
  const [mealPlan, setMealPlan] = useState<MealPlan[]>(() => {
    const saved = localStorage.getItem('meal-planner-plan')
    return saved ? JSON.parse(saved) : []
  })
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toISOString().split('T')[0]
  })
  const [showRecipes, setShowRecipes] = useState(false)
  const [newRecipe, setNewRecipe] = useState({ name: '', cuisine: 'American', prepTime: 10, cookTime: 15, servings: 4, ingredients: [{ name: '', amount: 0, unit: '' }], instructions: '', calories: 0, tags: [] })
  const [newMeal, setNewMeal] = useState({ date: '', mealType: 'dinner' as const, recipeId: 0, servings: 1 })

  useEffect(() => {
    try { localStorage.setItem('meal-planner-recipes', JSON.stringify(recipes)) } catch {}
  }, [recipes])
  useEffect(() => {
    try { localStorage.setItem('meal-planner-plan', JSON.stringify(mealPlan)) } catch {}
  }, [mealPlan])

  const weekDates = useMemo(() => {
    const start = new Date(weekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  }, [weekStart])

  const plannedMeals = useMemo(() => {
    const plan: Record<string, Record<string, MealPlan[]>> = {}
    weekDates.forEach(d => {
      plan[d] = { breakfast: [], lunch: [], dinner: [], snack: [] }
    })
    mealPlan.filter(m => weekDates.includes(m.date)).forEach(m => {
      if (plan[m.date]) plan[m.date][m.mealType].push(m)
    })
    return plan
  }, [mealPlan, weekDates])

  const groceryList = useMemo(() => {
    const items: Record<string, { amount: number; unit: string }> = {}
    mealPlan.filter(m => weekDates.includes(m.date)).forEach(m => {
      const recipe = recipes.find(r => r.id === m.recipeId)
      if (!recipe) return
      recipe.ingredients.forEach(ing => {
        const total = ing.amount * (m.servings / recipe.servings)
        if (items[ing.name]) {
          items[ing.name].amount += total
        } else {
          items[ing.name] = { amount: total, unit: ing.unit }
        }
      })
    })
    return Object.entries(items).map(([name, data]) => ({ name, ...data }))
  }, [mealPlan, recipes, weekDates])

  const addRecipe = () => {
    if (!newRecipe.name.trim()) return
    setRecipes([...recipes, { ...newRecipe, id: Date.now() }])
    setNewRecipe({ name: '', cuisine: 'American', prepTime: 10, cookTime: 15, servings: 4, ingredients: [{ name: '', amount: 0, unit: '' }], instructions: '', calories: 0, tags: [] })
  }

  const addIngredient = (recipeId: number) => {
    setRecipes(recipes.map(r => r.id === recipeId ? { ...r, ingredients: [...r.ingredients, { name: '', amount: 0, unit: '' }] } : r))
  }

  const removeIngredient = (recipeId: number, index: number) => {
    setRecipes(recipes.map(r => r.id === recipeId ? { ...r, ingredients: r.ingredients.filter((_, i) => i !== index) } : r))
  }

  const addMeal = () => {
    if (!newMeal.date || !newMeal.recipeId) return
    setMealPlan([...mealPlan, { ...newMeal, id: Date.now() }])
    setNewMeal({ date: '', mealType: 'dinner', recipeId: 0, servings: 1 })
  }

  const removeMeal = (mealId: number) => {
    setMealPlan(mealPlan.filter(m => m.id !== mealId))
  }

  const formatDay = (date: string) => new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Meal Planner</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() - 7 * 86400000)).toISOString().split('T')[0])}>← Prev</button>
          <span style={{ fontWeight: 600, minWidth: 250, textAlign: 'center' }}>
            {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() + 7 * 86400000)).toISOString().split('T')[0])}>Next →</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Recipes</h4>
            <button className="btn" onClick={() => setShowRecipes(!showRecipes)}>{showRecipes ? 'Hide' : 'Show'} Recipes</button>
          </div>

          {showRecipes && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {recipes.map((recipe, i) => (
                <div key={recipe.id} className="pop-row" style={{
                  padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{recipe.name}</span>
                    <div className="row" style={{ gap: 4 }}>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>{recipe.cuisine}</span>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>{recipe.prepTime + recipe.cookTime} min</span>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>{recipe.servings} serv</span>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>{recipe.calories} cal</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{recipe.instructions.slice(0, 100)}...</div>
                </div>
              ))}
              <button className="btn" onClick={() => setShowRecipes(false)}>Hide Recipes</button>
            </div>
          )}

          <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Add New Recipe</summary>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <div className="row" style={{ gap: 8 }}>
                <input type="text" placeholder="Recipe name" value={newRecipe.name} onChange={e => setNewRecipe({ ...newRecipe, name: e.target.value })} style={{ flex: 1 }} />
                <select value={newRecipe.cuisine} onChange={e => setNewRecipe({ ...newRecipe, cuisine: e.target.value })} style={{ width: 150 }}>
                  {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="number" min={0} max={60} placeholder="Prep (min)" value={newRecipe.prepTime} onChange={e => setNewRecipe({ ...newRecipe, prepTime: Number(e.target.value) })} style={{ width: 80 }} />
                <input type="number" min={0} max={180} placeholder="Cook (min)" value={newRecipe.cookTime} onChange={e => setNewRecipe({ ...newRecipe, cookTime: Number(e.target.value) })} style={{ width: 80 }} />
                <input type="number" min={1} max={20} placeholder="Servings" value={newRecipe.servings} onChange={e => setNewRecipe({ ...newRecipe, servings: Number(e.target.value) })} style={{ width: 80 }} />
              </div>
              <input type="number" min={0} placeholder="Calories per serving" value={newRecipe.calories} onChange={e => setNewRecipe({ ...newRecipe, calories: Number(e.target.value) })} style={{ width: 200 }} />
              <textarea placeholder="Instructions" value={newRecipe.instructions} onChange={e => setNewRecipe({ ...newRecipe, instructions: e.target.value })} rows={2} />
              <div style={{ display: 'grid', gap: 8 }}>
                {newRecipe.ingredients.map((ing, i) => (
                  <div key={i} className="row" style={{ gap: 8 }}>
                    <input type="text" placeholder="Ingredient" value={ing.name} onChange={e => setNewRecipe({ ...newRecipe, ingredients: newRecipe.ingredients.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} style={{ flex: 1 }} />
                    <input type="number" step={0.1} min={0} placeholder="Amount" value={ing.amount} onChange={e => setNewRecipe({ ...newRecipe, ingredients: newRecipe.ingredients.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x) })} style={{ width: 80 }} />
                    <input type="text" placeholder="Unit" value={ing.unit} onChange={e => setNewRecipe({ ...newRecipe, ingredients: newRecipe.ingredients.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) })} style={{ width: 80 }} />
                    <button className="btn" onClick={() => setNewRecipe({ ...newRecipe, ingredients: newRecipe.ingredients.filter((_, j) => j !== i) })} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
                  </div>
                ))}
                <button className="btn" onClick={() => setNewRecipe({ ...newRecipe, ingredients: [...newRecipe.ingredients, { name: '', amount: 0, unit: '' }] })} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add Ingredient</button>
              </div>
              <button className="btn" onClick={addRecipe} style={{ marginTop: 8 }}>Add Recipe</button>
            </div>
          </details>
        </div>

        <div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h4 style={{ margin: 0 }}>Weekly Plan</h4>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() - 7 * 86400000)).toISOString().split('T')[0])}>← Prev</button>
              <span style={{ fontWeight: 600, minWidth: 200, textAlign: 'center' }}>
                {new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(new Date(weekStart).getTime() + 6 * 86400000).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button className="btn" onClick={() => setWeekStart((new Date(new Date(weekStart).getTime() + 7 * 86400000)).toISOString().split('T')[0])}>Next →</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {weekDates.map((date, di) => {
              const meals = plannedMeals[date] || { breakfast: [], lunch: [], dinner: [], snack: [] }
              const isToday = date === new Date().toISOString().split('T')[0]
              return (
                <div key={date} style={{
                  background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  borderTop: isToday ? '3px solid var(--accent)' : '3px solid transparent',
                  minHeight: 300, display: 'flex', flexDirection: 'column',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${di * 60}ms`,
                }}>
                  <div style={{ padding: 8, background: isToday ? 'var(--accent)20' : 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][di]}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{new Date(weekDates[di]).getDate()}</div>
                  </div>
                  <div style={{ flex: 1, padding: 8, overflowY: 'auto' }}>
                    {MEAL_TYPES.map(mt => {
                      const meals = plannedMeals[date]?.[mt] || []
                      if (meals.length === 0) return null
                      return (
                        <div key={mt} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>{mt}</div>
                          {meals.map((meal, i) => {
                            const recipe = recipes.find(r => r.id === meal.recipeId)
                            return (
                              <div key={meal.id} style={{ padding: '4px 8px', background: 'var(--bg)', borderRadius: 4, marginBottom: 4, fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: 600 }}>{recipe?.name || 'Unknown'}</span>
                                {meal.servings !== recipes.find(r => r.id === meal.recipeId)?.servings && (
                                  <span className="muted" style={{ fontSize: '0.7rem', marginLeft: 4 }}>×{meal.servings}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )})}
                  </div>
                  <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
                    <select value={newMeal.date} onChange={e => setNewMeal({ ...newMeal, date: e.target.value })} style={{ width: '100%', display: 'none' }} />
                    {recipes.map(r => (
                      <button key={r.id} className="btn" onClick={() => { setNewMeal({ ...newMeal, date, recipeId: r.id }); addMeal() }} style={{ width: '100%', marginBottom: 4, padding: '4px 8px', fontSize: '0.75rem', textAlign: 'left', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                        + {r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
            <h4 style={{ margin: '0 0 12px' }}>Grocery List (Auto-generated)</h4>
            {groceryList.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: 16 }}>Add meals to generate grocery list</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {groceryList.map((item, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(item.amount)} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Plan meals for the week. Recipes auto-scale ingredients. Grocery list generates automatically from planned meals.
      </p>
    </div>
  )
}