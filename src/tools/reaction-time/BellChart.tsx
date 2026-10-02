import { normalPdf, stats, TYPICAL, type Mode } from './reaction'

const W = 360
const H = 150
const PAD = 22
const MIN = 100
const MAX = 600
const BIN = 25

const x = (ms: number) => PAD + ((Math.min(MAX, Math.max(MIN, ms)) - MIN) / (MAX - MIN)) * (W - 2 * PAD)

/** Your results as a histogram over the typical population curve. */
export default function BellChart({ results, mode }: { results: number[]; mode: Mode }) {
  const { mean, sd } = TYPICAL[mode]
  const peak = normalPdf(mean, mean, sd)
  const base = H - 22
  const top = 14
  const y = (v: number) => base - (v / peak) * (base - top)
  let d = ''
  for (let ms = MIN; ms <= MAX; ms += 5) d += `${d ? 'L' : 'M'}${x(ms).toFixed(1)},${y(normalPdf(ms, mean, sd)).toFixed(1)}`
  const bins = new Map<number, number>()
  for (const r of results) {
    const b = Math.floor(Math.min(MAX - 1, Math.max(MIN, r)) / BIN) * BIN
    bins.set(b, (bins.get(b) ?? 0) + 1)
  }
  const maxBin = Math.max(1, ...bins.values())
  const s = stats(results)
  return (
    <figure className="rt-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Typical reaction times peak near ${mean} ms${s.count ? `; your average is ${Math.round(s.mean)} ms` : ''}`}>
        <path d={`${d} L${x(MAX)},${base} L${x(MIN)},${base} Z`} className="rt-bell-fill" />
        <path d={d} className="rt-bell" />
        {[...bins].map(([b, n]) => {
          const h = (n / maxBin) * (base - top) * 0.8
          return <rect key={b} x={x(b) + 1} y={base - h} width={x(b + BIN) - x(b) - 2} height={h} rx="2" className="rt-bin" />
        })}
        {s.count > 0 && (
          <g className="rt-avg" style={{ transform: `translateX(${x(s.mean)}px)` }}>
            <line x1="0" x2="0" y1={top - 4} y2={base} />
            <text y={top - 5} textAnchor="middle">you {Math.round(s.mean)}</text>
          </g>
        )}
        <line x1={PAD} x2={W - PAD} y1={base} y2={base} className="rt-axis" />
        {[100, 200, 300, 400, 500, 600].map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="rt-tick">{t}</text>
        ))}
      </svg>
      <figcaption className="muted">Bars: your attempts. Curve: typical {mode === 'simple' ? 'simple' : 'choice'} reaction times (approx. mean {mean} ms, sd {sd} ms), in milliseconds.</figcaption>
    </figure>
  )
}
