import { useState, type ReactNode } from 'react'
import CopyButton from '../../components/CopyButton'
import { CACHEABLE, CLASSES, classOf, describeUnknown, findCode, searchCodes, type StatusCode } from './codes'
import { normalizeUrl, probe, type ProbeResult } from './probe'

const TONE: Record<string, string> = { '1': 'var(--muted)', '2': 'var(--ok)', '3': 'var(--accent)', '4': '#c2410c', '5': 'var(--danger)' }

function Pill({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, padding: '1px 7px', borderRadius: 99, border: `1px solid ${color ?? 'var(--border-strong)'}`, color: color ?? 'var(--muted)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function CodeCard({ c, open, onToggle }: { c: StatusCode; open: boolean; onToggle: () => void }) {
  const color = TONE[classOf(c.code)]
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: open ? 'var(--sunken)' : 'var(--surface)', transition: 'background-color .15s' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'baseline', padding: '10px 12px' }}>
        <b style={{ fontFamily: 'var(--mono)', fontSize: '1.15rem', color, minWidth: 40 }}>{c.code}</b>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{c.name}</span>{' '}
          {c.unofficial && <Pill color="#b45309">unofficial</Pill>} {c.deprecated && <Pill>deprecated</Pill>}
          <span className="muted" style={{ display: 'block', fontSize: '0.88rem' }}>{c.desc}</span>
        </span>
        <span aria-hidden className="muted" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 12px 64px', fontSize: '0.92rem' }}>
          <p style={{ margin: '4px 0' }}><b>When to use:</b> {c.when}</p>
          {c.fixes && <p style={{ margin: '4px 0' }}><b>{c.code >= 400 ? 'Common causes & fixes:' : 'Notes:'}</b> {c.fixes}</p>}
          {c.headers && (
            <p style={{ margin: '4px 0' }}>
              <b>Related headers:</b>{' '}
              {c.headers.map((h) => <code key={h} style={{ fontFamily: 'var(--mono)', fontSize: '0.84rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '0 5px', marginRight: 4, display: 'inline-block', marginBottom: 2 }}>{h}</code>)}
            </p>
          )}
          <p className="muted" style={{ margin: '4px 0', fontSize: '0.85rem' }}>
            {CLASSES[classOf(c.code)]} · {c.unofficial ? `Unofficial: ${c.unofficial}` : c.spec} · {CACHEABLE.has(c.code) ? 'Cacheable by default' : 'Not cacheable by default'}
          </p>
          <div className="row" style={{ margin: '6px 0 0' }}><CopyButton label="Copy summary" text={`${c.code} ${c.name}\n${c.desc}\nWhen: ${c.when}${c.fixes ? `\nFixes: ${c.fixes}` : ''}`} /></div>
        </div>
      )}
    </div>
  )
}

export default function HttpStatusCodes() {
  const [query, setQuery] = useState('')
  const [cls, setCls] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set([404]))
  const [url, setUrl] = useState('https://httpbin.org/status/418')
  const [method, setMethod] = useState<'GET' | 'HEAD'>('GET')
  const [follow, setFollow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ProbeResult | null>(null)
  const [urlError, setUrlError] = useState('')

  const results = searchCodes(query, cls)
  const exact = /^\d{3}$/.test(query.trim()) ? Number(query.trim()) : null
  const unknown = exact !== null && !findCode(exact) ? describeUnknown(exact) : ''

  function toggle(code: number) {
    const next = new Set(open)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    setOpen(next)
  }

  async function run() {
    const u = normalizeUrl(url)
    if (!u) { setUrlError('Enter a valid http(s) URL.'); return }
    setUrlError('')
    setBusy(true)
    setResult(null)
    try {
      setResult(await probe(u, method, follow))
    } finally {
      setBusy(false)
    }
  }

  const found = result?.kind === 'response' ? findCode(result.status) : undefined

  return (
    <div>
      <label htmlFor="hsc-q">Search by code, name or keyword</label>
      <input id="hsc-q" type="text" value={query} onChange={(e) => { setQuery(e.target.value); const n = Number(e.target.value.trim()); if (/^\d{3}$/.test(e.target.value.trim())) setOpen(new Set([n])) }} placeholder="e.g. 404, redirect, rate limit, cloudflare, 5xx" />
      <div className="row">
        <button type="button" className={`btn ${cls === null ? 'primary' : ''}`} onClick={() => setCls(null)}>All</button>
        {Object.entries(CLASSES).map(([k, v]) => (
          <button key={k} type="button" className={`btn ${cls === k ? 'primary' : ''}`} onClick={() => setCls(cls === k ? null : k)}>
            <span style={{ fontFamily: 'var(--mono)' }}>{k}xx</span> <span style={{ fontWeight: 400 }}>{v}</span>
          </button>
        ))}
      </div>
      {unknown && <p className="muted">{unknown}</p>}
      <p className="muted" style={{ fontSize: '0.85rem', margin: '4px 0 8px' }}>{results.length} code{results.length === 1 ? '' : 's'}</p>
      <div style={{ display: 'grid', gap: 6 }}>
        {results.map((c) => <CodeCard key={c.code} c={c} open={open.has(c.code)} onToggle={() => toggle(c.code)} />)}
        {results.length === 0 && !unknown && <p className="muted">No codes match.</p>}
      </div>

      <h3 style={{ marginTop: 32, marginBottom: 4 }}>Test a URL</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
        Sends a real request from your browser. Most sites do not allow other websites to read their responses (CORS), so many URLs will show as blocked even though they work. For any URL, <code>curl -sI URL</code> in a terminal shows the true status.
      </p>
      <div className="row">
        <select value={method} onChange={(e) => setMethod(e.target.value as 'GET' | 'HEAD')} style={{ width: 'auto' }} aria-label="Method">
          <option>GET</option>
          <option>HEAD</option>
        </select>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} style={{ flex: 1, minWidth: 200 }} aria-label="URL to test" />
        <button type="button" className="btn primary" onClick={run} disabled={busy}>{busy ? 'Testing…' : 'Send'}</button>
      </div>
      <label style={{ fontWeight: 400, marginTop: 0 }}>
        <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow redirects (fetch follows them automatically, so you see the final status)
      </label>
      {urlError && <p className="error">{urlError}</p>}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <div className="output" style={{ flex: 1, minWidth: 0 }}>curl -sI {normalizeUrl(url) ?? url}</div>
        <CopyButton text={`curl -sI ${normalizeUrl(url) ?? url}`} />
      </div>

      {result && (
        <div className="output" style={{ fontFamily: 'var(--font)', wordBreak: 'normal', marginTop: 8 }}>
          {result.kind === 'response' && (
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: '1.4rem', fontWeight: 700, color: TONE[classOf(result.status)] }}>
                {result.status} {found?.name ?? result.statusText}
              </div>
              <div className="muted" style={{ fontSize: '0.88rem' }}>
                {Math.round(result.ms)} ms{result.redirected ? ` · redirected to ${result.finalUrl}` : ''}
              </div>
              {found && <p style={{ margin: '8px 0 0' }}>{found.desc}</p>}
            </>
          )}
          {result.kind === 'opaque-redirect' && (
            <p style={{ margin: 0 }}><b>3xx redirect</b> ({Math.round(result.ms)} ms). The server answered with a redirect; browsers hide the exact code and Location header from scripts. Run the curl command above to see them.</p>
          )}
          {result.kind === 'blocked' && (
            <p style={{ margin: 0 }}>
              <b className="error">Could not read the response</b> ({Math.round(result.ms)} ms). {result.message}{' '}
              {result.reachable === true && 'The server did respond (a no-cors request succeeded), so it most likely does not allow this site to read responses (no CORS headers). The status code is hidden from the browser.'}
              {result.reachable === false && 'A second, no-cors request also failed, so the host is probably unreachable, the DNS name is wrong, the TLS certificate is invalid, or an http:// URL was blocked on this https page.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
