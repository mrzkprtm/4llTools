export const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV', 'PTR'] as const
export type RecordType = (typeof RECORD_TYPES)[number]

export const TYPE_CODES: Record<number, string> = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 43: 'DS', 46: 'RRSIG', 48: 'DNSKEY', 65: 'HTTPS', 257: 'CAA' }

export const TYPE_INFO: Record<RecordType, string> = {
  A: 'IPv4 address the name points to',
  AAAA: 'IPv6 address the name points to',
  CNAME: 'Alias: this name is another name',
  MX: 'Mail servers that accept email for the domain, lowest priority first',
  TXT: 'Free text: SPF, DMARC, site verification tokens',
  NS: 'Name servers that are authoritative for the zone',
  SOA: 'Start of authority: primary server, admin contact and timers',
  CAA: 'Which certificate authorities may issue TLS certificates',
  SRV: 'Service location: priority, weight, port and target (name like _sip._tcp.example.com)',
  PTR: 'Reverse DNS: the name for an IP address',
}

export const RCODES: Record<number, { name: string; text: string }> = {
  0: { name: 'NOERROR', text: 'The query worked. If there are no answers, the name exists but has no record of this type.' },
  1: { name: 'FORMERR', text: 'The server could not understand the query.' },
  2: { name: 'SERVFAIL', text: 'The resolver could not get an answer, often a broken DNSSEC signature or unreachable name servers.' },
  3: { name: 'NXDOMAIN', text: 'This name does not exist in DNS. Check the spelling or whether the domain is registered.' },
  4: { name: 'NOTIMP', text: 'The server does not support this kind of query.' },
  5: { name: 'REFUSED', text: 'The server refused to answer.' },
}

/** Takes a domain, URL or e-mail address and returns a bare, lowercase (punycode) hostname. */
export function normalizeName(input: string): string {
  let s = input.trim()
  if (!s) return ''
  if (s.includes('@') && !s.includes('/')) s = s.slice(s.lastIndexOf('@') + 1)
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/[/?#].*$/, '')
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1)
  if (isIPv6(s)) return s
  s = s.replace(/:\d+$/, '').replace(/\.$/, '')
  // Leading underscores (_dmarc, _sip._tcp) are valid DNS labels but not URL hosts, so only convert the rest.
  try {
    const labels = s.split('.')
    const prefix = []
    while (labels.length && labels[0].startsWith('_')) prefix.push(labels.shift()!.toLowerCase())
    const host = labels.length ? new URL(`http://${labels.join('.')}`).hostname : ''
    return [...prefix, host].filter(Boolean).join('.')
  } catch {
    return s.toLowerCase()
  }
}

export function isIPv4(s: string): boolean {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  return !!m && m.slice(1).every((x) => Number(x) <= 255)
}

export function isIPv6(s: string): boolean {
  return s.includes(':') && expandIPv6(s) !== null
}

/** Expands an IPv6 address to 32 hex digits, or returns null if it is not one. */
export function expandIPv6(s: string): string | null {
  let ip = s.trim().toLowerCase()
  // Embedded IPv4 at the end (::ffff:192.0.2.1)
  const v4 = ip.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    if (!isIPv4(v4[1])) return null
    const b = v4[1].split('.').map(Number)
    ip = ip.slice(0, -v4[1].length) + ((b[0] << 8) | b[1]).toString(16) + ':' + ((b[2] << 8) | b[3]).toString(16)
  }
  if (!/^[0-9a-f:]+$/.test(ip) || (ip.match(/::/g) ?? []).length > 1) return null
  const [head, tail] = ip.includes('::') ? ip.split('::') : [ip, undefined]
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const missing = 8 - h.length - t.length
  if (tail === undefined ? h.length !== 8 : missing < 1) return null
  const groups = [...h, ...Array(tail === undefined ? 0 : missing).fill('0'), ...t]
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null
  return groups.map((g) => g.padStart(4, '0')).join('')
}

/** The PTR name for an IP: 4.3.2.1.in-addr.arpa or nibbles.ip6.arpa. Null when the input is not an IP. */
export function reverseName(ip: string): string | null {
  const s = ip.trim()
  if (isIPv4(s)) return `${s.split('.').reverse().join('.')}.in-addr.arpa`
  const hex = expandIPv6(s)
  if (hex) return `${[...hex].reverse().join('.')}.ip6.arpa`
  return null
}

export interface DnsAnswer {
  name: string
  type: string
  ttl: number
  data: string
}

export interface DnsResult {
  status: number
  statusName: string
  statusText: string
  /** Authenticated Data: the resolver validated DNSSEC signatures. */
  ad: boolean
  truncated: boolean
  answers: DnsAnswer[]
  authority: DnsAnswer[]
  comment?: string
}

interface RawRecord {
  name?: string
  type?: number
  TTL?: number
  data?: string
}

interface RawResponse {
  Status?: number
  TC?: boolean
  AD?: boolean
  Answer?: RawRecord[]
  Authority?: RawRecord[]
  Comment?: string | string[]
}

function mapRecords(list: RawRecord[] | undefined): DnsAnswer[] {
  return (list ?? []).map((r) => {
    const type = TYPE_CODES[r.type ?? 0] ?? `TYPE${r.type}`
    let data = String(r.data ?? '')
    if (type === 'CAA') data = decodeCaa(data)
    return { name: String(r.name ?? '').replace(/\.$/, ''), type, ttl: Number(r.TTL ?? 0), data }
  })
}

/** Maps a DNS-over-HTTPS JSON response (Cloudflare or Google format) into a friendlier shape. */
export function mapResponse(json: unknown): DnsResult {
  if (!json || typeof json !== 'object' || typeof (json as RawResponse).Status !== 'number') throw new Error('The DNS server sent an unexpected response.')
  const r = json as RawResponse
  const status = r.Status!
  const rc = RCODES[status] ?? { name: `RCODE ${status}`, text: 'Unusual response code.' }
  return {
    status,
    statusName: rc.name,
    statusText: rc.text,
    ad: !!r.AD,
    truncated: !!r.TC,
    answers: mapRecords(r.Answer),
    authority: mapRecords(r.Authority),
    comment: Array.isArray(r.Comment) ? r.Comment.join(' ') : r.Comment,
  }
}

/**
 * Some resolvers return CAA in RFC 3597 generic form ("\# 22 00 05 69 73 73 75 65 …").
 * This turns it into "0 issue "letsencrypt.org"". Other input is returned unchanged.
 */
export function decodeCaa(data: string): string {
  const m = data.trim().match(/^\\#\s+\d+\s+([0-9a-f\s]+)$/i)
  if (!m) return data
  const bytes = m[1].replace(/\s+/g, '').match(/../g)?.map((h) => parseInt(h, 16)) ?? []
  if (bytes.length < 2) return data
  const flags = bytes[0]
  const tagLen = bytes[1]
  const tag = String.fromCharCode(...bytes.slice(2, 2 + tagLen))
  const value = new TextDecoder().decode(new Uint8Array(bytes.slice(2 + tagLen)))
  return `${flags} ${tag} "${value}"`
}

/** Joins the quoted chunks of a TXT record ("v=spf1 …" "…more") into one string. */
export function unquoteTxt(data: string): string {
  const chunks = data.match(/"((?:[^"\\]|\\.)*)"/g)
  if (!chunks) return data
  return chunks.map((c) => c.slice(1, -1).replace(/\\(.)/g, '$1')).join('')
}

export function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const parts: string[] = []
  let s = seconds
  for (const [unit, n] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]] as [string, number][]) {
    if (s >= n) {
      parts.push(`${Math.floor(s / n)}${unit}`)
      s %= n
    }
  }
  return parts.slice(0, 2).join(' ')
}

export interface TagPart {
  tag: string
  value: string
  meaning: string
  level?: 'good' | 'bad'
}

const QUALIFIERS: Record<string, string> = { '+': 'pass', '-': 'fail (reject)', '~': 'softfail (accept but mark)', '?': 'neutral' }

/** Explains each mechanism of an SPF record and counts DNS lookups (the limit is 10). */
export function parseSpf(txt: string): { parts: TagPart[]; lookups: number; warnings: string[] } | null {
  const t = txt.trim()
  if (!/^v=spf1(\s|$)/i.test(t)) return null
  const parts: TagPart[] = []
  const warnings: string[] = []
  let lookups = 0
  let sawAll = false
  for (const term of t.split(/\s+/).slice(1)) {
    const q = /^[+\-~?]/.test(term) ? term[0] : '+'
    const body = /^[+\-~?]/.test(term) ? term.slice(1) : term
    const [mech, ...rest] = body.split(/[:=]/)
    const arg = rest.join(':')
    const m = mech.toLowerCase()
    let meaning = ''
    switch (m) {
      case 'ip4':
      case 'ip6':
        meaning = `Mail from ${arg} is allowed → ${QUALIFIERS[q]}`
        break
      case 'a':
        lookups++
        meaning = `Servers in the A/AAAA record of ${arg || 'this domain'} → ${QUALIFIERS[q]}`
        break
      case 'mx':
        lookups++
        meaning = `The domain's mail servers (${arg || 'this domain'}) → ${QUALIFIERS[q]}`
        break
      case 'include':
        lookups++
        meaning = `Also use the SPF policy of ${arg} (common for Google, Microsoft, mail services)`
        break
      case 'exists':
        lookups++
        meaning = `Passes if ${arg} resolves`
        break
      case 'ptr':
        lookups++
        meaning = 'Reverse DNS check (slow and discouraged by RFC 7208)'
        warnings.push('The ptr mechanism is deprecated; remove it.')
        break
      case 'redirect':
        lookups++
        meaning = `Use ${arg}'s SPF record instead`
        break
      case 'exp':
        meaning = `Explanation text for failures comes from ${arg}`
        break
      case 'all':
        sawAll = true
        meaning = `Everything else → ${QUALIFIERS[q]}`
        break
      default:
        meaning = 'Unknown mechanism'
        warnings.push(`Unknown SPF term “${term}”.`)
    }
    const level = m === 'all' ? (q === '-' || q === '~' ? 'good' : 'bad') : undefined
    parts.push({ tag: term, value: arg, meaning, level })
  }
  if (lookups > 10) warnings.push(`${lookups} DNS lookups: SPF allows at most 10, so receivers will treat this record as an error (permerror).`)
  if (!sawAll && !/redirect=/i.test(t)) warnings.push('No “all” at the end, so unknown senders get a neutral result. Add ~all or -all.')
  if (/\+all\b/i.test(t)) warnings.push('+all lets anyone on the internet send mail as this domain.')
  return { parts, lookups, warnings }
}

const DMARC_TAGS: Record<string, (v: string) => string> = {
  v: () => 'DMARC version',
  p: (v) => ({ none: 'Monitor only: failing mail is still delivered', quarantine: 'Failing mail goes to spam', reject: 'Failing mail is rejected' })[v.toLowerCase()] ?? 'Unknown policy',
  sp: (v) => `Policy for subdomains: ${v}`,
  pct: (v) => `Apply the policy to ${v}% of failing mail`,
  rua: (v) => `Aggregate (daily) reports go to ${v}`,
  ruf: (v) => `Forensic (per-message) reports go to ${v}`,
  adkim: (v) => (v === 's' ? 'DKIM alignment: strict (exact domain)' : 'DKIM alignment: relaxed (subdomains ok)'),
  aspf: (v) => (v === 's' ? 'SPF alignment: strict (exact domain)' : 'SPF alignment: relaxed (subdomains ok)'),
  fo: (v) => `Failure report options: ${v}`,
  ri: (v) => `Report interval: ${formatTtl(Number(v) || 0)}`,
  rf: (v) => `Report format: ${v}`,
}

function parseTags(txt: string): [string, string][] {
  return txt
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((kv) => {
      const i = kv.indexOf('=')
      return i < 0 ? [kv.toLowerCase(), ''] : [kv.slice(0, i).trim().toLowerCase(), kv.slice(i + 1).trim()]
    })
}

export function parseDmarc(txt: string): { parts: TagPart[]; policy: string; warnings: string[] } | null {
  if (!/^v=DMARC1\s*(;|$)/i.test(txt.trim())) return null
  const tags = parseTags(txt)
  const warnings: string[] = []
  const policy = tags.find(([k]) => k === 'p')?.[1].toLowerCase() ?? ''
  if (!policy) warnings.push('The required p= tag is missing.')
  if (policy === 'none') warnings.push('p=none only monitors. Move to quarantine or reject once reports look clean.')
  if (!tags.some(([k]) => k === 'rua')) warnings.push('No rua= address, so you will not receive reports.')
  const parts = tags.map(([tag, value]) => ({
    tag,
    value,
    meaning: DMARC_TAGS[tag]?.(value) ?? 'Unknown tag',
    level: tag === 'p' ? (policy === 'none' ? ('bad' as const) : ('good' as const)) : undefined,
  }))
  return { parts, policy, warnings }
}

export function parseDkim(txt: string): { parts: TagPart[]; keyBits?: number; warnings: string[] } | null {
  const t = txt.trim()
  if (!/(^|;)\s*p=/i.test(t) || !(/^v=DKIM1/i.test(t) || /(^|;)\s*k=/i.test(t) || /(^|;)\s*p=[A-Za-z0-9+/]{40,}/.test(t))) return null
  const tags = parseTags(t)
  const warnings: string[] = []
  const p = tags.find(([k]) => k === 'p')?.[1].replace(/\s+/g, '') ?? ''
  // Base64 length → DER bytes; an RSA SubjectPublicKeyInfo is ~38 bytes of overhead plus the modulus.
  const der = Math.floor((p.length * 3) / 4)
  const keyType = tags.find(([k]) => k === 'k')?.[1] ?? 'rsa'
  const keyBits = !p ? undefined : keyType === 'ed25519' ? 256 : [4096, 3072, 2048, 1024, 768, 512].find((b) => der >= b / 8 + 20)
  if (!p) warnings.push('Empty p=: this DKIM key has been revoked.')
  else if (keyType === 'rsa' && keyBits && keyBits < 2048) warnings.push(`${keyBits}-bit RSA key: use 2048 bits or more.`)
  const names: Record<string, string> = { v: 'DKIM version', k: 'Key type', p: 'Public key (base64)', t: 'Flags (y = testing, s = strict)', h: 'Allowed hash algorithms', s: 'Service type', n: 'Notes' }
  return { parts: tags.map(([tag, value]) => ({ tag, value: tag === 'p' && value.length > 40 ? `${value.slice(0, 40)}…` : value, meaning: names[tag] ?? 'Unknown tag' })), keyBits, warnings }
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

export const PROVIDERS = [
  { name: 'Cloudflare', url: (n: string, t: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(n)}&type=${t}` },
  { name: 'Google', url: (n: string, t: string) => `https://dns.google/resolve?name=${encodeURIComponent(n)}&type=${t}` },
]

/** Queries Cloudflare DNS-over-HTTPS and falls back to Google when it fails. */
export async function resolve(name: string, type: string, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<DnsResult & { provider: string }> {
  let lastErr: unknown
  for (const p of PROVIDERS) {
    try {
      const res = await fetcher(p.url(name, type), { headers: { accept: 'application/dns-json' }, signal })
      if (!res.ok) throw new Error(`${p.name} answered HTTP ${res.status}`)
      return { ...mapResponse(await res.json()), provider: p.name }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      lastErr = err
    }
  }
  throw new Error(`Could not reach Cloudflare or Google DNS (${lastErr instanceof Error ? lastErr.message : String(lastErr)}). An ad blocker or network filter may block DNS-over-HTTPS.`)
}
