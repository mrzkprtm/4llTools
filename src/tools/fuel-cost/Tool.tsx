import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Vehicle {
  id: number
  name: string
  efficiency: number
  fuelType: 'gasoline' | 'diesel' | 'electric'
  tankCapacity: number
}

const FUEL_PRICES = {
  gasoline: 12000,
  diesel: 9500,
  electric: 2500,
}

export default function FuelCost() {
  const [distance, setDistance] = useState(100)
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('fuel-cost')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Car A (Sedan)', efficiency: 12, fuelType: 'gasoline', tankCapacity: 45 },
      { id: 2, name: 'Car B (SUV)', efficiency: 8, fuelType: 'diesel', tankCapacity: 65 },
      { id: 3, name: 'Motorcycle', efficiency: 35, fuelType: 'gasoline', tankCapacity: 8 },
    ]
  })
  const [customPrice, setCustomPrice] = useState(false)
  const [prices, setPrices] = useState(FUEL_PRICES)
  const [returnTrip, setReturnTrip] = useState(false)

  useEffect(() => { try { localStorage.setItem('fuel-cost', JSON.stringify(vehicles)) } catch {} }, [vehicles])

  const addVehicle = () => {
    setVehicles([...vehicles, { id: Date.now(), name: `Vehicle ${vehicles.length + 1}`, efficiency: 10, fuelType: 'gasoline', tankCapacity: 50 }])
  }

  const removeVehicle = (id: number) => {
    if (vehicles.length <= 1) return
    setVehicles(vehicles.filter(v => v.id !== id))
  }

  const updateVehicle = (id: number, field: string, value: string | number) => {
    setVehicles(vehicles.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const totalDistance = returnTrip ? distance * 2 : distance

  const results = useMemo(() => {
    return vehicles.map(v => {
      const price = prices[v.fuelType]
      let fuelNeeded: number
      let cost: number
      if (v.fuelType === 'electric') {
        fuelNeeded = totalDistance / v.efficiency
        cost = fuelNeeded * price
      } else {
        fuelNeeded = totalDistance / v.efficiency
        cost = fuelNeeded * price
      }
      const stops = Math.ceil(fuelNeeded / v.tankCapacity) - 1
      return { vehicle: v, fuelNeeded, cost, stops: Math.max(0, stops) }
    })
  }, [vehicles, totalDistance, prices])

  const fmt = (n: number) => 'Rp' + Math.round(n).toLocaleString()
  const fmtVol = (n: number) => n.toFixed(1) + (vehicles[0]?.fuelType === 'electric' ? ' kWh' : ' L')

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Fuel Cost Calculator</h3>
        <button className="btn" onClick={addVehicle}>+ Add Vehicle</button>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Distance (one way, km)</span>
          <input type="number" min={1} max={10000} value={distance} onChange={e => setDistance(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>&nbsp;</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={returnTrip} onChange={e => setReturnTrip(e.target.checked)} />
            <span>Return trip</span>
          </label>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>&nbsp;</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={customPrice} onChange={e => setCustomPrice(e.target.checked)} />
            <span>Custom prices</span>
          </label>
        </label>
      </div>

      {customPrice && (
        <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span>Gasoline (Rp/L)</span>
            <input type="number" min={0} step={100} value={prices.gasoline} onChange={e => setPrices({ ...prices, gasoline: Number(e.target.value) })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span>Diesel (Rp/L)</span>
            <input type="number" min={0} step={100} value={prices.diesel} onChange={e => setPrices({ ...prices, diesel: Number(e.target.value) })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
            <span>Electric (Rp/kWh)</span>
            <input type="number" min={0} step={100} value={prices.electric} onChange={e => setPrices({ ...prices, electric: Number(e.target.value) })} />
          </label>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16, marginBottom: 16 }}>
        {vehicles.map((vehicle, i) => {
          const result = results.find(r => r.vehicle.id === vehicle.id)!
          return (
            <div key={vehicle.id} className="pop-row" style={{
              display: 'grid', gap: 12, padding: 16,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              gridTemplateColumns: '1fr auto',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`,
            }}>
              <div>
                <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <input type="text" value={vehicle.name} onChange={e => updateVehicle(vehicle.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem', minWidth: 150 }} />
                  <select value={vehicle.fuelType} onChange={e => updateVehicle(vehicle.id, 'fuelType', e.target.value as any)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '6px 12px' }}>
                    <option value="gasoline">Gasoline</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                  </select>
                  <input type="number" min={1} max={100} step={0.1} value={vehicle.efficiency} onChange={e => updateVehicle(vehicle.id, 'efficiency', Number(e.target.value))} style={{ width: 80 }} />
                  <span className="muted">{vehicle.fuelType === 'electric' ? 'km/kWh' : 'km/L'}</span>
                  <input type="number" min={1} max={200} value={vehicle.tankCapacity} onChange={e => updateVehicle(vehicle.id, 'tankCapacity', Number(e.target.value))} style={{ width: 80 }} />
                  <span className="muted">{vehicle.fuelType === 'electric' ? 'kWh' : 'L'}</span>
                  <button className="btn" onClick={() => removeVehicle(vehicle.id)} disabled={vehicles.length <= 1} style={{ color: 'var(--danger)' }}>Remove</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>Fuel Needed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                      <Roll value={fmtVol(result.fuelNeeded)} />
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>Est. Cost</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                      <Roll value={fmt(result.cost)} />
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>Refuel Stops</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: result.stops > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      <Roll value={result.stops} />
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>Cost/km</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                      <Roll value={fmt(result.cost / totalDistance)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn" onClick={addVehicle} style={{ marginBottom: 16 }}>+ Add Another Vehicle</button>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <h4 style={{ margin: '0 0 12px' }}>Trip Summary</h4>
        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div className="stat"><b>Total Distance:</b> <Roll value={totalDistance} /> km</div>
          <div className="stat"><b>Cheapest Option:</b> <span style={{ color: 'var(--ok)' }}>{results.reduce((min, r) => r.cost < min.cost ? r : min).vehicle.name}</span></div>
          <div className="stat"><b>Most Efficient:</b> <span style={{ color: 'var(--accent)' }}>{results.reduce((max, r) => r.fuelNeeded < max.fuelNeeded ? r : max).vehicle.name}</span></div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Enter distance and vehicle specs. Electric vehicles use kWh/100km efficiency. Prices are Indonesian averages - use custom prices for accuracy.
      </p>
    </div>
  )
}