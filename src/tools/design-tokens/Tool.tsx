import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { DEFAULT_TOKENS, slugToken, toCss, toJson, toTailwind, type Token, type TokenGroup } from './tokens'

type Format = 'css' | 'tailwind' | 'json'

const FORMAT_META: Record<Format, { label: string; file: string; type: string }> = {
  css: { label: 'CSS', file: 'tokens.css', type: 'text/css' },
  tailwind: { label: 'Tailwind', file: 'tailwind.tokens.js', type: 'text/javascript' },
  json: { label: 'JSON', file: 'tokens.json', type: 'application/json' },
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function DesignTokens() {
  const [groups, setGroups] = useState<TokenGroup[]>(() => DEFAULT_TOKENS.map((g) => ({ ...g, tokens: g.tokens.map((t) => ({ ...t })) })))
  const [format, setFormat] = useState<Format>('css')
  const [saved, setSaved] = useState(false)

  const update = (gi: number, ti: number, patch: Partial<Token>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, tokens: g.tokens.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : g)))

  const addToken = (gi: number) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, tokens: [...g.tokens, { name: 'New token', value: g.kind === 'color' ? '#000000' : '0px' }] } : g)))

  const removeToken = (gi: number, ti: number) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, tokens: g.tokens.filter((_, j) => j !== ti) } : g)))

  const code = format === 'css' ? toCss(groups) : format === 'tailwind' ? toTailwind(groups) : toJson(groups)
  const meta = FORMAT_META[format]

  return (
    <div>
      {groups.map((group, gi) => (
        <section key={group.kind} style={{ marginTop: gi === 0 ? 0 : 18 }}>
          <h3 className="eyebrow">{group.label}</h3>
          {group.tokens.map((token, ti) => (
            <div key={ti} className="row" style={{ margin: '6px 0' }}>
              <label htmlFor={`tk-${group.kind}-${ti}`} style={{ margin: 0, position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Token name {ti + 1}</label>
              <input id={`tk-${group.kind}-${ti}`} type="text" value={token.name} onChange={(e) => update(gi, ti, { name: e.target.value })} placeholder="name" spellCheck={false} style={{ flex: '1 1 120px', minWidth: 0 }} />
              {group.kind === 'color' && (
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(token.value) ? token.value : '#000000'} onChange={(e) => update(gi, ti, { value: e.target.value })} style={{ width: 44, height: 40, padding: 0, border: 'none', background: 'none', flex: 'none' }} aria-label={`${token.name} color`} />
              )}
              <input type="text" value={token.value} onChange={(e) => update(gi, ti, { value: e.target.value })} placeholder="value" spellCheck={false} aria-label={`${token.name} value`} style={{ flex: '1 1 120px', minWidth: 0 }} />
              <button type="button" className="btn" onClick={() => removeToken(gi, ti)} disabled={group.tokens.length <= 1} aria-label={`Remove ${token.name}`}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-icon" onClick={() => addToken(gi)}>
            <Icon name="plus" size={16} /> Add {group.label.toLowerCase()} token
          </button>
        </section>
      ))}

      <h3 className="eyebrow" style={{ marginTop: 24 }}>Preview</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {groups.flatMap((group) =>
          group.tokens.map((token, ti) => (
            <li key={`${group.kind}-${ti}`} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
              {group.kind === 'color' ? (
                <span aria-hidden="true" style={{ width: 26, height: 26, flex: 'none', borderRadius: 6, border: '1px solid var(--border)', background: token.value }} />
              ) : (
                <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', flex: '0 0 26px' }}>{group.kind.slice(0, 2)}</span>
              )}
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>{group.kind}-{slugToken(token.name)}</span>
              <span className="muted" style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.78rem', textAlign: 'right', wordBreak: 'break-all' }}>{token.value}</span>
            </li>
          )),
        )}
      </ul>

      <PillRow label="Export format">
        {(['css', 'tailwind', 'json'] as Format[]).map((f) => (
          <button key={f} type="button" aria-pressed={format === f} className={format === f ? 'btn primary' : 'btn'} onClick={() => setFormat(f)}>{FORMAT_META[f].label}</button>
        ))}
      </PillRow>

      <SettleOutput value={code} aria-label={`${meta.label} output`} rows={format === 'json' ? 18 : 14} />
      <div className="row">
        <CopyButton text={code} />
        <button
          type="button"
          className={`btn btn-icon ${saved ? 'is-done' : ''}`}
          onClick={() => {
            saveBlob(new Blob([code], { type: meta.type }), meta.file)
            setSaved(true)
            window.setTimeout(() => setSaved(false), 2000)
          }}
        >
          <Icon name="arrow-down" size={16} />
          {saved ? 'Saved!' : `Download ${meta.file}`}
        </button>
      </div>
      <p className="muted">
        Edit the names and values, then export. The CSS form writes custom properties into <code>:root</code>, the Tailwind form is a
        <code> theme.extend</code> block, and the JSON form is a grouped object for a token pipeline. Names are slugged, so “Primary Brand”
        becomes <code>--color-primary-brand</code>.
      </p>
    </div>
  )
}
