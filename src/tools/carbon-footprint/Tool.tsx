import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Hint, Toggle } from '../../sim/controls'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { FACTORS, flightMode, KG_PER_TREE_YEAR, legKg, totalKg, treesFor, type Leg, type LegMode } from './logic'
import './tool.css'

const QUICK: readonly { label: string; mode: LegMode | 'flight'; km: number; pax?: number }[] = [
  { label: 'Jakarta ⇄ Bali flight', mode: 'flight', km: 980 },
  { label: 'Jakarta ⇄ Singapore flight', mode: 'flight', km: 880 },
  { label: 'Jakarta ⇄ Tokyo flight', mode: 'flight', km: 5780 },
  { label: 'Jakarta ⇄ London flight', mode: 'flight', km: 11700 },
  { label: 'Jakarta ⇄ Bandung by car', mode: 'car-petrol', km: 150, pax: 3 },
  { label: 'Jakarta ⇄ Surabaya by train', mode: 'train', km: 780 },
  { label: 'Merak ⇄ Bakauheni ferry', mode: 'ferry', km: 30 },
]

let nextId = 3
const MAX_TREES = 240

export default function CarbonFootprint() {
  const [legs, setLegs] = useState<Leg[]>([
    { id: 'l1', mode: 'flight-short-eco', km: 980, passengers: 1, roundTrip: true },
    { id: 'l2', mode: 'car-petrol', km: 60, passengers: 2, roundTrip: false },
  ])
  const [travelers, setTravelers] = useState(1)
  const [business, setBusiness] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const prevTrees = useRef(0)
  useFlip(list)

  const counted = legs.map((l) => ({ ...l, travelers }))
  const total = totalKg(counted)
  const trees = treesFor(total)
  const maxKg = Math.max(1, ...counted.map(legKg))
  const firstNew = prevTrees.current
  useEffect(() => {
    prevTrees.current = trees
  }, [trees])

  const update = (id: string, patch: Partial<Leg>) => setLegs(legs.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  function add(mode: LegMode | 'flight', km: number, pax = 1) {
    setLegs([...legs, { id: `l${nextId++}`, mode: mode === 'flight' ? flightMode(km, business) : mode, km, passengers: pax, roundTrip: true }])
  }

  return (
    <div>
      <div className="cf-quick" role="group" aria-label="Add a common trip">
        {QUICK.map((q) => (
          <button key={q.label} type="button" className="btn" onClick={() => add(q.mode, q.km, q.pax)}>+ {q.label}</button>
        ))}
      </div>
      <div className="row">
        <Toggle label="Fly business class" checked={business} onChange={(b) => { setBusiness(b); setLegs(legs.map((l) => (l.mode.startsWith('flight') ? { ...l, mode: flightMode(l.km, b) } : l))) }} />
        <label className="cf-trav">Travelers <input type="number" min={1} max={50} value={travelers} onChange={(e) => setTravelers(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></label>
      </div>

      <div ref={list} className="cf-legs">
        {counted.map((l, i) => {
          const f = FACTORS[l.mode]
          const kg = legKg(l)
          return (
            <div key={l.id} data-flip={l.id} className="cf-leg" style={{ borderLeftColor: f.color }}>
              <span className="cf-n">{i + 1}</span>
              <select aria-label="Mode" value={l.mode} onChange={(e) => update(l.id, { mode: e.target.value as LegMode })}>
                {(Object.keys(FACTORS) as LegMode[]).map((m) => <option key={m} value={m}>{FACTORS[m].icon} {FACTORS[m].name}</option>)}
              </select>
              <label className="cf-km"><input type="number" inputMode="decimal" min={0} aria-label="Distance in km" value={l.km} onChange={(e) => update(l.id, { km: Math.max(0, Number(e.target.value) || 0), mode: l.mode.startsWith('flight') ? flightMode(Number(e.target.value) || 0, business) : l.mode })} /> km</label>
              {f.perVehicle && (
                <label className="cf-km"><input type="number" min={1} max={60} aria-label="People in the vehicle" value={l.passengers} onChange={(e) => update(l.id, { passengers: Math.max(1, Number(e.target.value) || 1) })} /> in vehicle</label>
              )}
              <Toggle label="Return" checked={!!l.roundTrip} onChange={(v) => update(l.id, { roundTrip: v })} />
              <b className="cf-kg">{Math.round(kg).toLocaleString('en-US')} kg</b>
              <button type="button" className="cf-x" aria-label={`Remove leg ${i + 1}`} onClick={() => setLegs(legs.filter((x) => x.id !== l.id))}>×</button>
            </div>
          )
        })}
        {!legs.length && <p className="muted">No legs yet. Add a common trip above or a custom leg below.</p>}
      </div>
      <button type="button" className="btn" onClick={() => add('bus', 100)}>+ Custom leg</button>

      <div className="cf-bubbles" aria-hidden="true">
        {counted.map((l) => {
          const kg = legKg(l)
          const size = 36 + Math.sqrt(kg / maxKg) * 110
          const f = FACTORS[l.mode]
          return (
            <span key={l.id} className="cf-bubble" style={{ width: size, height: size, background: f.color } as CSSProperties}>
              <span>{f.icon}</span>
              {size > 60 && <small>{Math.round(kg)} kg</small>}
            </span>
          )
        })}
      </div>

      <div className="stats">
        <div className="stat"><b><Roll>{Math.round(total).toLocaleString('en-US')}</Roll> kg</b>CO₂ for {travelers > 1 ? `${travelers} travelers` : 'this trip'}</div>
        <div className="stat"><b><Roll>{String(trees)}</Roll></b>Trees for a year to absorb it</div>
        <div className="stat"><b>{((total / travelers / 2500) * 100).toFixed(0)}%</b>of an average Indonesian&apos;s yearly CO₂ (≈2.5 t) per traveler</div>
      </div>

      <div className="cf-forest" aria-label={`${trees} trees`} role="img">
        {Array.from({ length: Math.min(trees, MAX_TREES) }, (_, i) => (
          <span key={i} className="cf-tree" style={{ '--d': `${Math.round(Math.max(0, i - firstNew) * Math.min(45, 2400 / Math.max(1, Math.min(trees, MAX_TREES) - firstNew)))}ms` } as CSSProperties}>🌳</span>
        ))}
        {trees > MAX_TREES && <span className="cf-more">+{(trees - MAX_TREES).toLocaleString('en-US')} more</span>}
      </div>

      <p className="muted cf-note">
        Factors are rounded approximations based on the UK DEFRA/DESNZ conversion factors; flights include an uplift for non-CO₂ effects, close to ICAO-style estimates plus radiative forcing. Flights over 3,700 km count as long haul. Car, motorbike and EV emissions are split between the people in the vehicle, and the EV figure uses Indonesia&apos;s coal-heavy grid. One tree ≈ {KG_PER_TREE_YEAR} kg CO₂ a year.
      </p>
      <Hint>Add each leg of your trip with its distance; bubbles grow with each leg&apos;s CO₂ and the forest shows how many trees would need a year to soak it up. Share a car to shrink its bubble.</Hint>
    </div>
  )
}
