import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { curlCommands, parseRequestHeaders, simulateCors } from './cors'
import { parseHeaders } from './headers'
import { analyzeSecurity, type Level } from './security'

const SAMPLE = `HTTP/2 200
content-type: application/json; charset=utf-8
strict-transport-security: max-age=31536000; includeSubDomains
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.example.com; img-src * data:
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
referrer-policy: no-referrer-when-downgrade
access-control-allow-origin: https://app.example.com
access-control-allow-credentials: true
access-control-allow-methods: GET, POST, PUT
access-control-allow-headers: Content-Type, Authorization
access-control-expose-headers: X-Request-Id
x-request-id: 8f2c1a
set-cookie: session=abc123; Path=/; HttpOnly; SameSite=Lax
server: nginx/1.24.0
x-powered-by: Express`

const ICON: Record<Level, string> = { good: '✓', warn: '!', bad: '✗', info: 'i' }
const COLOR: Record<Level, string> = { good: 'var(--ok)', warn: '#b45309', bad: 'var(--danger)', info: 'var(--muted)' }

function Badge({ level }: { level: Level }) {
  return (
    <span aria-label={level} style={{ flex: 'none', display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 99, fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: COLOR[level] }}>
      {ICON[level]}
    </span>
  )
}

function Cmd({ text }: { text: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', margin: '6px 0' }}>
      <pre className="output" style={{ flex: 1, minWidth: 0, margin: 0, overflowX: 'auto', whiteSpace: 'pre', wordBreak: 'normal' }}>{text}</pre>
      <CopyButton text={text} />
    </div>
  )
}

type Tab = 'security' | 'cors' | 'live'

export default function CorsChecker() {
  const [tab, setTab] = useState<Tab>('security')
  const [raw, setRaw] = useState(SAMPLE)
  const [origin, setOrigin] = useState('https://app.example.com')
  const [url, setUrl] = useState('https://api.example.com/v1/items')
  const [method, setMethod] = useState('PUT')
  const [reqHeaders, setReqHeaders] = useState('Content-Type: application/json\nAuthorization: Bearer …')
  const [credentials, setCredentials] = useState(true)
  const [separatePreflight, setSeparatePreflight] = useState(false)
  const [preRaw, setPreRaw] = useState('access-control-allow-origin: https://app.example.com\naccess-control-allow-methods: GET, POST, PUT\naccess-control-allow-headers: content-type, authorization\naccess-control-allow-credentials: true\naccess-control-max-age: 600')

  const headers = useMemo(() => parseHeaders(raw), [raw])
  const report = useMemo(() => analyzeSecurity(headers), [headers])
  const reqList = parseRequestHeaders(reqHeaders)
  const sim = simulateCors({ origin, url, method, requestHeaders: reqList, credentials, response: headers, preflight: separatePreflight ? parseHeaders(preRaw) : undefined })
  const cmds = curlCommands(url || 'https://api.example.com/', origin, method, reqList, credentials)

  // live test
  const [liveUrl, setLiveUrl] = useState('https://api.github.com/zen')
  const [liveCreds, setLiveCreds] = useState(false)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<null | { ok: true; status: number; ms: number; headers: [string, string][]; origin: string } | { ok: false; ms: number; message: string; reachable: boolean | null; origin: string }>(null)

  async function runLive() {
    let target = liveUrl.trim()
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target
    try { new URL(target) } catch { setLive({ ok: false, ms: 0, message: 'That is not a valid URL.', reachable: null, origin: window.location.origin }); return }
    setBusy(true)
    setLive(null)
    const start = performance.now()
    try {
      const res = await fetch(target, { mode: 'cors', credentials: liveCreds ? 'include' : 'omit', cache: 'no-store' })
      setLive({ ok: true, status: res.status, ms: performance.now() - start, headers: [...res.headers.entries()], origin: window.location.origin })
    } catch (err) {
      const ms = performance.now() - start
      let reachable: boolean | null = null
      try { await fetch(target, { mode: 'no-cors', cache: 'no-store' }); reachable = true } catch { reachable = false }
      setLive({ ok: false, ms, message: err instanceof Error ? err.message : String(err), reachable, origin: window.location.origin })
    } finally {
      setBusy(false)
    }
  }

  const counts = { good: 0, warn: 0, bad: 0, info: 0 }
  for (const f of report.findings) counts[f.level]++

  return (
    <div>
      <div className="row" role="tablist">
        {([['security', 'Security headers'], ['cors', 'CORS simulator'], ['live', 'Live test']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`btn ${tab === k ? 'primary' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab !== 'live' && (
        <>
          <label htmlFor="crs-raw">Response headers</label>
          <textarea id="crs-raw" value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} style={{ minHeight: 200 }} />
          <p className="muted" style={{ fontSize: '0.85rem', margin: '4px 0 0' }}>
            Paste from <code>curl -sI https://your-site</code> or DevTools → Network → a request → Response Headers (Raw). {headers.length} header{headers.length === 1 ? '' : 's'} read.
          </p>
        </>
      )}

      {tab === 'security' && (
        <>
          <div className="stats">
            <div className="stat"><b style={{ color: report.grade.startsWith('A') ? 'var(--ok)' : report.grade === 'F' || report.grade === 'E' ? 'var(--danger)' : undefined }}>{report.grade}</b>Grade ({report.score}/100)</div>
            <div className="stat"><b style={{ color: 'var(--ok)' }}>{counts.good}</b>Good</div>
            <div className="stat"><b style={{ color: '#b45309' }}>{counts.warn}</b>Warnings</div>
            <div className="stat"><b style={{ color: 'var(--danger)' }}>{counts.bad}</b>Problems</div>
          </div>
          <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
            {report.findings.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)' }}>
                <Badge level={f.level} />
                <div style={{ minWidth: 0, fontSize: '0.92rem' }}>
                  <b style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem', wordBreak: 'break-all' }}>{f.header}</b>
                  <div>{f.message}</div>
                </div>
              </div>
            ))}
          </div>
          {report.csp && (
            <>
              <label>Content-Security-Policy directives</label>
              <div style={{ overflowX: 'auto' }}>
                <table className="simple">
                  <thead><tr><th>Directive</th><th>Sources</th></tr></thead>
                  <tbody>
                    {report.csp.map((d) => (
                      <tr key={d.name}>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{d.name}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: '0.84rem', wordBreak: 'break-all' }}>
                          {d.sources.length ? d.sources.map((s, i) => (
                            <span key={i} style={{ display: 'inline-block', margin: '1px 4px 1px 0', padding: '0 5px', borderRadius: 4, background: /unsafe|^\*$|^https?:$|^data:$/.test(s) ? 'color-mix(in srgb, var(--danger) 16%, transparent)' : 'var(--sunken)' }}>{s}</span>
                          )) : <span className="muted">(no value)</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="muted" style={{ fontSize: '0.85rem' }}>The grade is a quick heuristic based on the headers above, not a full audit.</p>
        </>
      )}

      {tab === 'cors' && (
        <>
          <div className="two-col">
            <div>
              <label htmlFor="crs-origin">Page origin (who is calling)</label>
              <input id="crs-origin" type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} spellCheck={false} />
            </div>
            <div>
              <label htmlFor="crs-url">Request URL</label>
              <input id="crs-url" type="text" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
            </div>
          </div>
          <div className="two-col">
            <div>
              <label htmlFor="crs-method">Method</label>
              <select id="crs-method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].map((m) => <option key={m}>{m}</option>)}
              </select>
              <label style={{ fontWeight: 400 }}>
                <input type="checkbox" checked={credentials} onChange={(e) => setCredentials(e.target.checked)} /> Send credentials (cookies / <code>credentials: 'include'</code>)
              </label>
            </div>
            <div>
              <label htmlFor="crs-req">Request headers set by the script</label>
              <textarea id="crs-req" value={reqHeaders} onChange={(e) => setReqHeaders(e.target.value)} spellCheck={false} style={{ minHeight: 80 }} />
            </div>
          </div>
          <label style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={separatePreflight} onChange={(e) => setSeparatePreflight(e.target.checked)} /> The preflight (OPTIONS) response has different headers
          </label>
          {separatePreflight && <textarea value={preRaw} onChange={(e) => setPreRaw(e.target.value)} spellCheck={false} aria-label="Preflight response headers" style={{ minHeight: 110 }} />}

          <div className="output" style={{ fontFamily: 'var(--font)', wordBreak: 'normal', marginTop: 14, borderColor: sim.allowed ? 'var(--ok)' : 'var(--danger)' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: sim.allowed ? 'var(--ok)' : 'var(--danger)' }}>
              {sim.allowed ? '✓ Allowed' : '✗ Blocked by CORS'}
              <span className="muted" style={{ fontWeight: 400, fontSize: '0.9rem' }}> · {sim.sameOrigin ? 'same origin' : sim.preflight ? 'preflighted request' : 'simple request'}</span>
            </div>
            <ol style={{ paddingLeft: 20, margin: '8px 0 0' }}>
              {sim.steps.map((s, i) => (
                <li key={i} style={{ margin: '4px 0', color: s.ok === false ? 'var(--danger)' : undefined }}>
                  {s.ok === true ? '✓ ' : s.ok === false ? '✗ ' : ''}{s.text}
                </li>
              ))}
            </ol>
            {sim.allowed && sim.readable.length > 0 && (
              <p style={{ margin: '8px 0 0' }}><b>JavaScript can read:</b> <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{sim.readable.join(', ')}</span></p>
            )}
          </div>
          {sim.advice.map((a) => <p key={a} style={{ margin: '8px 0', color: '#b45309' }}>! {a}</p>)}
          {!separatePreflight && sim.preflight && <p className="muted" style={{ fontSize: '0.85rem' }}>The pasted headers are used for both the preflight and the actual response.</p>}

          <label>Check the real server from your terminal</label>
          <Cmd text={cmds.preflight} />
          <Cmd text={cmds.actual} />
        </>
      )}

      {tab === 'live' && (
        <>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            Sends a real <code>fetch(url, {'{'} mode: 'cors' {'}'})</code> from this page, so it tests whether the server allows <b>this site’s</b> origin, not yours. When CORS blocks a request the browser hides the reason from JavaScript (it looks exactly like a network error); open DevTools → Console to see the browser’s own message.
          </p>
          <div className="row">
            <input type="url" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runLive()} style={{ flex: 1, minWidth: 200 }} aria-label="URL to test" />
            <button type="button" className="btn primary" onClick={runLive} disabled={busy}>{busy ? 'Testing…' : 'Test'}</button>
          </div>
          <label style={{ fontWeight: 400, marginTop: 0 }}>
            <input type="checkbox" checked={liveCreds} onChange={(e) => setLiveCreds(e.target.checked)} /> Include credentials
          </label>
          {live && live.ok && (
            <div className="output" style={{ fontFamily: 'var(--font)', wordBreak: 'normal', borderColor: 'var(--ok)' }}>
              <b className="ok">✓ CORS allows {live.origin}</b>
              <div className="muted" style={{ fontSize: '0.88rem' }}>Status {live.status} · {Math.round(live.ms)} ms</div>
              <label style={{ marginTop: 10 }}>Headers JavaScript can read</label>
              <div style={{ overflowX: 'auto' }}>
                <table className="simple">
                  <tbody>{live.headers.map(([k, v]) => <tr key={k}><td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{k}</td><td style={{ fontFamily: 'var(--mono)', fontSize: '0.84rem', wordBreak: 'break-all' }}>{v}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>Only safelisted headers and those in Access-Control-Expose-Headers are visible. Run curl for the full list.</p>
            </div>
          )}
          {live && !live.ok && (
            <div className="output" style={{ fontFamily: 'var(--font)', wordBreak: 'normal', borderColor: 'var(--danger)' }}>
              <b className="error">✗ Request failed</b> <span className="muted">({live.message}{live.ms ? `, ${Math.round(live.ms)} ms` : ''})</span>
              <p style={{ margin: '6px 0 0' }}>
                {live.reachable === true && `The server is reachable (a no-cors request got through), so it most likely does not send CORS headers allowing ${live.origin}${liveCreds ? ', or does not allow credentials' : ''}.`}
                {live.reachable === false && 'Even a no-cors request failed: the host may be down, the name may not resolve, the TLS certificate may be invalid, or an http:// URL was blocked on this https page. It could still be CORS as well; the browser cannot tell us.'}
                {live.reachable === null && 'This could be a CORS rejection or a network problem; the browser does not tell JavaScript which.'}
              </p>
            </div>
          )}
          <label>Run it yourself to see every header</label>
          <Cmd text={curlCommands(liveUrl || 'https://example.com', origin, 'GET', [], false).head} />
        </>
      )}
    </div>
  )
}
