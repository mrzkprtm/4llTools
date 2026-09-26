import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Wall {
  id: number
  width: number
  height: number
  openings: Opening[]
}

interface Opening {
  id: number
  type: 'door' | 'window'
  width: number
  height: number
  x: number
}

const PAINT_COVERAGE = 10 // m² per liter
const ROLL_COVERAGE = 5.2 // m² per roll (0.53m × 10m)

export default function PaintCalculator() {
  const [walls, setWalls] = useState<Wall[]>(() => {
    const saved = localStorage.getItem('paint-calculator')
    return saved ? JSON.parse(saved) : [{ id: 1, width: 4, height: 2.5, openings: [] }]
  })
  const [paintPrice, setPaintPrice] = useState(150000) // per liter
  const [rollPrice, setRollPrice] = useState(80000) // per roll
  const [coats, setCoats] = useState(2)

  useEffect(() => {
    try { localStorage.setItem('paint-calculator', JSON.stringify(walls)) } catch {}
  }, [walls])

  const totalWallArea = walls.reduce((sum, w) => sum + w.width * w.height, 0)
  const totalOpeningArea = walls.reduce((sum, w) => sum + w.openings.reduce((s, o) => s + o.width * o.height, 0), 0)
  const paintableArea = totalWallArea - totalOpeningArea
  const totalPaintLiters = Math.ceil((paintableArea * coats) / PAINT_COVERAGE)
  const totalRolls = Math.ceil(paintableArea / ROLL_COVERAGE)

  const addWall = () => {
    setWalls([...walls, { id: Date.now(), width: 3, height: 2.5, openings: [] }])
  }

  const updateWall = (id: number, field: string, value: number) => {
    setWalls(walls.map(w => w.id === id ? { ...w, [field]: value } : w))
  }

  const removeWall = (id: number) => {
    if (walls.length <= 1) return
    setWalls(walls.filter(w => w.id !== id))
  }

  const addOpening = (wallId: number) => {
    setWalls(walls.map(w => w.id === wallId ? { ...w, openings: [...w.openings, { id: Date.now(), type: 'window', width: 1, height: 1.2, x: 1 }] } : w))
  }

  const removeOpening = (wallId: number, openingId: number) => {
    setWalls(walls.map(w => w.id === wallId ? { ...w, openings: w.openings.filter(o => o.id !== openingId) } : w))
  }

  const updateOpening = (wallId: number, openingId: number, field: string, value: number) => {
    setWalls(walls.map(w => w.id === wallId ? {
      ...w,
      openings: w.openings.map(o => o.id === openingId ? { ...o, [field]: value } : o)
    } : w))
  }

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Paint Price / Liter</span>
          <input type="number" min={0} step={1000} value={paintPrice} onChange={e => setPaintPrice(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Wallpaper Price / Roll</span>
          <input type="number" min={0} step={1000} value={rollPrice} onChange={e => setRollPrice(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Coats</span>
          <input type="number" min={1} max={4} value={coats} onChange={e => setCoats(Number(e.target.value))} />
        </label>
        <button className="btn" onClick={addWall} style={{ alignSelf: 'flex-end' }}>+ Add Wall</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{paintableArea.toFixed(1)}</Roll></b><span className="muted">m² Paintable</span></div>
        <div className="stat"><b><Roll>{totalPaintLiters}</Roll></b><span className="muted">Liters Paint</span></div>
        <div className="stat"><b><Roll>{totalRolls}</Roll></b><span className="muted">Rolls Wallpaper</span></div>
        <div className="stat"><b><Roll>{(totalPaintLiters * paintPrice).toLocaleString()}</Roll></b><span className="muted">Est. Paint Cost</span></div>
        <div className="stat"><b><Roll>{(totalRolls * rollPrice).toLocaleString()}</Roll></b><span className="muted">Est. Wallpaper Cost</span></div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {walls.map((wall, i) => (
          <div key={wall.id} className="pop-row" style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Wall {i + 1}</span>
              <button className="btn" onClick={() => removeWall(wall.id)} disabled={walls.length <= 1} style={{ color: 'var(--danger)' }}>Remove</button>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Width (m)</span>
                <input type="number" step="0.1" min={0.5} max={20} value={wall.width} onChange={e => updateWall(wall.id, 'width', Number(e.target.value))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Height (m)</span>
                <input type="number" step="0.1" min={1} max={10} value={wall.height} onChange={e => updateWall(wall.id, 'height', Number(e.target.value))} />
              </label>
              <span className="stat"><b><Roll>{(wall.width * wall.height).toFixed(1)}</Roll></b><span className="muted">m²</span></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>Openings (doors/windows)</span>
                <button className="btn" onClick={() => addOpening(wall.id)} style={{ fontSize: '0.8rem' }}>+ Add</button>
              </div>
              {wall.openings.map((opening, oi) => (
                <div key={opening.id} className="pop-row" style={{
                  display: 'flex', gap: 8, padding: 8,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                }}>
                  <select value={opening.type} onChange={e => updateOpening(wall.id, opening.id, 'type', e.target.value === 'door' ? 'door' : 'window')} style={{ width: 80 }}>
                    <option value="window">Window</option>
                    <option value="door">Door</option>
                  </select>
                  <input type="number" step="0.1" min={0.3} max={5} value={opening.width} onChange={e => updateOpening(wall.id, opening.id, 'width', Number(e.target.value))} placeholder="Width (m)" style={{ width: 80 }} />
                  <input type="number" step="0.1" min={0.5} max={3} value={opening.height} onChange={e => updateOpening(wall.id, opening.id, 'height', Number(e.target.value))} placeholder="Height (m)" style={{ width: 80 }} />
                  <input type="number" step="0.1" min={0} max={10} value={opening.x} onChange={e => updateOpening(wall.id, opening.id, 'x', Number(e.target.value))} placeholder="X pos (m)" style={{ width: 80 }} />
                  <span className="stat"><b><Roll>{(opening.width * opening.height).toFixed(2)}</Roll></b><span className="muted">m²</span></span>
                  <button className="btn" onClick={() => removeOpening(wall.id, opening.id)} style={{ color: 'var(--danger)', padding: '4px 8px' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Hint>Add walls, set dimensions, add doors/windows. Walls fill with color as coverage computes. Instantly see cans/rolls needed and cost.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}