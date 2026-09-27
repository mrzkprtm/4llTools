import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Plant {
  id: number
  name: string
  species: string
  location: string
  wateringInterval: number
  fertilizingInterval: number
  repottingInterval: number
  sunlight: 'full' | 'partial' | 'shade'
  lastWatered: string
  lastFertilized: string
  lastRepotted: string
  acquiredDate: string
  notes: string
  photo: string
}

const SUNLIGHT_OPTIONS = [
  { value: 'full', label: 'Full Sun (6+ hrs)', icon: '☀️' },
  { value: 'partial', label: 'Partial Sun (3-6 hrs)', icon: '🌤️' },
  { value: 'shade', label: 'Shade (<3 hrs)', icon: '☁️' },
]

const LOCATIONS = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Balcony', 'Garden', 'Office', 'Window Sill', 'Shelf', 'Other']

export default function PlantCare() {
  const [plants, setPlants] = useState<Plant[]>(() => {
    const saved = localStorage.getItem('plant-care')
    return saved ? JSON.parse(saved) : []
  })
  const [newPlant, setNewPlant] = useState({ name: '', species: '', location: 'Living Room', wateringInterval: 7, fertilizingInterval: 30, repottingInterval: 365, sunlight: 'partial' as const, acquiredDate: new Date().toISOString().split('T')[0], notes: '' })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', species: '', location: 'Living Room', wateringInterval: 7, fertilizingInterval: 30, repottingInterval: 365, sunlight: 'partial' as const, acquiredDate: new Date().toISOString().split('T')[0], notes: '' })

  useEffect(() => {
    try { localStorage.setItem('plant-care', JSON.stringify(plants)) } catch {}
  }, [plants])

  const today = new Date().toISOString().split('T')[0]

  const addPlant = () => {
    if (!newPlant.name.trim()) return
    const plant: Plant = {
      ...newPlant,
      id: Date.now(),
      lastWatered: today,
      lastFertilized: today,
      lastRepotted: today,
    }
    setPlants([...plants, plant])
    setNewPlant({ name: '', species: '', location: 'Living Room', wateringInterval: 7, fertilizingInterval: 30, repottingInterval: 365, sunlight: 'partial', acquiredDate: today, notes: '' })
  }

  const removePlant = (id: number) => {
    setPlants(plants.filter(p => p.id !== id))
  }

  const startEdit = (plant: Plant) => {
    setEditingId(plant.id)
    setEditForm({ ...plant })
  }

  const saveEdit = () => {
    if (!editingId) return
    setPlants(plants.map(p => p.id === editingId ? { ...p, ...editForm } : p))
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const waterPlant = (id: number) => {
    setPlants(plants.map(p => p.id === id ? { ...p, lastWatered: today } : p))
  }

  const fertilizePlant = (id: number) => {
    setPlants(plants.map(p => p.id === id ? { ...p, lastFertilized: today } : p))
  }

  const repotPlant = (id: number) => {
    setPlants(plants.map(p => p.id === id ? { ...p, lastRepotted: today } : p))
  }

  const getDaysSince = (date: string) => {
    if (!date) return Infinity
    const diff = new Date(today).getTime() - new Date(date).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  const getStatus = (plant: Plant) => {
    const waterDays = getDaysSince(plant.lastWatered)
    const fertDays = getDaysSince(plant.lastFertilized)
    const repotDays = getDaysSince(plant.lastRepotted)

    const waterDue = waterDays >= plant.wateringInterval
    const fertDue = fertDays >= plant.fertilizingInterval
    const repotDue = repotDays >= plant.repottingInterval

    return { waterDays, fertDays, repotDays, waterDue, fertDue, repotDue }
  }

  const getSunlightIcon = (sunlight: string) => {
    return SUNLIGHT_OPTIONS.find(s => s.value === sunlight)?.icon || '☀️'
  }

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Plant Care Tracker</h3>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add New Plant
          <span className="muted" style={{ fontSize: '0.8rem' }}>{plants.length} plants</span>
        </h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Plant Name (e.g., Monstera)" value={newPlant.name} onChange={e => setNewPlant({ ...newPlant, name: e.target.value })} style={{ flex: 1 }} />
            <input type="text" placeholder="Species (e.g., Monstera deliciosa)" value={newPlant.species} onChange={e => setNewPlant({ ...newPlant, species: e.target.value })} style={{ flex: 1 }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select value={newPlant.location} onChange={e => setNewPlant({ ...newPlant, location: e.target.value })} style={{ flex: 1 }}>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={newPlant.sunlight} onChange={e => setNewPlant({ ...newPlant, sunlight: e.target.value as any })} style={{ width: 180 }}>
              {SUNLIGHT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="number" min={1} max={365} placeholder="Water Every (days)" value={newPlant.wateringInterval} onChange={e => setNewPlant({ ...newPlant, wateringInterval: Number(e.target.value) })} style={{ width: 150 }} />
            <input type="number" min={1} max={365} placeholder="Fertilize Every (days)" value={newPlant.fertilizingInterval} onChange={e => setNewPlant({ ...newPlant, fertilizingInterval: Number(e.target.value) })} style={{ width: 180 }} />
            <input type="number" min={1} max={3650} placeholder="Repot Every (days)" value={newPlant.repottingInterval} onChange={e => setNewPlant({ ...newPlant, repottingInterval: Number(e.target.value) })} style={{ width: 180 }} />
          </div>
          <input type="date" value={newPlant.acquiredDate} onChange={e => setNewPlant({ ...newPlant, acquiredDate: e.target.value })} placeholder="Acquired Date" style={{ width: 180 }} />
          <textarea placeholder="Notes" value={newPlant.notes} onChange={e => setNewPlant({ ...newPlant, notes: e.target.value })} rows={2} />
          <button className="btn" onClick={addPlant} style={{ justifySelf: 'start' }}>Add Plant</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {plants.length === 0 ? (
          <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🌱</div>
            <h3 style={{ margin: '0 0 8px' }}>No plants yet</h3>
            <p className="muted">Add your first plant above to start tracking care schedules.</p>
          </div>
        ) : (
          plants.map((plant, i) => {
            const status = getStatus(plant)
            const isOverdue = status.waterDue || status.fertDue || status.repotDue
            return (
              <details key={plant.id} defaultOpen={editingId === plant.id} style={{ background: 'var(--sunken)', border: isOverdue ? '2px solid var(--danger)' : '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <summary style={{ padding: 12, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOverdue ? 'var(--danger)10' : 'var(--bg)' }}>
                  <div className="row" style={{ gap: 12, alignItems: 'center', flex: 1 }}>
                    <span style={{ fontSize: '2rem' }}>{getSunlightIcon(plant.sunlight)}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{plant.name}</div>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>{plant.species || 'Unknown species'} • {plant.location}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <div className="row" style={{ gap: 4 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: status.waterDue ? 'var(--danger)20' : 'var(--ok)20', color: status.waterDue ? 'var(--danger)' : 'var(--ok)' }}>
                        {status.waterDays}d water
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: status.fertDue ? 'var(--danger)20' : 'var(--accent)20', color: status.fertDue ? 'var(--danger)' : 'var(--accent)' }}>
                        {status.fertDays}d fert
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: status.repotDue ? 'var(--danger)20' : 'var(--muted)20', color: status.repotDue ? 'var(--danger)' : 'var(--muted)' }}>
                        {status.repotDays}d repot
                      </span>
                    </div>
                    <button className="btn" onClick={() => startEdit(plant)} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>Edit</button>
                    <button className="btn" onClick={() => removePlant(plant.id)} style={{ color: 'var(--danger)', padding: '4px 10px', fontSize: '0.75rem' }}>Delete</button>
                  </div>
                </summary>
                <div style={{ padding: 16, display: 'grid', gap: 12 }}>
                  {editingId === plant.id ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" style={{ flex: 1 }} />
                        <input type="text" value={editForm.species} onChange={e => setEditForm({ ...editForm, species: e.target.value })} placeholder="Species" style={{ flex: 1 }} />
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <select value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} style={{ flex: 1 }}>
                          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <select value={editForm.sunlight} onChange={e => setEditForm({ ...editForm, sunlight: e.target.value as any })} style={{ width: 180 }}>
                          {SUNLIGHT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <input type="number" min={1} max={365} value={editForm.wateringInterval} onChange={e => setEditForm({ ...editForm, wateringInterval: Number(e.target.value) })} placeholder="Water (days)" style={{ width: 120 }} />
                        <input type="number" min={1} max={365} value={editForm.fertilizingInterval} onChange={e => setEditForm({ ...editForm, fertilizingInterval: Number(e.target.value) })} placeholder="Fertilize (days)" style={{ width: 150 }} />
                        <input type="number" min={1} max={3650} value={editForm.repottingInterval} onChange={e => setEditForm({ ...editForm, repottingInterval: Number(e.target.value) })} placeholder="Repot (days)" style={{ width: 150 }} />
                      </div>
                      <input type="date" value={editForm.acquiredDate} onChange={e => setEditForm({ ...editForm, acquiredDate: e.target.value })} placeholder="Acquired" style={{ width: 180 }} />
                      <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" rows={2} />
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn" onClick={saveEdit}>Save</button>
                        <button className="btn" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Water</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status.waterDue ? 'var(--danger)' : 'var(--ok)' }}>
                            {status.waterDays}d / {plant.wateringInterval}d
                          </div>
                          <button className="btn" onClick={() => waterPlant(plant.id)} style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.8rem', background: status.waterDue ? 'var(--danger)' : 'var(--ok)' }}>
                            {status.waterDue ? '💧 Water Now' : '✓ Watered'}
                          </button>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Fertilize</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status.fertDue ? 'var(--danger)' : 'var(--accent)' }}>
                            {status.fertDays}d / {plant.fertilizingInterval}d
                          </div>
                          <button className="btn" onClick={() => fertilizePlant(plant.id)} style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.8rem', background: status.fertDue ? 'var(--danger)' : 'var(--accent)' }}>
                            {status.fertDue ? '🌱 Fertilize Now' : '✓ Fertilized'}
                          </button>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Repot</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: status.repotDue ? 'var(--danger)' : 'var(--muted)' }}>
                            {status.repotDays}d / {plant.repottingInterval}d
                          </div>
                          <button className="btn" onClick={() => repotPlant(plant.id)} style={{ marginTop: 8, padding: '6px 12px', fontSize: '0.8rem', background: status.repotDue ? 'var(--danger)' : 'var(--muted)' }}>
                            {status.repotDue ? '🪴 Repot Now' : '✓ Potted'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Species</div>
                          <div style={{ fontWeight: 500 }}>{plant.species || 'Unknown'}</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Location</div>
                          <div style={{ fontWeight: 500 }}>{plant.location}</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Sunlight</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.5rem' }}>{getSunlightIcon(plant.sunlight)}</span>
                            <span style={{ fontWeight: 500 }}>{SUNLIGHT_OPTIONS.find(s => s.value === plant.sunlight)?.label}</span>
                          </div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Acquired</div>
                          <div>{new Date(plant.acquiredDate).toLocaleDateString()}</div>
                        </div>
                      </div>

                      {plant.notes && (
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, borderLeft: '4px solid var(--accent)' }}>
                          <div className="muted" style={{ fontSize: '0.75rem' }}>Notes</div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{plant.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </details>
              )
            )}
          </div>
        )}

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Track watering, fertilizing, and repotting schedules for all your plants. Overdue tasks highlighted in red. One-click to mark tasks complete.
        </p>
      </div>
    )
  }
}