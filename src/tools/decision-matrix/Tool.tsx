import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Criterion {
  id: number
  name: string
  weight: number
}

interface Option {
  id: number
  name: string
  scores: Record<number, number>
}

export default function DecisionMatrix() {
  const [criteria, setCriteria] = useState<Criterion[]>(() => {
    const saved = localStorage.getItem('decision-matrix')
    return saved ? JSON.parse(saved).criteria : [
      { id: 1, name: 'Cost', weight: 30 },
      { id: 2, name: 'Time to Implement', weight: 20 },
      { id: 3, name: 'Impact', weight: 35 },
      { id: 4, name: 'Risk', weight: 15 },
    ]
  })

  const [options, setOptions] = useState<Option[]>(() => {
    const saved = localStorage.getItem('decision-matrix')
    return saved ? JSON.parse(saved).options : [
      { id: 1, name: 'Option A', scores: { 1: 7, 2: 5, 3: 8, 4: 6 } },
      { id: 2, name: 'Option B', scores: { 1: 5, 2: 8, 3: 6, 4: 8 } },
      { id: 3, name: 'Option C', scores: { 1: 8, 2: 6, 3: 7, 4: 5 } },
    ]
  })

  useEffect(() => {
    try { localStorage.setItem('decision-matrix', JSON.stringify({ criteria, options })) } catch {}
  }, [criteria, options])

  const addCriterion = () => {
    setCriteria([...criteria, { id: Date.now(), name: `Criterion ${criteria.length + 1}`, weight: 10 }])
  }

  const removeCriterion = (id: number) => {
    setCriteria(criteria.filter(c => c.id !== id))
    setOptions(options.map(o => { const { [id]: removed, ...rest } = o.scores; return { ...o, scores: rest } }))
  }

  const updateCriterion = (id: number, field: string, value: string | number) => {
    setCriteria(criteria.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addOption = () => {
    const scores: Record<number, number> = {}
    criteria.forEach(c => { scores[c.id] = 5 })
    setOptions([...options, { id: Date.now(), name: `Option ${options.length + 1}`, scores }])
  }

  const removeOption = (id: number) => {
    setOptions(options.filter(o => o.id !== id))
  }

  const updateOption = (id: number, field: string, value: string | number | Record<number, number>) => {
    setOptions(options.map(o => o.id === id ? { ...o, [field]: value } : o))
  }

  const updateScore = (optionId: number, criterionId: number, score: number) => {
    setOptions(options.map(o => o.id === optionId ? { ...o, scores: { ...o.scores, [criterionId]: score } } : o))
  }

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0)

  const results = useMemo(() => {
    return options.map(opt => {
      let weightedSum = 0
      criteria.forEach(c => {
        const score = opt.scores[c.id] || 0
        weightedSum += score * c.weight
      })
      return { option: opt, score: weightedSum / (totalWeight || 1), rawScore: weightedSum }
    }).sort((a, b) => b.score - a.score)
  }, [criteria, options])

  const exportCSV = () => {
    const headers = ['Option', ...criteria.map(c => c.name), 'Weighted Score']
    const rows = results.map(r => [
      r.option.name,
      ...criteria.map(c => r.option.scores[c.id] || 0),
      r.score.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'decision-matrix.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Decision Matrix</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={addCriterion}>+ Criterion</button>
          <button className="btn" onClick={addOption}>+ Option</button>
          <button className="btn" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>Criteria (weights sum: <b>{totalWeight}</b>%)</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {criteria.map((criterion, i) => (
            <div key={criterion.id} className="pop-row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 10,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`
            }}>
              <input type="text" value={criterion.name} onChange={e => updateCriterion(criterion.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, minWidth: 150 }} />
              <input type="number" min={0} max={100} value={criterion.weight} onChange={e => updateCriterion(criterion.id, 'weight', Number(e.target.value))} style={{ width: 80 }} />
              <span className="muted">%</span>
              <button className="btn" onClick={() => removeCriterion(criterion.id)} style={{ color: 'var(--danger)', marginLeft: 'auto' }}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ width: 150, textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>Option</th>
              {criteria.map(c => (
                <th key={c.id} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem' }}>
                  {c.name} ({c.weight}%)
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: '0.85rem', color: 'var(--accent)' }}>Weighted Score</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option, oi) => (
              <tr key={option.id} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${oi * 60}ms` }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <input type="text" value={option.name} onChange={e => updateOption(option.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, width: 120 }} />
                    <button className="btn" onClick={() => removeOption(option.id)} style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)' }}>Remove</button>
                  </div>
                </td>
                {criteria.map(c => (
                  <td key={c.id} style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                    <select value={option.scores[c.id] || 5} onChange={e => updateScore(option.id, c.id, Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', width: 80 }}>
                      {[1,2,3,4,5,6,7,8,9,10].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                ))}
                <td style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem' }}>
                  <Roll value={results.find(r => r.option.id === option.id)?.score.toFixed(2) || '0.00'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Ranking</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          {results.map((result, rank) => (
            <div key={result.option.id} className="pop-row" style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${rank * 60}ms`,
              borderLeft: rank === 0 ? '4px solid var(--ok)' : '4px solid transparent',
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: rank === 0 ? 'var(--ok)' : 'var(--muted)', minWidth: 40 }}>#{rank + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{result.option.name}</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {criteria.map(c => `${c.name}: ${result.option.scores[c.id] || 0}`).join(' | ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                  <Roll value={result.score.toFixed(2)} />
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Weighted Score</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Score each option 1-10 per criterion. Weights determine importance. Higher weighted score = better choice. Export to CSV.
      </p>
    </div>
  )
}