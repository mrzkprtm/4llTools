import { PALETTE } from '../../sim/theme'

const C = 160
const R_IN = 104
const R_OUT = 156

const pt = (r: number, deg: number): [number, number] => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)]
const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function arc(r0: number, r1: number, a0: number, a1: number) {
  if (a1 - a0 >= 359.99) return `M ${C - r1} ${C} a ${r1} ${r1} 0 1 0 ${2 * r1} 0 a ${r1} ${r1} 0 1 0 ${-2 * r1} 0 Z`
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = pt(r1, a0)
  const [x1, y1] = pt(r1, a1)
  const [x2, y2] = pt(r0, a1)
  const [x3, y3] = pt(r0, a0)
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${large} 0 ${x3} ${y3} Z`
}

/**
 * A paper-style chore wheel: chores sit in fixed slots on the outer ring and
 * the inner disc of people turns one slot per week.
 */
export default function Wheel({ people, chores, rotation, spinning }: { people: string[]; chores: string[]; rotation: number; spinning: boolean }) {
  const P = Math.max(1, people.length)
  const step = 360 / P
  const slots = Array.from({ length: P }, (_, s) => chores.filter((_, c) => c % P === s))

  return (
    <svg className="cr-wheel" viewBox="0 0 320 320" role="img" aria-label="Chore wheel">
      <g className="cr-outer">
        {slots.map((list, s) => {
          const a = s * step - 90
          const [lx, ly] = pt((R_IN + R_OUT) / 2 + 4, a)
          return (
            <g key={s}>
              <path d={arc(R_IN + 2, R_OUT, a - step / 2, a + step / 2)} className="cr-slot" />
              <text x={lx} y={ly - ((list.length - 1) * 11) / 2} textAnchor="middle" dominantBaseline="middle" className="cr-chore">
                {list.slice(0, 3).map((c, i) => (
                  <tspan key={i} x={lx} dy={i ? 11 : 0}>
                    {short(c, P > 4 ? 9 : 14)}
                  </tspan>
                ))}
                {list.length > 3 && <tspan x={lx} dy={11}>+{list.length - 3}</tspan>}
              </text>
            </g>
          )
        })}
      </g>
      <g className={`cr-disc ${spinning ? 'spin' : ''}`} style={{ transform: `rotate(${rotation}deg)` }}>
        {people.map((p, i) => {
          const a = i * step - 90
          const [tx, ty] = pt(R_IN * 0.6, a)
          return (
            <g key={i}>
              <path d={arc(0, R_IN, a - step / 2, a + step / 2)} fill={PALETTE[i % PALETTE.length]} className="cr-seg" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" className="cr-person" transform={`rotate(${P > 1 ? a + (a > 90 && a < 270 ? 180 : 0) : 0} ${tx} ${ty})`}>
                {short(p, P > 6 ? 7 : 10)}
              </text>
            </g>
          )
        })}
        <circle cx={C} cy={C} r={18} className="cr-hub" />
      </g>
      {slots.map((_, s) => {
        const a = s * step - 90
        const [x0, y0] = pt(R_IN - 9, a)
        const [x1, y1] = pt(R_IN + 7, a - 4)
        const [x2, y2] = pt(R_IN + 7, a + 4)
        return <path key={s} d={`M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z`} className="cr-pointer" />
      })}
    </svg>
  )
}
