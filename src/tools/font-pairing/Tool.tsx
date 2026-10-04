import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { MOODS, PAIRS, cssFor, filterPairs, stackFor, type Pair } from './pairs'

const HEADING_SAMPLE = 'Design is thinking made visual'
const BODY_SAMPLE =
  'Typography is the craft of arranging type so that written language becomes readable and inviting. A good pairing sets the tone before a single word is understood.'

export default function FontPairing() {
  const [mood, setMood] = useState('All')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Pair>(PAIRS[0])

  const results = useMemo(() => filterPairs(PAIRS, mood, query), [mood, query])
  const shown = results.includes(selected) ? selected : results[0]
  const code = shown ? cssFor(shown) : '/* no pairings match */'

  return (
    <div>
      <PillRow label="Mood" role="group">
        {['All', ...MOODS].map((m) => (
          <button key={m} type="button" aria-pressed={mood === m} className={mood === m ? 'btn primary' : 'btn'} onClick={() => setMood(m)}>
            {m}
          </button>
        ))}
      </PillRow>

      <label htmlFor="fp-search">Search fonts</label>
      <input id="fp-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Playfair, mono, editorial…" />

      {results.length === 0 ? (
        <p className="error">No pairings match “{query}”. Try another font or mood.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginTop: 16 }}>
          {results.map((pair) => {
            const on = shown === pair
            return (
              <button
                key={`${pair.heading}-${pair.body}`}
                type="button"
                aria-pressed={on}
                className={on ? 'btn primary' : 'btn'}
                style={{ textAlign: 'left', padding: '10px 12px' }}
                onClick={() => setSelected(pair)}
              >
                <span style={{ display: 'block', fontFamily: stackFor(pair.heading), fontSize: '1.05rem', fontWeight: 700 }}>{pair.heading}</span>
                <span style={{ display: 'block', opacity: 0.85, fontFamily: stackFor(pair.body), fontSize: '0.85rem' }}>{pair.body}</span>
                <span style={{ display: 'block', fontSize: '0.72rem', opacity: 0.7, marginTop: 2 }}>{pair.mood}</span>
              </button>
            )
          })}
        </div>
      )}

      {shown && (
        <>
          <h3 className="eyebrow" style={{ marginTop: 24 }}>Specimen</h3>
          <div className="output" style={{ padding: 20, background: 'var(--surface)', wordBreak: 'normal' }}>
            <p style={{ margin: 0, fontFamily: stackFor(shown.heading), fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 700, lineHeight: 1.1 }}>{HEADING_SAMPLE}</p>
            <p style={{ margin: '14px 0 0', fontFamily: stackFor(shown.body), fontSize: '1rem', lineHeight: 1.6 }}>{BODY_SAMPLE}</p>
            <p className="muted" style={{ margin: '16px 0 0', fontSize: '0.82rem' }}>{shown.note}</p>
          </div>

          <SettleOutput value={code} aria-label="Font pairing CSS" rows={4} style={{ marginTop: 14 }} />
          <div className="row">
            <CopyButton text={code} />
          </div>
        </>
      )}

      <p className="muted">
        Each pair names two well-known font families with sensible fallbacks, so a preview still reads well before the fonts are installed.
        Copy the custom properties and set them on <code>:root</code>, then use <code>font-family: var(--font-heading)</code> on headings and
        <code> font-family: var(--font-body)</code> on body text. Nothing is fetched from the network.
      </p>
    </div>
  )
}
