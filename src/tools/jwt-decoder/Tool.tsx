import { useState } from 'react'
import SettleOutput from '../../motion/SettleOutput'
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
          <p className="jwt-parts" key={token.trim()} aria-hidden="true">
            {token.trim().replace(/^Bearer\s+/i, '').split('.').map((part, i) => (
              <span key={i} className={`jwt-part jwt-${Math.min(i, 2)}`} style={{ animationDelay: `${i * 70}ms` }}>
                {part.length > 18 ? `${part.slice(0, 18)}…` : part}
              </span>
            ))}
          </p>
          {timeClaims(result.payload).map((c) => (
            <p key={c.claim} style={{ margin: '6px 0' }}>
              <b>{LABELS[c.claim]}:</b> {c.date.toLocaleString()}{' '}
              {c.expired !== undefined && (c.expired ? <span className="chip bad">Expired</span> : <span className="chip good">Still valid</span>)}
            </p>
          ))}
          <div className="two-col">
            <div>
              <label>Header</label>
              <SettleOutput value={JSON.stringify(result.header, null, 2)} motion="order" aria-label="Header" />
            </div>
            <div>
              <label>Payload</label>
              <SettleOutput value={JSON.stringify(result.payload, null, 2)} motion="order" aria-label="Payload" />
            </div>
          </div>
          <p className="muted">The signature is not checked. Decoding only shows what the token says.</p>
        </>
      )}
    </div>
  )
}
