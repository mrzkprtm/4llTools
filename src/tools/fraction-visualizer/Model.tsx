import { useRef, type PointerEvent } from 'react'

export type Kind = 'pie' | 'bar'

interface Props {
  /** Pieces per whole. */
  d: number
  /** How many wholes to draw. */
  wholes: number
  /** Fill for piece i (counted across wholes), or null for an empty piece. */
  color: (i: number) => string | null
  kind: Kind
  label: string
  /** Pieces for which this returns true fade out (used for subtraction). */
  fading?: (i: number) => boolean
  /** Called when a piece is pressed ('down') or dragged over ('over'). */
  onPiece?: (i: number, how: 'down' | 'over') => void
  small?: boolean
}

const R = 54
const C = 60

function slicePath(k: number, d: number) {
  if (d === 1) return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
  const a0 = (k / d) * Math.PI * 2
  const a1 = ((k + 1) / d) * Math.PI * 2
  const p = (a: number) => `${(C + R * Math.sin(a)).toFixed(2)} ${(C - R * Math.cos(a)).toFixed(2)}`
  return `M ${C} ${C} L ${p(a0)} A ${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`
}

/**
 * Pie or bar models of a fraction. Keyed by the denominator, so a new
 * denominator redraws the cut lines, which animate in as a re-cut.
 */
export default function Model({ d, wholes, color, kind, label, fading, onPiece, small }: Props) {
  const drag = useRef(false)
  const last = useRef(-1)
  const pieceAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<SVGElement>('[data-i]')
    return el ? Number(el.dataset.i) : -1
  }
  const handlers = onPiece
    ? {
        onPointerDown: (e: PointerEvent) => {
          const i = pieceAt(e.clientX, e.clientY)
          if (i < 0) return
          drag.current = true
          last.current = i
          onPiece(i, 'down')
        },
        onPointerMove: (e: PointerEvent) => {
          if (!drag.current) return
          const i = pieceAt(e.clientX, e.clientY)
          if (i >= 0 && i !== last.current) {
            last.current = i
            onPiece(i, 'over')
          }
        },
        onPointerUp: () => (drag.current = false),
        onPointerCancel: () => (drag.current = false),
        onPointerLeave: () => (drag.current = false),
      }
    : {}

  return (
    <div className={`fv-model fv-${kind} ${small ? 'fv-small' : ''} ${onPiece ? 'fv-edit' : ''}`} role="img" aria-label={label} {...handlers}>
      {Array.from({ length: Math.max(1, wholes) }, (_, w) =>
        kind === 'pie' ? (
          <svg key={`${w}-${d}`} viewBox="0 0 120 120">
            {Array.from({ length: d }, (_, k) => {
              const i = w * d + k
              const fill = color(i)
              return <path key={k} data-i={i} d={slicePath(k, d)} className={`fv-piece ${fill ? 'on' : ''} ${fading?.(i) ? 'out' : ''}`} style={{ fill: fill ?? undefined, animationDelay: `${k * 25}ms` }} />
            })}
            {d > 1 &&
              Array.from({ length: d }, (_, k) => {
                const a = (k / d) * Math.PI * 2
                return <path key={`c${k}`} className="fv-cut" pathLength={1} d={`M ${C} ${C} L ${C + R * Math.sin(a)} ${C - R * Math.cos(a)}`} style={{ animationDelay: `${k * 30}ms` }} />
              })}
            <circle cx={C} cy={C} r={R} className="fv-rim" />
          </svg>
        ) : (
          <svg key={`${w}-${d}`} viewBox="0 0 240 40">
            {Array.from({ length: d }, (_, k) => {
              const i = w * d + k
              const fill = color(i)
              const pw = 236 / d
              return <rect key={k} data-i={i} x={2 + k * pw} y={2} width={pw} height={36} className={`fv-piece ${fill ? 'on' : ''} ${fading?.(i) ? 'out' : ''}`} style={{ fill: fill ?? undefined, animationDelay: `${k * 25}ms` }} />
            })}
            {Array.from({ length: d - 1 }, (_, k) => {
              const x = 2 + ((k + 1) * 236) / d
              return <path key={`c${k}`} className="fv-cut" pathLength={1} d={`M ${x} 2 L ${x} 38`} style={{ animationDelay: `${k * 30}ms` }} />
            })}
            <rect x={2} y={2} width={236} height={36} rx={3} className="fv-rim" />
          </svg>
        ),
      )}
    </div>
  )
}
