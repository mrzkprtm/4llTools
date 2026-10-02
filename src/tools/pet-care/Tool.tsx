import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Pet {
  id: number
  name: string
  type: string
  breed: string
  birthDate: string
  weight: number
  color: string
  microchip: string
  vet: string
}

interface Feeding {
  id: number
  petId: number
  time: string
  food: string
  amount: string
  completed: boolean
}

interface Medication {
  id: number
  petId: number
  name: string
  dosage: string
  frequency: string
  startDate: string
  endDate: string
  instructions: string
}

interface VetVisit {
  id: number
  petId: number
  date: string
  reason: string
  vet: string
  notes: string
  cost: number
  nextVisit: string
}

interface WeightLog {
  id: number
  petId: number
  date: string
  weight: number
  notes: string
}

const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Reptile', 'Other']
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

export default function PetCare() {
  const [pets, setPets] = useState<Pet[]>(() => {
    try { const saved = localStorage.getItem('4lltools:pet-care'); return saved ? JSON.parse(saved) : [] } catch { return [] }
  })
  const [feedings, setFeedings] = useState<Feeding[]>(() => {
    try { const saved = localStorage.getItem('4lltools:pet-care-feedings'); return saved ? JSON.parse(saved) : [] } catch { return [] }
  })
  const [medications, setMedications] = useState<Medication[]>(() => {
    try { const saved = localStorage.getItem('4lltools:pet-care-medications'); return saved ? JSON.parse(saved) : [] } catch { return [] }
  })
  const [vetVisits, setVetVisits] = useState<VetVisit[]>(() => {
    try { const saved = localStorage.getItem('4lltools:pet-care-vet'); return saved ? JSON.parse(saved) : [] } catch { return [] }
  })
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(() => {
    try { const saved = localStorage.getItem('4lltools:pet-care-weight'); return saved ? JSON.parse(saved) : [] } catch { return [] }
  })
  const [activePetId, setActivePetId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'pet' | 'feeding' | 'medication' | 'vet' | 'weight'>('list')
  const [newPet, setNewPet] = useState({ name: '', type: 'Dog', breed: '', birthDate: '', weight: 0, color: COLORS[0], microchip: '', vet: '' })
  const [newFeeding, setNewFeeding] = useState({ petId: 0, time: '07:00', food: '', amount: '', completed: false })
  const [newMedication, setNewMedication] = useState({ petId: 0, name: '', dosage: '', frequency: 'daily', startDate: new Date().toISOString().split('T')[0], endDate: '', instructions: '' })
  const [newVetVisit, setNewVetVisit] = useState({ petId: 0, date: new Date().toISOString().split('T')[0], reason: '', vet: '', notes: '', cost: 0, nextVisit: '' })
  const [newWeight, setNewWeight] = useState({ petId: 0, date: new Date().toISOString().split('T')[0], weight: 0, notes: '' })

  useEffect(() => { try { localStorage.setItem('4lltools:pet-care', JSON.stringify(pets)) } catch {} }, [pets])
  useEffect(() => { try { localStorage.setItem('4lltools:pet-care-feedings', JSON.stringify(feedings)) } catch {} }, [feedings])
  useEffect(() => { try { localStorage.setItem('4lltools:pet-care-medications', JSON.stringify(medications)) } catch {} }, [medications])
  useEffect(() => { try { localStorage.setItem('4lltools:pet-care-vet', JSON.stringify(vetVisits)) } catch {} }, [vetVisits])
  useEffect(() => { try { localStorage.setItem('4lltools:pet-care-weight', JSON.stringify(weightLogs)) } catch {} }, [weightLogs])

  const activePet = pets.find(p => p.id === activePetId)

  const addPet = () => {
    if (!newPet.name.trim()) return
    setPets([...pets, { ...newPet, id: Date.now() }])
    setNewPet({ name: '', type: 'Dog', breed: '', birthDate: '', weight: 0, color: COLORS[pets.length % COLORS.length], microchip: '', vet: '' })
    setViewMode('list')
  }

  const removePet = (id: number) => {
    setPets(pets.filter(p => p.id !== id))
    setFeedings(feedings.filter(f => f.petId !== id))
    setMedications(medications.filter(m => m.petId !== id))
    setVetVisits(vetVisits.filter(v => v.petId !== id))
    setWeightLogs(weightLogs.filter(w => w.petId !== id))
    if (activePetId === id) setActivePetId(null)
  }

  const getAge = (birthDate: string) => {
    if (!birthDate) return 'Unknown'
    const birth = new Date(birthDate)
    const now = new Date()
    let years = now.getFullYear() - birth.getFullYear()
    let months = now.getMonth() - birth.getMonth()
    if (months < 0) { years--; months += 12 }
    return `${years}y ${months}m`
  }

  const feedingsToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return feedings.filter(f => f.petId === activePetId && f.time.startsWith(today))
  }, [feedings, activePetId])

  const activeMeds = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return medications.filter(m => m.petId === activePetId && m.startDate <= today && (!m.endDate || m.endDate >= today))
  }, [medications, activePetId])

  const upcomingVet = useMemo(() => {
    return vetVisits.filter(v => v.petId === activePetId && v.nextVisit && v.nextVisit >= new Date().toISOString().split('T')[0])
      .sort((a, b) => a.nextVisit.localeCompare(b.nextVisit))
  }, [vetVisits, activePetId])

  const weightHistory = useMemo(() => {
    return weightLogs.filter(w => w.petId === activePetId).sort((a, b) => a.date.localeCompare(b.date))
  }, [weightLogs, activePetId])

  const fmt = (n: number) => n.toFixed(1)

  if (viewMode === 'list') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Pet Care Tracker</h3>
          <button className="btn" onClick={() => { setViewMode('pet'); setActivePetId(null) }}>+ Add Pet</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {pets.map((pet, i) => (
            <div key={pet.id} className="pop-row" style={{
              padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              borderTop: `4px solid ${pet.color}`,
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: 8 }}>{pet.name}</div>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 4 }}>{pet.type} • {pet.breed || 'Mixed'}</div>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 4 }}>Age: {getAge(pet.birthDate)}</div>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 8 }}>Weight: {pet.weight} kg</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => { setActivePetId(pet.id); setViewMode('feeding') }}>Feeding</button>
                <button className="btn" onClick={() => { setActivePetId(pet.id); setViewMode('medication') }}>Meds</button>
                <button className="btn" onClick={() => { setActivePetId(pet.id); setViewMode('vet') }}>Vet</button>
                <button className="btn" onClick={() => { setActivePetId(pet.id); setViewMode('weight') }}>Weight</button>
              </div>
              <button className="btn" onClick={() => removePet(pet.id)} style={{ marginTop: 8, color: 'var(--danger)', width: '100%' }}>Remove Pet</button>
            </div>
          ))}
          <div style={{
            padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 8 }}>🐾</div>
            <h4 style={{ margin: '0 0 8px' }}>Add New Pet</h4>
            <button className="btn" onClick={() => { setViewMode('pet'); setActivePetId(null) }} style={{ padding: '12px 24px', fontSize: '1.1rem' }}>Add Pet</button>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Track feeding, medication, vet visits, and weight for multiple pets. All data stored locally.
        </p>
      </div>
    )
  }

  if (viewMode === 'pet') {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => { setViewMode('list'); setActivePetId(null) }}>← Back to Pets</button>
          <h3 style={{ margin: 0 }}>{activePet?.name || 'Add New Pet'}</h3>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>{activePet ? 'Edit Pet' : 'Add New Pet'}</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                <input type="text" placeholder="Name" value={newPet.name} onChange={e => setNewPet({ ...newPet, name: e.target.value })} style={{ flex: 1 }} />
                <select value={newPet.type} onChange={e => setNewPet({ ...newPet, type: e.target.value })} style={{ width: 120 }}>
                  {PET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Breed" value={newPet.breed} onChange={e => setNewPet({ ...newPet, breed: e.target.value })} style={{ flex: 1 }} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input type="date" placeholder="Birth Date" value={newPet.birthDate} onChange={e => setNewPet({ ...newPet, birthDate: e.target.value })} style={{ width: 140 }} />
                <input type="number" step={0.1} min={0} placeholder="Weight (kg)" value={newPet.weight} onChange={e => setNewPet({ ...newPet, weight: Number(e.target.value) })} style={{ width: 100 }} />
                <input type="color" value={newPet.color} onChange={e => setNewPet({ ...newPet, color: e.target.value })} style={{ width: 50, height: 40, border: 'none', borderRadius: '50%', cursor: 'pointer' }} />
              </div>
              <div className="row" style={{ gap: 8 }}>
                <input type="text" placeholder="Microchip #" value={newPet.microchip} onChange={e => setNewPet({ ...newPet, microchip: e.target.value })} style={{ flex: 1 }} />
                <input type="text" placeholder="Vet Clinic" value={newPet.vet} onChange={e => setNewPet({ ...newPet, vet: e.target.value })} style={{ flex: 1 }} />
              </div>
              <button className="btn" onClick={activePet ? () => { setPets(pets.map(p => p.id === activePetId ? { ...newPet, id: activePetId } : p)); setViewMode('list'); setActivePetId(null) } : addPet} style={{ justifySelf: 'start', marginTop: 8 }}>
                {activePet ? 'Save Changes' : 'Add Pet'}
              </button>
            </div>
          </div>

          <div className="row" style={{ gap: 16 }}>
            <button className="btn" onClick={() => { setViewMode('feeding'); setActivePetId(activePet!.id) }}>Feeding Schedule</button>
            <button className="btn" onClick={() => { setViewMode('medication'); setActivePetId(activePet!.id) }}>Medications</button>
            <button className="btn" onClick={() => { setViewMode('vet'); setActivePetId(activePet!.id) }}>Vet Visits</button>
            <button className="btn" onClick={() => { setViewMode('weight'); setActivePetId(activePet!.id) }}>Weight Log</button>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'feeding' && activePet) {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => { setViewMode('list'); setActivePetId(null) }}>← Back to Pets</button>
          <h3 style={{ margin: 0 }}>{activePet.name} - Feeding</h3>
          <button className="btn" onClick={() => { setActivePetId(activePet.id); setViewMode('pet') }}>Pet Profile</button>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Feeding Time
            <button className="btn" onClick={() => { setFeedings([...feedings, { id: Date.now(), petId: activePet!.id, time: '07:00', food: '', amount: '', completed: false }])}} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="time" value={newFeeding.time} onChange={e => setNewFeeding({ ...newFeeding, time: e.target.value })} style={{ width: 100 }} />
              <input type="text" placeholder="Food Type" value={newFeeding.food} onChange={e => setNewFeeding({ ...newFeeding, food: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="Amount" value={newFeeding.amount} onChange={e => setNewFeeding({ ...newFeeding, amount: e.target.value })} style={{ width: 100 }} />
            </div>
            <button className="btn" onClick={() => { setFeedings([...feedings, { ...newFeeding, id: Date.now(), petId: activePet!.id, completed: false }]); setNewFeeding({ petId: activePet!.id, time: '07:00', food: '', amount: '', completed: false })}}>Add Feeding</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {feedings.filter(f => f.petId === activePet!.id).sort((a, b) => a.time.localeCompare(b.time)).map((feeding, i) => (
            <div key={feeding.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              opacity: feeding.completed ? 0.6 : 1,
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 30}ms`,
            }}>
              <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={feeding.completed} onChange={e => setFeedings(feedings.map(f => f.id === feeding.id ? { ...f, completed: e.target.checked } : f))} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{feeding.time}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>{feeding.food} - {feeding.amount}</div>
                  </div>
                </label>
              </div>
              <button className="btn" onClick={() => setFeedings(feedings.filter(f => f.id !== feeding.id))} style={{ color: 'var(--danger)' }}>Remove</button>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Set feeding times for your pet. Mark as completed when done. Times sorted chronologically.
        </p>
      </div>
    )
  }

  if (viewMode === 'medication' && activePet) {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => { setViewMode('list'); setActivePetId(null) }}>← Back to Pets</button>
          <h3 style={{ margin: 0 }}>{activePet.name} - Medications</h3>
          <button className="btn" onClick={() => { setActivePetId(activePet.id); setViewMode('pet') }}>Pet Profile</button>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Medication
            <button className="btn" onClick={() => { setMedications([...medications, { id: Date.now(), petId: activePet!.id, name: '', dosage: '', frequency: 'daily', startDate: new Date().toISOString().split('T')[0], endDate: '', instructions: '' }])}} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Medication Name" value={newMedication.name} onChange={e => setNewMedication({ ...newMedication, name: e.target.value })} style={{ flex: 1 }} />
              <input type="text" placeholder="Dosage" value={newMedication.dosage} onChange={e => setNewMedication({ ...newMedication, dosage: e.target.value })} style={{ width: 120 }} />
              <select value={newMedication.frequency} onChange={e => setNewMedication({ ...newMedication, frequency: e.target.value })} style={{ width: 120 }}>
                <option value="daily">Daily</option>
                <option value="twice-daily">Twice Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="as-needed">As Needed</option>
              </select>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="date" value={newMedication.startDate} onChange={e => setNewMedication({ ...newMedication, startDate: e.target.value })} style={{ width: 140 }} />
              <input type="date" placeholder="End Date" value={newMedication.endDate} onChange={e => setNewMedication({ ...newMedication, endDate: e.target.value })} style={{ width: 140 }} />
            </div>
            <textarea placeholder="Instructions" value={newMedication.instructions} onChange={e => setNewMedication({ ...newMedication, instructions: e.target.value })} rows={2} />
            <button className="btn" onClick={() => { setMedications([...medications, { ...newMedication, id: Date.now(), petId: activePet!.id }]); setNewMedication({ petId: activePet!.id, name: '', dosage: '', frequency: 'daily', startDate: new Date().toISOString().split('T')[0], endDate: '', instructions: '' })}}>Add Medication</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {medications.filter(m => m.petId === activePet!.id).map((med, i) => (
            <div key={med.id} className="pop-row" style={{
              padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{med.name}</div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>{med.dosage} • {med.frequency}</div>
                </div>
                <button className="btn" onClick={() => setMedications(medications.filter(m => m.id !== med.id))} style={{ color: 'var(--danger)' }}>Remove</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 8, fontSize: '0.85rem' }}>
                <div><span className="muted">Start:</span> {med.startDate}</div>
                <div><span className="muted">End:</span> {med.endDate || 'Ongoing'}</div>
                <div><span className="muted">Frequency:</span> {med.frequency}</div>
              </div>
              {med.instructions && <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>{med.instructions}</div>}
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Track medications with dosage, frequency, and duration. Set start/end dates. Instructions for administration.
        </p>
      </div>
    )
  }

  if (viewMode === 'vet' && activePet) {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => { setViewMode('list'); setActivePetId(null) }}>← Back to Pets</button>
          <h3 style={{ margin: 0 }}>{activePet.name} - Vet Visits</h3>
          <button className="btn" onClick={() => { setActivePetId(activePet.id); setViewMode('pet') }}>Pet Profile</button>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Vet Visit
            <button className="btn" onClick={() => { setVetVisits([...vetVisits, { id: Date.now(), petId: activePet!.id, date: new Date().toISOString().split('T')[0], reason: '', vet: '', notes: '', cost: 0, nextVisit: '' }])}} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="date" value={newVetVisit.date} onChange={e => setNewVetVisit({ ...newVetVisit, date: e.target.value })} style={{ width: 140 }} />
              <input type="text" placeholder="Reason" value={newVetVisit.reason} onChange={e => setNewVetVisit({ ...newVetVisit, reason: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Vet Clinic" value={newVetVisit.vet} onChange={e => setNewVetVisit({ ...newVetVisit, vet: e.target.value })} style={{ flex: 1 }} />
              <input type="number" min={0} step={0.01} placeholder="Cost" value={newVetVisit.cost} onChange={e => setNewVetVisit({ ...newVetVisit, cost: Number(e.target.value) })} style={{ width: 100 }} />
              <input type="date" placeholder="Next Visit" value={newVetVisit.nextVisit} onChange={e => setNewVetVisit({ ...newVetVisit, nextVisit: e.target.value })} style={{ width: 140 }} />
            </div>
            <textarea placeholder="Notes" value={newVetVisit.notes} onChange={e => setNewVetVisit({ ...newVetVisit, notes: e.target.value })} rows={2} />
            <button className="btn" onClick={() => { setVetVisits([...vetVisits, { ...newVetVisit, id: Date.now(), petId: activePet!.id }]); setNewVetVisit({ petId: activePet!.id, date: new Date().toISOString().split('T')[0], reason: '', vet: '', notes: '', cost: 0, nextVisit: '' })}}>Add Visit</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {vetVisits.filter(v => v.petId === activePet!.id).sort((a, b) => b.date.localeCompare(a.date)).map((visit, i) => (
            <div key={visit.id} className="pop-row" style={{
              padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{visit.reason || 'Checkup'}</div>
                  <div className="muted" style={{ fontSize: '0.85rem' }}>{visit.vet} • {visit.date}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>${visit.cost.toFixed(2)}</span>
                  <button className="btn" onClick={() => setVetVisits(vetVisits.filter(v => v.id !== visit.id))} style={{ color: 'var(--danger)' }}>Remove</button>
                </div>
              </div>
              {visit.nextVisit && <div className="muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>Next visit: {visit.nextVisit}</div>}
              {visit.notes && <div className="muted" style={{ marginTop: 4, fontSize: '0.85rem' }}>{visit.notes}</div>}
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Log vet visits with reason, cost, and next appointment date. Track veterinary history and expenses.
        </p>
      </div>
    )
  }

  if (viewMode === 'weight' && activePet) {
    return (
      <div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn" onClick={() => { setViewMode('list'); setActivePetId(null) }}>← Back to Pets</button>
          <h3 style={{ margin: 0 }}>{activePet.name} - Weight Tracker</h3>
          <button className="btn" onClick={() => { setActivePetId(activePet.id); setViewMode('pet') }}>Pet Profile</button>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Weight Entry
            <span className="muted" style={{ fontSize: '0.8rem' }}>{weightHistory.length} entries</span>
          </h4>
          <div className="row" style={{ gap: 8 }}>
            <input type="date" value={newWeight.date} onChange={e => setNewWeight({ ...newWeight, date: e.target.value })} style={{ width: 140 }} />
            <input type="number" step={0.1} min={0} placeholder="Weight (kg)" value={newWeight.weight} onChange={e => setNewWeight({ ...newWeight, weight: Number(e.target.value) })} style={{ width: 100 }} />
            <input type="text" placeholder="Notes" value={newWeight.notes} onChange={e => setNewWeight({ ...newWeight, notes: e.target.value })} style={{ flex: 1 }} />
            <button className="btn" onClick={() => { setWeightLogs([...weightLogs, { ...newWeight, id: Date.now(), petId: activePet!.id }]); setNewWeight({ petId: activePet!.id, date: new Date().toISOString().split('T')[0], weight: 0, notes: '' })}}>Add Entry</button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {weightHistory.slice().reverse().map((log, i) => (
            <div key={log.id} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 30}ms`,
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{fmt(log.weight)} kg</div>
                <div className="muted" style={{ fontSize: '0.85rem' }}>{log.date} {log.notes ? `• ${log.notes}` : ''}</div>
              </div>
              <button className="btn" onClick={() => setWeightLogs(weightLogs.filter(w => w.id !== log.id))} style={{ color: 'var(--danger)' }}>Remove</button>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Log weight regularly to track growth or weight loss. Shows history with dates and notes.
        </p>
      </div>
    )
  }

  return null
}