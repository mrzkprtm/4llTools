import { useEffect, useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { useScramble } from '../../motion/useScramble'
import { MAX_BYTES, MAX_COST, MIN_COST, SLOW_COST, byteLength, hashPassword, parseHash, verifyPassword } from './bcrypt'

type Tab = 'hash' | 'verify'

function Progress({ value }: { value: number }) {
  return (
    <div className="bar busy-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} style={{ margin: '10px 0' }}>
      <i style={{ transform: `scaleX(${Math.max(0.03, value)})` }} />
    </div>
  )
}

function LengthNote({ password }: { password: string }) {
  const bytes = byteLength(password)
  if (bytes <= MAX_BYTES) return <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>{bytes} / {MAX_BYTES} bytes</p>
  return (
    <p className="error" style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>
      {bytes} bytes: bcrypt only uses the first {MAX_BYTES} bytes, so anything after that is ignored (two passwords sharing the first {MAX_BYTES} bytes get the same hash).
    </p>
  )
}

function HashParts({ hash }: { hash: string }) {
  const parsed = parseHash(hash)
  if ('error' in parsed) return hash.trim() ? <p className="error">{parsed.error}</p> : null
  const p = parsed.parts
  const cells: [string, string, string][] = [
    ['Version', `$${p.version}$`, p.version === '2a' ? 'original' : p.version === '2y' ? 'PHP / Laravel' : 'current OpenBSD'],
    ['Cost', String(p.cost), `2^${p.cost} = ${(2 ** p.cost).toLocaleString()} rounds`],
    ['Salt', p.salt, '22 chars, 128 bits'],
    ['Hash', p.hash, '31 chars, 184 bits'],
  ]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="simple">
        <tbody>
          {cells.map(([k, v, note]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td style={{ fontFamily: 'var(--mono)', wordBreak: 'break-all' }}>{v}</td>
              <td className="muted" style={{ fontSize: '0.82rem' }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function HashOut({ hash }: { hash: string }) {
  const shown = useScramble(hash, { limit: 60, duration: 420, pool: './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' })
  return <div className="output" style={{ flex: 1, minWidth: 0 }}>{shown}</div>
}

export default function Bcrypt() {
  const [tab, setTab] = useState<Tab>('hash')
  const [password, setPassword] = useState('correct horse battery staple')
  const [cost, setCost] = useState(10)
  const [hash, setHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [ms, setMs] = useState(0)
  const [error, setError] = useState('')

  const [vPassword, setVPassword] = useState('correct horse battery staple')
  const [vHash, setVHash] = useState('$2b$10$GSEX37XLV97M6ihMxa8XdeBWfnTg31n023U8wR03VW6u.l6fK2SnG')
  const [vBusy, setVBusy] = useState(false)
  const [vProgress, setVProgress] = useState(0)
  const [match, setMatch] = useState<boolean | null>(null)
  const [vError, setVError] = useState('')
  const vParsed = useMemo(() => parseHash(vHash), [vHash])

  async function doHash() {
    setBusy(true)
    setError('')
    setProgress(0)
    const start = performance.now()
    try {
      setHash(await hashPassword(password, cost, setProgress))
      setMs(performance.now() - start)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function doVerify() {
    setVBusy(true)
    setVError('')
    setMatch(null)
    setVProgress(0)
    try {
      setMatch(await verifyPassword(vPassword, vHash, setVProgress))
    } catch (err) {
      setVError(err instanceof Error ? err.message : String(err))
    } finally {
      setVBusy(false)
    }
  }

  useEffect(() => {
    // Show a real result on first load.
    void doHash()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PillRow role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'hash'} className={`btn ${tab === 'hash' ? 'primary' : ''}`} onClick={() => setTab('hash')}>Generate hash</button>
        <button type="button" role="tab" aria-selected={tab === 'verify'} className={`btn ${tab === 'verify' ? 'primary' : ''}`} onClick={() => setTab('verify')}>Verify password</button>
      </PillRow>

      {tab === 'hash' ? (
        <div>
          <label htmlFor="bc-pw">Password</label>
          <input id="bc-pw" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} />
          <LengthNote password={password} />
          <label htmlFor="bc-cost">Cost factor: {cost} ({(2 ** cost).toLocaleString()} rounds)</label>
          <input id="bc-cost" type="range" min={MIN_COST} max={MAX_COST} value={cost} onChange={(e) => setCost(Number(e.target.value))} style={{ width: '100%' }} />
          {cost > SLOW_COST && <p className="error" style={{ margin: '4px 0 0', fontSize: '0.88rem' }}>Cost above {SLOW_COST} is slow: each step doubles the time, and {cost} may take {cost >= 14 ? 'many seconds' : 'a few seconds'} here.</p>}
          <div className="row">
            <button type="button" className="btn primary" onClick={doHash} disabled={busy}>{busy ? `Hashing… ${Math.round(progress * 100)}%` : 'Generate hash'}</button>
          </div>
          {busy && <Progress value={progress} />}
          {error && <p className="error">{error}</p>}
          {hash && !busy && (
            <div className="settle-in">
              <label>bcrypt hash <span className="muted" style={{ fontWeight: 400 }}>({(ms / 1000).toFixed(2)} s)</span></label>
              <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
                <HashOut hash={hash} />
                <CopyButton text={hash} />
              </div>
              <div className="row">
                <button type="button" className="btn" onClick={() => { setVPassword(password); setVHash(hash); setMatch(null); setTab('verify') }}>Test it in Verify →</button>
              </div>
              <HashParts hash={hash} />
            </div>
          )}
          <p className="muted">Every hash uses a new random salt, so the same password gives a different hash each time; that is expected. Cost 10–12 is typical for web apps.</p>
        </div>
      ) : (
        <div>
          <label htmlFor="bc-vpw">Password</label>
          <input id="bc-vpw" type="text" value={vPassword} onChange={(e) => { setVPassword(e.target.value); setMatch(null) }} autoComplete="off" spellCheck={false} />
          <LengthNote password={vPassword} />
          <label htmlFor="bc-vhash">bcrypt hash</label>
          <input id="bc-vhash" type="text" value={vHash} onChange={(e) => { setVHash(e.target.value); setMatch(null) }} spellCheck={false} placeholder="$2b$10$…" style={{ fontFamily: 'var(--mono)' }} />
          <HashParts hash={vHash} />
          <div className="row">
            <button type="button" className="btn primary" onClick={doVerify} disabled={vBusy || 'error' in vParsed}>{vBusy ? `Checking… ${Math.round(vProgress * 100)}%` : 'Check password'}</button>
          </div>
          {vBusy && <Progress value={vProgress} />}
          {vError && <p className="error">{vError}</p>}
          {match !== null && !vBusy && (
            <p role="status" style={{ margin: '12px 0' }}>
              <span className={`chip ${match ? 'good' : 'bad'}`} style={{ fontSize: '1rem', fontWeight: 650 }}>
                {match ? <><Check /> Match: the password fits this hash.</> : '✗ No match: this password does not produce this hash.'}
              </span>
            </p>
          )}
        </div>
      )}
      <p className="muted">Hashing runs in your browser with bcryptjs; nothing is sent anywhere.</p>
    </div>
  )
}
