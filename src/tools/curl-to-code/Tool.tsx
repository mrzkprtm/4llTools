import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { generate, LANGUAGES, type Language } from './generate'
import { parseCurl, type ParsedRequest } from './parse'

const EXAMPLE = `curl -X POST 'https://api.example.com/v1/users?notify=true' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{"name": "Siti Rahma", "email": "siti@example.com", "roles": ["admin"]}'`

const EXAMPLES: [string, string][] = [
  ['JSON POST', EXAMPLE],
  ['GET with query', `curl -G https://api.example.com/search -d q=kopi -d page=2 -H 'Accept: application/json'`],
  ['File upload', `curl -F title=Liburan -F 'photo=@/home/me/beach.jpg;type=image/jpeg' -u "$API_USER:$API_PASS" https://api.example.com/upload`],
  ['Chrome (cmd)', `curl ^"https://api.example.com/items^" ^\n  -H ^"accept: application/json^" ^\n  -H ^"x-requested-with: XMLHttpRequest^" ^\n  --data-raw ^"^{^\\^"id^\\^":42^}^" ^\n  --compressed`],
]

export default function CurlToCode() {
  const [input, setInput] = useState(EXAMPLE)
  const [lang, setLang] = useState<Language>('fetch')

  const parsed = useMemo((): { req: ParsedRequest } | { error: string } => {
    try {
      return { req: parseCurl(input) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [input])

  const code = 'req' in parsed ? generate(parsed.req, lang) : ''
  const req = 'req' in parsed ? parsed.req : null

  return (
    <div>
      <label htmlFor="curl-in">curl command</label>
      <textarea id="curl-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="curl https://…" style={{ minHeight: 150 }} />
      <div className="row">
        <span className="muted" style={{ fontSize: '0.88rem' }}>Examples:</span>
        {EXAMPLES.map(([label, cmd]) => (
          <button key={label} type="button" className="btn" style={{ padding: '5px 10px', fontSize: '0.85rem' }} onClick={() => setInput(cmd)}>{label}</button>
        ))}
        <button type="button" className="btn" style={{ padding: '5px 10px', fontSize: '0.85rem' }} onClick={() => setInput('')}>Clear</button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>
        Works with DevTools → Network → right-click a request → Copy → Copy as cURL (bash or cmd).
      </p>

      {'error' in parsed && input.trim() && <p className="error">{parsed.error}</p>}

      {req && (
        <>
          <div className="row" style={{ fontSize: '0.9rem', gap: 6 }}>
            <b style={{ fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{req.method}</b>
            <span style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all', minWidth: 0 }}>{req.url}</span>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: -6 }}>
            {req.headers.length} header{req.headers.length === 1 ? '' : 's'}
            {req.body ? (req.body.kind === 'form' ? ` · multipart form (${req.body.fields.length} fields)` : ` · ${new Blob([req.body.text]).size} byte body`) : ''}
            {req.auth ? ' · basic auth' : ''}{req.insecure ? ' · TLS verification off' : ''}{req.followRedirects ? ' · follows redirects' : ''}
          </div>

          <div className="row" role="tablist" style={{ marginTop: 16 }}>
            {LANGUAGES.map((l) => (
              <button key={l.id} type="button" role="tab" aria-selected={lang === l.id} className={`btn ${lang === l.id ? 'primary' : ''}`} style={{ padding: '7px 11px', fontSize: '0.88rem' }} onClick={() => setLang(l.id)}>{l.label}</button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <pre className="output" style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre', wordBreak: 'normal', lineHeight: 1.55, maxHeight: 560, tabSize: 4 }}>{code}</pre>
          </div>
          <div className="row">
            <CopyButton text={code} label="Copy code" />
          </div>
          {req.notes.length > 0 && (
            <ul style={{ paddingLeft: 20, color: '#b45309', fontSize: '0.9rem' }}>
              {req.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            {lang === 'fetch' && 'Browsers refuse to set some headers (Cookie, User-Agent, Referer) and cross-origin calls need CORS; run it in Node.js 18+ to send them as-is.'}
            {lang === 'axios' && 'Uses ES modules and top-level await (Node.js 14.8+ with "type": "module"). Install with npm i axios (plus form-data for uploads).'}
            {lang === 'python' && 'Install with pip install requests. requests follows redirects and decompresses gzip automatically.'}
            {lang === 'php' && 'Needs the PHP curl extension. Unlike the libraries above, PHP cURL does not follow redirects unless curl had -L.'}
            {lang === 'go' && 'Standard library only. Go’s http.Client follows up to 10 redirects and handles gzip automatically.'}
            {lang === 'rust' && 'Uses reqwest’s blocking client for a short, synchronous example (no Tokio needed). For async, switch to reqwest::Client and add .await.'}
          </p>
        </>
      )}
    </div>
  )
}
