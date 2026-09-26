import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { layout, type Person } from './logic'

export const NW = 150
export const NH = 58
export const SX = 168
export const SY = 104

export interface View {
  x: number
  y: number
  k: number
}

export function positions(people: readonly Person[], collapsed: ReadonlySet<number>) {
  const l = layout(people, collapsed)
  const pos = new Map(l.nodes.map((n) => [n.id, { cx: n.x * SX + SX / 2, cy: n.depth * SY + NH / 2 + 10, reports: n.reports }]))
  return { pos, width: l.width * SX, height: l.depth * SY + 20 }
}

export function edgePath(px: number, py: number, cx: number, cy: number) {
  const y1 = py + NH / 2
  const y2 = cy - NH / 2
  const my = (y1 + y2) / 2
  return `M${px},${y1} V${my} H${cx} V${y2}`
}

interface Props {
  people: Person[]
  collapsed: Set<number>
  selected: number | null
  view: View
  setView: (v: View) => void
  onSelect: (id: number | null) => void
  onToggle: (id: number) => void
  onDrop: (id: number, manager: number) => void
}

type Mode = { kind: 'none' } | { kind: 'pan'; x0: number; y0: number; v: View } | { kind: 'node'; id: number; x0: number; y0: number; moved: boolean } | { kind: 'pinch'; d0: number; mx: number; my: number; v: View }

export default function Chart({ people, collapsed, selected, view, setView, onSelect, onToggle, onDrop }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const mode = useRef<Mode>({ kind: 'none' })
  const [ghost, setGhost] = useState<{ id: number; x: number; y: number; target: number | null } | null>(null)
  const { pos } = positions(people, collapsed)
  const byId = new Map(people.map((p) => [p.id, p]))
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const v = viewRef.current
      const k = Math.min(2.5, Math.max(0.25, v.k * Math.exp(-e.deltaY * 0.0015)))
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      setView({ k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setView])

  const world = (clientX: number, clientY: number) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: (clientX - r.left - view.x) / view.k, y: (clientY - r.top - view.y) / view.k }
  }
  const hit = (x: number, y: number, skip: number) => {
    for (const [id, p] of pos) if (id !== skip && Math.abs(x - p.cx) < NW / 2 && Math.abs(y - p.cy) < NH / 2) return id
    return null
  }

  function down(e: PointerEvent<SVGSVGElement>) {
    svg.current?.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      const r = svg.current!.getBoundingClientRect()
      mode.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, v: view }
      setGhost(null)
      return
    }
    const node = (e.target as Element).closest('[data-node]')
    if (node) mode.current = { kind: 'node', id: Number(node.getAttribute('data-node')), x0: e.clientX, y0: e.clientY, moved: false }
    else mode.current = { kind: 'pan', x0: e.clientX, y0: e.clientY, v: view }
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const m = mode.current
    if (m.kind === 'pan') setView({ ...m.v, x: m.v.x + e.clientX - m.x0, y: m.v.y + e.clientY - m.y0 })
    else if (m.kind === 'pinch' && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const k = Math.min(2.5, Math.max(0.25, (m.v.k * Math.hypot(a.x - b.x, a.y - b.y)) / m.d0))
      setView({ k, x: m.mx - ((m.mx - m.v.x) / m.v.k) * k, y: m.my - ((m.my - m.v.y) / m.v.k) * k })
    } else if (m.kind === 'node') {
      if (!m.moved && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 6) return
      m.moved = true
      const w = world(e.clientX, e.clientY)
      setGhost({ id: m.id, x: w.x, y: w.y, target: hit(w.x, w.y, m.id) })
    }
  }
  function up(e: PointerEvent<SVGSVGElement>) {
    pts.current.delete(e.pointerId)
    const m = mode.current
    if (m.kind === 'node') {
      if (!m.moved) onSelect(m.id)
      else if (ghost?.target != null) onDrop(m.id, ghost.target)
    } else if (m.kind === 'pan' && Math.hypot(e.clientX - m.x0, e.clientY - m.y0) < 4) onSelect(null)
    setGhost(null)
    mode.current = { kind: 'none' }
  }

  return (
    <svg ref={svg} className="oc-svg" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Organization chart">
      <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }}>
        {people.map((p) => {
          const c = pos.get(p.id)
          const par = p.manager !== null ? pos.get(p.manager) : undefined
          return c && par ? <path key={`e${p.id}`} className="oc-edge" d={edgePath(par.cx, par.cy, c.cx, c.cy)} /> : null
        })}
        {people.map((p) => {
          const c = pos.get(p.id)
          if (!c) return null
          const cls = `oc-node ${selected === p.id ? 'sel' : ''} ${ghost?.id === p.id ? 'lifted' : ''} ${ghost?.target === p.id ? 'target' : ''}`
          return (
            <g key={p.id} className={cls} style={{ transform: `translate(${c.cx - NW / 2}px, ${c.cy - NH / 2}px)` }}>
              <g className="oc-pop" data-node={p.id}>
                <rect width={NW} height={NH} rx={10} className="oc-card" />
                <rect width={6} height={NH} rx={3} fill={p.color} />
                <text x={16} y={24} className="oc-name">{p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name}</text>
                <text x={16} y={42} className="oc-title">{p.title.length > 22 ? p.title.slice(0, 21) + '…' : p.title}</text>
              </g>
              {c.reports > 0 && (
                <g className="oc-toggle" onPointerDown={(e) => e.stopPropagation()} onClick={() => onToggle(p.id)} role="button" aria-label={`${collapsed.has(p.id) ? 'Expand' : 'Collapse'} ${p.name}`}>
                  <circle cx={NW / 2} cy={NH + 2} r={11} />
                  <text x={NW / 2} y={NH + 6} textAnchor="middle">{collapsed.has(p.id) ? `+${c.reports}` : '–'}</text>
                </g>
              )}
            </g>
          )
        })}
        {ghost && byId.get(ghost.id) && (
          <g className="oc-ghost" style={{ transform: `translate(${ghost.x - NW / 2}px, ${ghost.y - NH / 2}px)` }}>
            <rect width={NW} height={NH} rx={10} />
            <text x={NW / 2} y={34} textAnchor="middle">{byId.get(ghost.id)!.name}</text>
          </g>
        )}
      </g>
    </svg>
  )
}
