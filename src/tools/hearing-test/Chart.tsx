import { FREQS, fmtHz, MAX_DB, MIN_DB } from './logic'

export type Ear = 'L' | 'R'
export type Results = Record<Ear, Partial<Record<number, number | null>>>

const W = 360
const H = 230
const PAD = { l: 40, r: 14, t: 16, b: 30 }
const x = (f: number) => PAD.l + (Math.log2(f / 250) / Math.log2(16000 / 250)) * (W - PAD.l - PAD.r)
const y = (db: number) => PAD.t + ((db - MIN_DB) / (MAX_DB - MIN_DB)) * (H - PAD.t - PAD.b)
const COLOR: Record<Ear, string> = { R: '#e03131', L: '#1c7ed6' }

/** Audiogram: quieter thresholds plot higher up, like a clinical chart. Not heard → marked at the bottom. */
export function Audiogram({ results, current }: { results: Results; current?: { ear: Ear; freq: number } | null }) {
  const series = (ear: Ear) =>
    FREQS.filter((f) => f in results[ear]).map((f) => {
      const v = results[ear][f]
      return { f, v, px: x(f), py: y(v ?? MAX_DB) }
    })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ht-chart" role="img" aria-label="Audiogram of relative thresholds per ear">
      {[-90, -75, -60, -45, -30, -15, 0].map((db) => (
        <g key={db}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(db)} y2={y(db)} className="ht-grid" />
          <text x={PAD.l - 6} y={y(db) + 4} textAnchor="end" className="ht-tick">{db}</text>
        </g>
      ))}
      {FREQS.map((f) => (
        <g key={f}>
          <line x1={x(f)} x2={x(f)} y1={PAD.t} y2={H - PAD.b} className={`ht-grid ${current?.freq === f ? 'ht-now' : ''}`} />
          <text x={x(f)} y={H - PAD.b + 16} textAnchor="middle" className="ht-tick">{fmtHz(f)}</text>
        </g>
      ))}
      <text x={PAD.l} y={10} className="ht-tick">better ↑ (dB rel.)</text>
      {(['R', 'L'] as const).map((ear) => {
        const pts = series(ear)
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px} ${p.py}`).join(' ')
        return (
          <g key={ear}>
            {pts.length > 1 && <path key={d} d={d} pathLength={1} className="ht-line" stroke={COLOR[ear]} />}
            {pts.map((p) =>
              ear === 'R' ? (
                <circle key={p.f} cx={p.px} cy={p.py} r={6} className="ht-pt" stroke={COLOR.R} opacity={p.v === null ? 0.4 : 1} />
              ) : (
                <path key={p.f} d={`M${p.px - 5} ${p.py - 5} L${p.px + 5} ${p.py + 5} M${p.px + 5} ${p.py - 5} L${p.px - 5} ${p.py + 5}`} className="ht-pt" stroke={COLOR.L} opacity={p.v === null ? 0.4 : 1} />
              ),
            )}
          </g>
        )
      })}
    </svg>
  )
}

export const EAR_NAME: Record<Ear, string> = { L: 'Left', R: 'Right' }
export const EAR_COLOR = COLOR
