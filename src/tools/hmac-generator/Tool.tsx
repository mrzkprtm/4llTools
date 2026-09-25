import { useEffect, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { Scramble } from '../../motion/useScramble'
import {
  DIGEST_BYTES,
  HMAC_ALGORITHMS,
  constantTimeEqual,
  decode,
  hmac,
  parseSignature,
  parseStripeHeader,
  toBase64,
  toBase64Url,
  toHex,
  type Encoding,
  type HmacAlgorithm,
} from './hmac'

type Preset = 'generic' | 'github' | 'stripe'

const BODY = '{"event":"order.paid","id":"ord_1024","amount":150000,"currency":"IDR"}'

interface Result {
  mac: Uint8Array | null
  error: string
}

type Verdict = { state: 'empty' } | { state: 'error'; message: string } | { state: 'match' | 'nomatch'; format: string }

export default function HmacGenerator() {
  const [preset, setPreset] = useState<Preset>('generic')
  const [algorithm, setAlgorithm] = useState<HmacAlgorithm>('SHA-256')
  const [secret, setSecret] = useState('my-webhook-secret')
  const [secretEnc, setSecretEnc] = useState<Encoding>('text')
  const [message, setMessage] = useState(BODY)
  const [timestamp, setTimestamp] = useState('1767225600')
  const [expected, setExpected] = useState('')
  const [result, setResult] = useState<Result>({ mac: null, error: '' })
  const [verdict, setVerdict] = useState<Verdict>({ state: 'empty' })

  const alg: HmacAlgorithm = preset === 'generic' ? algorithm : 'SHA-256'
  const signedPayload = preset === 'stripe' ? `${timestamp}.${message}` : message

  useEffect(() => {
    let cancelled = false
    let key: Uint8Array
    try {
      key = decode(secret, secretEnc)
    } catch (err) {
      setResult({ mac: null, error: `Secret: ${err instanceof Error ? err.message : String(err)}` })
      return
    }
    hmac(alg, key, new TextEncoder().encode(signedPayload)).then(
      (mac) => !cancelled && setResult({ mac, error: '' }),
      (err) => !cancelled && setResult({ mac: null, error: err instanceof Error ? err.message : String(err) }),
    )
    return () => {
      cancelled = true
    }
  }, [alg, secret, secretEnc, signedPayload])

  useEffect(() => {
    const mac = result.mac
    if (!expected.trim() || !mac) return setVerdict({ state: 'empty' })
    try {
      if (preset === 'stripe' && expected.includes('t=')) {
        const h = parseStripeHeader(expected)
        if (!h) return setVerdict({ state: 'error', message: 'Could not read t= and v1= from the Stripe-Signature header.' })
        if (h.timestamp !== timestamp) return setVerdict({ state: 'error', message: `The header's timestamp (t=${h.timestamp}) differs from the timestamp above. Copy it into the Timestamp field.` })
        let ok = false
        for (const s of h.signatures) {
          try {
            ok = constantTimeEqual(parseSignature(s, DIGEST_BYTES[alg]).bytes, mac) || ok
          } catch {
            /* ignore malformed entries */
          }
        }
        return setVerdict({ state: ok ? 'match' : 'nomatch', format: 'Stripe-Signature v1' })
      }
      const p = parseSignature(expected, DIGEST_BYTES[alg])
      setVerdict({ state: constantTimeEqual(p.bytes, mac) ? 'match' : 'nomatch', format: `${p.prefix ? `${p.prefix}= prefixed ` : ''}${p.format}` })
    } catch (err) {
      setVerdict({ state: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [expected, result, preset, timestamp, alg])

  function choose(p: Preset) {
    setPreset(p)
    setExpected('')
    if (p === 'stripe' && !secret.startsWith('whsec_')) {
      setSecret('whsec_test_secret')
      setSecretEnc('text')
    }
    if (p === 'github') setSecretEnc('text')
  }

  const hex = result.mac ? toHex(result.mac) : ''
  const outputs: [string, string][] = result.mac
    ? preset === 'github'
      ? [['X-Hub-Signature-256 header', `sha256=${hex}`], ['Hex', hex]]
      : preset === 'stripe'
        ? [['Stripe-Signature header', `t=${timestamp},v1=${hex}`], ['v1 signature (hex)', hex]]
        : [['Hex', hex], ['Base64', toBase64(result.mac)], ['Base64url', toBase64Url(result.mac)]]
    : []

  return (
    <div>
      <PillRow role="tablist" label="Preset">
        {([['generic', 'Generic HMAC'], ['github', 'GitHub webhook'], ['stripe', 'Stripe webhook']] as [Preset, string][]).map(([p, label]) => (
          <button key={p} type="button" role="tab" aria-selected={preset === p} className={`btn ${preset === p ? 'primary' : ''}`} onClick={() => choose(p)}>{label}</button>
        ))}
      </PillRow>

      <div className="two-col">
        <div>
          <label htmlFor="hm-alg">Algorithm</label>
          <select id="hm-alg" value={alg} onChange={(e) => setAlgorithm(e.target.value as HmacAlgorithm)} disabled={preset !== 'generic'}>
            {HMAC_ALGORITHMS.map((a) => <option key={a} value={a}>HMAC-{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="hm-enc">Secret format</label>
          <select id="hm-enc" value={secretEnc} onChange={(e) => setSecretEnc(e.target.value as Encoding)} disabled={preset !== 'generic'}>
            <option value="text">Text (UTF-8)</option>
            <option value="hex">Hex</option>
            <option value="base64">Base64</option>
          </select>
        </div>
      </div>
      <label htmlFor="hm-secret">Secret key</label>
      <input id="hm-secret" type="text" value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} autoComplete="off" style={{ fontFamily: 'var(--mono)' }} />
      {preset === 'stripe' && (
        <>
          <label htmlFor="hm-t">Timestamp (t, Unix seconds)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="hm-t" type="text" value={timestamp} onChange={(e) => setTimestamp(e.target.value.trim())} style={{ minWidth: 0, flex: 1 }} />
            <button type="button" className="btn" onClick={() => setTimestamp(String(Math.floor(Date.now() / 1000)))}>Now</button>
          </div>
        </>
      )}
      <label htmlFor="hm-msg">{preset === 'generic' ? 'Message' : 'Raw request body (exact bytes, before any JSON parsing)'}</label>
      <textarea id="hm-msg" value={message} onChange={(e) => setMessage(e.target.value)} spellCheck={false} style={{ minHeight: 120 }} />
      {preset === 'stripe' && <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Signed payload: <code style={{ wordBreak: 'break-all' }}>{`${timestamp}.`}</code> followed by the body.</p>}

      {result.error && <p className="error" role="alert">{result.error}</p>}
      {outputs.map(([label, value]) => (
        <div key={label}>
          <label>{label}</label>
          <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
            <div className="output" style={{ flex: 1, minWidth: 0, fontSize: '0.84rem' }}><Scramble text={value} limit={96} duration={240} /></div>
            <CopyButton text={value} />
          </div>
        </div>
      ))}

      <label htmlFor="hm-expected">
        Verify: paste the signature you received{preset === 'github' ? ' (X-Hub-Signature-256)' : preset === 'stripe' ? ' (Stripe-Signature header or v1 value)' : ''}
      </label>
      <input
        id="hm-expected"
        type="text"
        value={expected}
        onChange={(e) => setExpected(e.target.value)}
        placeholder={preset === 'github' ? 'sha256=…' : preset === 'stripe' ? 't=…,v1=…' : 'hex, Base64, or sha256=…'}
        spellCheck={false}
        style={{ fontFamily: 'var(--mono)' }}
      />
      {verdict.state === 'error' && <p className="error">{verdict.message}</p>}
      {(verdict.state === 'match' || verdict.state === 'nomatch') && (
        <p key={verdict.state} role="status" style={{ margin: '10px 0' }}>
          <span className={`chip ${verdict.state === 'match' ? 'good' : 'bad'}`}>{verdict.state === 'match' ? <><Check size={15} /> Valid signature</> : '✗ Signature does not match'}</span>{' '}
          <span className="muted" style={{ fontSize: '0.85rem' }}>({verdict.format}, compared in constant time)</span>
        </p>
      )}

      <div className="muted" style={{ fontSize: '0.9rem', marginTop: 16 }}>
        {preset === 'github' && (
          <p>GitHub signs the raw body with your webhook secret using HMAC-SHA256 and sends <code>X-Hub-Signature-256: sha256=&lt;hex&gt;</code>. Verify against the raw body bytes; re-serialized JSON will not match.</p>
        )}
        {preset === 'stripe' && (
          <p>Stripe signs <code>{'${t}.${body}'}</code> with your endpoint secret (the whole <code>whsec_…</code> string) using HMAC-SHA256, and sends <code>Stripe-Signature: t=…,v1=…</code>. Also reject events whose t is older than a few minutes to stop replays.</p>
        )}
        {preset === 'generic' && (
          <p>An HMAC proves a message came from someone who knows the secret and was not changed. In your server, compare signatures with a constant-time function (e.g. <code>crypto.timingSafeEqual</code>, <code>hmac.compare_digest</code>).</p>
        )}
        <p>Everything runs in your browser with WebCrypto; the secret is not sent anywhere.</p>
      </div>
    </div>
  )
}
