import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Icon from '../../components/Icon'
import { useFlip } from '../../motion/useFlip'
import { Hint } from '../../sim/controls'
import { cell, normalizeWeights, rank, type Criterion, type Option, type Scores } from './logic'
import './tool.css'

const KEY = '4lltools:decision-matrix'
const uid = () => Math.random().toString(36).slice(2, 9)
const COLORS = ['#1c7ed6', '#e8590c', '#2f9e44', '#ae3ec9', '#f59f00', '#0ca678', '#e03131', '#5c7cfa']

interface State {
  title: string
  options: Option[]
  criteria: Criterion[]
  scores: Scores
}

function laptop(): State {
  const options = [{ id: 'o1', name: 'MacBook Air M3' }, { id: 'o2', name: 'ThinkPad X1 Carbon' }, { id: 'o3', name: 'ASUS Zenbook 14' }]
  const criteria = [
    { id: 'c1', name: 'Price', weight: 8 },
    { id: 'c2', name: 'Battery life', weight: 7 },
    { id: 'c3', name: 'Performance', weight: 6 },
    { id: 'c4', name: 'Weight', weight: 5 },
    { id: 'c5', name: 'Screen', weight: 4 },
    { id: 'c6', name: 'Keyboard', weight: 3 },
  ]
  const grid = [
    [2, 5, 4, 5, 4, 3],
    [2, 3, 4, 4, 3, 5],
    [5, 4, 3, 4, 5, 3],
  ]
  const scores: Scores = {}
  options.forEach((o, i) => criteria.forEach((c, j) => (scores[cell(o.id, c.id)] = grid[i][j])))
  return { title: 'Which laptop to buy?', options, criteria, scores }
}

export default function DecisionMatrix() {
  const [s, setS] = useState<State>(laptop)
  const ready = useRef(false)
  const bars = useRef<HTMLOListElement>(null)
  useFlip(bars, { spring: 'bouncy' })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setS(JSON.parse(raw) as State)
    } catch {
      // Keep the example.
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage is optional.
    }
  }, [s])

  const results = rank(s.options, s.criteria, s.scores)
  const shares = normalizeWeights(s.criteria)
  const color = (id: string) => COLORS[Math.max(0, s.options.findIndex((o) => o.id === id)) % COLORS.length]
  const winner = results[0] && results.length > 1 && results[0].rank === 1 && results[1].rank !== 1 ? results[0].id : null
  const patch = (p: Partial<State>) => setS((x) => ({ ...x, ...p }))

  return (
    <div className="dm">
      <input className="dm-title" type="text" value={s.title} aria-label="Decision" onChange={(e) => patch({ title: e.target.value })} />
      <ol ref={bars} className="dm-rank" aria-label="Ranking">
        {results.map((r) => (
          <li key={r.id} data-flip={r.id} className={r.id === winner ? 'win' : ''} style={{ '--oc': color(r.id) } as CSSProperties}>
            <span className="dm-pos">{r.id === winner ? <span key={winner} className="dm-crown"><Icon name="crown" size={22} /></span> : `#${r.rank}`}</span>
            <span className="dm-name">{r.name || 'Untitled'}</span>
            <span className="dm-track"><i style={{ width: `${r.pct * 100}%` }} /></span>
            <b className="dm-score">{r.score.toFixed(2)}</b>
          </li>
        ))}
      </ol>

      <h3 className="dm-h">Criteria and weights</h3>
      <div className="dm-crit">
        {s.criteria.map((c, j) => (
          <div key={c.id} className="dm-crow">
            <input type="text" aria-label="Criterion" value={c.name} onChange={(e) => patch({ criteria: s.criteria.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} />
            <input type="range" min={0} max={10} value={c.weight} aria-label={`Weight of ${c.name}`} onChange={(e) => patch({ criteria: s.criteria.map((x) => (x.id === c.id ? { ...x, weight: Number(e.target.value) } : x)) })} />
            <span className="dm-share" title="Share of the total weight"><i style={{ width: `${shares[j] * 100}%` }} />{Math.round(shares[j] * 100)}%</span>
            <button type="button" className="btn dm-x" aria-label={`Remove ${c.name}`} onClick={() => patch({ criteria: s.criteria.filter((x) => x.id !== c.id) })}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => patch({ criteria: [...s.criteria, { id: uid(), name: 'New criterion', weight: 5 }] })}><Icon name="plus" size={18} /> Criterion</button>
        <button type="button" className="btn" disabled={!s.criteria.length} onClick={() => {
          // Rescale so the largest weight is 10, keeping the proportions.
          const max = Math.max(...s.criteria.map((c) => c.weight))
          patch({ criteria: s.criteria.map((c) => ({ ...c, weight: max ? Math.round((c.weight / max) * 10) : 5 })) })
        }}>Normalize weights</button>
        <button type="button" className="btn" onClick={() => patch({ criteria: s.criteria.map((c) => ({ ...c, weight: 5 })) })}>Equal weights</button>
      </div>

      <h3 className="dm-h">Score each option (1–5 stars)</h3>
      <div className="dm-options">
        {s.options.map((o) => (
          <section key={o.id} className="dm-opt" style={{ '--oc': color(o.id) } as CSSProperties}>
            <header>
              <input type="text" aria-label="Option name" value={o.name} onChange={(e) => patch({ options: s.options.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} />
              <button type="button" className="btn dm-x" aria-label={`Remove ${o.name}`} onClick={() => patch({ options: s.options.filter((x) => x.id !== o.id) })}><Icon name="close" size={16} /></button>
            </header>
            {s.criteria.map((c) => {
              const v = s.scores[cell(o.id, c.id)] ?? 3
              return (
                <div key={c.id} className="dm-srow">
                  <span className="dm-cname">{c.name}</span>
                  <span className="dm-stars" role="radiogroup" aria-label={`${o.name}: ${c.name}`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={v === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= v ? 'on' : ''} onClick={() => patch({ scores: { ...s.scores, [cell(o.id, c.id)]: n } })}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z" /></svg>
                      </button>
                    ))}
                  </span>
                </div>
              )
            })}
          </section>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn btn-icon" disabled={s.options.length >= 8} onClick={() => patch({ options: [...s.options, { id: uid(), name: `Option ${s.options.length + 1}` }] })}><Icon name="plus" size={18} /> Option</button>
        <button type="button" className="btn" onClick={() => setS(laptop())}>Laptop example</button>
        <button type="button" className="btn" onClick={() => setS({ title: 'My decision', options: [{ id: uid(), name: 'Option A' }, { id: uid(), name: 'Option B' }], criteria: [{ id: uid(), name: 'Cost', weight: 5 }, { id: uid(), name: 'Quality', weight: 5 }], scores: {} })}>Start blank</button>
      </div>
      <Hint>Set how much each criterion matters with the sliders, then tap stars to score every option. Each score is multiplied by its weight share, and the bars re-sort live; the leader gets the crown.</Hint>
    </div>
  )
}
