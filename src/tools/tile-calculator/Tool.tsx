import { useState, useEffect, useRef } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Hint } from '../../sim/controls'

const TILE_SIZES = [
  { name: '30×30 cm', w: 0.3, h: 0.3 },
  { name: '40×40 cm', w: 0.4, h: 0.4 },
  { name: '60×60 cm', w: 0.6, h: 0.6 },
  { name: '80×80 cm', w: 0.8, h: 0.8 },
  { name: '30×60 cm', w: 0.3, h: 0.6 },
  { name: '20×120 cm (wood)', w: 0.2, h: 1.2 },
  { name: 'Custom', w: 0.4, h: 0.4 },
] as const

const STORE = '4lltools:tile-calculator'

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

const newRoom = (id: number, name: string, length = 4, width = 3): Room => ({ id, name, length, width, tileIdx: 1, customW: 0.4, customH: 0.4, waste: 10, boxSize: 1.44, pricePerBox: 80000 })

function tileOf(room: Room) {
  return room.tileIdx === TILE_SIZES.length - 1 ? { w: Math.max(0.05, room.customW), h: Math.max(0.05, room.customH) } : TILE_SIZES[room.tileIdx]
}

const EPS = 1e-6

/** Tiles laid from one corner: full tiles, cut tiles, then waste % on top, rounded up to whole boxes. */
function computeRoomStats(room: Room) {
  const tile = tileOf(room)
  const tileArea = tile.w * tile.h
  const cols = Math.ceil(room.length / tile.w - EPS)
  const rows = Math.ceil(room.width / tile.h - EPS)
  const fullCols = Math.floor(room.length / tile.w + EPS)
  const fullRows = Math.floor(room.width / tile.h + EPS)
  const laid = cols * rows
  const fullTiles = fullCols * fullRows
  const cutTiles = laid - fullTiles
  const tilesNeeded = Math.ceil(laid * (1 + room.waste / 100))
  const tilesPerBox = Math.max(1, Math.round(room.boxSize / tileArea))
  const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox)
  const totalCost = boxesNeeded * room.pricePerBox
  return { tile, tileArea, cols, rows, fullTiles, cutTiles, tilesNeeded, tilesPerBox, boxesNeeded, totalCost }
}

const rupiah = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

/** The floor with tiles laying themselves row by row; cut pieces are highlighted. */
function FloorPreview({ room }: { room: Room }) {
  const { tile, cols, rows } = computeRoomStats(room)
  const anim = !reducedMotion()
  const many = cols * rows > 900
  const cells: { x: number; y: number; w: number; h: number; cut: boolean; i: number }[] = []
  if (!many) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const w = Math.min(tile.w, room.length - c * tile.w)
        const h = Math.min(tile.h, room.width - r * tile.h)
        cells.push({ x: c * tile.w, y: r * tile.h, w, h, cut: w < tile.w - EPS || h < tile.h - EPS, i: r + c })
      }
    }
  }
  const delay = Math.max(4, 500 / Math.max(1, cols + rows))
  return (
    <svg viewBox={`-0.05 -0.05 ${room.length + 0.1} ${room.width + 0.1}`} style={{ width: '100%', maxHeight: 260, display: 'block', background: 'var(--surface)', borderRadius: 8 }} role="img" aria-label={`${cols} by ${rows} tile layout`}>
      <rect x={0} y={0} width={room.length} height={room.width} fill="var(--sunken)" />
      {cells.map((c) => (
        <rect
          key={`${room.tileIdx}-${room.length}-${room.width}-${c.x}-${c.y}`}
          x={c.x + 0.004}
          y={c.y + 0.004}
          width={Math.max(0, c.w - 0.008)}
          height={Math.max(0, c.h - 0.008)}
          fill={c.cut ? 'var(--accent)' : 'var(--ok)'}
          fillOpacity={c.cut ? 0.55 : 0.28}
          style={anim ? { animation: `pop 0.35s var(--spring-bouncy) both`, animationDelay: `${c.i * delay}ms`, transformBox: 'fill-box', transformOrigin: 'center' } : undefined}
        />
      ))}
      {many && <text x={room.length / 2} y={room.width / 2} fontSize={Math.min(room.length, room.width) / 10} textAnchor="middle" fill="var(--muted)">{cols * rows} tiles</text>}
      <rect x={0} y={0} width={room.length} height={room.width} fill="none" stroke="var(--text)" strokeWidth={0.05} />
    </svg>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 } as const

export default function TileCalculator() {
  const [rooms, setRooms] = useState<Room[]>(() => [newRoom(1, 'Living room', 5, 4), { ...newRoom(2, 'Bathroom', 2.2, 1.6), tileIdx: 0, boxSize: 1.08, pricePerBox: 95000 }])
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE)
      const saved = raw ? (JSON.parse(raw) as Room[]) : null
      if (Array.isArray(saved) && saved.length) setRooms(saved)
    } catch { /* storage is optional */ }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try { localStorage.setItem(STORE, JSON.stringify(rooms)) } catch { /* storage is optional */ }
  }, [rooms])

  const addRoom = () => setRooms([...rooms, newRoom(Date.now(), `Room ${rooms.length + 1}`)])
  const removeRoom = (id: number) => { if (rooms.length > 1) setRooms(rooms.filter((r) => r.id !== id)) }
  const update = <K extends keyof Room>(id: number, key: K, value: Room[K]) => setRooms(rooms.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
  const num = (v: string, min: number) => Math.max(min, Number(v) || 0)

  const all = rooms.map(computeRoomStats)
  const totalCost = all.reduce((s, x) => s + x.totalCost, 0)
  const totalBoxes = all.reduce((s, x) => s + x.boxesNeeded, 0)
  const totalArea = rooms.reduce((s, r) => s + r.length * r.width, 0)

  return (
    <div>
      <div style={{ display: 'grid', gap: 12 }}>
        {rooms.map((room, i) => {
          const stats = all[i]
          return (
            <div key={room.id} style={{
              display: 'flex', flexDirection: 'column', gap: 12, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="text" aria-label="Room name" value={room.name} onChange={(e) => update(room.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem', minWidth: 0, flex: 1 }} />
                <button type="button" className="btn" onClick={() => removeRoom(room.id)} disabled={rooms.length <= 1} style={{ color: 'var(--danger)' }}>Remove</button>
              </div>

              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <label style={field}>
                  <span>Length (m)</span>
                  <input type="number" step="0.1" min={0.5} max={50} value={room.length} onChange={(e) => update(room.id, 'length', Math.min(50, num(e.target.value, 0.5)))} />
                </label>
                <label style={field}>
                  <span>Width (m)</span>
                  <input type="number" step="0.1" min={0.5} max={50} value={room.width} onChange={(e) => update(room.id, 'width', Math.min(50, num(e.target.value, 0.5)))} />
                </label>
                <label style={{ ...field, minWidth: 160 }}>
                  <span>Tile</span>
                  <select value={room.tileIdx} onChange={(e) => update(room.id, 'tileIdx', Number(e.target.value))}>
                    {TILE_SIZES.map((t, ti) => <option key={t.name} value={ti}>{t.name}</option>)}
                  </select>
                </label>
                {room.tileIdx === TILE_SIZES.length - 1 && (
                  <>
                    <label style={field}>
                      <span>Tile width (m)</span>
                      <input type="number" step="0.01" min={0.05} max={2} value={room.customW} onChange={(e) => update(room.id, 'customW', num(e.target.value, 0.05))} />
                    </label>
                    <label style={field}>
                      <span>Tile length (m)</span>
                      <input type="number" step="0.01" min={0.05} max={2} value={room.customH} onChange={(e) => update(room.id, 'customH', num(e.target.value, 0.05))} />
                    </label>
                  </>
                )}
                <label style={field}>
                  <span>Waste %</span>
                  <input type="number" min={0} max={30} value={room.waste} onChange={(e) => update(room.id, 'waste', Math.min(30, num(e.target.value, 0)))} />
                </label>
                <label style={field}>
                  <span>Box covers (m²)</span>
                  <input type="number" step="0.01" min={0.1} max={10} value={room.boxSize} onChange={(e) => update(room.id, 'boxSize', num(e.target.value, 0.1))} />
                </label>
                <label style={field}>
                  <span>Price / box (Rp)</span>
                  <input type="number" min={0} step={1000} value={room.pricePerBox} onChange={(e) => update(room.id, 'pricePerBox', num(e.target.value, 0))} />
                </label>
              </div>

              <FloorPreview room={room} />

              <div className="stats">
                <div className="stat"><b><Roll>{(room.length * room.width).toFixed(2)}</Roll></b><span className="muted">Floor area (m²)</span></div>
                <div className="stat"><b><Roll>{stats.fullTiles}</Roll></b><span className="muted">Full tiles</span></div>
                <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll>{stats.cutTiles}</Roll></b><span className="muted">Cut tiles</span></div>
                <div className="stat"><b><Roll>{stats.tilesNeeded}</Roll></b><span className="muted">Tiles incl. {room.waste}% waste</span></div>
                <div className="stat"><b><Roll>{stats.boxesNeeded}</Roll></b><span className="muted">Boxes ({stats.tilesPerBox} tiles each)</span></div>
                <div className="stat"><b><Roll>{rupiah(stats.totalCost)}</Roll></b><span className="muted">Cost</span></div>
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" className="btn" onClick={addRoom} style={{ marginTop: 16 }}>+ Add room</button>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{totalArea.toFixed(2)}</Roll></b><span className="muted">Total area (m²)</span></div>
        <div className="stat"><b><Roll>{totalBoxes}</Roll></b><span className="muted">Boxes to buy</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll>{rupiah(totalCost)}</Roll></b><span className="muted">Total cost</span></div>
      </div>

      <Hint>Enter each room's size, tile, and the box coverage printed on the carton. The preview lays tiles from one corner: green tiles are whole, orange ones need cutting, and the waste % covers breakage.</Hint>
    </div>
  )
}
