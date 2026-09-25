import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { cssToTailwind, tailwindToCss, type TwVersion } from './convert'

const SAMPLE_CSS = `.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  max-width: 28rem;
  transition: box-shadow 0.2s;
}
.card:hover {
  border-color: #3b82f6;
}
@media (min-width: 768px) {
  .card { flex-direction: row; padding: 13px; }
}`

const SAMPLE_TW = 'flex items-center justify-between gap-4 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 md:px-8 w-[calc(100%-2rem)] -mt-2'

export default function CssTailwind() {
  const [mode, setMode] = useState<'css2tw' | 'tw2css'>('css2tw')
  const [version, setVersion] = useState<TwVersion>(4)
  const [css, setCss] = useState(SAMPLE_CSS)
  const [tw, setTw] = useState(SAMPLE_TW)
  const [selector, setSelector] = useState('.element')
  const [arbitraryProps, setArbitraryProps] = useState(false)

  const forward = useMemo(() => {
    try {
      return { ok: true as const, rules: cssToTailwind(css, version) }
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
    }
  }, [css, version])

  const reverse = useMemo(() => tailwindToCss(tw, selector.trim() || '.element', version), [tw, selector, version])

  return (
    <div>
      <PillRow>
        <button type="button" className={`btn ${mode === 'css2tw' ? 'primary' : ''}`} onClick={() => setMode('css2tw')}>CSS → Tailwind</button>
        <button type="button" className={`btn ${mode === 'tw2css' ? 'primary' : ''}`} onClick={() => setMode('tw2css')}>Tailwind → CSS</button>
        <select value={version} onChange={(e) => setVersion(Number(e.target.value) as TwVersion)} style={{ width: 'auto' }} aria-label="Tailwind version">
          <option value={4}>Tailwind v4</option>
          <option value={3}>Tailwind v3</option>
        </select>
      </PillRow>

      {mode === 'css2tw' ? (
        <>
          <label htmlFor="ct-css">CSS (rules or bare declarations)</label>
          <textarea id="ct-css" value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} style={{ minHeight: 220 }} />
          <label style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={arbitraryProps} onChange={(e) => setArbitraryProps(e.target.checked)} /> Also emit leftovers as arbitrary properties, e.g. <code>[transform:rotate(3deg)]</code>
          </label>
          {!forward.ok && <p className="error">{forward.error}</p>}
          {forward.ok && forward.rules.length === 0 && <p className="muted">Paste some CSS to convert.</p>}
          {forward.ok &&
            forward.rules.map((r) => {
              const extra = arbitraryProps
                ? r.unconverted.map(({ variant, decl }) => `${variant}[${decl.prop}:${decl.value.trim().replace(/\s*,\s*/g, ',').replace(/\s+/g, '_')}]`)
                : []
              const classes = [...r.classes, ...extra].join(' ')
              return (
                <div key={r.selector || '(declarations)'} style={{ marginTop: 16 }}>
                  <label>{r.selector || 'Classes'}</label>
                  <div className="row" style={{ margin: 0, flexWrap: 'nowrap', alignItems: 'stretch' }}>
                    <div className="output tw-chips" style={{ flex: 1, minWidth: 0, wordBreak: 'normal', overflowWrap: 'anywhere' }}>
                      {classes ? classes.split(' ').map((c, i) => <span key={c} className="tw-chip" style={{ animationDelay: `${Math.min(i, 40) * 12}ms` }}>{c}</span>) : <span className="muted">No classes</span>}
                    </div>
                    <CopyButton text={classes} />
                  </div>
                  {r.notes.map((n) => <p key={n} className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }}>{n}.</p>)}
                  {r.unconverted.length > 0 && !arbitraryProps && (
                    <div style={{ marginTop: 6, fontSize: '0.86rem' }}>
                      <span className="error">Not converted ({r.unconverted.length}):</span>{' '}
                      <code style={{ fontFamily: 'var(--mono)', overflowWrap: 'anywhere' }}>
                        {r.unconverted.map(({ variant, decl }) => `${variant}${decl.prop}: ${decl.value}`).join('; ')}
                      </code>
                    </div>
                  )}
                </div>
              )
            })}
        </>
      ) : (
        <>
          <label htmlFor="ct-tw">Tailwind classes</label>
          <textarea id="ct-tw" value={tw} onChange={(e) => setTw(e.target.value)} spellCheck={false} style={{ minHeight: 110 }} />
          <label htmlFor="ct-sel">Selector</label>
          <input id="ct-sel" type="text" value={selector} onChange={(e) => setSelector(e.target.value)} spellCheck={false} />
          {reverse.unknown.length > 0 && (
            <p style={{ fontSize: '0.9rem' }}>
              <span className="error">Not converted:</span> <code style={{ fontFamily: 'var(--mono)', overflowWrap: 'anywhere' }}>{reverse.unknown.join(' ')}</code>
              {reverse.unsupportedVariants.length > 0 && <span className="muted"> (variants like {reverse.unsupportedVariants.join(', ')} need parent/peer context)</span>}
            </p>
          )}
          <label htmlFor="ct-out">CSS</label>
          <SettleOutput id="ct-out" value={reverse.css} motion="order" style={{ minHeight: 220 }} />
          <div className="row">
            <CopyButton text={reverse.css} />
          </div>
        </>
      )}
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Covers the common core utilities (layout, flex/grid, spacing, sizing, typography, colours, borders, radius, shadows, opacity, z-index and more)
        using the default theme. Custom theme values, plugins and every edge case are not covered. Named colours use the v3 hex palette; v4 ships
        OKLCH versions that look nearly identical.
      </p>
    </div>
  )
}
