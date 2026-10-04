import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { DEFAULT_OPTIONS, PRESETS, cleanStats, cleanText, type CleanOptions } from './clean'

const GROUPS: { title: string; keys: (keyof CleanOptions)[] }[] = [
  { title: 'Whitespace', keys: ['trimLines', 'removeEmptyLines', 'singleSpaces', 'bullets'] },
  { title: 'Characters', keys: ['smartQuotes', 'dashes', 'removeEmojis', 'removeNonAscii', 'removeNumbers', 'removePunctuation'] },
  { title: 'Lines', keys: ['dedupeLines', 'sortLines', 'uppercase', 'lowercase'] },
]

const LABELS: Record<keyof CleanOptions, string> = {
  trimLines: 'Trim line edges',
  removeEmptyLines: 'Collapse blank lines',
  singleSpaces: 'Collapse double spaces',
  bullets: 'Strip bullet characters',
  smartQuotes: 'Straighten smart quotes',
  dashes: 'Convert dashes & ellipses',
  removeEmojis: 'Remove emoji',
  removeNonAscii: 'Keep ASCII only',
  removeNumbers: 'Remove digits',
  removePunctuation: 'Remove punctuation',
  dedupeLines: 'Remove duplicate lines',
  sortLines: 'Sort lines A–Z',
  uppercase: 'ALL CAPS',
  lowercase: 'all lowercase',
}

export default function Tool() {
  const [input, setInput] = useState('')
  const [options, setOptions] = useState<CleanOptions>({ ...DEFAULT_OPTIONS })
  const [copied, setCopied] = useState(false)

  const output = useMemo(() => cleanText(input, options), [input, options])
  const stats = useMemo(() => cleanStats(input, output), [input, output])

  const set = (key: keyof CleanOptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setOptions((o) => ({ ...o, [key]: e.target.checked }))

  function downloadTxt() {
    const blob = new Blob([output], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'cleaned-text.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="two-col">
      <div>
        <label htmlFor="tc-in" style={{ marginTop: 0 }}>Messy text</label>
        <textarea
          id="tc-in"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'Paste text copied from a PDF, chat or doc…\n\n\n\n  \u201CIt keeps   weird\u201D \u2014 spacing… \u{1F602}'}
          style={{ minHeight: 220 }}
        />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: '0.84rem' }}>
            <Roll>{input.length}</Roll> chars · <Roll>{input ? input.split('\n').length : 0}</Roll> lines
          </span>
          {input && (
            <button type="button" className="btn btn-icon" onClick={() => setInput('')}>
              <Icon name="close" size={14} /> Clear
            </button>
          )}
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="btn"
              style={{ fontSize: '0.84rem', padding: '6px 11px' }}
              onClick={() => setOptions({ ...p.options })}
            >
              {p.name}
            </button>
          ))}
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginTop: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{g.title}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '4px 12px' }}>
              {g.keys.map((key) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: '0.88rem', margin: 0 }}>
                  <input type="checkbox" checked={options[key]} onChange={set(key)} />
                  {LABELS[key]}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label style={{ marginTop: 0 }}>Clean result</label>
        <textarea readOnly value={output} placeholder="Cleaned text appears here as you type…" style={{ minHeight: 220, background: 'var(--surface)' }} />
        <div className="stats">
          <div className="stat">
            Characters
            <b>
              <Roll>{stats.charsAfter}</Roll>
            </b>
          </div>
          <div className="stat">
            Lines
            <b>
              <Roll>{stats.linesAfter}</Roll>
            </b>
          </div>
          <div className="stat">
            Removed
            <b>
              <Roll>{stats.removedPct}%</Roll>
            </b>
          </div>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <CopyButton text={output} label="Copy cleaned" />
          <button type="button" className={`btn btn-icon ${copied ? 'is-done' : ''}`} onClick={downloadTxt} disabled={!output}>
            <Icon name="save" size={16} /> {copied ? 'Saved!' : 'Download .txt'}
          </button>
        </div>
        {stats.charsBefore > 0 && stats.charsAfter < stats.charsBefore && (
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            Removed {stats.charsBefore - stats.charsAfter} of {stats.charsBefore} characters.
          </p>
        )}
      </div>
    </div>
  )
}
