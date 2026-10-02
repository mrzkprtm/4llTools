import { useEffect, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import { useSettled } from '../../motion/useSettled'
import './tool.css'
import type { UaSummary } from './ua'

type UaModule = typeof import('./ua')

interface UaData {
  brands?: { brand: string; version: string }[]
  mobile?: boolean
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}

const HINTS = ['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList', 'wow64', 'formFactors']

function hintValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x && 'brand' in x ? `${(x as { brand: string }).brand} ${(x as { version: string }).version}` : String(x))).join(', ')
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  return v === '' || v === undefined ? '(empty)' : String(v)
}

function Card({ title, main, sub, delay }: { title: string; main: string; sub?: string; delay: number }) {
  return (
    <div className="ua-card" style={{ animationDelay: `${delay}ms` }}>
      <span className="ua-card-t">{title}</span>
      <b key={main} className="ua-card-v">{main}</b>
      {sub && <span className="ua-card-s">{sub}</span>}
    </div>
  )
}

export default function UserAgentParser() {
  const [mod, setMod] = useState<UaModule | null>(null)
  const [loadError, setLoadError] = useState('')
  const [ua, setUa] = useState('')
  const [mine, setMine] = useState('')
  const [hints, setHints] = useState<[string, string][] | null>(null)
  const [hintsState, setHintsState] = useState<'idle' | 'busy' | 'none' | 'done'>('idle')
  const settled = useSettled(ua, 150)

  useEffect(() => {
    const own = navigator.userAgent
    setMine(own)
    setUa(own)
    import('./ua').then(setMod, () => setLoadError('Could not load the parser. Check your connection and reload.'))
    const data = (navigator as Navigator & { userAgentData?: UaData }).userAgentData
    if (!data?.getHighEntropyValues) {
      setHintsState('none')
      return
    }
    setHintsState('busy')
    data
      .getHighEntropyValues(HINTS)
      .then((v) => {
        const rows: [string, string][] = [
          ['platform', hintValue(v.platform ?? data.platform)],
          ['mobile', hintValue(v.mobile ?? data.mobile)],
          ...HINTS.filter((h) => h in v).map((h) => [h, hintValue(v[h])] as [string, string]),
        ]
        setHints(rows)
        setHintsState('done')
      })
      .catch(() => setHintsState('none'))
  }, [])

  const r: UaSummary | null = mod && ua.trim() ? mod.parseUa(ua) : null
  const isMine = ua === mine && !!mine

  return (
    <div>
      <label htmlFor="ua-in">User agent string</label>
      <textarea id="ua-in" value={ua} onChange={(e) => setUa(e.target.value)} spellCheck={false} placeholder="Mozilla/5.0 (…)" style={{ minHeight: 90 }} />
      <div className="row">
        <button type="button" className="btn" onClick={() => setUa(mine)} disabled={isMine || !mine}>Use my browser</button>
        <button type="button" className="btn" onClick={() => setUa('')} disabled={!ua}>Clear</button>
        <CopyButton text={ua} />
      </div>
      <p className="muted ua-samples-label">Try a sample:</p>
      <div className="ua-samples">
        {mod?.SAMPLES.map((s) => (
          <button key={s.label} type="button" className={`btn ua-sample ${ua === s.ua ? 'is-on' : ''}`} aria-pressed={ua === s.ua} onClick={() => setUa(s.ua)}>{s.label}</button>
        ))}
      </div>

      {loadError && <p className="error">{loadError}</p>}
      {!mod && !loadError && <Busy label="Loading parser…" />}

      {r && (
        <div key={settled} className="settle-in">
          <p className="ua-summary" aria-live="polite">
            {r.bot ? <span className="chip bad calm">Bot</span> : <span className="chip good"><Check size={14} /> Looks like a person</span>}
            {isMine && <span className="chip">Your browser</span>}
            <span className="ua-desc">{mod!.describe(r)}</span>
          </p>
          <div className="ua-grid">
            <Card title="Browser" main={mod!.joinName(r.browser.name, r.browser.version)} sub={r.browser.type ? `type: ${r.browser.type}` : undefined} delay={0} />
            <Card title="Engine" main={mod!.joinName(r.engine.name, r.engine.version)} delay={40} />
            <Card title="Operating system" main={mod!.joinName(r.os.name, r.os.version)} delay={80} />
            <Card title="Device" main={mod!.deviceKind(r)} sub={[r.device.vendor, r.device.model].filter(Boolean).join(' ') || undefined} delay={120} />
            <Card title="CPU" main={r.cpu.architecture ?? 'Unknown'} delay={160} />
          </div>
          {r.bot && (
            <p className="muted ua-note">
              {r.bot.kind === 'ai' ? 'This is an AI crawler or AI assistant: it fetches pages for AI models or AI answers. You can allow or block it in robots.txt.' : 'Automated clients announce themselves in the user agent. Note that anyone can fake a user agent, so to trust a “Googlebot” check its IP with a reverse DNS lookup.'}
            </p>
          )}
          {isMine && /Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && (
            <p className="muted ua-note">This “Mac” has a touch screen, so it is probably an iPad in desktop mode.</p>
          )}
        </div>
      )}

      <h3 className="ua-h">Client hints from your browser</h3>
      {hintsState === 'busy' && <Busy label="Asking your browser for client hints…" />}
      {hintsState === 'none' && <p className="muted">Your browser does not expose User-Agent Client Hints (Safari and Firefox don’t). Chrome, Edge and other Chromium browsers do.</p>}
      {hintsState === 'done' && hints && (
        <div className="ua-table-wrap">
          <table className="simple">
            <tbody>
              {hints.map(([k, v]) => (
                <tr key={k}><th scope="row">{k}</th><td className="ua-hint">{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted">
        Chromium browsers now freeze parts of the user agent (for example Windows 11 still says “Windows NT 10.0”, and Android hides the model), so client hints are the accurate source for the version and device.
        Browser, OS and device parsing uses ua-parser-js; bots, AI crawlers, command-line tools and HTTP libraries are matched against a built-in list of known user agents. Everything runs in your browser; nothing is sent anywhere.
      </p>
    </div>
  )
}
