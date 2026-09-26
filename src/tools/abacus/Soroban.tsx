import { useRef, type PointerEvent } from 'react'
import { tone } from '../../sim/audio'
import type { Rod } from './logic'

const RW = 46 // rod spacing
const TOP = 14
const BEAM = 96
const BOTTOM = 238
const BH = 22 // bead height
const PAD = 16

export type Highlight = Set<string> // keys like "3h" (heaven of rod 3) or "3e1" (earth bead 1 of rod 3)

function beadPath(cx: number) {
  const w = 19
  const h = BH / 2
  return `M ${cx - w} 0 Q ${cx - w + 3} ${-h} ${cx - 6} ${-h} L ${cx + 6} ${-h} Q ${cx + w - 3} ${-h} ${cx + w} 0 Q ${cx + w - 3} ${h} ${cx + 6} ${h} L ${cx - 6} ${h} Q ${cx - w + 3} ${h} ${cx - w} 0 Z`
}

/** Bead keys whose position differs between two states. */
export function changedBeads(a: readonly Rod[], b: readonly Rod[]): Highlight {
  const out: Highlight = new Set()
  a.forEach((r, i) => {
    if (r.heaven !== b[i].heaven) out.add(`${i}h`)
    for (let k = Math.min(r.earth, b[i].earth); k < Math.max(r.earth, b[i].earth); k++) out.add(`${i}e${k}`)
  })
  return out
}

interface Props {
  rods: Rod[]
  onChange: (rods: Rod[]) => void
  highlight?: Highlight
  /** Stagger each rod's motion (used when a number is set). */
  stagger?: boolean
}

/** A soroban drawn in SVG. Tap a bead or flick it toward or away from the beam. */
export default function Soroban({ rods, onChange, highlight, stagger }: Props) {
  const n = rods.length
  const W = n * RW + PAD * 2
  const drag = useRef<{ key: string; y: number } | null>(null)

  const set = (i: number, r: Rod) => {
    if (r.heaven === rods[i].heaven && r.earth === rods[i].earth) return
    tone(1500 + Math.random() * 300, 25, 'triangle', 0.04)
    onChange(rods.map((x, j) => (j === i ? r : x)))
  }
  const act = (key: string, dir: 'tap' | 'toBeam' | 'away') => {
    const i = parseInt(key)
    const r = rods[i]
    if (key.endsWith('h')) {
      const heaven = dir === 'tap' ? !r.heaven : dir === 'toBeam'
      set(i, { ...r, heaven })
    } else {
      const k = Number(key.split('e')[1])
      const earth = dir === 'tap' ? (k < r.earth ? k : k + 1) : dir === 'toBeam' ? Math.max(r.earth, k + 1) : Math.min(r.earth, k)
      set(i, { ...r, earth })
    }
  }
  const down = (key: string) => (e: PointerEvent) => {
    e.preventDefault()
    drag.current = { key, y: e.clientY }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const up = (e: PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) < 8) return act(d.key, 'tap')
    const heaven = d.key.endsWith('h')
    // Heaven beads move to the beam by going down; earth beads by going up.
    act(d.key, (heaven ? dy > 0 : dy < 0) ? 'toBeam' : 'away')
  }

  return (
    <svg className="ab-svg" viewBox={`0 0 ${W} ${BOTTOM + 40}`} role="group" aria-label="Soroban abacus">
      <rect x={2} y={2} width={W - 4} height={BOTTOM + 10} rx={10} className="ab-frame" />
      <rect x={PAD - 4} y={TOP - 4} width={W - PAD * 2 + 8} height={BOTTOM - TOP + 8} rx={4} className="ab-inner" />
      {rods.map((r, i) => {
        const cx = PAD + RW / 2 + i * RW
        const place = n - 1 - i
        const delay = stagger ? `${i * 45}ms` : '0ms'
        const hy = r.heaven ? BEAM - 4 - BH / 2 : TOP + BH / 2
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={TOP} y2={BOTTOM} className="ab-rod" />
            <g
              className={`ab-bead ab-heaven ${r.heaven ? 'on' : ''} ${highlight?.has(`${i}h`) ? 'hl' : ''}`}
              style={{ transform: `translateY(${hy}px)`, transitionDelay: delay }}
              onPointerDown={down(`${i}h`)}
              onPointerUp={up}
              role="button"
              aria-label={`${place === 0 ? 'Ones' : `Place ${place}`} five bead, ${r.heaven ? 'on' : 'off'}`}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), act(`${i}h`, 'tap'))}
            >
              <path d={beadPath(cx)} />
            </g>
            {[0, 1, 2, 3].map((k) => {
              const on = k < r.earth
              const y = on ? BEAM + 4 + BH / 2 + k * BH : BOTTOM - BH / 2 - (3 - k) * BH
              return (
                <g
                  key={k}
                  className={`ab-bead ${on ? 'on' : ''} ${highlight?.has(`${i}e${k}`) ? 'hl' : ''}`}
                  style={{ transform: `translateY(${y}px)`, transitionDelay: delay }}
                  onPointerDown={down(`${i}e${k}`)}
                  onPointerUp={up}
                  role="button"
                  aria-label={`${place === 0 ? 'Ones' : `Place ${place}`} one bead ${k + 1}, ${on ? 'on' : 'off'}`}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), act(`${i}e${k}`, 'tap'))}
                >
                  <path d={beadPath(cx)} />
                </g>
              )
            })}
            <text x={cx} y={BOTTOM + 30} className={`ab-digit ${place === 0 ? 'unit' : ''}`}>{(r.heaven ? 5 : 0) + r.earth}</text>
          </g>
        )
      })}
      <rect x={PAD - 4} y={BEAM - 4} width={W - PAD * 2 + 8} height={8} className="ab-beam" />
      {rods.map((_, i) => ((n - 1 - i) % 3 === 0 ? <circle key={`d${i}`} cx={PAD + RW / 2 + i * RW} cy={BEAM} r={2.4} className="ab-dot" /> : null))}
    </svg>
  )
}
