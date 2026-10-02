import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { useSettled } from '../../motion/useSettled'
import './tool.css'
import { ALGORITHMS, EXPIRY_PRESETS, generateKeyPair, isHmac, nowSeconds, randomSecret, signJwt, timeStatus, verifyJwt, type JwtAlg, type Verified } from './jwt'

type Tab = 'sign' | 'verify'

const DEFAULT_PAYLOAD = { sub: 'user_1024', name: 'Budi Santoso', role: 'editor', iat: 1767225600, exp: 1767229200 }

function parseJson(text: string, what: string): { value?: Record<string, unknown>; error?: string } {
  try {
    const v = JSON.parse(text)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: `The ${what} must be a JSON object { … }.` }
    return { value: v }
  } catch (err) {
    return { error: `${what[0].toUpperCase()}${what.slice(1)}: ${err instanceof Error ? err.message : String(err)}` }
  }
}

function TokenView({ token }: { token: string }) {
  const parts = token.split('.')
  return (
    <div className="output js-token" aria-live="polite">
      {parts.map((p, i) => (
        <span key={`${i}-${p}`}>
          <span className={`jwt-part jwt-${i} js-part`} style={{ animationDelay: `${i * 70}ms` }}>{p}</span>
          {i < parts.length - 1 && <span className="js-dot">.</span>}
        </span>
      ))}
    </div>
  )
}

export default function JwtGenerator() {
  const [tab, setTab] = useState<Tab>('sign')
  const [alg, setAlg] = useState<JwtAlg>('HS256')
  const [header, setHeader] = useState('{\n  "typ": "JWT"\n}')
  const [payload, setPayload] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2))
  const [secret, setSecret] = useState(['demo', 'signing', 'key', 'change', 'me'].join('-'))
  const [privPem, setPrivPem] = useState('')
  const [pubPem, setPubPem] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [token, setToken] = useState('')
  const [signError, setSignError] = useState('')

  const [vToken, setVToken] = useState('')
  const [vKey, setVKey] = useState('')
  const [verified, setVerified] = useState<Verified | null>(null)
  const [vError, setVError] = useState('')
  const [vBusy, setVBusy] = useState(false)

  const h = useMemo(() => parseJson(header, 'header'), [header])
  const p = useMemo(() => parseJson(payload, 'payload'), [payload])
  const key = isHmac(alg) ? secret : privPem
  const settled = useSettled(`${alg}|${header}|${payload}|${key}`, 150)

  // Real timestamps once mounted (the prerendered HTML uses fixed ones).
  useEffect(() => {
    const now = nowSeconds()
    setPayload(JSON.stringify({ ...DEFAULT_PAYLOAD, iat: now, exp: now + 3600 }, null, 2))
  }, [])

  useEffect(() => {
    if (!h.value || !p.value) {
      setSignError('')
      return setToken('')
    }
    if (!key.trim()) {
      setToken('')
      return setSignError(isHmac(alg) ? 'Enter a secret.' : 'Paste a PEM private key or generate a key pair.')
    }
    let off = false
    signJwt(h.value, p.value, alg, key).then(
      (t) => {
        if (off) return
        setToken(t)
        setSignError('')
      },
      (err) => {
        if (off) return
        setToken('')
        setSignError(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, h.value, p.value])

  function claim(name: string, value: unknown) {
    if (!p.value) return
    setPayload(JSON.stringify({ ...p.value, [name]: value }, null, 2))
  }

  async function genKeys(a: JwtAlg = alg) {
    if (isHmac(a)) return
    setGenBusy(true)
    try {
      const kp = await generateKeyPair(a)
      setPrivPem(kp.privatePem)
      setPubPem(kp.publicPem)
    } catch (err) {
      setSignError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenBusy(false)
    }
  }

  function chooseAlg(a: JwtAlg) {
    const familyChanged = a.slice(0, 2) !== alg.slice(0, 2) || (a.startsWith('ES') && a !== alg)
    setAlg(a)
    if (!isHmac(a) && (familyChanged || !privPem)) void genKeys(a)
  }

  async function doVerify(t = vToken, k = vKey) {
    setVBusy(true)
    setVError('')
    setVerified(null)
    try {
      setVerified(await verifyJwt(t, k))
    } catch (err) {
      setVError(err instanceof Error ? err.message : String(err))
    } finally {
      setVBusy(false)
    }
  }

  function sendToVerify() {
    const k = isHmac(alg) ? secret : pubPem
    setVToken(token)
    setVKey(k)
    setTab('verify')
    void doVerify(token, k)
  }

  const payloadObj = p.value
  const times = timeStatus(payloadObj)

  return (
    <div>
      <PillRow role="tablist" label="Mode">
        <button type="button" role="tab" aria-selected={tab === 'sign'} className={`btn ${tab === 'sign' ? 'primary' : ''}`} onClick={() => setTab('sign')}>Create & sign</button>
        <button type="button" role="tab" aria-selected={tab === 'verify'} className={`btn ${tab === 'verify' ? 'primary' : ''}`} onClick={() => setTab('verify')}>Verify a token</button>
      </PillRow>

      {tab === 'sign' && (
        <div className="settle-in">
          <label htmlFor="js-alg">Algorithm</label>
          <select id="js-alg" value={alg} onChange={(e) => chooseAlg(e.target.value as JwtAlg)}>
            <optgroup label="HMAC (shared secret)">
              {ALGORITHMS.filter((a) => a.startsWith('HS')).map((a) => <option key={a} value={a}>{a}</option>)}
            </optgroup>
            <optgroup label="RSA (private/public key)">
              {ALGORITHMS.filter((a) => a.startsWith('RS') || a.startsWith('PS')).map((a) => <option key={a} value={a}>{a}</option>)}
            </optgroup>
            <optgroup label="ECDSA (private/public key)">
              {ALGORITHMS.filter((a) => a.startsWith('ES')).map((a) => <option key={a} value={a}>{a}</option>)}
            </optgroup>
          </select>

          <div className="js-editors">
            <div>
              <label htmlFor="js-header">Header <span className="muted js-light">(alg is set for you)</span></label>
              <textarea id="js-header" value={header} onChange={(e) => setHeader(e.target.value)} spellCheck={false} className={`js-h ${h.error ? 'js-bad' : ''}`} style={{ minHeight: 100 }} />
              {h.error && <p className="error">{h.error}</p>}
            </div>
            <div>
              <label htmlFor="js-payload">Payload (claims)</label>
              <textarea id="js-payload" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} className={`js-p ${p.error ? 'js-bad' : ''}`} style={{ minHeight: 180 }} />
              {p.error && <p className="error">{p.error}</p>}
            </div>
          </div>

          <div className="js-claims" role="group" aria-label="Claim helpers">
            <button type="button" className="btn js-chip" onClick={() => claim('iat', nowSeconds())}>iat = now</button>
            {EXPIRY_PRESETS.map(([label, s]) => (
              <button key={label} type="button" className="btn js-chip" onClick={() => claim('exp', nowSeconds() + s)}>exp in {label}</button>
            ))}
            <button type="button" className="btn js-chip" onClick={() => claim('nbf', nowSeconds())}>nbf = now</button>
            <button type="button" className="btn js-chip" onClick={() => claim('jti', crypto.randomUUID())}>+ jti</button>
          </div>
          {times.length > 0 && <p className="muted js-times">{times.join(' · ')}</p>}

          {isHmac(alg) ? (
            <>
              <label htmlFor="js-secret">Secret</label>
              <div className="js-row">
                <input id="js-secret" type="text" value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} autoComplete="off" />
                <button type="button" className="btn" onClick={() => setSecret(randomSecret(Number(alg.slice(2)) / 8))}>Random</button>
              </div>
              {new TextEncoder().encode(secret).length < Number(alg.slice(2)) / 8 && secret && (
                <p className="muted js-light">Tip: {alg} should use a secret of at least {Number(alg.slice(2)) / 8} bytes; short secrets can be brute-forced.</p>
              )}
            </>
          ) : (
            <>
              <label htmlFor="js-priv">Private key (PEM, PKCS#8 or PKCS#1)</label>
              <textarea id="js-priv" value={privPem} onChange={(e) => setPrivPem(e.target.value)} spellCheck={false} placeholder="-----BEGIN PRIVATE KEY-----" style={{ minHeight: 120 }} />
              <div className="row">
                <button type="button" className="btn" onClick={() => genKeys()} disabled={genBusy}>{genBusy ? 'Generating…' : `Generate ${alg.startsWith('ES') ? 'EC' : 'RSA'} key pair`}</button>
              </div>
              {genBusy && <Busy label="Generating a key pair…" />}
              {pubPem && (
                <details>
                  <summary>Matching public key (share this for verification)</summary>
                  <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <pre className="output js-pem">{pubPem}</pre>
                    <CopyButton text={pubPem} />
                  </div>
                </details>
              )}
            </>
          )}

          {signError && !genBusy && <p className="error" role="alert">{signError}</p>}
          {token && (
            <>
              <label>Signed token</label>
              <TokenView token={token} />
              <div className="row">
                <CopyButton text={token} label="Copy token" />
                <button type="button" className="btn" onClick={sendToVerify}>Verify it →</button>
                <Link to="/jwt-decoder" className="btn">Open JWT Decoder</Link>
              </div>
              <p className="muted js-legend"><span className="jwt-part jwt-0">header</span> . <span className="jwt-part jwt-1">payload</span> . <span className="jwt-part jwt-2">signature</span></p>
            </>
          )}
        </div>
      )}

      {tab === 'verify' && (
        <div className="settle-in">
          <label htmlFor="js-vtoken">Token</label>
          <textarea id="js-vtoken" value={vToken} onChange={(e) => { setVToken(e.target.value); setVerified(null) }} spellCheck={false} placeholder="eyJhbGciOi…" style={{ minHeight: 100 }} />
          <label htmlFor="js-vkey">Secret (HS*) or PEM public key (RS*, PS*, ES*)</label>
          <textarea id="js-vkey" value={vKey} onChange={(e) => { setVKey(e.target.value); setVerified(null) }} spellCheck={false} placeholder="-----BEGIN PUBLIC KEY-----  or your HMAC secret" style={{ minHeight: 90 }} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => doVerify()} disabled={vBusy || !vToken.trim() || !vKey}>{vBusy ? 'Checking…' : 'Verify signature'}</button>
          </div>
          {vBusy && <Busy label="Checking the signature…" />}
          {vError && <p className="error" role="alert">{vError}</p>}
          {verified && (
            <div className="settle-in">
              <p role="status">
                {verified.valid ? (
                  <span className="chip good js-verdict"><Check /> Signature verified ({verified.alg})</span>
                ) : (
                  <span className="chip bad js-verdict">✗ Invalid signature: wrong key/secret or the token was changed</span>
                )}
              </p>
              {timeStatus(verified.payload).map((t) => <p key={t} className="muted js-light">{t}</p>)}
              <div className="js-editors">
                <div>
                  <label>Header</label>
                  <pre className="output js-pem">{JSON.stringify(verified.header, null, 2)}</pre>
                </div>
                <div>
                  <label>Payload</label>
                  <pre className="output js-pem">{JSON.stringify(verified.payload, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="muted">
        Signing and verifying run in your browser with Web Crypto; keys and secrets never leave this page. Use this for development and testing: in production, sign tokens on your server and keep
        signing keys out of browsers. The payload is only Base64url-encoded, not encrypted, so anyone holding the token can read it.
      </p>
    </div>
  )
}
