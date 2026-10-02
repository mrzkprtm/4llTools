import { useCallback, useEffect, useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { Scramble } from '../../motion/useScramble'
import { collisionLog10, cuid2Like, decode, humanCount, NANO_ALPHABET, nanoid, ulidBatch, uuidV4, uuidV7Batch } from './ids'
import './tool.css'

type Kind = 'v7' | 'ulid' | 'nano' | 'v4' | 'cuid'

const KINDS: { id: Kind; label: string; about: string }[] = [
  { id: 'v7', label: 'UUID v7', about: 'RFC 9562 UUID whose first 48 bits are a millisecond timestamp, so ids sort by creation time. A great default primary key for Postgres, MySQL and friends.' },
  { id: 'ulid', label: 'ULID', about: '26 characters of Crockford base32: 10 for the time, 16 random. Sortable as plain text, URL-safe and case-insensitive.' },
  { id: 'nano', label: 'NanoID', about: 'Short, URL-safe random ids with your own alphabet and length. Not time-ordered.' },
  { id: 'v4', label: 'UUID v4', about: 'The classic fully random UUID. No timestamp, so it scatters across database indexes.' },
  { id: 'cuid', label: 'CUID2-style', about: 'Starts with a letter, then base36. Same shape as CUID2 but built from random bytes only, not CUID2’s hashed fingerprint.' },
]

const ALPHABETS: [string, string][] = [
  ['URL-safe (A-Za-z0-9_-)', NANO_ALPHABET],
  ['Alphanumeric', '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'],
  ['Lowercase + digits', '0123456789abcdefghijklmnopqrstuvwxyz'],
  ['No look-alikes', '346789ABCDEFGHJKLMNPQRTUVWXYabcdefghijkmnpqrtwxyz'],
  ['Hex', '0123456789abcdef'],
  ['Numbers only', '0123456789'],
]

const POOL: Record<Kind, string> = {
  v7: '0123456789abcdef',
  v4: '0123456789abcdef',
  ulid: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  nano: NANO_ALPHABET,
  cuid: '0123456789abcdefghijklmnopqrstuvwxyz',
}

function relative(ms: number): string {
  const diff = ms - Date.now()
  const abs = Math.abs(diff)
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [31536e6, 'year'],
    [2592e6, 'month'],
    [864e5, 'day'],
    [36e5, 'hour'],
    [6e4, 'minute'],
    [1e3, 'second'],
  ]
  const [size, unit] = units.find(([s]) => abs >= s) ?? [1e3, 'second']
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(diff / size), unit)
}

export default function IdGenerator() {
  const [kind, setKind] = useState<Kind>('v7')
  const [count, setCount] = useState(5)
  const [upper, setUpper] = useState(false)
  const [hyphens, setHyphens] = useState(true)
  const [monotonic, setMonotonic] = useState(true)
  const [size, setSize] = useState(21)
  const [alphabet, setAlphabet] = useState(NANO_ALPHABET)
  const [ids, setIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [turns, setTurns] = useState(0)
  const [pasted, setPasted] = useState('')

  const generate = useCallback(() => {
    try {
      let list: string[]
      if (kind === 'v7') list = uuidV7Batch({ count, monotonic })
      else if (kind === 'ulid') list = ulidBatch({ count, monotonic })
      else if (kind === 'v4') list = Array.from({ length: count }, () => uuidV4())
      else if (kind === 'nano') list = Array.from({ length: count }, () => nanoid(size, alphabet))
      else list = Array.from({ length: count }, () => cuid2Like(Math.max(2, size)))
      if (kind === 'v7' || kind === 'v4') {
        if (!hyphens) list = list.map((s) => s.replace(/-/g, ''))
        if (upper) list = list.map((s) => s.toUpperCase())
      }
      setIds(list)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setIds([])
    }
  }, [kind, count, monotonic, hyphens, upper, size, alphabet])

  useEffect(generate, [generate])

  function pickKind(k: Kind) {
    setKind(k)
    if (k === 'cuid') setSize(24)
    if (k === 'nano') setSize(21)
  }

  const uniqueChars = new Set([...alphabet]).size
  const safeLog = kind === 'nano' && uniqueChars >= 2 ? collisionLog10(uniqueChars, size) : 0
  const decoded = useMemo(() => (pasted.trim() ? decode(pasted) : null), [pasted])
  const firstTime = ids[0] ? decode(ids[0]) : null
  const text = ids.join('\n')
  const about = KINDS.find((k) => k.id === kind)!.about

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' }))
    a.download = `${kind}-ids.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PillRow label="ID type">
        {KINDS.map((k) => (
          <button key={k.id} type="button" className={`btn ${kind === k.id ? 'primary' : ''}`} aria-pressed={kind === k.id} onClick={() => pickKind(k.id)}>
            {k.label}
          </button>
        ))}
      </PillRow>
      <p className="muted swap-code" key={kind} style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>{about}</p>

      <div className="ul-opts">
        <label htmlFor="ul-count" style={{ fontWeight: 600 }}>How many</label>
        <input id="ul-count" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(1000, Math.round(Number(e.target.value)) || 1)))} style={{ width: 96 }} />
        {(kind === 'v7' || kind === 'v4') && (
          <>
            <label><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> Uppercase</label>
            <label><input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /> Hyphens</label>
          </>
        )}
        {(kind === 'v7' || kind === 'ulid') && (
          <label title="Ids made in the same millisecond increment instead of re-rolling, so they stay in order">
            <input type="checkbox" checked={monotonic} onChange={(e) => setMonotonic(e.target.checked)} /> Monotonic
          </label>
        )}
        {(kind === 'nano' || kind === 'cuid') && (
          <>
            <label htmlFor="ul-size" style={{ fontWeight: 600 }}>Length</label>
            <input id="ul-size" type="number" min={2} max={128} value={size} onChange={(e) => setSize(Math.max(2, Math.min(128, Math.round(Number(e.target.value)) || 2)))} style={{ width: 80 }} />
          </>
        )}
        {kind === 'nano' && (
          <select value={ALPHABETS.some(([, a]) => a === alphabet) ? alphabet : ''} onChange={(e) => e.target.value && setAlphabet(e.target.value)} aria-label="Alphabet preset" style={{ width: 'auto' }}>
            {ALPHABETS.map(([label, a]) => <option key={label} value={a}>{label}</option>)}
            {!ALPHABETS.some(([, a]) => a === alphabet) && <option value="">Custom</option>}
          </select>
        )}
      </div>
      {kind === 'nano' && (
        <>
          <label htmlFor="ul-alpha">Alphabet ({uniqueChars} unique characters)</label>
          <input id="ul-alpha" type="text" value={alphabet} onChange={(e) => setAlphabet(e.target.value)} spellCheck={false} style={{ fontFamily: 'var(--mono)' }} />
          {uniqueChars >= 2 && (
            <p className="ul-hint" aria-live="polite">
              <span className={`chip ${safeLog >= 12 ? 'good' : safeLog >= 6 ? '' : 'bad calm'}`} key={Math.round(safeLog * 10)}>{humanCount(safeLog)} ids</span>
              <span className="muted">before a 1% chance of any collision ({(size * Math.log2(uniqueChars)).toFixed(0)} bits of randomness).</span>
            </p>
          )}
        </>
      )}

      {error && <p className="error shake-once" role="alert">{error}</p>}

      {ids.length <= 25 ? (
        <ol className="ul-list" aria-label="Generated ids" key={`${kind}-${turns}`}>
          {ids.map((id, i) => (
            <li key={i} className="settle-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
              <code>
                {kind === 'ulid' ? (
                  <>
                    <span className="ul-time" title="Timestamp part"><Scramble text={id.slice(0, 10)} pool={POOL.ulid} duration={200 + i * 12} /></span>
                    <Scramble text={id.slice(10)} pool={POOL.ulid} duration={220 + i * 12} />
                  </>
                ) : kind === 'v7' ? (
                  <>
                    <span className="ul-time" title="Timestamp part"><Scramble text={id.slice(0, hyphens ? 13 : 12)} pool={POOL.v7} duration={200 + i * 12} /></span>
                    <Scramble text={id.slice(hyphens ? 13 : 12)} pool={POOL.v7} duration={220 + i * 12} />
                  </>
                ) : (
                  <Scramble text={id} pool={POOL[kind]} duration={200 + i * 12} />
                )}
              </code>
              <CopyButton text={id} label="" />
            </li>
          ))}
        </ol>
      ) : (
        <textarea readOnly value={text} style={{ minHeight: 240 }} aria-label="Generated ids" />
      )}
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>
        <Roll>{ids.length}</Roll> ids
        {firstTime?.ok && firstTime.ms !== null ? <> · time part (highlighted) = {new Date(firstTime.ms).toISOString()}</> : null}
      </p>
      <div className="row">
        <button
          type="button"
          className="btn primary ul-regen"
          onClick={() => {
            setTurns((t) => t + 1)
            generate()
          }}
        >
          <span className="ul-spin" style={{ transform: `rotate(${turns * 360}deg)` }} aria-hidden="true">↻</span> Generate new
        </button>
        <CopyButton text={text} label="Copy all" />
        <button type="button" className="btn" onClick={download} disabled={!ids.length}>Download .txt</button>
      </div>

      <section className="ul-decode" aria-labelledby="ul-decode-h">
        <h3 id="ul-decode-h" style={{ margin: '0 0 8px', fontSize: '1rem' }}>Decode a timestamp</h3>
        <label htmlFor="ul-paste" className="muted" style={{ fontWeight: 400 }}>Paste a UUID v7 / v1 / v6 or a ULID</label>
        <div className="row" style={{ margin: '4px 0 0', flexWrap: 'nowrap' }}>
          <input id="ul-paste" type="text" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="e.g. 01ARYZ6S41TSV4RRFFQ69G5FAV" spellCheck={false} autoComplete="off" style={{ fontFamily: 'var(--mono)', flex: 1, minWidth: 0 }} />
          <button type="button" className="btn" onClick={() => setPasted(ids[0] ?? '')} disabled={!ids[0]}>Use first</button>
        </div>
        <div aria-live="polite">
          {decoded && !decoded.ok && <p className="error shake-once" key={decoded.error}>{decoded.error}</p>}
          {decoded?.ok && (
            <>
              <div className="ul-facts" key={pasted}>
                <div className="ul-fact">
                  <b>Type</b>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><span className="ok"><Check size={14} /></span>{decoded.kind}</span>
                </div>
                {decoded.ms !== null && (
                  <>
                    <div className="ul-fact" style={{ animationDelay: '40ms' }}><b>UTC</b><span>{new Date(decoded.ms).toISOString()}</span></div>
                    <div className="ul-fact" style={{ animationDelay: '80ms' }}><b>Your local time</b><span>{new Date(decoded.ms).toLocaleString()}</span></div>
                    <div className="ul-fact" style={{ animationDelay: '120ms' }}><b>Unix ms</b><span>{decoded.ms}</span></div>
                    <div className="ul-fact" style={{ animationDelay: '160ms' }}><b>Relative</b><span>{relative(decoded.ms)}</span></div>
                  </>
                )}
              </div>
              {decoded.note && <p className="muted" style={{ fontSize: '0.88rem' }}>{decoded.note}</p>}
            </>
          )}
        </div>
      </section>
      <p className="muted">
        Randomness comes from <code>crypto.getRandomValues</code> in your browser; nothing is sent anywhere. UUID v7 and ULID leak their creation time to anyone who sees them, so use v4 or NanoID for ids that must not reveal when they were made.
      </p>
    </div>
  )
}
