import { applyDeadzone, type Vec } from './logic'

export interface Snapshot {
  index: number
  id: string
  mapping: string
  axes: number[]
  buttons: { pressed: boolean; value: number }[]
  timestamp: number
  rumble: boolean
}

const v = (p: Snapshot, i: number) => p.buttons[i]?.value ?? 0
const on = (p: Snapshot, i: number) => p.buttons[i]?.pressed ?? false
const fill = (p: Snapshot, i: number) => (on(p, i) || v(p, i) > 0.05 ? 'var(--accent)' : 'var(--surface)')
const ax = (p: Snapshot, i: number) => p.axes[i] ?? 0

function Btn({ p, i, x, y, r = 12, label }: { p: Snapshot; i: number; x: number; y: number; r?: number; label?: string }) {
  return (
    <g className={`gp-btn ${on(p, i) ? 'on' : ''}`}>
      <circle cx={x} cy={y} r={r} fill={fill(p, i)} stroke="var(--text)" strokeWidth={1.5} />
      {label && <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={on(p, i) ? '#fff' : 'var(--text)'}>{label}</text>}
    </g>
  )
}

function Stick({ p, x, y, axX, axY, btn }: { p: Snapshot; x: number; y: number; axX: number; axY: number; btn: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={30} fill="var(--sunken)" stroke="var(--text)" strokeWidth={1.5} />
      <circle cx={x + ax(p, axX) * 15} cy={y + ax(p, axY) * 15} r={19} fill={on(p, btn) ? 'var(--accent)' : 'var(--surface)'} stroke="var(--text)" strokeWidth={2} />
    </g>
  )
}

function Trigger({ p, i, x }: { p: Snapshot; i: number; x: number }) {
  const val = v(p, i)
  return (
    <g>
      <rect x={x} y={6} width={60} height={28} rx={8} fill="var(--sunken)" stroke="var(--text)" strokeWidth={1.5} />
      <rect x={x + 2} y={8 + 24 * (1 - val)} width={56} height={24 * val} rx={6} fill="var(--accent)" />
      <text x={x + 30} y={25} textAnchor="middle" fontSize={11} fontFamily="var(--mono)" fill="var(--text)">{Math.round(val * 100)}%</text>
    </g>
  )
}

/** A generic controller drawing for the standard mapping. */
export function PadSvg({ p }: { p: Snapshot }) {
  return (
    <svg viewBox="0 0 440 270" className="gp-svg" role="img" aria-label="Controller diagram showing live input">
      <Trigger p={p} i={6} x={78} />
      <Trigger p={p} i={7} x={302} />
      <rect x={72} y={40} width={80} height={14} rx={7} fill={fill(p, 4)} stroke="var(--text)" strokeWidth={1.5} />
      <rect x={288} y={40} width={80} height={14} rx={7} fill={fill(p, 5)} stroke="var(--text)" strokeWidth={1.5} />
      <path d="M110 58 H330 C380 58 408 88 418 138 L434 214 C441 250 408 268 383 248 L338 204 H102 L57 248 C32 268 -1 250 6 214 L22 138 C32 88 60 58 110 58 Z" fill="var(--surface)" stroke="var(--text)" strokeWidth={2} />
      <Stick p={p} x={112} y={120} axX={0} axY={1} btn={10} />
      <Stick p={p} x={272} y={190} axX={2} axY={3} btn={11} />
      <g>
        <rect x={158} y={160} width={22} height={22} rx={4} fill={fill(p, 12)} stroke="var(--text)" strokeWidth={1.5} />
        <rect x={158} y={204} width={22} height={22} rx={4} fill={fill(p, 13)} stroke="var(--text)" strokeWidth={1.5} />
        <rect x={136} y={182} width={22} height={22} rx={4} fill={fill(p, 14)} stroke="var(--text)" strokeWidth={1.5} />
        <rect x={180} y={182} width={22} height={22} rx={4} fill={fill(p, 15)} stroke="var(--text)" strokeWidth={1.5} />
      </g>
      <Btn p={p} i={3} x={328} y={96} label="Y" />
      <Btn p={p} i={1} x={354} y={120} label="B" />
      <Btn p={p} i={0} x={328} y={144} label="A" />
      <Btn p={p} i={2} x={302} y={120} label="X" />
      <Btn p={p} i={8} x={192} y={110} r={8} />
      <Btn p={p} i={9} x={248} y={110} r={8} />
      <Btn p={p} i={16} x={220} y={142} r={11} />
    </svg>
  )
}

/** One stick's position with its recent trail and the deadzone ring. */
export function StickView({ label, pos, trail, deadzone }: { label: string; pos: Vec; trail: readonly Vec[]; deadzone: number }) {
  const S = 60
  const dz = applyDeadzone(pos, deadzone)
  return (
    <figure className="gp-stick">
      <svg viewBox="-70 -70 140 140" role="img" aria-label={`${label}: x ${pos.x.toFixed(2)}, y ${pos.y.toFixed(2)}`}>
        <circle r={S} fill="var(--sunken)" stroke="var(--border)" />
        <line x1={-S} x2={S} stroke="var(--border)" />
        <line y1={-S} y2={S} stroke="var(--border)" />
        <circle r={deadzone * S} fill="color-mix(in srgb, var(--danger) 15%, transparent)" stroke="var(--danger)" strokeDasharray="3 3" />
        {trail.map((t, i) => <circle key={i} cx={t.x * S} cy={t.y * S} r={2.5} fill="var(--accent)" opacity={(i + 1) / trail.length / 2} />)}
        <circle cx={pos.x * S} cy={pos.y * S} r={7} fill="var(--accent)" />
        <circle cx={dz.x * S} cy={dz.y * S} r={4} fill="none" stroke="var(--text)" strokeWidth={1.5} />
      </svg>
      <figcaption>
        <b>{label}</b>
        <span className="gp-mono">x {pos.x.toFixed(3)} · y {pos.y.toFixed(3)}</span>
      </figcaption>
    </figure>
  )
}
