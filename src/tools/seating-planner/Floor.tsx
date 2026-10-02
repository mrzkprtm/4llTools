import { useRef, useState, type PointerEvent } from 'react'
import { seatKey, seatPositions, tableSize, type Guest, type Seating, type Table } from './logic'

export const FW = 900
export const FH = 560

interface Props {
  tables: Table[]
  guests: Guest[]
  seating: Seating
  bad: Set<number>
  colorOf: (group: string) => string
  selectedGuest: number | null
  selectedTable: number | null
  arranging: boolean
  onMoveTable: (id: number, x: number, y: number) => void
  onSelectTable: (id: number | null) => void
  onSeatTap: (key: string) => void
  onGuestDown: (e: PointerEvent<Element>, id: number) => void
}

export const short = (name: string) => {
  const parts = name.trim().split(/\s+/)
  const w = (/^(om|tante|pak|bu|ibu|bapak|mr\.?|mrs\.?|ms\.?|dr\.?|kak|mas|mbak)$/i.test(parts[0] ?? '') && parts[1] ? parts[1] : parts[0]) ?? ''
  return w.length > 7 ? w.slice(0, 6) + '…' : w
}

export default function Floor(p: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: number; dx: number; dy: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)
  const guestById = new Map(p.guests.map((g) => [g.id, g]))

  const toSvg = (cx: number, cy: number) => {
    const m = svg.current?.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: pt.x, y: pt.y }
  }

  function tableDown(e: PointerEvent<SVGGElement>, t: Table) {
    e.stopPropagation()
    svg.current?.setPointerCapture(e.pointerId)
    const q = toSvg(e.clientX, e.clientY)
    drag.current = { id: t.id, dx: t.x - q.x, dy: t.y - q.y, moved: false }
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const q = toSvg(e.clientX, e.clientY)
    if (!d.moved) setDragging(true)
    d.moved = true
    p.onMoveTable(d.id, Math.max(40, Math.min(FW - 40, q.x + d.dx)), Math.max(40, Math.min(FH - 40, q.y + d.dy)))
  }
  function up() {
    const d = drag.current
    if (d && !d.moved) p.onSelectTable(d.id)
    drag.current = null
    setDragging(false)
  }

  // Token positions: seat centers in floor coordinates.
  const tokens: { g: Guest; x: number; y: number; key: string }[] = []
  for (const t of p.tables) {
    seatPositions(t).forEach((s, i) => {
      const key = seatKey(t.id, i)
      const gid = p.seating[key]
      const g = gid !== undefined ? guestById.get(gid) : undefined
      if (g) tokens.push({ g, x: t.x + s.x, y: t.y + s.y, key })
    })
  }

  return (
    <svg ref={svg} className={`sp-floor ${dragging ? 'dragging' : ''} ${p.arranging ? 'arranging' : ''}`} viewBox={`0 0 ${FW} ${FH}`} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerDown={() => p.onSelectTable(null)} role="img" aria-label="Floor plan with tables and seats">
      {p.tables.map((t) => {
        const { r, w, h } = tableSize(t)
        return (
          <g key={t.id} className={`sp-table ${p.selectedTable === t.id ? 'sel' : ''}`} style={{ transform: `translate(${t.x}px, ${t.y}px)` }}>
            <g className="sp-body" onPointerDown={(e) => tableDown(e, t)}>
              {t.shape === 'round' ? <circle r={r} /> : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} />}
              <text y={4} textAnchor="middle" className="sp-tname">{t.name}</text>
            </g>
            {seatPositions(t).map((s, i) => {
              const key = seatKey(t.id, i)
              return <circle key={key} data-seat={key} cx={s.x} cy={s.y} r={17} className={`sp-seat ${p.selectedGuest !== null && p.seating[key] === undefined ? 'open' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => p.onSeatTap(key)} />
            })}
          </g>
        )
      })}
      {tokens.map(({ g, x, y, key }, i) => (
        <g key={g.id} className={`sp-token ${p.bad.has(g.id) ? 'bad' : ''} ${p.selectedGuest === g.id ? 'sel' : ''}`} style={{ transform: `translate(${x}px, ${y}px)`, transitionDelay: p.arranging ? `${(i % 24) * 18}ms` : '0ms' }} data-seat={key}
          onPointerDown={(e) => { e.stopPropagation(); p.onGuestDown(e, g.id) }}>
          <g className="sp-tokin">
            <circle r={17} fill={p.colorOf(g.group)} />
            <text y={3.5} textAnchor="middle">{short(g.name)}</text>
            <title>{g.name}{g.group ? ` (${g.group})` : ''}</title>
          </g>
        </g>
      ))}
    </svg>
  )
}
