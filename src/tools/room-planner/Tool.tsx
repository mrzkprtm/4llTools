import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Furniture {
  id: number
  name: string
  w: number
  h: number
  x: number
  y: number
  rotation: number
  color: string
}

const FURNITURE_TYPES = [
  { name: 'Sofa', w: 2.2, h: 0.9, color: '#8b5cf6' },
  { name: 'Armchair', w: 0.9, h: 0.9, color: '#ec4899' },
  { name: 'Coffee Table', w: 1, h: 0.6, color: '#f97316' },
  { name: 'Dining Table', w: 1.8, h: 1, color: '#84cc16' },
  { name: 'Chair', w: 0.5, h: 0.5, color: '#06b6d4' },
  { name: 'Bed (Queen)', w: 1.6, h: 2, color: '#e11d48' },
  { name: 'Bed (King)', w: 2, h: 2.1, color: '#e11d48' },
  { name: 'Wardrobe', w: 1.2, h: 0.6, color: '#a16207' },
  { name: 'Desk', w: 1.4, h: 0.7, color: '#7c3aed' },
  { name: 'Bookshelf', w: 1, h: 0.4, color: '#a16207' },
  { name: 'TV Stand', w: 1.5, h: 0.4, color: '#374151' },
  { name: 'Rug', w: 2.5, h: 1.8, color: '#f59e0b' },
] as const

const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#84cc16', '#06b6d4', '#e11d48', '#a16207', '#7c3aed', '#f59e0b', '#374151']

export default function RoomPlanner() {
  const [roomW, setRoomW] = useState(6)
  const [roomH, setRoomH] = useState(5)
  const [furniture, setFurniture] = useState<Furniture[]>(() => {
    const saved = localStorage.getItem('room-planner')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    try { localStorage.setItem('room-planner', JSON.stringify(furniture)) } catch {}
  }, [furniture])

  const addFurniture = (typeIdx: number) => {
    const type = FURNITURE_TYPES[typeIdx]
    const newItem: Furniture = {
      id: Date.now(),
      name: type.name,
      w: type.w,
      h: type.h,
      x: Math.max(0.2, (roomW - type.w) / 2),
      y: Math.max(0.2, (roomH - type.h) / 2),
      rotation: 0,
      color: type.color,
    }
    setFurniture([...furniture, newItem])
    setSelectedId(newItem.id)
  }

  const removeFurniture = (id: number) => {
    setFurniture(furniture.filter(f => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const rotateFurniture = (id: number) => {
    setFurniture(furniture.map(f => f.id === id ? { ...f, rotation: (f.rotation + 90) % 360, w: f.rotation === 0 || f.rotation === 180 ? f.h : f.w, h: f.rotation === 0 || f.rotation === 180 ? f.w : f.h } : f))
  }

  const snap = (val: number) => Math.round(val * 10) / 10

  const handleMouseDown = (e: React.MouseEvent, item: Furniture) => {
    if (e.button !== 0) return
    e.preventDefault()
    setSelectedId(item.id)
    const rect = containerRef.current!.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left - item.x * 40,
      y: e.clientY - rect.top - item.y * 40
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (selectedId === null) return
    const rect = containerRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left - dragOffset.x) / 40
    const y = (e.clientY - rect.top - dragOffset.y) / 40
    const item = furniture.find(f => f.id === selectedId)
    if (!item) return
    let newX = Math.max(0, Math.min(roomW - item.w, x))
    let newY = Math.max(0, Math.min(roomH - item.h, y))
    if (snapToGrid) {
      newX = snap(newX)
      newY = snap(newY)
    }
    setFurniture(furniture.map(f => f.id === selectedId ? { ...f, x: newX, y: newY } : f))
  }

  const handleMouseUp = () => {
    // Check for overlap warnings
    const selected = furniture.find(f => f.id === selectedId)
    if (selected) {
      const others = furniture.filter(f => f.id !== selectedId)
      const hasOverlap = others.some(f =>
        selected.x < f.x + f.w && selected.x + selected.w > f.x &&
        selected.y < f.y + f.h && selected.y + selected.h > f.y
      )
      if (hasOverlap) {
        // Could show warning
      }
    }
  }

  const canvasScale = 40 // 1m = 40px

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Room Width (m)</span>
          <input type="number" step="0.5" min={2} max={20} value={roomW} onChange={e => setRoomW(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Room Height (m)</span>
          <input type="number" step="0.5" min={2} max={20} value={roomH} onChange={e => setRoomH(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
          <span>Show Grid</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} />
          <span>Snap to Grid</span>
        </label>
        <button className="btn" onClick={() => {
          const data = JSON.stringify({ roomW, roomH, furniture })
          const blob = new Blob([data], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'room-layout.json'
          a.click()
        }}>Export PNG</button>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>Furniture Palette</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FURNITURE_TYPES.map((type, i) => (
            <button key={type.name} className="btn" onClick={() => addFurniture(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
              <div style={{ width: 40, height: 24, background: type.color, borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ fontSize: '0.7rem' }}>{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} style={{
        position: 'relative',
        width: roomW * 40,
        height: roomH * 40,
        background: '#f5f0e8',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        touchAction: 'none',
      }}>
        {/* Grid */}
        {showGrid && (
          <>
            {Array.from({ length: Math.floor(roomW * 10) + 1 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute', left: i * 4, top: 0, bottom: 0, width: 1,
                background: i % 10 === 0 ? 'var(--border)' : 'var(--border)',
                opacity: i % 10 === 0 ? 0.5 : 0.2,
              }} />
            ))}
            {Array.from({ length: Math.floor(roomH * 10) + 1 }).map((_, i) => (
              <div key={i} style={{
                position: 'absolute', top: i * 4, left: 0, right: 0, height: 1,
                background: i % 10 === 0 ? 'var(--border)' : 'var(--border)',
                opacity: i % 10 === 0 ? 0.5 : 0.2,
              }} />
            ))}
          </>
        )}

        {/* Furniture */}
        {furniture.map(item => (
          <div
            key={item.id}
            onMouseDown={e => handleMouseDown(e, item)}
            style={{
              position: 'absolute',
              left: item.x * 40,
              top: item.y * 40,
              width: item.w * 40,
              height: item.h * 40,
              background: item.color,
              border: selectedId === item.id ? '3px solid var(--accent)' : '2px solid var(--border)',
              borderRadius: '4px',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              userSelect: 'none',
              transform: `rotate(${item.rotation}deg)`,
              transition: reducedMotion() ? 'none' : 'transform 0.1s, box-shadow 0.1s',
              boxShadow: selectedId === item.id ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            }}
            onContextMenu={e => { e.preventDefault(); rotateFurniture(item.id) }}
          >
            {item.name}
          </div>
        )}

{/* Clearance warnings */}
        {furniture.length > 1 && (
          <React.Fragment>
            {furniture.flatMap((item, i) => furniture.slice(i + 1).map(other => {
              const overlap = item.x < other.x + other.w && item.x + item.w > other.x &&
                item.y < other.y + other.h && item.y + item.h > other.y
              if (!overlap) return null
              const cx = (Math.max(item.x, other.x) + Math.min(item.x + item.w, other.x + other.w)) / 2
              const cy = (Math.max(item.y, other.y) + Math.min(item.y, other.y, other.y + other.h)) / 2
              return (
                <div key={`${item.id}-${other.id}`} style={{
                  position: 'absolute', left: cx * 40 - 30, top: cy * 40 - 15,
                  background: 'var(--danger)', color: 'white', padding: '2px 8px',
                  borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                  whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none',
                  animation: 'pop 0.3s var(--spring-bouncy) both'
                }}>
                  ⚠ Overlap
                </div>
              )
            })).filter(Boolean)}
          </React.Fragment>
        )}
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{furniture.length}</Roll></b><span className="muted">Items</span></div>
        <div className="stat"><b><Roll>{(roomW * roomH).toFixed(1)}</Roll></b><span className="muted">Room Area (m²)</span></div>
        <div className="stat"><b><Roll>{furniture.reduce((s, f) => s + f.w * f.h, 0).toFixed(1)}</Roll></b><span className="muted">Furniture Area (m²)</span></div>
        <div className="stat"><b><Roll>{((furniture.reduce((s, f) => s + f.w * f.h, 0) / (roomW * roomH) * 100).toFixed(0))}</Roll>%</b><span className="muted">Coverage</span></div>
      </div>

      <Hint>Drag furniture to scale on floor plan. Right-click to rotate. Snap to 0.1m grid. Overlaps warned in red. Export layout.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}