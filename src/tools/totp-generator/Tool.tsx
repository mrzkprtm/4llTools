import { useEffect, useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import MorphText from '../../motion/MorphText'
import PillRow from '../../motion/PillRow'
import './tool.css'
import { ALGORITHMS, DEFAULT_CONFIG, base32Decode, buildOtpauth, groupSecret, hotp, parseOtpauth, randomSecret, type OtpAlgorithm, type OtpConfig } from './otp'

function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code
}

function Ring({ remaining, period }: { remaining: number; period: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const frac = Math.max(0, Math.min(1, remaining / period))
  const low = remaining <= 5
  return (
    <svg className={`tp-ring ${low ? 'is-low' : ''}`} width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${Math.ceil(remaining)} seconds left`}>
      <circle cx="32" cy="32" r={r} className="tp-ring-bg" />
      <circle cx="32" cy="32" r={r} className="tp-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle" className="tp-ring-t">{Math.ceil(remaining)}</text>
    </svg>
  )
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let off = false
    import('qrcode')
      .then((QR) => QR.toDataURL(text, { width: 320, margin: 2, errorCorrectionLevel: 'M' }))
      .then((u) => !off && setSrc(u), () => !off && setSrc(''))
    return () => {
      off = true
    }
  }, [text])
  if (!src) return <div className="tp-qr-ph" aria-hidden="true" />
  return <img key={src} src={src} width={180} height={180} alt="QR code to scan with an authenticator app" className="tp-qr pop" />
}

export default function TotpGenerator() {
  const [cfg, setCfg] = useState<OtpConfig>({ ...DEFAULT_CONFIG, issuer: '4llTools Demo', account: 'you@example.com' })
  const [secretIn, setSecretIn] = useState('')
  const [uriError, setUriError] = useState('')
  const [now, setNow] = useState(0)
  const [codes, setCodes] = useState<{ prev: string; cur: string; next: string } | null>(null)
  const [keyError, setKeyError] = useState('')

  // A fresh random secret on first load (in an effect so prerendered HTML stays stable).
  useEffect(() => {
    const s = randomSecret()
    setSecretIn(groupSecret(s))
    setCfg((c) => ({ ...c, secret: s }))
  }, [])

  useEffect(() => {
    if (cfg.type !== 'totp') return
    const tick = () => setNow(Date.now() / 1000)
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [cfg.type])

  const key = useMemo(() => {
    if (!cfg.secret) return null
    try {
      return base32Decode(cfg.secret)
    } catch {
      return null
    }
  }, [cfg.secret])

  const step = cfg.type === 'totp' ? (now ? Math.floor(now / cfg.period) : -1) : cfg.counter
  const remaining = cfg.period - (now % cfg.period)

  useEffect(() => {
    if (!key || step < 0) return setCodes(null)
    let off = false
    const s = Math.max(0, step)
    Promise.all([step > 0 ? hotp(key, s - 1, cfg.digits, cfg.algorithm) : Promise.resolve(''), hotp(key, s, cfg.digits, cfg.algorithm), hotp(key, s + 1, cfg.digits, cfg.algorithm)]).then(
      ([prev, cur, next]) => !off && setCodes({ prev, cur, next }),
      () => !off && setCodes(null),
    )
    return () => {
      off = true
    }
  }, [key, step, cfg.digits, cfg.algorithm])

  function onSecret(v: string) {
    setSecretIn(v)
    setUriError('')
    if (/^\s*otpauth:/i.test(v)) {
      try {
        const parsed = parseOtpauth(v)
        setCfg(parsed)
        setKeyError('')
        setSecretIn(groupSecret(parsed.secret))
      } catch (err) {
        setUriError(err instanceof Error ? err.message : String(err))
      }
      return
    }
    const clean = v.replace(/[\s-]/g, '').toUpperCase()
    setCfg((c) => ({ ...c, secret: clean }))
    try {
      if (clean) base32Decode(clean)
      setKeyError(clean ? '' : 'Enter a Base32 secret key.')
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : String(err))
    }
  }

  function newSecret() {
    const s = randomSecret()
    setSecretIn(groupSecret(s))
    setKeyError('')
    setUriError('')
    setCfg((c) => ({ ...c, secret: s, counter: 0 }))
  }

  const uri = key ? buildOtpauth(cfg) : ''
  const set = <K extends keyof OtpConfig>(k: K, v: OtpConfig[K]) => setCfg((c) => ({ ...c, [k]: v }))

  return (
    <div>
      <PillRow role="tablist" label="OTP type">
        <button type="button" role="tab" aria-selected={cfg.type === 'totp'} className={`btn ${cfg.type === 'totp' ? 'primary' : ''}`} onClick={() => set('type', 'totp')}>TOTP (time-based)</button>
        <button type="button" role="tab" aria-selected={cfg.type === 'hotp'} className={`btn ${cfg.type === 'hotp' ? 'primary' : ''}`} onClick={() => set('type', 'hotp')}>HOTP (counter)</button>
      </PillRow>

      <label htmlFor="tp-secret">Secret key (Base32) or otpauth:// link</label>
      <div className="tp-secret-row">
        <input id="tp-secret" type="text" value={secretIn} onChange={(e) => onSecret(e.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="characters" placeholder="JBSW Y3DP EHPK 3PXP or otpauth://totp/…" />
        <button type="button" className="btn btn-icon" onClick={newSecret}>
          <Icon name="reload" size={18} className="spin-icon" /> New secret
        </button>
      </div>
      {uriError && <p className="error" role="alert">{uriError}</p>}
      {keyError && !uriError && <p className="error" role="alert">{keyError}</p>}

      <div className="tp-grid">
        <div>
          <label htmlFor="tp-alg">Algorithm</label>
          <select id="tp-alg" value={cfg.algorithm} onChange={(e) => set('algorithm', e.target.value as OtpAlgorithm)}>
            {ALGORITHMS.map((a) => <option key={a} value={a}>{a.replace('-', '')}{a === 'SHA-1' ? ' (most apps)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tp-digits">Digits</label>
          <select id="tp-digits" value={cfg.digits} onChange={(e) => set('digits', Number(e.target.value))}>
            <option value={6}>6</option>
            <option value={8}>8</option>
          </select>
        </div>
        {cfg.type === 'totp' ? (
          <div>
            <label htmlFor="tp-period">Period</label>
            <select id="tp-period" value={cfg.period} onChange={(e) => set('period', Number(e.target.value))}>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="tp-counter">Counter</label>
            <div className="tp-counter">
              <button type="button" className="btn" aria-label="Previous counter" onClick={() => set('counter', Math.max(0, cfg.counter - 1))}>−</button>
              <input id="tp-counter" type="number" min={0} value={cfg.counter} onChange={(e) => set('counter', Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              <button type="button" className="btn" aria-label="Next counter" onClick={() => set('counter', cfg.counter + 1)}>+</button>
            </div>
          </div>
        )}
      </div>

      {codes && (
        <div className="tp-live" aria-live="polite">
          <div className="tp-main">
            {cfg.type === 'totp' && <Ring remaining={remaining} period={cfg.period} />}
            <div className="tp-code-wrap">
              <span className="tp-label">{cfg.type === 'totp' ? 'Current code' : `Code for counter ${cfg.counter}`}</span>
              <div className={`tp-code ${cfg.type === 'totp' && remaining <= 5 ? 'is-low' : ''}`}>
                <MorphText text={formatCode(codes.cur)} stagger={30} />
              </div>
            </div>
            <CopyButton text={codes.cur} />
          </div>
          <div className="tp-side">
            {codes.prev && <span><small>{cfg.type === 'totp' ? 'Previous' : `Counter ${cfg.counter - 1}`}</small><code>{formatCode(codes.prev)}</code></span>}
            <span><small>{cfg.type === 'totp' ? 'Next' : `Counter ${cfg.counter + 1}`}</small><code>{formatCode(codes.next)}</code></span>
          </div>
        </div>
      )}

      <h3 className="tp-h">Add to an authenticator app</h3>
      <div className="tp-grid">
        <div>
          <label htmlFor="tp-issuer">Issuer (service name)</label>
          <input id="tp-issuer" type="text" value={cfg.issuer} onChange={(e) => set('issuer', e.target.value)} />
        </div>
        <div>
          <label htmlFor="tp-account">Account</label>
          <input id="tp-account" type="text" value={cfg.account} onChange={(e) => set('account', e.target.value)} />
        </div>
      </div>
      {uri && (
        <div className="tp-setup">
          <Qr text={uri} />
          <div className="tp-uri">
            <label>otpauth:// link</label>
            <div className="output tp-uri-text">{uri}</div>
            <div className="row">
              <CopyButton text={uri} label="Copy link" />
              <CopyButton text={cfg.secret} label="Copy secret" />
            </div>
            <p className="muted tp-small">Scan with Google Authenticator, Microsoft Authenticator, Authy, 1Password or Bitwarden. Some apps ignore SHA-256/512, 8 digits or 60-second periods, so keep the defaults for the widest support.</p>
          </div>
        </div>
      )}

      <p className="tp-warn">
        Careful: a TOTP secret is as good as a password for that account. Don’t paste secrets of important accounts on shared or untrusted devices, and don’t share screenshots of the QR code.
      </p>
      <p className="muted">
        Codes are computed in your browser with Web Crypto (RFC 6238 TOTP and RFC 4226 HOTP) and use your device clock; if codes are rejected, check that the clock is set automatically. Nothing is sent or saved.
      </p>
    </div>
  )
}
