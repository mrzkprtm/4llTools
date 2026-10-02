import { useState, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { Hint } from '../../sim/controls'

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

const STORE = '4lltools:room-planner'
/** Walkways narrower than this (in meters) get a clearance warning. */
const CLEARANCE = 0.6
/** Items this close to a wall (in meters) snap flush against it. */
const WALL_SNAP = 0.15

const EXAMPLE: Furniture[] = [
  { id: 1, name: 'Sofa', w: 2.2, h: 0.9, x: 0, y: 4.1, rotation: 0, color: '#8b5cf6' },
  { id: 2, name: 'Coffee Table', w: 1, h: 0.6, x: 0.6, y: 3.2, rotation: 0, color: '#f97316' },
  { id: 3, name: 'TV Stand', w: 1.5, h: 0.4, x: 0.3, y: 0, rotation: 0, color: '#374151' },
  { id: 4, name: 'Dining Table', w: 1.8, h: 1, x: 3.6, y: 1.5, rotation: 0, color: '#84cc16' },
]

interface Warning {
  key: string
  kind: 'overlap' | 'tight'
  x: number
  y: number
  gap: number
}

/** Overlaps and too-narrow walkways between items (rugs are ignored, you walk on them). */
function findWarnings(items: Furniture[]): Warning[] {
  const out: Warning[] = []
  const solid = items.filter((f) => f.name !== 'Rug')
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i]
      const b = solid[j]
      // Positive gx/gy is the empty space between the boxes on that axis.
      const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      const cx = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2
      const cy = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2
      if (gx < -0.001 && gy < -0.001) {
        out.push({ key: `${a.id}-${b.id}`, kind: 'overlap', x: cx, y: cy, gap: 0 })
      } else if (gx < 0 || gy < 0) {
        // Side by side: the walkway is the gap on the other axis.
        const gap = gx < 0 ? gy : gx
        if (gap > 0.001 && gap < CLEARANCE) out.push({ key: `${a.id}-${b.id}`, kind: 'tight', x: cx, y: cy, gap })
      }
    }
  }
  return out
}

function loadLayout(): { roomW: number; roomH: number; furniture: Furniture[] } | null {
  try {
    const raw = localStorage.getItem(STORE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function RoomPlanner() {
  const [roomW, setRoomW] = useState(6)
  const [roomH, setRoomH] = useState(5)
  const [furniture, setFurniture] = useState<Furniture[]>(EXAMPLE)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [scale, setScale] = useState(40) // px per meter, fitted to the container width
  const wrapRef = useRef<HTMLDivElement>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; dx: number; dy: number; pointer: number } | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    const saved = loadLayout()
    if (saved && Array.isArray(saved.furniture)) {
      setRoomW(saved.roomW || 6)
      setRoomH(saved.roomH || 5)
      setFurniture(saved.furniture)
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try { localStorage.setItem(STORE, JSON.stringify({ roomW, roomH, furniture })) } catch { /* storage is optional */ }
  }, [furniture, roomW, roomH])

  // Fit the plan to the available width (capped at 60 px per meter).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => setScale(Math.min(60, Math.max(12, (el.clientWidth - 8) / roomW)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [roomW])

  const addFurniture = (typeIdx: number) => {
    const type = FURNITURE_TYPES[typeIdx]
    const newItem: Furniture = {
      id: Date.now(),
      name: type.name,
      w: type.w,
      h: type.h,
      x: Math.max(0, (roomW - type.w) / 2),
      y: Math.max(0, (roomH - type.h) / 2),
      rotation: 0,
      color: type.color,
    }
    setFurniture([...furniture, newItem])
    setSelectedId(newItem.id)
  }

  const removeFurniture = (id: number) => {
    setFurniture(furniture.filter((f) => f.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // Rotating by 90° swaps the footprint; keep it inside the room.
  const rotateFurniture = (id: number) => {
    setFurniture(furniture.map((f) => (f.id === id ? { ...f, rotation: (f.rotation + 90) % 360, w: f.h, h: f.w, x: Math.min(f.x, Math.max(0, roomW - f.h)), y: Math.min(f.y, Math.max(0, roomH - f.w)) } : f)))
  }

  const snap = (val: number) => Math.round(val * 10) / 10

  const place = (v: number, size: number, room: number) => {
    let p = Math.max(0, Math.min(room - size, v))
    if (snapToGrid) p = snap(p)
    if (p < WALL_SNAP) p = 0
    if (room - size - p < WALL_SNAP) p = Math.max(0, room - size)
    return p
  }

  const onItemDown = (e: ReactPointerEvent, item: Furniture) => {
    if (e.button !== 0) return
    e.preventDefault()
    setSelectedId(item.id)
    const rect = planRef.current!.getBoundingClientRect()
    drag.current = { id: item.id, dx: e.clientX - rect.left - item.x * scale, dy: e.clientY - rect.top - item.y * scale, pointer: e.pointerId }
    planRef.current!.setPointerCapture(e.pointerId)
  }

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const rect = planRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left - d.dx) / scale
    const y = (e.clientY - rect.top - d.dy) / scale
    setFurniture((fs) => fs.map((f) => (f.id === d.id ? { ...f, x: place(x, f.w, roomW), y: place(y, f.h, roomH) } : f)))
  }

  const onUp = () => { drag.current = null }

  function exportPng() {
    const px = 80
    const pad = 24
    const c = document.createElement('canvas')
    c.width = roomW * px + pad * 2
    c.height = roomH * px + pad * 2
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#f5f0e8'
    ctx.fillRect(pad, pad, roomW * px, roomH * px)
    ctx.strokeStyle = '#e2dccd'
    ctx.lineWidth = 1
    for (let i = 0; i <= roomW * 2; i++) { ctx.beginPath(); ctx.moveTo(pad + (i * px) / 2, pad); ctx.lineTo(pad + (i * px) / 2, pad + roomH * px); ctx.stroke() }
    for (let i = 0; i <= roomH * 2; i++) { ctx.beginPath(); ctx.moveTo(pad, pad + (i * px) / 2); ctx.lineTo(pad + roomW * px, pad + (i * px) / 2); ctx.stroke() }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 14px system-ui, sans-serif'
    for (const f of [...furniture].sort((a, b) => Number(b.name === 'Rug') - Number(a.name === 'Rug'))) {
      ctx.globalAlpha = f.name === 'Rug' ? 0.55 : 1
      ctx.fillStyle = f.color
      ctx.fillRect(pad + f.x * px, pad + f.y * px, f.w * px, f.h * px)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'
      ctx.fillText(f.name, pad + (f.x + f.w / 2) * px, pad + (f.y + f.h / 2) * px)
    }
    ctx.lineWidth = 4
    ctx.strokeStyle = '#333'
    ctx.strokeRect(pad, pad, roomW * px, roomH * px)
    ctx.fillStyle = '#333'
    ctx.textAlign = 'left'
    ctx.fillText(`${roomW} × ${roomH} m`, pad, pad / 2)
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = 'room-layout.png'
    a.click()
  }

  const warnings = findWarnings(furniture)
  const selected = furniture.find((f) => f.id === selectedId)
  const furnArea = furniture.filter((f) => f.name !== 'Rug').reduce((s, f) => s + f.w * f.h, 0)
  const anim = !reducedMotion()

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Room width (m)</span>
          <input type="number" step="0.5" min={2} max={20} value={roomW} onChange={(e) => setRoomW(Math.max(2, Math.min(20, Number(e.target.value) || 2)))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Room length (m)</span>
          <input type="number" step="0.5" min={2} max={20} value={roomH} onChange={(e) => setRoomH(Math.max(2, Math.min(20, Number(e.target.value) || 2)))} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          <span>Show grid</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
          <span>Snap to 10 cm</span>
        </label>
        <button type="button" className="btn" onClick={exportPng}>Export PNG</button>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>Furniture palette</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FURNITURE_TYPES.map((type, i) => (
            <button type="button" key={type.name} className="btn" onClick={() => addFurniture(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px' }}>
              <div style={{ width: 40, height: 24, background: type.color, borderRadius: '4px', border: '1px solid var(--border)' }} />
              <span style={{ fontSize: '0.7rem' }}>{type.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ width: '100%' }}>
        <div
          ref={planRef}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null) }}
          style={{
            position: 'relative',
            boxSizing: 'content-box',
            width: roomW * scale,
            height: roomH * scale,
            background: '#f5f0e8',
            border: '3px solid #333',
            borderRadius: 4,
            overflow: 'hidden',
            touchAction: 'none',
            backgroundImage: showGrid ? 'linear-gradient(to right, rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.08) 1px, transparent 1px)' : undefined,
            backgroundSize: showGrid ? `${scale / 2}px ${scale / 2}px` : undefined,
          }}
        >
          {/* Furniture */}
          {furniture.map((item) => (
            <div
              key={item.id}
              onPointerDown={(e) => onItemDown(e, item)}
              onDoubleClick={() => rotateFurniture(item.id)}
              onContextMenu={(e) => { e.preventDefault(); rotateFurniture(item.id) }}
              style={{
                position: 'absolute',
                left: item.x * scale,
                top: item.y * scale,
                width: item.w * scale,
                height: item.h * scale,
                background: item.color,
                opacity: item.name === 'Rug' ? 0.55 : 1,
                outline: selectedId === item.id ? '3px solid var(--accent)' : '1px solid rgba(0,0,0,.25)',
                outlineOffset: -1,
                borderRadius: 4,
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                userSelect: 'none',
                overflow: 'hidden',
                zIndex: item.name === 'Rug' ? 0 : 1,
                transition: anim ? 'width 0.3s var(--spring-snap), height 0.3s var(--spring-snap), box-shadow 0.15s' : 'none',
                boxShadow: selectedId === item.id ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {item.name}
            </div>
          ))}

          {/* Clearance warnings */}
          {warnings.map((w) => (
            <div key={w.key} style={{ position: 'absolute', left: w.x * scale, top: w.y * scale, transform: 'translate(-50%, -50%)', zIndex: 100, pointerEvents: 'none' }}>
              <div style={{
                background: w.kind === 'overlap' ? 'var(--danger)' : '#d97706', color: 'white', padding: '2px 8px',
                borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                animation: anim ? 'pop 0.3s var(--spring-bouncy) both' : undefined,
              }}>
                {w.kind === 'overlap' ? '⚠ Overlap' : `⚠ ${Math.round(w.gap * 100)} cm gap`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <b>{selected.name}</b>
          <span className="muted">{selected.w.toFixed(1)} × {selected.h.toFixed(1)} m at ({selected.x.toFixed(1)}, {selected.y.toFixed(1)})</span>
          <button type="button" className="btn" onClick={() => rotateFurniture(selected.id)}>Rotate 90°</button>
          <button type="button" className="btn" onClick={() => removeFurniture(selected.id)} style={{ color: 'var(--danger)' }}>Remove</button>
        </div>
      )}

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{furniture.length}</Roll></b><span className="muted">Items</span></div>
        <div className="stat"><b><Roll>{(roomW * roomH).toFixed(1)}</Roll></b><span className="muted">Room area (m²)</span></div>
        <div className="stat"><b><Roll>{furnArea.toFixed(1)}</Roll></b><span className="muted">Furniture area (m²)</span></div>
        <div className="stat"><b><Roll>{((furnArea / (roomW * roomH)) * 100).toFixed(0)}</Roll>%</b><span className="muted">Floor covered</span></div>
        <div className="stat"><b style={{ color: warnings.length ? 'var(--danger)' : 'var(--ok)' }}><Roll>{warnings.length}</Roll></b><span className="muted">Warnings</span></div>
      </div>

      <Hint>Tap a piece in the palette to add it, then drag it on the plan; it snaps flush to walls within 15 cm. Double-click or use Rotate to turn it. Red marks overlaps and amber marks walkways under {CLEARANCE * 100} cm.</Hint>
    </div>
  )
}
