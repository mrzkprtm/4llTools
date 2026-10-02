import type { KeySignature } from './logic'

// Treble-staff positions in steps above E4 (bottom line), in writing order.
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4]
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1]
const BOTTOM = 62
const STEP = 5

/** A treble staff showing the key signature; accidentals pop in one by one. */
export default function Staff({ sig }: { sig: KeySignature }) {
  const steps = sig.type === 'sharp' ? SHARP_STEPS : FLAT_STEPS
  return (
    <svg viewBox="0 0 220 84" className="co-staff" role="img" aria-label={sig.count ? `${sig.count} ${sig.type}s: ${sig.letters.join(', ')}` : 'No sharps or flats'}>
      {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={6} x2={214} y1={BOTTOM - i * 10} y2={BOTTOM - i * 10} className="co-staff-line" />)}
      <text x={10} y={BOTTOM + 8} className="co-clef">𝄞</text>
      <g key={`${sig.type}${sig.count}`}>
        {sig.letters.map((l, i) => (
          <text
            key={l}
            x={62 + i * 20}
            y={BOTTOM - steps[i] * STEP + (sig.type === 'sharp' ? 6 : 4)}
            className="co-acc"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {sig.type === 'sharp' ? '♯' : '♭'}
          </text>
        ))}
      </g>
    </svg>
  )
}
