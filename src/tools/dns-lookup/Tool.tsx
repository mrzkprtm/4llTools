import { useEffect, useRef, useState, type FormEvent } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import './tool.css'
import {
  RECORD_TYPES,
  TYPE_INFO,
  formatTtl,
  isIPv4,
  isIPv6,
  normalizeName,
  parseDkim,
  parseDmarc,
  parseSpf,
  resolve,
  reverseName,
  unquoteTxt,
  type DnsResult,
  type RecordType,
  type TagPart,
} from './dns'

type Mode = RecordType | 'ALL' | 'EMAIL'

interface Query {
  key: string
  label: string
  name: string
  type: RecordType
  hint?: string
}

type Slot = { state: 'busy' } | { state: 'done'; result: DnsResult & { provider: string }; ms: number } | { state: 'error'; error: string }

const ALL_TYPES: RecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA']

function planQueries(mode: Mode, raw: string, selector: string): { queries: Query[]; note?: string; error?: string } {
  const input = normalizeName(raw)
  if (!input) return { queries: [], error: 'Enter a domain name, e.g. example.com.' }
  if (isIPv4(input) || isIPv6(input)) {
    const ptr = reverseName(input)!
    return { queries: [{ key: 'PTR', label: 'PTR (reverse DNS)', name: ptr, type: 'PTR' }], note: mode !== 'PTR' ? 'That is an IP address, so this runs a reverse (PTR) lookup.' : undefined }
  }
  if (!/^[a-z0-9_.-]+$/i.test(input) || (!input.includes('.') && input !== 'localhost')) return { queries: [], error: `“${input}” does not look like a domain name.` }
  if (mode === 'PTR') return { queries: [], error: 'PTR (reverse) lookups need an IP address, like 1.1.1.1 or 2606:4700::1111.' }
  if (mode === 'ALL') return { queries: ALL_TYPES.map((t) => ({ key: t, label: t, name: input, type: t })) }
  if (mode === 'EMAIL') {
    const domain = input.replace(/^_dmarc\./, '')
    const q: Query[] = [
      { key: 'MX', label: 'MX: mail servers', name: domain, type: 'MX' },
      { key: 'SPF', label: 'SPF: who may send', name: domain, type: 'TXT', hint: 'spf' },
      { key: 'DMARC', label: 'DMARC: policy', name: `_dmarc.${domain}`, type: 'TXT', hint: 'dmarc' },
    ]
    const sel = selector.trim().replace(/\._domainkey.*$/, '')
    if (sel) q.push({ key: 'DKIM', label: `DKIM: selector “${sel}”`, name: `${sel}._domainkey.${domain}`, type: 'TXT', hint: 'dkim' })
    return { queries: q }
  }
  return { queries: [{ key: mode, label: mode, name: input, type: mode }] }
}

function Parts({ title, parts, warnings, extra }: { title: string; parts: TagPart[]; warnings: string[]; extra?: string }) {
  return (
    <div className="dn-parsed">
      <p className="dn-parsed-title">
        <b>{title}</b> {extra && <span className="chip">{extra}</span>}
        {warnings.length === 0 && <span className="chip good"><Check size={14} /> Looks good</span>}
      </p>
      <ul className="dn-tags">
        {parts.map((p, i) => (
          <li key={i} className="finding" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <code className={p.level ? `dn-tag-${p.level}` : ''}>{p.tag}{p.value && !p.tag.includes(p.value) ? `=${p.value}` : ''}</code>
            <span>{p.meaning}</span>
          </li>
        ))}
      </ul>
      {warnings.map((w) => <p key={w} className="dn-warn">⚠ {w}</p>)}
    </div>
  )
}

function TxtExplain({ txt, hint }: { txt: string; hint?: string }) {
  const spf = parseSpf(txt)
  if (spf) return <Parts title="SPF record" parts={spf.parts} warnings={spf.warnings} extra={`${spf.lookups}/10 lookups`} />
  const dmarc = parseDmarc(txt)
  if (dmarc) return <Parts title="DMARC record" parts={dmarc.parts} warnings={dmarc.warnings} extra={dmarc.policy ? `p=${dmarc.policy}` : undefined} />
  if (hint === 'dkim' || /v=DKIM1/i.test(txt)) {
    const dkim = parseDkim(txt)
    if (dkim) return <Parts title="DKIM key" parts={dkim.parts} warnings={dkim.warnings} extra={dkim.keyBits ? `~${dkim.keyBits}-bit` : undefined} />
  }
  return null
}

function ResultBlock({ q, slot }: { q: Query; slot: Slot | undefined }) {
  if (!slot || slot.state === 'busy') {
    return (
      <section className="dn-block dn-busy" aria-busy="true">
        <h3 className="dn-h">{q.label} <code>{q.name}</code></h3>
        <div className="bar busy-bar dn-bar"><i style={{ transform: 'scaleX(0.35)' }} /></div>
      </section>
    )
  }
  if (slot.state === 'error') {
    return (
      <section className="dn-block">
        <h3 className="dn-h">{q.label} <code>{q.name}</code></h3>
        <p className="error">{slot.error}</p>
      </section>
    )
  }
  const r = slot.result
  let answers = r.answers.filter((a) => a.type === q.type || q.type === 'CNAME' || a.type === 'CNAME')
  if (q.hint === 'spf') answers = answers.filter((a) => a.type !== 'TXT' || /^v=spf1/i.test(unquoteTxt(a.data)))
  if (q.hint === 'dmarc') answers = answers.filter((a) => a.type !== 'TXT' || /^v=DMARC1/i.test(unquoteTxt(a.data)))
  const spfCount = q.hint === 'spf' ? answers.filter((a) => a.type === 'TXT').length : 0
  const sorted = q.type === 'MX' ? [...answers].sort((a, b) => parseInt(a.data) - parseInt(b.data)) : answers
  const good = r.status === 0 && sorted.length > 0
  return (
    <section className="dn-block settle-in">
      <h3 className="dn-h">
        {q.label} <code>{q.name}</code>
      </h3>
      <p className="dn-chips">
        <span className={`chip ${r.status === 0 ? 'good' : 'bad'}`} title={r.statusText}>{r.statusName}</span>
        {r.ad ? <span className="chip good" title="The resolver checked the DNSSEC signatures of this answer."><Check size={14} /> DNSSEC validated</span> : <span className="chip calm" title="Either the zone is not signed with DNSSEC or validation did not apply.">No DNSSEC (AD=0)</span>}
        <span className="muted dn-meta">{slot.ms} ms · via {r.provider}</span>
      </p>
      {r.status !== 0 && <p className="muted dn-explain">{r.statusText}</p>}
      {r.status === 0 && sorted.length === 0 && (
        <p className="muted dn-explain">
          {q.hint === 'spf' ? 'No SPF record found: anyone can pretend to send mail from this domain. Add a TXT record starting with v=spf1.'
            : q.hint === 'dmarc' ? 'No DMARC record found at _dmarc. Add one (start with v=DMARC1; p=none; rua=mailto:…) to see who sends as you.'
              : q.hint === 'dkim' ? 'No DKIM key for this selector. Selectors differ per mail service (google, selector1, k1, s1…); check your provider.'
                : `The name exists but has no ${q.type} record.`}
        </p>
      )}
      {spfCount > 1 && <p className="dn-warn">⚠ {spfCount} SPF records: a domain must have exactly one, otherwise SPF fails.</p>}
      {good && (
        <div className="dn-table-wrap">
          <table className="simple dn-table">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">TTL</th><th scope="col">Data</th></tr>
            </thead>
            <tbody>
              {sorted.map((a, i) => {
                const data = a.type === 'TXT' ? unquoteTxt(a.data) : a.data
                return (
                  <tr key={i}>
                    <td className="dn-name">{a.name}</td>
                    <td><span className="dn-type">{a.type}</span></td>
                    <td title={`${a.ttl} seconds`}>{formatTtl(a.ttl)}</td>
                    <td className="dn-data">{data}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {good && sorted.filter((a) => a.type === 'TXT').map((a, i) => <TxtExplain key={i} txt={unquoteTxt(a.data)} hint={q.hint} />)}
    </section>
  )
}

export default function DnsLookup() {
  const [name, setName] = useState('example.com')
  const [mode, setMode] = useState<Mode>('ALL')
  const [selector, setSelector] = useState('google')
  const [queries, setQueries] = useState<Query[]>([])
  const [slots, setSlots] = useState<Record<string, Slot>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const abort = useRef<AbortController | null>(null)

  function run(m: Mode = mode) {
    const plan = planQueries(m, name, selector)
    abort.current?.abort()
    setError(plan.error ?? '')
    setNote(plan.note ?? '')
    setQueries(plan.queries)
    if (!plan.queries.length) return setSlots({})
    const ctrl = new AbortController()
    abort.current = ctrl
    setSlots(Object.fromEntries(plan.queries.map((q) => [q.key, { state: 'busy' } as Slot])))
    for (const q of plan.queries) {
      const start = performance.now()
      resolve(q.name, q.type, fetch, ctrl.signal).then(
        (result) => !ctrl.signal.aborted && setSlots((s) => ({ ...s, [q.key]: { state: 'done', result, ms: Math.round(performance.now() - start) } })),
        (err) => !ctrl.signal.aborted && setSlots((s) => ({ ...s, [q.key]: { state: 'error', error: err instanceof Error ? err.message : String(err) } })),
      )
    }
  }

  // No query on load: the page contacts no outside server until you press Look up.
  useEffect(() => () => abort.current?.abort(), [])

  function submit(e: FormEvent) {
    e.preventDefault()
    run()
  }

  function pick(m: Mode) {
    setMode(m)
    // Re-run only if the user has already looked something up.
    if (queries.length && name.trim()) run(m)
  }

  const busyCount = Object.values(slots).filter((s) => s.state === 'busy').length
  const summary = queries
    .map((q) => {
      const s = slots[q.key]
      if (s?.state !== 'done') return ''
      return `; ${q.label} ${q.name} (${s.result.statusName})\n${s.result.answers.map((a) => `${a.name}\t${a.ttl}\t${a.type}\t${a.data}`).join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')

  return (
    <div>
      <form onSubmit={submit} className="dn-form">
        <label htmlFor="dn-name">Domain, URL, e-mail or IP address</label>
        <div className="dn-input-row">
          <input id="dn-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="example.com" spellCheck={false} autoComplete="off" autoCapitalize="none" inputMode="url" />
          <button type="submit" className="btn primary" disabled={busyCount > 0}>{busyCount > 0 ? 'Looking up…' : 'Look up'}</button>
        </div>
        <PillRow role="radiogroup" label="Record type" className="dn-types">
          {(['ALL', ...RECORD_TYPES, 'EMAIL'] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`btn ${mode === m ? 'primary' : ''}`} onClick={() => pick(m)} title={m in TYPE_INFO ? TYPE_INFO[m as RecordType] : undefined}>
              {m === 'ALL' ? 'All' : m === 'EMAIL' ? 'Email check' : m}
            </button>
          ))}
        </PillRow>
        {mode === 'EMAIL' && (
          <div className="dn-sel settle-in">
            <label htmlFor="dn-sel">DKIM selector (optional)</label>
            <input id="dn-sel" type="text" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="google, selector1, k1, s1…" spellCheck={false} />
          </div>
        )}
        <p className="muted dn-typeinfo">
          {mode === 'ALL' ? 'Queries A, AAAA, CNAME, MX, TXT, NS, SOA and CAA at the same time.' : mode === 'EMAIL' ? 'Checks MX, SPF, DMARC and (with a selector) DKIM: the records that decide whether your mail lands in the inbox.' : TYPE_INFO[mode]}
        </p>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      {note && <p className="muted">{note}</p>}
      {busyCount > 0 && <Busy label={`Asking DNS… ${queries.length - busyCount}/${queries.length} answered`} />}

      {queries.length === 0 && !error && <p className="muted dn-idle">Press <b>Look up</b> (or Enter) to query. Nothing is sent until you do.</p>}

      <div className="dn-results" aria-live="polite">
        {queries.map((q) => <ResultBlock key={`${q.key}-${q.name}`} q={q} slot={slots[q.key]} />)}
      </div>

      {summary && busyCount === 0 && (
        <div className="row">
          <CopyButton text={summary} label="Copy all records" />
        </div>
      )}

      <p className="muted">
        Privacy note: unlike most tools here, this one has to contact an outside server. Lookups go straight from your browser to Cloudflare DNS-over-HTTPS (1.1.1.1), falling back to Google Public DNS, which see the names you look up.
        Results can differ from your local resolver because of caching (see the TTL) or split-horizon DNS.
      </p>
    </div>
  )
}
