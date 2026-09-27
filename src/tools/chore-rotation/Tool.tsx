import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Person {
  id: number
  name: string
  color: string
}

interface Chore {
  id: number
  name: string
  frequency: number
  assigneeId: number | null
  history: { personId: number; date: string }[]
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

const DEFAULT_CHORES = [
  { name: 'Wash Dishes', frequency: 1 },
  { name: 'Take Out Trash', frequency: 1 },
  { name: 'Clean Bathroom', frequency: 7 },
  { name: 'Vacuum Floors', frequency: 7 },
  { name: 'Mop Floors', frequency: 7 },
  { name: 'Clean Kitchen', frequency: 3 },
  { name: 'Laundry', frequency: 3 },
  { name: 'Water Plants', frequency: 2 },
]

export default function ChoreRotation() {
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('chore-rotation')
    return saved ? JSON.parse(saved).people : [
      { id: 1, name: 'Alice', color: COLORS[0] },
      { id: 2, name: 'Bob', color: COLORS[1] },
      { id: 3, name: 'Charlie', color: COLORS[2] },
    ]
  })

  const [chores, setChores] = useState<Chore[]>(() => {
    const saved = localStorage.getItem('chore-rotation')
    return saved ? JSON.parse(saved).chores : DEFAULT_CHORES.map((c, i) => ({
      id: i + 1,
      name: c.name,
      frequency: c.frequency,
      assigneeId: null,
      history: [],
    }))
  })

  useEffect(() => {
    try { localStorage.setItem('chore-rotation', JSON.stringify({ people, chores })) } catch {}
  }, [people, chores])

  const addPerson = () => {
    setPeople([...people, { id: Date.now(), name: `Person ${people.length + 1}`, color: COLORS[people.length % COLORS.length] }])
  }

  const removePerson = (id: number) => {
    if (people.length <= 1) return
    setPeople(people.filter(p => p.id !== id))
    setChores(chores.map(c => c.assigneeId === id ? { ...c, assigneeId: null } : c))
  }

  const updatePerson = (id: number, field: string, value: string) => {
    setPeople(people.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const addChore = () => {
    setChores([...chores, { id: Date.now(), name: 'New Chore', frequency: 1, assigneeId: null, history: [] }])
  }

  const removeChore = (id: number) => {
    setChores(chores.filter(c => c.id !== id))
  }

  const updateChore = (id: number, field: string, value: string | number) => {
    setChores(chores.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const assignNext = (choreId: number) => {
    const chore = chores.find(c => c.id === choreId)
    if (!chore || people.length === 0) return

    const counts = people.map(p => ({
      person: p,
      count: chore.history.filter(h => h.personId === p.id).length
    }))
    counts.sort((a, b) => a.count - b.count)

    const nextPerson = counts[0].person
    const today = new Date().toISOString().split('T')[0]

    setChores(chores.map(c => c.id === choreId ? {
      ...c,
      assigneeId: nextPerson.id,
      history: [...c.history, { personId: nextPerson.id, date: today }]
    } : c))
  }

  const rotateAll = () => {
    chores.forEach(c => assignNext(c.id))
  }

  const getChoreStats = (chore: Chore) => {
    const total = chore.history.length
    const perPerson = people.map(p => ({
      person: p,
      count: chore.history.filter(h => h.personId === p.id).length
    }))
    return { total, perPerson }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Chore Rotation</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={addPerson}>+ Person</button>
          <button className="btn" onClick={addChore}>+ Chore</button>
          <button className="btn" onClick={rotateAll} style={{ background: 'var(--ok)' }}>Rotate All</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
        <div>
          <h4 style={{ marginBottom: 8 }}>People</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
            {people.map((person, i) => (
              <div key={person.id} className="pop-row" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                borderLeft: `4px solid ${person.color}`,
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 40}ms`,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: person.color }} />
                <input type="text" value={person.name} onChange={e => updatePerson(person.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, flex: 1 }} />
                <input type="color" value={person.color} onChange={e => updatePerson(person.id, 'color', e.target.value)} style={{ width: 24, height: 24, border: 'none', borderRadius: '50%', cursor: 'pointer' }} />
                <button className="btn" onClick={() => removePerson(person.id)} disabled={people.length <= 1} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ marginBottom: 8 }}>Chores</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {chores.map((chore, i) => {
              const stats = getChoreStats(chore)
              const assignee = people.find(p => p.id === chore.assigneeId)
              const counts = people.map(p => chore.history.filter(h => h.personId === p.id).length)
              const minCount = Math.min(...counts)
              const isFair = counts.every(c => c === minCount || c === minCount + 1)

              return (
                <div key={chore.id} className="pop-row" style={{
                  display: 'grid', gap: 12, padding: 16,
                  background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  gridTemplateColumns: '1fr auto auto',
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                }}>
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input type="text" value={chore.name} onChange={e => updateChore(chore.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem' }} />
                      <input type="number" min={1} max={30} value={chore.frequency} onChange={e => updateChore(chore.id, 'frequency', Number(e.target.value))} style={{ width: 70 }} />
                      <span className="muted">days</span>
                      <button className="btn" onClick={() => removeChore(chore.id)} style={{ color: 'var(--danger)', marginLeft: 'auto' }}>Remove</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 4 }}>
                      {people.map(p => {
                        const count = chore.history.filter(h => h.personId === p.id).length
                        return (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                            <span>{p.name}</span>
                            <b style={{ color: count === minCount ? 'var(--ok)' : count === minCount + 1 ? 'var(--accent)' : 'var(--danger)' }}>{count}</b>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>Current</div>
                    {assignee ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: assignee.color }} />
                        <span style={{ fontWeight: 600 }}>{assignee.name}</span>
                      </div>
                    ) : (
                      <button className="btn" onClick={() => assignNext(chore.id)} style={{ width: '100%' }}>Assign</button>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>Fairness</div>
                    <div style={{ fontWeight: 700, color: isFair ? 'var(--ok)' : 'var(--danger)' }}>
                      {isFair ? '✓ Balanced' : '⚠ Uneven'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>History Log</summary>
        <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto', fontSize: '0.85rem' }}>
          {chores.flatMap(c => c.history.map(h => ({ chore: c.name, ...h })))
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 50)
            .map((h, i) => {
              const person = people.find(p => p.id === h.personId)
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                  <span>{h.date} — {h.chore}</span>
                  {person && <span style={{ color: person.color, fontWeight: 500 }}>{person.name}</span>}
                </div>
              )
            })}
        </div>
      </details>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Assigns chores to the person who has done it least. Frequency in days. History tracks fairness. Rotate All assigns all at once.
      </p>
    </div>
  )
}