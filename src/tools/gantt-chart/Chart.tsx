import { useRef, useState, type PointerEvent, type ReactElement } from 'react'
import { addDays, end, schedule, type Task } from './logic'

export const ROW = 40
export const HEAD = 46
export const GUT = 128

export interface Geo {
  dayW: number
  days: number
  width: number
  height: number
}

export function geometry(tasks: readonly Task[], dayW: number, today: number): Geo {
  const days = Math.max(28, ...tasks.map((t) => end(t) + 5), today + 3)
  return { dayW, days, width: GUT + days * dayW, height: HEAD + tasks.length * ROW + 8 }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Curved finish→start connector between two bars. */
export function connector(x1: number, y1: number, x2: number, y2: number): string {
  const k = Math.max(16, Math.min(60, Math.abs(x2 - x1) / 2 + 12))
  return `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2 - 2},${y2}`
}

interface Props {
  tasks: Task[]
  start: string
  dayW: number
  today: number
  selected: number | null
  onSelect: (id: number) => void
  onChange: (tasks: Task[]) => void
}

export default function Chart({ tasks, start, dayW, today, selected, onSelect, onChange }: Props) {
  const g = geometry(tasks, dayW, today)
  const drag = useRef<{ id: number; mode: 'move' | 'size'; x0: number; base: Task[] } | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const idx = new Map(tasks.map((t, i) => [t.id, i]))
  const weeks = dayW < 20

  function down(e: PointerEvent<SVGGElement>, t: Task, mode: 'move' | 'size') {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget.ownerSVGElement ?? e.currentTarget).setPointerCapture(e.pointerId)
    drag.current = { id: t.id, mode, x0: e.clientX, base: tasks }
    setDragging(t.id)
    onSelect(t.id)
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    const dd = Math.round((e.clientX - d.x0) / dayW)
    const next = d.base.map((t) => (t.id !== d.id ? t : d.mode === 'move' ? { ...t, start: Math.max(0, t.start + dd) } : { ...t, duration: Math.max(1, t.duration + dd) }))
    const s = schedule(next)
    if (s.some((t, i) => t.start !== tasks[i]?.start || t.duration !== tasks[i]?.duration)) onChange(s)
  }
  function up() {
    drag.current = null
    setDragging(null)
  }

  const head: ReactElement[] = []
  for (let d = 0; d < g.days; d++) {
    const iso = addDays(start, d)
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
    const x = GUT + d * dayW
    if (!weeks && (dow === 0 || dow === 6)) head.push(<rect key={`w${d}`} x={x} y={HEAD} width={dayW} height={g.height - HEAD} className="gc-weekend" />)
    if (iso.endsWith('-01') || d === 0) head.push(<text key={`m${d}`} x={x + 3} y={16} className="gc-month">{MONTHS[+iso.slice(5, 7) - 1]} {iso.slice(0, 4)}</text>)
    if (weeks ? dow === 1 : true) {
      head.push(<line key={`l${d}`} x1={x} x2={x} y1={weeks ? 22 : 24} y2={g.height} className={dow === 1 ? 'gc-grid wk' : 'gc-grid'} />)
      head.push(<text key={`d${d}`} x={x + (weeks ? 3 : dayW / 2)} y={38} textAnchor={weeks ? 'start' : 'middle'} className="gc-day">{+iso.slice(8, 10)}</text>)
    }
  }

  return (
    <svg className="gc-svg" width={g.width} height={g.height} viewBox={`0 0 ${g.width} ${g.height}`} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Gantt chart timeline">
      <defs>
        <marker id="gc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="gc-arrowhead" />
        </marker>
      </defs>
      {head}
      <line x1={0} x2={g.width} y1={HEAD} y2={HEAD} className="gc-grid wk" />
      {tasks.map((t, i) => (
        <g key={`r${t.id}`}>
          {i % 2 === 1 && <rect x={0} y={HEAD + i * ROW} width={g.width} height={ROW} className="gc-stripe" />}
          <text x={10} y={HEAD + i * ROW + ROW / 2 + 4} className={`gc-name ${selected === t.id ? 'sel' : ''}`} onClick={() => onSelect(t.id)}>
            {t.name.length > 16 ? t.name.slice(0, 15) + '…' : t.name}
          </text>
        </g>
      ))}
      {tasks.flatMap((t) =>
        t.deps.filter((d) => idx.has(d)).map((d) => {
          const p = tasks[idx.get(d)!]
          const x1 = GUT + end(p) * dayW
          const y1 = HEAD + idx.get(d)! * ROW + ROW / 2
          const x2 = GUT + t.start * dayW
          const y2 = HEAD + idx.get(t.id)! * ROW + ROW / 2
          return <path key={`a${d}-${t.id}`} d={connector(x1, y1, x2, y2)} className="gc-link" markerEnd="url(#gc-arrow)" />
        }),
      )}
      {today >= 0 && today < g.days && (
        <g className="gc-today">
          <line x1={GUT + today * dayW} x2={GUT + today * dayW} y1={22} y2={g.height} />
          <text x={GUT + today * dayW + 3} y={g.height - 4}>Today</text>
        </g>
      )}
      {tasks.map((t, i) => {
        const w = t.duration * dayW
        return (
          <g key={t.id} className={`gc-bar ${dragging === t.id ? 'drag' : ''} ${selected === t.id ? 'sel' : ''}`} style={{ transform: `translate(${GUT + t.start * dayW}px, ${HEAD + i * ROW + 8}px)` }}>
            <g onPointerDown={(e) => down(e, t, 'move')} className="gc-hit">
              <rect className="gc-body" width={w} height={ROW - 16} rx={6} fill={t.color} />
              <rect className="gc-prog" width={(w * t.progress) / 100} height={ROW - 16} rx={6} />
              {w > 46 && <text x={8} y={(ROW - 16) / 2 + 4} className="gc-label">{t.progress}%</text>}
            </g>
            <rect className="gc-handle" x={w - 10} width={14} height={ROW - 16} onPointerDown={(e) => down(e, t, 'size')} />
          </g>
        )
      })}
    </svg>
  )
}
