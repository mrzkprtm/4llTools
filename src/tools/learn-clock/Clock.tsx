import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { dragHour, dragMinute } from './logic'

const C = 150

interface Props {
  /** Unbounded total minutes, so hands keep turning the same way across 12. */
  total: number
  onChange?: (total: number) => void
  minuteLabels: boolean
  label: string
  /** Flash the face after an answer. */
  tone?: 'ok' | 'bad' | null
}

/** A large analog clock whose hands can be dragged. The hour hand follows the minute hand. */
export default function Clock({ total, onChange, minuteLabels, label, tone }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [grab, setGrab] = useState<null | 'minute' | 'hour'>(null)
  const minuteDeg = total * 6
  const hourDeg = total * 0.5

  const angleAt = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 300 - C
    const y = ((e.clientY - r.top) / r.height) * 300 - C
    return { angle: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360, dist: Math.hypot(x, y) }
  }
  const near = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!onChange) return
    const { angle, dist } = angleAt(e)
    const dm = near(angle, minuteDeg % 360)
    const dh = near(angle, hourDeg % 360)
    const which = dist < 85 && dh < 30 ? 'hour' : dh < dm && dh < 20 && dist < 110 ? 'hour' : 'minute'
    setGrab(which)
    e.currentTarget.setPointerCapture(e.pointerId)
    onChange(which === 'minute' ? dragMinute(total, angle) : dragHour(total, angle))
  }
  const move = (e: PointerEvent) => {
    if (!grab || !onChange) return
    const { angle } = angleAt(e)
    onChange(grab === 'minute' ? dragMinute(total, angle) : dragHour(total, angle))
  }
  const key = (e: KeyboardEvent) => {
    if (!onChange) return
    const d = { ArrowUp: 5, ArrowRight: 1, ArrowDown: -5, ArrowLeft: -1, PageUp: 60, PageDown: -60 }[e.key]
    if (d) {
      e.preventDefault()
      onChange(total + d)
    }
  }

  return (
    <svg
      ref={svg}
      viewBox="0 0 300 300"
      className={`lc-clock ${grab ? 'dragging' : ''} ${onChange ? 'editable' : ''} ${tone ? `lc-${tone}` : ''}`}
      role={onChange ? 'slider' : 'img'}
      aria-label={label}
      aria-valuetext={onChange ? label : undefined}
      tabIndex={onChange ? 0 : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => setGrab(null)}
      onPointerCancel={() => setGrab(null)}
      onKeyDown={key}
    >
      <circle cx={C} cy={C} r={140} className="lc-face" />
      {Array.from({ length: 60 }, (_, i) => {
        const big = i % 5 === 0
        return <line key={i} x1={C} y1={big ? 18 : 20} x2={C} y2={big ? 32 : 26} className={big ? 'lc-tick big' : 'lc-tick'} transform={`rotate(${i * 6} ${C} ${C})`} />
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1
        const a = (n * 30 * Math.PI) / 180
        return (
          <g key={n}>
            <text x={C + 88 * Math.sin(a)} y={C - 88 * Math.cos(a)} className="lc-num">{n}</text>
            {minuteLabels && <text x={C + 110 * Math.sin(a)} y={C - 110 * Math.cos(a)} className="lc-min">{(n * 5) % 60}</text>}
          </g>
        )
      })}
      <g className="lc-hand lc-hour" style={{ transform: `rotate(${hourDeg}deg)` }}>
        <line x1={C} y1={C + 14} x2={C} y2={C - 70} />
        <circle cx={C} cy={C - 70} r={grab === 'hour' ? 10 : 0} className="lc-knob" />
      </g>
      <g className="lc-hand lc-minute" style={{ transform: `rotate(${minuteDeg}deg)` }}>
        <line x1={C} y1={C + 18} x2={C} y2={C - 108} />
        <circle cx={C} cy={C - 108} r={onChange ? 9 : 0} className="lc-knob" />
      </g>
      <circle cx={C} cy={C} r={7} className="lc-pin" />
    </svg>
  )
}
