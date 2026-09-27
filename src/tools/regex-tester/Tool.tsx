import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const

export default function RegexTester() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b')
  const [flags, setFlags] = useState<string[]>(['g'])
  const [testString, setTestString] = useState('Contact us at support@example.com or sales@company.org')
  const [replacement, setReplacement] = useState('$&')
  const [showMatches, setShowMatches] = useState(true)
  const [showGroups, setShowGroups] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const regex = useMemo(() => {
    try {
      return new RegExp(pattern, flags.join(''))
    } catch {
      return null
    }
  }, [pattern, flags])

  const matches = useMemo(() => {
    if (!regex) return []
    const matches: { match: string; index: number; groups: string[] }[] = []
    let match
    const regexCopy = new RegExp(pattern, flags.join(''))
    while ((match = regexCopy.exec(testString)) !== null) {
      matches.push({
        match: match[0],
        index: match.index,
        groups: match.slice(1)
      })
      if (!flags.includes('g')) break
    }
    return matches
  }, [regex, testString])

  const replaced = useMemo(() => {
    if (!regex) return testString
    try {
      return testString.replace(new RegExp(pattern, flags.join('')), replacement)
    } catch {
      return 'Error in replacement'
    }
  }, [regex, testString, replacement])

  const explainPattern = useMemo(() => {
    if (!pattern) return []
    const parts: string[] = []
    let i = 0
    while (i < pattern.length) {
      const char = pattern[i]
      if (char === '\\' && i + 1 < pattern.length) {
        parts.push(`\\${pattern[i + 1]}`)
        i += 2
        continue
      }
      if (char === '[') {
        let j = i + 1
        while (j < pattern.length && pattern[j] !== ']') j++
        parts.push(pattern.slice(i, j + 1))
        i = j + 1
        continue
      }
      if (char === '(') {
        let depth = 1
        let j = i + 1
        while (j < pattern.length && depth > 0) {
          if (pattern[j] === '(') depth++
          else if (pattern[j] === ')') depth--
          j++
        }
        parts.push(pattern.slice(i, j))
        i = j
        continue
      }
      if ('*+?{}'.includes(char)) {
        parts.push(char)
        i++
        continue
      }
      if ('^$|'.includes(char)) {
        parts.push(char)
        i++
        continue
      }
      parts.push(char)
      i++
    }
    return parts
  }, [pattern])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Regex Tester</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          {['g', 'i', 'm', 's', 'u', 'y'].map(flag => (
            <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '4px 8px', background: flags.includes(flag) ? 'var(--accent)20' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }} >
              <input type="checkbox" checked={flags.includes(flag)} onChange={e => setFlags(e.target.checked ? [...flags, flag] : flags.filter(f => f !== flag))} />
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>/{flag}</span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setPattern('')}>Clear</button>
          <button className="btn" onClick={() => setPattern('\\b\\w+@\\w+\\.\\w+\\b')}>Email</button>
          <button className="btn" onClick={() => setPattern('https?://[^\\s]+')}>URL</button>
          <button className="btn" onClick={() => setPattern('\\d{4}-\\d{2}-\\d{2}')}>Date (YYYY-MM-DD)</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Pattern</span>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: error ? 'var(--danger)20' : 'var(--ok)20', color: error ? 'var(--danger)' : 'var(--ok)' }}>
                {error ? 'Invalid' : 'Valid'}
              </span>
            </div>
            <input
              type="text"
              value={pattern}
              onChange={e => { setPattern(e.target.value); try { new RegExp(e.target.value, flags.join('')); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Invalid regex') }}}
              style={{ width: '100%', background: error ? 'var(--danger)10' : 'var(--bg)', border: error ? '2px solid var(--danger)' : '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: '1rem' }}
            />
            {error && <span className="muted" style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
          </label>
        </div>

        <div style={{ flex: 1, minWidth: 300 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Test String</span>
            <textarea
              value={testString}
              onChange={e => setTestString(e.target.value)}
              rows={4}
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Matches (<b>{matches.length}</b>)
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={showMatches} onChange={e => setShowMatches(e.target.checked)} />
              <span>Highlight</span>
            </label>
          </h4>

          {showMatches && testString && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', lineHeight: 1.6, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}>
              {(() => {
                const parts: React.ReactElement[] = []
                let lastIndex = 0
                matches.forEach((m, i) => {
                  if (m.index > lastIndex) {
                    parts.push(<span key={`text-${i}`}>{testString.slice(lastIndex, m.index)}</span>)
                  }
                  parts.push(
                    <mark key={`match-${i}`} style={{ background: i % 2 === 0 ? 'var(--accent)20' : 'var(--ok)20', padding: '2px 4px', borderRadius: 2 }}>
                      {m.match}
                    </mark>
                  )
                  lastIndex = m.index + m.match.length
                })
                if (lastIndex < testString.length) {
                  parts.push(<span key="end">{testString.slice(lastIndex)}</span>)
                }
                return parts
              })()}
            </div>
          )}

          {!matches.length && testString && (
            <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No matches found</p>
          )}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Replacement
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={showGroups} onChange={e => setShowGroups(e.target.checked)} />
              <span>Show Groups</span>
            </label>
          </h4>

          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" value={replacement} onChange={e => setReplacement(e.target.value)} placeholder="Replacement (use $1, $2, $&, etc.)" style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)' }} />
              <button className="btn" onClick={() => navigator.clipboard.writeText(replaced)}>Copy Result</button>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', lineHeight: 1.6, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}>
              {replaced}
            </div>

            {showGroups && matches.length > 0 && matches[0].groups.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h5 style={{ margin: '0 0 8px' }}>Capture Groups (first match)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {matches[0].groups.map((group, i) => (
                    <div key={i} style={{ padding: 8, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                      <div className="muted" style={{ fontSize: '0.7rem' }}>$${i + 1}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{group || '(empty)'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
          <h4 style={{ margin: '0 0 12px' }}>Pattern Explanation</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {explainPattern.map((part, i) => (
              <span key={i} style={{
                padding: '2px 6px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: '0.8rem',
                background: i % 2 === 0 ? 'var(--accent)20' : 'var(--ok)20',
                color: i % 2 === 0 ? 'var(--accent)' : 'var(--ok)'
              }}>
                {part}
              </span>
            ))}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
          <h4 style={{ margin: '0 0 12px' }}>Quick Reference</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: '0.8rem' }}>
            <div><kbd>.</kbd> Any character (except newline)</div>
            <div><kbd>\d</kbd> Digit [0-9]</div>
            <div><kbd>\w</kbd> Word char [a-zA-Z0-9_]</div>
            <div><kbd>\s</kbd> Whitespace</div>
            <div><kbd>^</kbd> Start of string/line</div>
            <div><kbd>$</kbd> End of string/line</div>
            <div><kbd>*</kbd> 0 or more</div>
            <div><kbd>+</kbd> 1 or more</div>
            <div><kbd>?</kbd> 0 or 1</div>
            <div><kbd>{n,m}</kbd> n to m times</div>
            <div><kbd>[abc]</kbd> Character class</div>
            <div><kbd>[^abc]</kbd> Negated class</div>
            <div><kbd>(abc)</kbd> Capture group</div>
            <div><kbd>(?:abc)</kbd> Non-capture group</div>
            <div><kbd>a|b</kbd> Alternation</div>
            <div><kbd>\b</kbd> Word boundary</div>
            <div><kbd>\B</kbd> Non-word boundary</div>
            <div><kbd>\n</kbd> Newline</div>
            <div><kbd>\t</kbd> Tab</div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Test regex patterns with live highlighting. Supports capture groups, replacement, and all JS flags. Pattern explanation included.
        </p>
      </div>
    </div>
  )
}