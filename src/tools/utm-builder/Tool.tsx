import { useEffect, useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { useReplay } from '../../motion/useReplay'
import { useSettled } from '../../motion/useSettled'
import './tool.css'
import {
  PRESETS,
  UTM_KEYS,
  UTM_LABELS,
  buildBulk,
  buildFromParts,
  buildUtmUrl,
  missingRequired,
  parseUrl,
  toCsv,
  type UrlParts,
  type UtmParams,
} from './utm'

type Tab = 'build' | 'parse' | 'bulk'

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState('')
  const settled = useSettled(text, 250)
  useEffect(() => {
    let off = false
    if (!text) return setSrc('')
    import('qrcode')
      .then((QR) => QR.toDataURL(text, { width: 360, margin: 2, errorCorrectionLevel: 'M' }))
      .then((u) => !off && setSrc(u))
      .catch(() => !off && setSrc(''))
    return () => {
      off = true
    }
    // Only redraw once typing pauses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, text === ''])
  if (!src) return null
  return (
    <div className="ut-qr">
      <img key={src} src={src} alt="QR code of the tagged link" width={160} height={160} className="pop" />
      <a className="btn btn-icon" href={src} download="utm-link-qr.png">
        <Icon name="arrow-down" size={18} /> QR PNG
      </a>
    </div>
  )
}

/** The final URL with its UTM part highlighted. */
function UrlOut({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const settled = useSettled(url, 220)
  useReplay(ref, settled)
  const i = url.search(/[?&]utm_/)
  const hashAt = url.indexOf('#')
  const end = hashAt > i && i >= 0 ? hashAt : url.length
  return (
    <div ref={ref} className="output ut-url" aria-live="polite">
      {i < 0 ? url : (
        <>
          {url.slice(0, i)}
          <span className="ut-utm">{url.slice(i, end)}</span>
          {url.slice(end)}
        </>
      )}
    </div>
  )
}

export default function UtmBuilder() {
  const [tab, setTab] = useState<Tab>('build')
  const [base, setBase] = useState('https://example.com/promo?ref=home#pricing')
  const [params, setParams] = useState<UtmParams>({
    utm_source: 'instagram',
    utm_medium: 'social',
    utm_campaign: 'Ramadan Sale 2026',
    utm_term: '',
    utm_content: 'story_link',
    utm_id: '',
  })
  const [normalize, setNormalize] = useState(true)
  const [preset, setPreset] = useState('instagram')

  const built = useMemo(() => buildUtmUrl(base, params, normalize), [base, params, normalize])
  const missing = missingRequired(params)

  const [parseIn, setParseIn] = useState('https://shop.example.com/products/kopi?utm_source=google&utm_medium=cpc&utm_campaign=kopi_launch&gclid=abc123#reviews')
  const [parts, setParts] = useState<UrlParts | null>(() => parseUrl(parseIn))
  const rebuilt = useMemo(() => (parts ? buildFromParts(parts) : null), [parts])

  const [bulkIn, setBulkIn] = useState('https://example.com/\nhttps://example.com/blog/post-1\nexample.com/pricing?plan=pro')
  const bulk = useMemo(() => buildBulk(bulkIn, params, normalize), [bulkIn, params, normalize])
  const bulkText = bulk.map((r) => r.url ?? `# ${r.input}: ${r.error}`).join('\n')

  function set(key: keyof UtmParams, value: string) {
    setParams((p) => ({ ...p, [key]: value }))
    if (key === 'utm_source' || key === 'utm_medium') setPreset('')
  }

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setParams((cur) => ({ ...cur, utm_source: p.source, utm_medium: p.medium }))
  }

  function onParseInput(v: string) {
    setParseIn(v)
    setParts(parseUrl(v))
  }

  function editParam(i: number, which: 0 | 1, v: string) {
    setParts((p) => (p ? { ...p, params: p.params.map((row, j) => (j === i ? ((which === 0 ? [v, row[1]] : [row[0], v]) as [string, string]) : row)) } : p))
  }

  function useInBuilder() {
    if (!parts) return
    const next = { ...params }
    for (const k of UTM_KEYS) next[k] = parts.params.find(([name]) => name === k)?.[1] ?? ''
    const rest = { ...parts, params: parts.params.filter(([k]) => !k.startsWith('utm_')) }
    const r = buildFromParts(rest)
    if ('url' in r) setBase(r.url)
    setParams(next)
    setPreset('')
    setTab('build')
  }

  const settings = (
    <>
      <div className="ut-presets" role="group" aria-label="Source presets">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={`btn ut-preset ${preset === p.id ? 'is-on' : ''}`} aria-pressed={preset === p.id} onClick={() => applyPreset(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="ut-grid">
        {UTM_KEYS.map((k) => (
          <div key={k}>
            <label htmlFor={`ut-${k}`}>
              {UTM_LABELS[k].label} <code className="ut-key">{k}</code>
              {(k === 'utm_source' || k === 'utm_medium' || k === 'utm_campaign') && <span className="ut-req" aria-hidden="true"> *</span>}
            </label>
            <input id={`ut-${k}`} type="text" value={params[k]} onChange={(e) => set(k, e.target.value)} placeholder={UTM_LABELS[k].hint} spellCheck={false} autoComplete="off" />
          </div>
        ))}
      </div>
      <label className="ut-check">
        <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} /> Lowercase values and turn spaces into underscores
      </label>
    </>
  )

  return (
    <div>
      <PillRow role="tablist" label="Mode">
        {([['build', 'Build link'], ['parse', 'Parse URL'], ['bulk', 'Bulk tag']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? 'primary' : ''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </PillRow>

      {tab === 'build' && (
        <div className="settle-in">
          <label htmlFor="ut-base">Page URL</label>
          <input id="ut-base" type="url" value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://example.com/landing-page" spellCheck={false} inputMode="url" />
          {settings}
          {'error' in built ? (
            <p className="error" role="alert">{built.error}</p>
          ) : (
            <>
              <label>Tagged link</label>
              <UrlOut url={built.url} />
              {missing.length > 0 && (
                <p className="muted ut-warn">Tip: fill in {missing.map((m) => UTM_LABELS[m].label.toLowerCase()).join(', ')}. Google Analytics groups traffic by source, medium and campaign.</p>
              )}
              <div className="ut-out-row">
                <div className="row">
                  <CopyButton text={built.url} label="Copy link" />
                  <button type="button" className="btn" onClick={() => onParseInput(built.url)}>Inspect in Parse →</button>
                </div>
                <Qr text={built.url} />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'parse' && (
        <div className="settle-in">
          <label htmlFor="ut-parse">Any URL</label>
          <textarea id="ut-parse" value={parseIn} onChange={(e) => onParseInput(e.target.value)} spellCheck={false} style={{ minHeight: 70 }} />
          {!parts ? (
            parseIn.trim() && <p className="error" role="alert">That does not look like a URL.</p>
          ) : (
            <>
              <div className="ut-grid">
                <div>
                  <label htmlFor="ut-proto">Protocol</label>
                  <input type="text" id="ut-proto" value={parts.protocol} onChange={(e) => setParts({ ...parts, protocol: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="ut-host">Host</label>
                  <input type="text" id="ut-host" value={parts.host} onChange={(e) => setParts({ ...parts, host: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="ut-path">Path</label>
                  <input type="text" id="ut-path" value={parts.pathname} onChange={(e) => setParts({ ...parts, pathname: e.target.value })} spellCheck={false} />
                </div>
                <div>
                  <label htmlFor="ut-hash">Hash (#fragment)</label>
                  <input type="text" id="ut-hash" value={parts.hash} onChange={(e) => setParts({ ...parts, hash: e.target.value })} spellCheck={false} />
                </div>
              </div>
              <label>Query parameters ({parts.params.length})</label>
              <div className="ut-table-wrap">
                <table className="simple ut-table">
                  <thead>
                    <tr><th scope="col">Name</th><th scope="col">Value</th><th scope="col"><span className="ut-sr">Remove</span></th></tr>
                  </thead>
                  <tbody>
                    {parts.params.map(([k, v], i) => (
                      <tr key={i} className={k.startsWith('utm_') ? 'ut-row-utm' : ''}>
                        <td><input type="text" aria-label={`Parameter ${i + 1} name`} value={k} onChange={(e) => editParam(i, 0, e.target.value)} spellCheck={false} /></td>
                        <td><input type="text" aria-label={`Parameter ${i + 1} value`} value={v} onChange={(e) => editParam(i, 1, e.target.value)} spellCheck={false} /></td>
                        <td>
                          <button type="button" className="btn ut-x" aria-label={`Remove ${k || 'parameter'}`} onClick={() => setParts({ ...parts, params: parts.params.filter((_, j) => j !== i) })}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row">
                <button type="button" className="btn" onClick={() => setParts({ ...parts, params: [...parts.params, ['', '']] })}>+ Add parameter</button>
                <button type="button" className="btn" onClick={() => setParts({ ...parts, params: parts.params.filter(([k]) => !k.startsWith('utm_')) })}>Strip utm_*</button>
                <button type="button" className="btn primary" onClick={useInBuilder}>Edit in builder</button>
              </div>
              {rebuilt && ('error' in rebuilt ? <p className="error">{rebuilt.error}</p> : (
                <>
                  <label>Rebuilt URL</label>
                  <div className="row" style={{ margin: 0, flexWrap: 'nowrap', alignItems: 'stretch' }}>
                    <div style={{ flex: 1, minWidth: 0 }}><UrlOut url={rebuilt.url} /></div>
                    <CopyButton text={rebuilt.url} />
                  </div>
                </>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'bulk' && (
        <div className="settle-in">
          <label htmlFor="ut-bulk">Base URLs, one per line</label>
          <textarea id="ut-bulk" value={bulkIn} onChange={(e) => setBulkIn(e.target.value)} spellCheck={false} style={{ minHeight: 110 }} />
          {settings}
          <label htmlFor="ut-bulk-out">Tagged links ({bulk.filter((r) => r.url).length}{bulk.some((r) => r.error) ? `, ${bulk.filter((r) => r.error).length} skipped` : ''})</label>
          <SettleOutput id="ut-bulk-out" value={bulkText} style={{ minHeight: 110 }} />
          <div className="row">
            <CopyButton text={bulk.filter((r) => r.url).map((r) => r.url).join('\n')} label="Copy all" />
            <button type="button" className="btn btn-icon" disabled={!bulk.length} onClick={() => download('utm-links.csv', toCsv(bulk), 'text/csv')}>
              <Icon name="arrow-down" size={18} /> Download CSV
            </button>
          </div>
        </div>
      )}

      <p className="muted">
        UTM parameters tell Google Analytics, Matomo or Plausible where a visit came from. Existing query parameters and the #hash are kept; only utm_* values you fill in are added or replaced.
        Use the same spelling every time (the lowercase option helps), and never put personal data in UTM tags.
      </p>
    </div>
  )
}
