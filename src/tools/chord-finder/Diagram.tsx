import type { Voicing } from './logic'

const SX = 34
const X0 = 40
const Y0 = 50
const FY = 44
const FRETS = 5

/** An SVG chord box. Each string keeps one dot element, so dots glide between chords. */
export default function Diagram({ v, capo, name }: { v: Voicing; capo: number; name: string }) {
  const fretted = v.frets.filter((f) => f > 0)
  const max = Math.max(0, ...fretted)
  const start = max <= FRETS ? 1 : Math.min(...fretted)
  const y = (f: number) => Y0 + (f - start + 0.5) * FY
  const desc = v.frets.map((f, i) => `string ${6 - i}: ${f < 0 ? 'muted' : f === 0 ? 'open' : `fret ${f + capo}`}`).join(', ')
  return (
    <svg viewBox="0 0 250 290" className="cf-diagram" role="img" aria-label={`${name} chord diagram. ${desc}`}>
      {start === 1 ? <rect x={X0 - 2} y={Y0 - 7} width={SX * 5 + 4} height={7} rx={2} className={capo ? 'cf-capo' : 'cf-nut'} /> : <text x={X0 - 12} y={y(start) + 5} textAnchor="end" className="cf-fretno">{start + capo}fr</text>}
      {Array.from({ length: FRETS + 1 }, (_, i) => <line key={`f${i}`} x1={X0} x2={X0 + SX * 5} y1={Y0 + i * FY} y2={Y0 + i * FY} className="cf-fret" />)}
      {Array.from({ length: 6 }, (_, i) => <line key={`s${i}`} x1={X0 + i * SX} x2={X0 + i * SX} y1={Y0} y2={Y0 + FRETS * FY} className="cf-string" style={{ strokeWidth: 2.4 - i * 0.3 }} />)}
      {[3, 5, 7, 9].filter((f) => f >= start && f < start + FRETS).map((f) => <circle key={f} cx={X0 + SX * 2.5} cy={y(f)} r={4} className="cf-inlay" />)}
      {v.barre && (
        <rect
          className="cf-barre"
          x={X0 + v.barre.from * SX - 13}
          y={y(v.barre.fret) - 13}
          width={(v.barre.to - v.barre.from) * SX + 26}
          height={26}
          rx={13}
        />
      )}
      {v.frets.map((f, i) => {
        const x = X0 + i * SX
        const hidden = f <= 0 || (v.barre && f === v.barre.fret && i > v.barre.from && i <= v.barre.to && v.fingers[i] === 1)
        return (
          <g key={i}>
            <g className="cf-dot" style={{ transform: `translate(${x}px, ${f > 0 ? y(f) : Y0 - 24}px)`, opacity: hidden ? 0 : 1, transitionDelay: `${i * 30}ms` }}>
              <circle r={13} />
              <text y={5} textAnchor="middle">{v.fingers[i] || ''}</text>
            </g>
            {f === 0 && <circle cx={x} cy={Y0 - 22} r={8} className="cf-open pop" />}
            {f < 0 && <text x={x} y={Y0 - 16} textAnchor="middle" className="cf-mute pop">×</text>}
          </g>
        )
      })}
    </svg>
  )
}
