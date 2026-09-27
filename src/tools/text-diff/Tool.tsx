import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

type DiffMode = 'char' | 'word' | 'line'
type ViewMode = 'unified' | 'split'

export default function TextDiff() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [diffMode, setDiffMode] = useState<DiffMode>('line')
  const [viewMode, setViewMode] = useState<ViewMode>('unified')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true)
  const [caseSensitive, setCaseSensitive] = useState(false)

  const normalize = (text: string) => {
    let t = text
    if (!caseSensitive) t = t.toLowerCase()
    if (ignoreWhitespace) t = t.replace(/\s+/g, ' ').trim()
    return t
  }

  const diff = useMemo(() => {
    const leftNorm = normalize(left)
    const rightNorm = normalize(right)

    if (diffMode === 'char') {
      return diffChars(leftNorm, rightNorm)
    } else if (diffMode === 'word') {
      return diffWords(leftNorm, rightNorm)
    } else {
      return diffLines(leftNorm, rightNorm)
    }
  }, [left, right, diffMode, ignoreWhitespace, caseSensitive])

  const diffChars = (a: string, b: string) => {
    const result: { value: string; added?: boolean; removed?: boolean }[] = []
    let i = 0, j = 0
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        result.push({ value: a[i] })
        i++; j++
      } else if (j < b.length && (i >= a.length || a[i] !== b[j])) {
        // Check if this char exists later in a
        const nextMatch = a.indexOf(b[j], i)
        if (nextMatch !== -1 && nextMatch - i < 5) {
          // Add removed chars
          while (i < nextMatch) {
            result.push({ value: a[i], removed: true })
            i++
          }
        } else {
          result.push({ value: b[j], added: true })
          j++
        }
      } else if (i < a.length) {
        result.push({ value: a[i], removed: true })
        i++
      }
    }
    return result
  }

  const diffWords = (a: string, b: string) => {
    const aWords = a.split(/(\s+)/).filter(w => w.length > 0)
    const bWords = b.split(/(\s+)/).filter(w => w.length > 0)
    return diffArrays(aWords, bWords)
  }

  const diffLines = (a: string, b: string) => {
    const aLines = a.split('\n')
    const bLines = b.split('\n')
    return diffArrays(aLines, bLines)
  }

  const diffArrays = (a: string[], b: string[]) => {
    const result: { value: string; added?: boolean; removed?: boolean }[] = []
    let i = 0, j = 0
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        result.push({ value: a[i] })
        i++; j++
      } else if (j < b.length && (i >= a.length || a[i] !== b[j])) {
        const nextMatch = a.indexOf(b[j], i)
        if (nextMatch !== -1 && nextMatch - i < 3) {
          while (i < nextMatch) {
            result.push({ value: a[i], removed: true })
            i++
          }
        } else {
          result.push({ value: b[j], added: true })
          j++
        }
      } else if (i < a.length) {
        result.push({ value: a[i], removed: true })
        i++
      }
    }
    return result
  }

  const stats = useMemo(() => {
    let added = 0, removed = 0, unchanged = 0
    diff.forEach(d => {
      if (d.added) added += d.value.length
      else if (d.removed) removed += d.value.length
      else unchanged += d.value.length
    })
    return { added, removed, unchanged, total: diff.length }
  }, [diff])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Text Diff</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>Diff Level</span>
          <select value={diffMode} onChange={e => setDiffMode(e.target.value as any)}>
            <option value="char">Character</option>
            <option value="word">Word</option>
            <option value="line">Line</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>View Mode</span>
          <select value={viewMode} onChange={e => setViewMode(e.target.value as any)}>
            <option value="unified">Unified</option>
            <option value="split">Split View</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={ignoreWhitespace} onChange={e => setIgnoreWhitespace(e.target.checked)} />
          <span>Ignore Whitespace</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
          <span>Case Sensitive</span>
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={stats.added} /></b><span className="muted">Added</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={stats.removed} /></b><span className="muted">Removed</span></div>
        <div className="stat"><b><Roll value={stats.unchanged} /></b><span className="muted">Unchanged</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div>
          <h4 style={{ marginBottom: 8 }}>Left (Original)</h4>
          <textarea
            value={left}
            onChange={e => setLeft(e.target.value)}
            rows={20}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.85rem', resize: 'vertical' }}
          />
        </div>

        <div>
          <h4 style={{ marginBottom: 8 }}>Right (Modified)</h4>
          <textarea
            value={right}
            onChange={e => setRight(e.target.value)}
            rows={20}
            style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.85rem', resize: 'vertical' }}
          />
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Diff Result ({viewMode})</h4>
        {viewMode === 'unified' ? (
          <div style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.6, maxHeight: 400, overflow: 'auto' }}>
            {diff.map((d, i) => (
              <div key={i} style={{
                display: 'flex', padding: '2px 8px',
                background: d.added ? 'var(--ok)15' : d.removed ? 'var(--danger)15' : 'transparent',
                borderLeft: d.added ? '3px solid var(--ok)' : d.removed ? '3px solid var(--danger)' : '3px solid transparent',
                paddingLeft: 12,
              }}>
                <span style={{ color: d.added ? 'var(--ok)' : d.removed ? 'var(--danger)' : 'var(--muted)', fontFamily: 'var(--mono)', minWidth: 24 }}>
                  {d.added ? '+' : d.removed ? '-' : ' '}
                </span>
                <span style={{ 
                  color: d.added ? 'var(--ok)' : d.removed ? 'var(--danger)' : 'var(--text)',
                  textDecoration: d.removed ? 'line-through' : 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <h4 style={{ marginBottom: 8, color: 'var(--danger)' }}>Removed</h4>
              {diff.filter(d => d.removed).map((d, i) => (
                <div key={i} style={{ padding: '4px 8px', background: 'var(--danger)15', borderLeft: '3px solid var(--danger)', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {d.value}
                </div>
              ))}
            </div>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <h4 style={{ marginBottom: 8, color: 'var(--ok)' }}>Added</h4>
              {diff.filter(d => d.added).map((d, i) => (
                <div key={i} style={{ padding: '4px 8px', background: 'var(--ok)15', borderLeft: '3px solid var(--ok)', marginBottom: 4, fontFamily: 'var(--mono)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {d.value}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Compare two texts at character, word, or line level. Unified or split view. Ignore whitespace and case options available.
      </p>
    </div>
  )
}