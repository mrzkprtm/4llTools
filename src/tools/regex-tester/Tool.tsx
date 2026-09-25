import { useState, type ReactNode } from 'react'
import Roll from '../../motion/Roll'
import { findMatches } from './regex'

const FLAGS = [
  ['g', 'global'],
  ['i', 'ignore case'],
  ['m', 'multiline'],
  ['s', 'dot matches newline'],
  ['u', 'unicode'],
] as const

export default function RegexTester() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b')
  const [flags, setFlags] = useState('g')
  const [text, setText] = useState('Email me at hello@example.com or admin@test.org')
  const result = pattern ? findMatches(pattern, flags, text) : null

  const highlighted: ReactNode[] = []
  if (result?.ok) {
    let last = 0
    result.matches.forEach((m, i) => {
      if (!m.text) return
      highlighted.push(text.slice(last, m.index), <mark key={`${m.index}:${m.text}`} style={{ animationDelay: `${Math.min(i, 30) * 10}ms` }}>{m.text}</mark>)
      last = m.index + m.text.length
    })
    highlighted.push(text.slice(last))
  }

  return (
    <div>
      <label htmlFor="re-pattern">Pattern</label>
      <div className="row" style={{ marginTop: 0, flexWrap: 'nowrap' }}>
        <span className="muted">/</span>
        <input id="re-pattern" type="text" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} style={{ fontFamily: 'ui-monospace, monospace' }} />
        <span className="muted">/{flags}</span>
      </div>
      <div className="row">
        {FLAGS.map(([f, label]) => (
          <label key={f} style={{ fontWeight: 400, margin: 0 }}>
            <input type="checkbox" checked={flags.includes(f)} onChange={(e) => setFlags(e.target.checked ? flags + f : flags.replace(f, ''))} /> {f} <span className="muted">({label})</span>
          </label>
        ))}
      </div>
      <label htmlFor="re-text">Test text</label>
      <textarea id="re-text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {result && !result.ok && <p className="error">{result.error}</p>}
      {result?.ok && (
        <>
          <label>
            <Roll>{result.matches.length}</Roll> match{result.matches.length === 1 ? '' : 'es'}
          </label>
          <div className="output" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', wordBreak: 'break-word' }}>{highlighted}</div>
          {result.matches.some((m) => m.groups.length > 0) && (
            <table className="simple" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>#</th><th>Match</th>{result.matches[0].groups.map((_, i) => <th key={i}>Group {i + 1}</th>)}</tr>
              </thead>
              <tbody>
                {result.matches.slice(0, 100).map((m, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{m.text}</td>{m.groups.map((g, j) => <td key={j}>{g ?? '—'}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
