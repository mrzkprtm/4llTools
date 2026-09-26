import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const TILE_SIZES = [
  { name: '30×30 cm', w: 0.3, h: 0.3 },
  { name: '40×40 cm', w: 0.4, h: 0.4 },
  { name: '60×60 cm', w: 0.6, h: 0.6 },
  { name: '80×80 cm', w: 0.8, h: 0.8 },
  { name: '30×60 cm', w: 0.3, h: 0.6 },
  { name: '20×120 cm (wood)', w: 0.2, h: 1.2 },
  { name: 'Custom', w: 0.4, h: 0.4 },
] as const

interface Room {
  id: number
  name: string
  length: number
  width: number
  tileIdx: number
  customW: number
  customH: number
  waste: number
  boxSize: number
  pricePerBox: number
}

function computeRoomStats(room: Room, rooms: Room[], tileSizes: typeof TILE_SIZES) {
  const tile = room.tileIdx === TILE_SIZES.length - 1 ? { w: room.customW, h: room.customH } : TILE_SIZES[room.tileIdx]
  const tileArea = tile.w * tile.h
  const roomArea = room.length * room.width
  const tilesNeeded = Math.ceil(room.length * room.width / tileArea * (1 + room.waste / 100))
  const boxesNeeded = Math.ceil(tilesNeeded * tileArea / room.boxSize)
  const totalCost = boxesNeeded * room.pricePerBox
  const cutTiles = Math.ceil((room.length / tile.w % 1 + room.width / tile.h % 1) * (room.length / tile.w + room.width / tile.h))
  const fullTiles = tilesNeeded - cutTiles
  const totalCostAll = Math.round(rooms.reduce((s, r) => {
    const t = r.tileIdx === TILE_SIZES.length - 1 ? { w: r.customW, h: r.customH } : TILE_SIZES[r.tileIdx]
    const a = r.length * r.width / (t.w * t.h) * (1 + r.waste / 100)
    return s + Math.ceil(a) * r.pricePerBox / r.boxSize
  }, 0))
  return { tileArea, tilesNeeded, boxesNeeded, cutTiles, totalCost, fullTiles: tilesNeeded - Math.ceil((room.length / tile.w % 1 + room.width / tile.h % 1) * (room.length / tile.w + room.width / tile.h)), totalCostAll }
}

export default function TileCalculator() {
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = localStorage.getItem('tile-calculator')
    return saved ? JSON.parse(saved) : [{ id: 1, name: 'Living Room', length: 5, width: 4, tileIdx: 1, customW: 0.4, customH: 0.4, waste: 10, boxSize: 1.44, pricePerBox: 80000 }]
  })

  useEffect(() => {
    try { localStorage.setItem('tile-calculator', JSON.stringify(rooms)) } catch {}
  }, [rooms])

  const addRoom = () => {
    setRooms([...rooms, { id: Date.now(), name: `Room ${rooms.length + 1}`, length: 4, width: 3, tileIdx: 1, customW: 0.4, customH: 0.4, waste: 10, boxSize: 1.44, pricePerBox: 80000 }])
  }

  const removeRoom = (id: number) => {
    if (rooms.length <= 1) return
    setRooms(rooms.filter(r => r.id !== id))
  }

  const updateRoom = (id: number, field: string, value: string | number) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <button className="btn" onClick={addRoom} style={{ marginBottom: 16 }}>+ Add Room</button>

      <div style={{ display: 'grid', gap: 8 }}>
        {rooms.map((room, i) => {
          const stats = computeRoomStats(room, rooms, TILE_SIZES)
          return (
            <div key={room.id} className="pop-row" style={{
              display: 'flex', flexDirection: 'column', gap: 12, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`
            }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="text" value={room.name} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, name: e.target.value } : r))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem', minWidth: 150 }} />
                <button className="btn" onClick={() => setRooms(rooms.filter(r => r.id !== room.id))} disabled={rooms.length <= 1} style={{ color: 'var(--danger)' }}>Remove</button>
              </div>

              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                  <span>Length (m)</span>
                  <input type="number" step="0.1" min={0.5} max={50} value={room.length} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, length: Number(e.target.value) } : r))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                  <span>Width (m)</span>
                  <input type="number" step="0.1" min={0.5} max={50} value={room.width} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, width: Number(e.target.value) } : r))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
                  <span>Tile</span>
                  <select value={room.tileIdx} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, tileIdx: Number(e.target.value) } : r))}>
                    {TILE_SIZES.map((t, i) => <option key={t.name} value={i}>{t.name} ({t.w}×{t.h} m)</option>)}
                  </select>
                </label>
                {room.tileIdx === TILE_SIZES.length - 1 && (
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                      <span>Custom Width (m)</span>
                      <input type="number" step="0.01" min={0.05} max={2} value={room.customW} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, customW: Number(e.target.value) } : r))} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                      <span>Custom Height (m)</span>
                      <input type="number" step="0.01" min={0.05} max={2} value={room.customH} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, customH: Number(e.target.value) } : r))} />
                    </label>
                  </div>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                  <span>Waste %</span>
                  <input type="number" min={0} max={30} value={room.waste} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, waste: Number(e.target.value) } : r))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                  <span>Box Size (m²)</span>
                  <input type="number" step="0.01" min={0.1} max={10} value={room.boxSize} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, boxSize: Number(e.target.value) } : r))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
                  <span>Price / Box (Rp)</span>
                  <input type="number" min={0} step={1000} value={room.pricePerBox} onChange={e => setRooms(rooms.map(r => r.id === room.id ? { ...r, pricePerBox: Number(e.target.value) } : r))} />
                </label>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div className="stats" style={{ marginTop: 12 }}>
                  <div className="stat"><b><Roll>{room.length * room.width}</Roll></b><span className="muted">Room Area (m²)</span></div>
                  <div className="stat"><b><Roll>{stats.tileArea.toFixed(4)}</Roll></b><span className="muted">Tile Area (m²)</span></div>
                  <div className="stat"><b><Roll>{stats.tilesNeeded}</Roll></b><span className="muted">Tiles Needed</span></div>
                  <div className="stat"><b><Roll>{stats.boxesNeeded}</Roll></b><span className="muted">Boxes Needed</span></div>
                  <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll>{stats.cutTiles}</Roll></b><span className="muted">Cut Tiles</span></div>
                  <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll>{stats.totalCostAll}</Roll></b><span className="muted">Total Cost (Rp)</span></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn" onClick={() => setRooms([...rooms, { id: Date.now(), name: `Room ${rooms.length + 1}`, length: 4, width: 3, tileIdx: 1, customW: 0.4, customH: 0.4, waste: 10, boxSize: 1.44, pricePerBox: 80000 })]} style={{ marginTop: 16 }}>+ Add Room</button>

        <Hint>Draw walls, set dimensions, add doors/windows. Tiles lay themselves across the floor. Cut pieces highlighted, waste %, boxes to buy.</Hint>
      </div>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}