import type { MeasureKey } from './sizes'

/** Where to measure: a simple body or foot outline with an animated tape at the active spot. */
export default function Guide({ active, foot }: { active: MeasureKey | null; foot: boolean }) {
  if (foot) {
    return (
      <svg viewBox="0 0 160 240" className="cz-guide" role="img" aria-label="Measure your foot from the back of the heel to the tip of the longest toe">
        <rect x="18" y="12" width="124" height="220" rx="6" className="cz-paper" />
        <path d="M80 214c-22 0-34-16-34-44 0-30-8-58-6-88 2-34 18-58 44-58 24 0 38 20 38 52 0 34-8 62-6 92 2 30-12 46-36 46z" className="cz-body" />
        {[[66, 32, 9], [84, 26, 8], [99, 30, 7], [111, 38, 6], [119, 49, 5]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} className="cz-body" />)}
        <line x1="26" x2="134" y1="214" y2="214" className="cz-wall" />
        <g className={`cz-tape ${active === 'foot' ? 'on' : ''}`}>
          <line x1="140" x2="140" y1="214" y2="20" className="cz-tape-line" />
          <path d="M132 214h16M132 20h16" className="cz-tape-end" />
          <text x="146" y="120" className="cz-tape-text" transform="rotate(-90 146 120)">heel → longest toe</text>
        </g>
      </svg>
    )
  }
  const spots: Record<'chest' | 'waist' | 'hip' | 'height', number> = { chest: 88, waist: 122, hip: 150, height: 0 }
  return (
    <svg viewBox="0 0 160 260" className="cz-guide" role="img" aria-label={active ? `Measure your ${active} around the fullest part, keeping the tape level` : 'Body measuring guide'}>
      <circle cx="80" cy="34" r="20" className="cz-body" />
      <path d="M68 52h24l4 10c18 4 30 10 32 22l6 70c1 8-10 9-11 1l-8-60-3 40c8 14 10 30 8 46l-6 64h-14l-6-60-6 60h-14l-6-64c-2-16 0-32 8-46l-3-40-8 60c-1 8-12 7-11-1l6-70c2-12 14-18 32-22z" className="cz-body" />
      {(['chest', 'waist', 'hip'] as const).map((k) => (
        <g key={k} className={`cz-tape ${active === k ? 'on' : ''}`}>
          <ellipse cx="80" cy={spots[k]} rx={k === 'waist' ? 26 : k === 'hip' ? 34 : 32} ry="6" className="cz-tape-ring" />
          <text x="122" y={spots[k] + 3} className="cz-tape-text">{k === 'chest' ? 'chest' : k}</text>
        </g>
      ))}
      <g className={`cz-tape ${active === 'height' ? 'on' : ''}`}>
        <line x1="20" x2="20" y1="12" y2="252" className="cz-tape-line" />
        <path d="M14 12h12M14 252h12" className="cz-tape-end" />
      </g>
    </svg>
  )
}
