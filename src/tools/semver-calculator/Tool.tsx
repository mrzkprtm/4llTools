import { useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import MorphText from '../../motion/MorphText'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { checkRange, compareVersions, explainRange, nextVersions, parseVersion, sortVersions } from './semver-logic'

const mono = { fontFamily: 'var(--mono)' }

export default function SemverCalculator() {
  return (
    <div>
      <BumpSection />
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '28px 0 8px' }} />
      <CompareSection />
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '28px 0 8px' }} />
      <RangeSection />
      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '28px 0 8px' }} />
      <SortSection />
    </div>
  )
}

function BumpSection() {
  const [version, setVersion] = useState('1.4.2')
  const [preid, setPreid] = useState('beta')
  const parsed = parseVersion(version)

  return (
    <section>
      <h3 style={{ margin: '8px 0 0' }}>Parse & bump a version</h3>
      <div className="row">
        <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} aria-label="Version" placeholder="1.4.2" spellCheck={false} style={{ ...mono, flex: '2 1 160px', minWidth: 0 }} />
        <select value={['alpha', 'beta', 'rc'].includes(preid) ? preid : 'custom'} onChange={(e) => e.target.value !== 'custom' && setPreid(e.target.value)} aria-label="Pre-release id" style={{ flex: '0 0 auto' }}>
          <option value="alpha">alpha</option>
          <option value="beta">beta</option>
          <option value="rc">rc</option>
          <option value="custom">custom…</option>
        </select>
        <input type="text" value={preid} onChange={(e) => setPreid(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))} aria-label="Pre-release id text" placeholder="preid" style={{ ...mono, flex: '1 1 80px', minWidth: 0 }} />
      </div>
      {!parsed && version.trim() && <p className="error">Not a valid semantic version. Use MAJOR.MINOR.PATCH, like 1.4.2 or 2.0.0-rc.1.</p>}
      {parsed && (
        <>
          <div className="stats">
            <div className="stat"><b><Roll>{parsed.major}</Roll></b>Major</div>
            <div className="stat"><b><Roll>{parsed.minor}</Roll></b>Minor</div>
            <div className="stat"><b><Roll>{parsed.patch}</Roll></b>Patch</div>
            <div className="stat"><b style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>{parsed.prerelease.length ? parsed.prerelease.join('.') : '—'}</b>Pre-release</div>
            <div className="stat"><b style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>{parsed.build.length ? parsed.build.join('.') : '—'}</b>Build metadata</div>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table className="simple">
              <thead><tr><th>Bump</th><th>Next version</th><th>Use it when</th></tr></thead>
              <tbody>
                {nextVersions(version, preid).map((n) => (
                  <tr key={n.kind}>
                    <td style={mono}>{n.kind}</td>
                    <td style={{ ...mono, whiteSpace: 'nowrap' }}><b><MorphText text={n.next ?? '—'} stagger={6} /></b></td>
                    <td className="muted" style={{ minWidth: 180 }}>{n.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.build.length > 0 && <p className="muted">Build metadata (after +) is ignored when comparing and dropped when bumping.</p>}
        </>
      )}
    </section>
  )
}

function CompareSection() {
  const [a, setA] = useState('1.9.0')
  const [b, setB] = useState('1.10.0-rc.1')
  const cmp = compareVersions(a, b)

  return (
    <section>
      <h3 style={{ margin: '8px 0 0' }}>Compare two versions</h3>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" value={a} onChange={(e) => setA(e.target.value)} aria-label="Version A" spellCheck={false} style={{ ...mono, flex: 1, minWidth: 0 }} />
        <b key={cmp?.symbol ?? '?'} className="pop" style={{ fontSize: '1.4rem', width: 28, textAlign: 'center', flex: 'none', color: 'var(--accent)' }} aria-live="polite">{cmp?.symbol ?? '?'}</b>
        <input type="text" value={b} onChange={(e) => setB(e.target.value)} aria-label="Version B" spellCheck={false} style={{ ...mono, flex: 1, minWidth: 0 }} />
        <button type="button" className="btn" onClick={() => { setA(b); setB(a) }} aria-label="Swap versions" style={{ flex: 'none' }}>⇄</button>
      </div>
      {!cmp && <p className="error">Enter two valid versions like 1.2.3.</p>}
      {cmp && (
        <p style={{ margin: '4px 0' }}>
          {cmp.order === 0 ? (
            <>Both versions are <b>equal</b> in precedence.</>
          ) : (
            <>
              <b style={mono}>{cmp.newer}</b> is newer. The difference is a <b>{cmp.diff}</b> change.
            </>
          )}
        </p>
      )}
    </section>
  )
}

const DEFAULT_TESTS = '1.2.2\n1.2.3\n1.2.9\n1.3.0\n1.9.9\n2.0.0\n2.0.0-beta.1\n1.5.0-rc.1'

function RangeSection() {
  const [range, setRange] = useState('^1.2.3')
  const [tests, setTests] = useState(DEFAULT_TESTS)
  const [pre, setPre] = useState(false)
  const list = tests.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
  const result = checkRange(range, list, pre)
  const notes = explainRange(range)

  return (
    <section>
      <h3 style={{ margin: '8px 0 0' }}>Range checker</h3>
      <div className="row">
        <input type="text" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range" spellCheck={false} style={{ ...mono, flex: '1 1 160px', minWidth: 0 }} />
        {['^1.2.3', '~1.2', '>=1 <2', '1.x', '^0.2.3'].map((r) => (
          <button key={r} type="button" className="btn" onClick={() => setRange(r)} style={mono}>{r}</button>
        ))}
      </div>
      <label style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={pre} onChange={(e) => setPre(e.target.checked)} /> Include pre-releases
      </label>
      {!result.ok && <p className="error">{result.error}</p>}
      {result.ok && (
        <p className="muted" style={{ margin: '6px 0' }}>
          Means: <span style={{ ...mono, color: 'var(--text)' }}>{result.normalized}</span>
        </p>
      )}
      {notes.map((n) => <p key={n} className="muted" style={{ margin: '4px 0' }}>{n}</p>)}
      <details style={{ margin: '8px 0' }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>What do ^ and ~ mean?</summary>
        <ul className="muted" style={{ paddingLeft: 20 }}>
          <li><b>^1.2.3</b> (caret) accepts new features and fixes, but not breaking changes: &gt;=1.2.3 &lt;2.0.0. This is npm's default when you run <span style={mono}>npm install</span>.</li>
          <li><b>~1.2.3</b> (tilde) accepts only fixes: &gt;=1.2.3 &lt;1.3.0.</li>
          <li>For 0.x versions, ^ is stricter because the minor number counts as breaking: ^0.2.3 means &gt;=0.2.3 &lt;0.3.0.</li>
          <li>Pre-releases like 1.5.0-rc.1 only match if the range names the same major.minor.patch, unless you include pre-releases.</li>
        </ul>
      </details>
      <label htmlFor="sem-tests">Test versions (one per line)</label>
      <div className="two-col">
        <textarea id="sem-tests" value={tests} onChange={(e) => setTests(e.target.value)} spellCheck={false} style={{ ...mono, minHeight: 160 }} />
        {result.ok && (
          <div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, ...mono, fontSize: '0.9rem' }}>
              {result.results.map((r, i) => (
                <li key={`${i}:${r.version}:${r.satisfies}`} className="settle-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms`, padding: '3px 0', color: !r.valid ? 'var(--muted)' : r.satisfies ? 'var(--ok)' : 'var(--danger)' }}>
                  {!r.valid ? '?' : r.satisfies ? '✓' : '✗'} {r.version}{!r.valid && ' (invalid)'}
                </li>
              ))}
            </ul>
            <p style={{ marginBottom: 0 }}>
              Highest match: <b style={mono}>{result.max ?? 'none'}</b>
              <br />
              Lowest match: <b style={mono}>{result.min ?? 'none'}</b>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function SortSection() {
  const [list, setList] = useState('1.10.0\n1.2.0\n2.0.0-rc.1\n1.2.0-beta.2\n0.9.12\n2.0.0\n1.2.0-alpha')
  const [desc, setDesc] = useState(false)
  const { sorted, invalid } = sortVersions(list, desc)
  const out = sorted.join('\n')
  const listRef = useRef<HTMLOListElement>(null)
  useFlip(listRef)

  return (
    <section>
      <h3 style={{ margin: '8px 0 0' }}>Sort versions</h3>
      <div className="two-col" style={{ marginTop: 10 }}>
        <textarea value={list} onChange={(e) => setList(e.target.value)} aria-label="Versions to sort" spellCheck={false} style={{ ...mono, minHeight: 160 }} />
        <div>
          <ol ref={listRef} className="output sorted-list" style={{ minHeight: 60, overflowX: 'auto' }}>
            {sorted.map((v, i) => <li key={`${v}:${sorted.indexOf(v) === i ? 0 : i}`} data-flip={`${v}:${sorted.indexOf(v) === i ? 0 : i}`}>{v}</li>)}
          </ol>
          <div className="row">
            <label style={{ fontWeight: 400 }}><input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} /> Newest first</label>
            <CopyButton text={out} />
          </div>
          {invalid.length > 0 && <p className="error">Skipped invalid: {invalid.join(', ')}</p>}
        </div>
      </div>
    </section>
  )
}
