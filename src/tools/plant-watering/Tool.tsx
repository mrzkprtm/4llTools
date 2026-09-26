import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Plant {
  id: number
  name: string
  type: string
  waterInterval: number // days
  lastWatered: string // ISO date
  color: string
}

const PLANT_TYPES = [
  { name: 'Succulent', interval: 14, color: '#84cc16' },
  { name: 'Tropical', interval: 5, color: '#06b6d4' },
  { name: 'Herb', interval: 3, color: '#84cc16' },
  { name: 'Flowering', interval: 4, color: '#ec4899' },
  { name: 'Foliage', interval: 7, color: '#84cc16' },
  { name: 'Custom', interval: 7, color: '#f97316' },
] as const

export default function PlantWatering() {
  const [plants, setPlants] = useState(() => {
    const saved = localStorage.getItem('plant-watering')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Monstera', type: 'Tropical', waterInterval: 5, lastWatered: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], color: '#06b6d4' },
      { id: 2, name: 'Snake Plant', type: 'Succulent', waterInterval: 14, lastWatered: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], color: '#84cc16' },
      { id: 3, name: 'Basil', type: 'Herb', waterInterval: 3, lastWatered: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], color: '#84cc16' },
    ]
  })
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('Tropical')

  useEffect(() => {
    try { localStorage.setItem('plant-watering', JSON.stringify(plants)) } catch {}
  }, [plants])

  const today = new Date()
  const plantStatus = plants.map(plant => {
    const last = new Date(plant.lastWatered)
    const daysSince = Math.floor((today.getTime() - last.getTime()) / 86400000)
    const due = daysSince >= plant.waterInterval
    const daysLeft = plant.waterInterval - daysSince
    return { ...plant, daysSince, daysLeft, due }
  })

  const addPlant = () => {
    if (!newName.trim()) return
    const type = PLANT_TYPES.find(t => t.name === newType)!
    setPlants([...plants, {
      id: Date.now(),
      name: newName,
      type: newType,
      waterInterval: type.interval,
      lastWatered: today.toISOString().split('T')[0],
      color: type.color,
    }])
    setNewName('')
  }

  const waterPlant = (id: number) => {
    setPlants(plants.map(p => p.id === id ? { ...p, lastWatered: today.toISOString().split('T')[0] } : p))
    playSplash()
  }

  const removePlant = (id: number) => {
    setPlants(plants.filter(p => p.id !== id))
  }

  const playSplash = () => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
    navigator.vibrate?.([50, 30, 50])
  }

  const fmtDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" placeholder="Plant name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ minWidth: 120 }}>
          {PLANT_TYPES.map(t => <option key={t.name} value={t.name}>{t.name} ({t.interval}d)</option>)}
        </select>
        <button className="btn primary" onClick={addPlant} disabled={!newName.trim()}>Add Plant</button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {plantStatus.map((plant, i) => (
          <div key={plant.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            borderLeft: `4px solid ${plant.color}`,
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`,
            opacity: plant.due ? 1 : 0.7,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: plant.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${Math.max(0, 1 - plant.daysSince / plant.waterInterval) * 100}%`,
                background: `linear-gradient(180deg, ${plant.color}88, ${plant.color})`,
                borderRadius: '0 0 50% 50%',
              }} />
              <span style={{ position: 'relative', fontSize: '1.5rem' }}>💧</span>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{plant.name}</span>
                <span className="chip" style={{ background: plant.color + '22', borderColor: plant.color, color: plant.color, fontSize: '0.7rem' }}>{plant.type}</span>
                {plant.due && <span className="chip" style={{ background: 'var(--danger)', color: 'white', fontSize: '0.7rem' }}>⚠ Due Now</span>}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 4, fontSize: '0.85rem', color: 'var(--muted)' }}>
                <span>Last: {fmtDate(new Date(plant.lastWatered))}</span>
                <span>Interval: {plant.waterInterval}d</span>
                <span style={{ color: plant.due ? 'var(--danger)' : plant.daysLeft <= 1 ? '#eab308' : 'var(--ok)' }}>
                  {plant.due ? '💧 WATER NOW' : `${plant.daysLeft} day${plant.daysLeft !== 1 ? 's' : ''} left`}
                </span>
              </div>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary" onClick={() => waterPlant(plant.id)} disabled={!plant.due} style={{ flex: 1 }}>
                {plant.due ? '💧 Water Now' : '✓ Done'}
              </button>
              <button className="btn" onClick={() => removePlant(plant.id)} style={{ color: 'var(--danger)' }}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn" onClick={() => {
        const type = PLANT_TYPES[Math.floor(Math.random() * PLANT_TYPES.length)]
        addPlant()
        setNewName(`Plant ${plants.length + 1}`)
        setNewType(type.name)
      }} style={{ marginTop: 16 }}>Add Demo Plant</button>

      <Hint>Tap 💧 to water with a splash. Droplet fills as days pass. Red cards = overdue. Stored locally only.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}