import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Envelope {
  id: number
  name: string
  allocated: number
  spent: number
  color: string
  recurring: boolean
  frequency: 'weekly' | 'monthly' | 'yearly'
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c', '#64748b', '#000000']

const DEFAULT_ENVELOPES = [
  { name: 'Groceries', allocated: 400, color: COLORS[0], recurring: true, frequency: 'monthly' as const },
  { name: 'Transport', allocated: 150, color: COLORS[1], recurring: true, frequency: 'monthly' as const },
  { name: 'Dining Out', allocated: 200, color: COLORS[2], recurring: true, frequency: 'monthly' as const },
  { name: 'Entertainment', allocated: 100, color: COLORS[3], recurring: true, frequency: 'monthly' as const },
  { name: 'Personal Care', allocated: 80, color: COLORS[4], recurring: true, frequency: 'monthly' as const },
  { name: 'Gifts', allocated: 50, color: COLORS[5], recurring: false, frequency: 'monthly' as const },
  { name: 'Emergency', allocated: 200, color: COLORS[6], recurring: false, frequency: 'monthly' as const },
  { name: 'Savings', allocated: 300, color: COLORS[7], recurring: true, frequency: 'monthly' as const },
]

export default function BudgetEnvelope() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>(() => {
    const saved = localStorage.getItem('budget-envelope')
    return saved ? JSON.parse(saved) : DEFAULT_ENVELOPES.map((e, i) => ({ ...e, id: i + 1, spent: 0 }))
  })
  const [monthlyIncome, setMonthlyIncome] = useState(() => {
    const saved = localStorage.getItem('budget-envelope-income')
    return saved ? Number(saved) : 2000
  })
  const [newEnvelope, setNewEnvelope] = useState({ name: '', allocated: 0, color: COLORS[0], recurring: true, frequency: 'monthly' as const })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; allocated: number; color: string; recurring: boolean; frequency: 'weekly' | 'monthly' | 'yearly' }>({ name: '', allocated: 0, color: COLORS[0], recurring: true, frequency: 'monthly' })
  const [transactions, setTransactions] = useState<{ id: number; envelopeId: number; amount: number; description: string; date: string }[]>(() => {
    const saved = localStorage.getItem('budget-envelope-transactions')
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    try { localStorage.setItem('budget-envelope', JSON.stringify(envelopes)) } catch {}
  }, [envelopes])
  useEffect(() => { try { localStorage.setItem('budget-envelope-income', String(monthlyIncome)) } catch {} }, [monthlyIncome])
  useEffect(() => { try { localStorage.setItem('budget-envelope-transactions', JSON.stringify(transactions)) } catch {} }, [transactions])

  const totalAllocated = envelopes.reduce((sum, e) => sum + e.allocated, 0)
  const totalSpent = envelopes.reduce((sum, e) => sum + e.spent, 0)
  const remaining = monthlyIncome - totalAllocated

  const addEnvelope = () => {
    if (!newEnvelope.name.trim() || newEnvelope.allocated <= 0) return
    setEnvelopes([...envelopes, { ...newEnvelope, id: Date.now(), spent: 0 }])
    setNewEnvelope({ name: '', allocated: 0, color: COLORS[envelopes.length % COLORS.length], recurring: true, frequency: 'monthly' })
  }

  const startEdit = (envelope: Envelope) => {
    setEditingId(envelope.id)
    setEditForm({ name: envelope.name, allocated: envelope.allocated, color: envelope.color, recurring: envelope.recurring, frequency: envelope.frequency })
  }

  const saveEdit = () => {
    if (!editingId) return
    setEnvelopes(envelopes.map(e => e.id === editingId ? { ...e, ...editForm } : e))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const removeEnvelope = (id: number) => {
    setEnvelopes(envelopes.filter(e => e.id !== id))
    setTransactions(transactions.filter(t => t.envelopeId !== id))
  }

  const addTransaction = (envelopeId: number, amount: number, description: string) => {
    if (amount <= 0 || !description.trim()) return
    setTransactions([...transactions, { id: Date.now(), envelopeId, amount, description, date: new Date().toISOString().split('T')[0] }])
    setEnvelopes(envelopes.map(e => e.id === envelopeId ? { ...e, spent: e.spent + amount } : e))
  }

  const removeTransaction = (id: number) => {
    const txn = transactions.find(t => t.id === id)
    if (!txn) return
    setTransactions(transactions.filter(t => t.id !== id))
    setEnvelopes(envelopes.map(e => e.id === txn.envelopeId ? { ...e, spent: e.spent - txn.amount } : e))
  }

  const getEnvelopeTransactions = (envelopeId: number) => transactions.filter(t => t.envelopeId === envelopeId).sort((a, b) => b.date.localeCompare(a.date))

  const fmt = (n: number) => '$' + n.toFixed(2)

  const EnvelopeContent = ({ envelope, index }: { envelope: Envelope; index: number }) => {
    const envelopeTxns = getEnvelopeTransactions(envelope.id)
    const remaining = envelope.allocated - envelope.spent
    const percent = envelope.allocated > 0 ? (envelope.spent / envelope.allocated) * 100 : 0
    const isOver = envelope.spent > envelope.allocated

    return (
      <details key={envelope.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <summary style={{ padding: 12, background: envelope.color + '20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: envelope.color }} />
            <input type="text" value={envelope.name} onChange={ev => setEnvelopes(envelopes.map(en => en.id === envelope.id ? { ...en, name: ev.target.value } : en))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1rem', width: 150 }} />
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', background: envelope.recurring ? 'var(--ok)20' : 'var(--muted)20', color: envelope.recurring ? 'var(--ok)' : 'var(--muted)', borderRadius: 4 }}>
              {envelope.frequency}
            </span>
          </div>
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="muted">Spent:</span>
              <span style={{ fontWeight: 600, color: isOver ? 'var(--danger)' : 'var(--text)' }}>{fmt(envelope.spent)} / {fmt(envelope.allocated)}</span>
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="muted">Left:</span>
              <span style={{ fontWeight: 600, color: remaining >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(remaining)}</span>
            </div>
            <button className="btn" onClick={() => setEditingId(envelope.id)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
            <button className="btn" onClick={() => removeEnvelope(envelope.id)} style={{ color: 'var(--danger)', padding: '4px 10px', fontSize: '0.75rem' }}>Delete</button>
          </div>
        </summary>
        <div style={{ padding: 12 }}>
          <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, percent)}%`, height: '100%',
              background: isOver ? 'var(--danger)' : percent > 80 ? 'var(--danger)' : percent > 60 ? 'var(--accent)' : 'var(--ok)',
              borderRadius: 4, transition: 'width 0.3s'
            }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.75rem' }}>Allocated</div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(envelope.allocated)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.75rem' }}>Spent</div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{fmt(envelope.spent)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.75rem' }}>Remaining</div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: envelope.allocated - envelope.spent >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(envelope.allocated - envelope.spent)}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.75rem' }}>% Used</div>
              <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: percent > 100 ? 'var(--danger)' : percent > 80 ? 'var(--accent)' : 'var(--ok)' }}>{percent.toFixed(0)}%</div>
            </div>
          </div>

          {editingId === envelope.id ? (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
              <input type="number" min={0} step={1} value={editForm.allocated} onChange={e => setEditForm({ ...editForm, allocated: Number(e.target.value) })} />
              <select value={editForm.color} onChange={e => setEditForm({ ...editForm, color: e.target.value })}>
                {COLORS.map(c => <option key={c} value={c} style={{ color: c }}>{c}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={editForm.recurring} onChange={e => setEditForm({ ...editForm, recurring: e.target.checked })} />
                <span>Recurring</span>
              </label>
              <select value={editForm.frequency} onChange={e => setEditForm({ ...editForm, frequency: e.target.value as any })}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={saveEdit}>Save</button>
                <button className="btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 12 }}>
                <h5 style={{ margin: '0 0 8px' }}>Add Transaction</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: 8 }}>
                  <input type="text" placeholder="Description" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }} />
                  <input type="number" min={0.01} step={0.01} placeholder="Amount" style={{ width: 100 }} />
                  <button className="btn" onClick={() => {
                    const desc = prompt('Description:')
                    if (desc) addTransaction(envelope.id, 0, desc)
                  }}>Add $</button>
                </div>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {(() => {
                  const txns = getEnvelopeTransactions(envelope.id)
                  if (txns.length === 0) {
                    return <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No transactions yet</p>
                  }
                  return txns.map((txn, i) => (
                    <div key={txn.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, marginBottom: 4, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 30}ms` }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{txn.description}</div>
                        <div className="muted" style={{ fontSize: '0.75rem' }}>{txn.date}</div>
                      </div>
                      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmt(txn.amount)}</span>
                        <button className="btn" onClick={() => removeTransaction(txn.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
          </div>
        </details>
    )
  }

  const renderEnvelopeContent = (envelope: Envelope, i: number) => <EnvelopeContent envelope={envelope} index={i} />;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Budget Envelope System</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted" style={{ fontSize: '0.75rem' }}>Monthly Income</span>
            <input type="number" min={0} step={100} value={monthlyIncome} onChange={e => setMonthlyIncome(Number(e.target.value))} style={{ width: 120 }} />
          </label>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(monthlyIncome)} /></b><span className="muted">Income</span></div>
        <div className="stat"><b><Roll value={fmt(totalAllocated)} /></b><span className="muted">Allocated</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(totalSpent)} /></b><span className="muted">Spent</span></div>
        <div className="stat"><b style={{ color: remaining >= 0 ? 'var(--ok)' : 'var(--danger)' }}><Roll value={fmt(remaining)} /></b><span className="muted">Remaining</span></div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Envelope
          <span className="muted" style={{ fontSize: '0.8rem' }}>{envelopes.length} envelopes</span>
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Envelope Name" value={newEnvelope.name} onChange={e => setNewEnvelope({ ...newEnvelope, name: e.target.value })} style={{ flex: 1 }} />
            <input type="number" min={0} step={1} placeholder="Allocated Amount" value={newEnvelope.allocated} onChange={e => setNewEnvelope({ ...newEnvelope, allocated: Number(e.target.value) })} style={{ width: 120 }} />
            <select value={newEnvelope.color} onChange={e => setNewEnvelope({ ...newEnvelope, color: e.target.value })} style={{ width: 80 }}>
              {COLORS.map(c => <option key={c} value={c} style={{ color: c }}>{c}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="muted" style={{ fontSize: '0.7rem' }}>Recurring</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={newEnvelope.recurring} onChange={e => setNewEnvelope({ ...newEnvelope, recurring: e.target.checked })} />
                <span className="muted" style={{ fontSize: '0.8rem' }}>Recurring</span>
              </label>
            </label>
            <select value={newEnvelope.frequency} onChange={e => setNewEnvelope({ ...newEnvelope, frequency: e.target.value as any })} style={{ width: 120 }}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <button className="btn" onClick={addEnvelope} style={{ justifySelf: 'start' }}>Add Envelope</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {envelopes.map((envelope, i) => <EnvelopeContent key={envelope.id} envelope={envelope} index={i} />)}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Summary</h4>
        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div className="stat"><b><Roll value={fmt(monthlyIncome)} /></b><span className="muted">Income</span></div>
          <div className="stat"><b><Roll value={fmt(totalAllocated)} /></b><span className="muted">Budgeted</span></div>
          <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(totalSpent)} /></b><span className="muted">Spent</span></div>
          <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(monthlyIncome - totalSpent)} /></b><span className="muted">Net</span></div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Digital envelope budgeting. Allocate income to categories, track spending per envelope, see remaining amounts visually. Transactions tracked per envelope.
      </p>
    </div>
  )
}