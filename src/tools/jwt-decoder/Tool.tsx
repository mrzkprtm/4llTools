import { useState } from 'react'
import { decodeJwt, timeClaims } from './jwt'

const LABELS: Record<string, string> = { iat: 'Issued at', nbf: 'Not valid before', exp: 'Expires' }

export default function JwtDecoder() {
  const [token, setToken] = useState('')
  const result = token.trim() ? decodeJwt(token) : null

  return (
    <div>
      <label htmlFor="jwt-in">Token</label>
      <textarea id="jwt-in" value={token} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOi…" spellCheck={false} style={{ minHeight: 110 }} />
      {result && !result.ok && <p className="error">{result.error}</p>}
      {result?.ok && (
        <>
          {timeClaims(result.payload).map((c) => (
            <p key={c.claim} style={{ margin: '6px 0' }}>
              <b>{LABELS[c.claim]}:</b> {c.date.toLocaleString()}{' '}
              {c.expired !== undefined && (c.expired ? <span className="error">(expired)</span> : <span className="ok">(still valid)</span>)}
            </p>
          ))}
          <div className="two-col">
            <div>
              <label>Header</label>
              <textarea readOnly value={JSON.stringify(result.header, null, 2)} />
            </div>
            <div>
              <label>Payload</label>
              <textarea readOnly value={JSON.stringify(result.payload, null, 2)} />
            </div>
          </div>
          <p className="muted">The signature is not checked. Decoding only shows what the token says.</p>
        </>
      )}
    </div>
  )
}
