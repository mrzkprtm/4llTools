export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'] as const
export type UtmKey = (typeof UTM_KEYS)[number]
export type UtmParams = Record<UtmKey, string>

export const UTM_LABELS: Record<UtmKey, { label: string; hint: string }> = {
  utm_source: { label: 'Source', hint: 'Where the traffic comes from: google, facebook, newsletter' },
  utm_medium: { label: 'Medium', hint: 'The channel type: cpc, social, email, referral' },
  utm_campaign: { label: 'Campaign', hint: 'Campaign name or promo code: spring_sale' },
  utm_term: { label: 'Term', hint: 'Paid keyword (optional)' },
  utm_content: { label: 'Content', hint: 'Which ad or link was clicked (optional): banner_a' },
  utm_id: { label: 'Campaign ID', hint: 'Ads campaign ID (optional)' },
}

export interface Preset {
  id: string
  label: string
  source: string
  medium: string
}

export const PRESETS: Preset[] = [
  { id: 'google', label: 'Google Ads', source: 'google', medium: 'cpc' },
  { id: 'facebook', label: 'Facebook', source: 'facebook', medium: 'social' },
  { id: 'instagram', label: 'Instagram', source: 'instagram', medium: 'social' },
  { id: 'tiktok', label: 'TikTok', source: 'tiktok', medium: 'social' },
  { id: 'newsletter', label: 'Newsletter', source: 'newsletter', medium: 'email' },
  { id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'messaging' },
]

export function emptyParams(): UtmParams {
  return { utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '', utm_id: '' }
}

/** Lowercases, trims and turns runs of spaces into underscores so reports don't split "Spring Sale" and "spring sale". */
export function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Parses a URL, adding https:// when the scheme is missing. Returns null if it still isn't a URL. */
export function toUrl(input: string): URL | null {
  const s = input.trim()
  if (!s) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if ((u.protocol === 'http:' || u.protocol === 'https:') && !u.hostname) return null
    return u
  } catch {
    return null
  }
}

export type BuildResult = { url: string } | { error: string }

/**
 * Adds UTM parameters to a URL. Existing query parameters and the #hash are kept;
 * existing utm_* values are replaced only when a new non-empty value is given.
 */
export function buildUtmUrl(base: string, params: UtmParams, normalize = false): BuildResult {
  if (!base.trim()) return { error: 'Enter the page address you want to track.' }
  const u = toUrl(base)
  if (!u) return { error: 'That does not look like a web address. Example: https://example.com/page' }
  for (const key of UTM_KEYS) {
    const raw = params[key] ?? ''
    const value = normalize ? normalizeValue(raw) : raw.trim()
    if (value) u.searchParams.set(key, value)
  }
  return { url: u.toString() }
}

/** Which recommended fields are missing (source, medium and campaign are what GA4 needs). */
export function missingRequired(params: UtmParams): UtmKey[] {
  return (['utm_source', 'utm_medium', 'utm_campaign'] as UtmKey[]).filter((k) => !params[k].trim())
}

export interface UrlParts {
  protocol: string
  host: string
  pathname: string
  params: [string, string][]
  hash: string
}

export function parseUrl(input: string): UrlParts | null {
  const u = toUrl(input)
  if (!u) return null
  return {
    protocol: u.protocol.replace(/:$/, ''),
    host: u.host,
    pathname: u.pathname,
    params: [...u.searchParams.entries()],
    hash: u.hash.replace(/^#/, ''),
  }
}

/** Rebuilds a URL from edited parts. Empty parameter names are skipped. */
export function buildFromParts(p: UrlParts): BuildResult {
  const protocol = p.protocol.trim().replace(/:?\/*$/, '') || 'https'
  const host = p.host.trim()
  if (!host) return { error: 'The host (domain) is empty.' }
  let u: URL
  try {
    u = new URL(`${protocol}://${host}`)
  } catch {
    return { error: `“${host}” is not a valid host.` }
  }
  const path = p.pathname.trim()
  u.pathname = path ? (path.startsWith('/') ? path : `/${path}`) : '/'
  const sp = new URLSearchParams()
  for (const [k, v] of p.params) if (k.trim()) sp.append(k.trim(), v)
  u.search = sp.toString()
  u.hash = p.hash
  return { url: u.toString() }
}

export interface BulkRow {
  input: string
  url?: string
  error?: string
}

/** Tags every non-empty line (one base URL per line) with the same UTM parameters. */
export function buildBulk(text: string, params: UtmParams, normalize = false): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((input) => {
      const r = buildUtmUrl(input, params, normalize)
      return 'url' in r ? { input, url: r.url } : { input, error: r.error }
    })
}

export function toCsv(rows: BulkRow[]): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return ['original,tagged_url', ...rows.map((r) => `${q(r.input)},${q(r.url ?? r.error ?? '')}`)].join('\n')
}
