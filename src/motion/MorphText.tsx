/**
 * Text where each character that changes flips in like a split-flap tile.
 * Characters are keyed by position and value, so only changed ones re-mount
 * and replay the flip. Past `limit` characters the rest renders as plain text.
 */
export default function MorphText({ text, limit = 400, stagger = 4 }: { text: string; limit?: number; stagger?: number }) {
  const head = [...text.slice(0, limit)]
  return (
    <>
      {head.map((ch, i) =>
        ch === ' ' || ch === '\n' ? (
          ch
        ) : (
          <span key={`${i}:${ch}`} className="flip-in" style={{ animationDelay: `${Math.min(i * stagger, 240)}ms` }}>
            {ch}
          </span>
        ),
      )}
      {text.slice(limit)}
    </>
  )
}
