import { get, getAll, type Headers } from './headers'

export type Level = 'good' | 'warn' | 'bad' | 'info'

export interface Finding {
  header: string
  level: Level
  message: string
}

export interface CspDirective {
  name: string
  sources: string[]
}

export function parseCsp(value: string): CspDirective[] {
  const out: CspDirective[] = []
  const seen = new Set<string>()
  for (const part of value.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) continue
    const name = tokens[0].toLowerCase()
    if (seen.has(name)) continue // browsers ignore repeated directives
    seen.add(name)
    out.push({ name, sources: tokens.slice(1) })
  }
  return out
}

const FETCH_FALLBACK: Record<string, string[]> = {
  'script-src-elem': ['script-src', 'default-src'],
  'script-src-attr': ['script-src', 'default-src'],
  'script-src': ['default-src'],
  'object-src': ['default-src'],
  'style-src': ['default-src'],
}

function effective(dirs: CspDirective[], name: string): CspDirective | undefined {
  const d = dirs.find((x) => x.name === name)
  if (d) return d
  for (const fb of FETCH_FALLBACK[name] ?? []) {
    const f = dirs.find((x) => x.name === fb)
    if (f) return f
  }
  return undefined
}

export function analyzeCsp(value: string, reportOnly = false): Finding[] {
  const h = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
  const f: Finding[] = []
  const dirs = parseCsp(value)
  const lower = (d?: CspDirective) => (d?.sources ?? []).map((s) => s.toLowerCase())
  if (reportOnly) f.push({ header: h, level: 'warn', message: 'Report-only: violations are reported but nothing is blocked.' })
  if (!dirs.some((d) => d.name === 'default-src')) f.push({ header: h, level: 'warn', message: 'No default-src, so any fetch directive you did not list is unrestricted.' })

  const script = effective(dirs, 'script-src')
  const s = lower(script)
  if (!script) f.push({ header: h, level: 'bad', message: 'Scripts are not restricted (no script-src or default-src).' })
  else {
    const hasNonceOrHash = s.some((x) => /^'(nonce-|sha256-|sha384-|sha512-)/.test(x))
    const strictDynamic = s.includes("'strict-dynamic'")
    if (s.includes("'unsafe-inline'")) {
      f.push(hasNonceOrHash
        ? { header: h, level: 'info', message: `'unsafe-inline' in ${script.name} is ignored by modern browsers because a nonce or hash is present (kept for old browsers).` }
        : { header: h, level: 'bad', message: `'unsafe-inline' in ${script.name} allows inline scripts, which defeats most XSS protection. Use nonces or hashes.` })
    }
    if (s.includes("'unsafe-eval'")) f.push({ header: h, level: 'warn', message: `'unsafe-eval' in ${script.name} allows eval() and new Function().` })
    if (!strictDynamic) {
      const wild = s.filter((x) => x === '*' || x === 'http:' || x === 'https:' || x === 'data:' || x === 'blob:' || /^(https?:\/\/)?\*\./.test(x))
      if (wild.length) f.push({ header: h, level: 'bad', message: `${script.name} allows ${wild.join(' ')}, so scripts can load from almost anywhere.` })
      if (s.some((x) => x.startsWith('http:'))) f.push({ header: h, level: 'warn', message: `${script.name} allows plain http: sources.` })
    } else f.push({ header: h, level: 'good', message: `'strict-dynamic' with nonces/hashes: a modern, robust script policy.` })
  }

  const obj = effective(dirs, 'object-src')
  if (!obj || !(lower(obj).includes("'none'"))) f.push({ header: h, level: 'warn', message: "object-src is not 'none'. Plugins (<object>, <embed>) are a classic bypass; set object-src 'none'." })
  if (!dirs.some((d) => d.name === 'base-uri')) f.push({ header: h, level: 'warn', message: "No base-uri: an injected <base> tag could redirect relative script URLs. Add base-uri 'self' or 'none'." })
  if (!dirs.some((d) => d.name === 'frame-ancestors')) f.push({ header: h, level: 'info', message: 'No frame-ancestors: clickjacking protection must come from X-Frame-Options.' })
  if (!dirs.some((d) => d.name === 'form-action')) f.push({ header: h, level: 'info', message: 'No form-action: forms can post to any site (form-action does not fall back to default-src).' })
  if (dirs.some((d) => d.name === 'upgrade-insecure-requests')) f.push({ header: h, level: 'good', message: 'upgrade-insecure-requests rewrites http:// subresources to https://.' })
  const known = new Set(['default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'img-src', 'font-src', 'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src', 'prefetch-src', 'base-uri', 'form-action', 'frame-ancestors', 'sandbox', 'report-uri', 'report-to', 'upgrade-insecure-requests', 'block-all-mixed-content', 'require-trusted-types-for', 'trusted-types', 'fenced-frame-src', 'webrtc'])
  for (const d of dirs) if (!known.has(d.name)) f.push({ header: h, level: 'warn', message: `Unknown directive “${d.name}” (typo?). Browsers ignore it.` })
  if (dirs.some((d) => d.name === 'block-all-mixed-content')) f.push({ header: h, level: 'info', message: 'block-all-mixed-content is deprecated; browsers now block or upgrade mixed content by default.' })
  if (!f.some((x) => x.level === 'bad' || x.level === 'warn')) f.push({ header: h, level: 'good', message: 'Strong policy.' })
  return f
}

export function analyzeHsts(value: string): Finding[] {
  const h = 'Strict-Transport-Security'
  const parts = value.split(';').map((p) => p.trim().toLowerCase())
  const ma = parts.find((p) => p.startsWith('max-age'))
  const maxAge = ma ? Number(ma.split('=')[1]?.replace(/"/g, '')) : NaN
  const sub = parts.includes('includesubdomains')
  const preload = parts.includes('preload')
  const f: Finding[] = []
  if (!Number.isFinite(maxAge)) return [{ header: h, level: 'bad', message: 'max-age is missing or invalid, so the header is ignored.' }]
  const days = Math.round(maxAge / 86400)
  if (maxAge === 0) f.push({ header: h, level: 'bad', message: 'max-age=0 tells browsers to forget HSTS for this host.' })
  else if (maxAge < 15552000) f.push({ header: h, level: 'warn', message: `max-age is ${days} days; at least 180 days (15552000) is recommended, 1–2 years is typical.` })
  else f.push({ header: h, level: 'good', message: `max-age ${days} days.` })
  f.push(sub ? { header: h, level: 'good', message: 'includeSubDomains covers every subdomain.' } : { header: h, level: 'info', message: 'No includeSubDomains: subdomains are not protected.' })
  if (preload) {
    f.push(maxAge >= 31536000 && sub
      ? { header: h, level: 'good', message: 'preload: eligible for the browser HSTS preload list (submit at hstspreload.org).' }
      : { header: h, level: 'warn', message: 'preload requires max-age of at least 31536000 and includeSubDomains.' })
  }
  return f
}

const GOOD_REFERRER = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin']

export interface SecurityReport {
  findings: Finding[]
  csp: CspDirective[] | null
  score: number
  grade: string
}

export function analyzeSecurity(headers: Headers): SecurityReport {
  const f: Finding[] = []
  let score = 0

  // CSP
  const cspValue = get(headers, 'content-security-policy')
  const cspRo = get(headers, 'content-security-policy-report-only')
  let csp: CspDirective[] | null = null
  if (cspValue) {
    csp = parseCsp(cspValue)
    const cf = analyzeCsp(cspValue)
    f.push(...cf)
    score += cf.some((x) => x.level === 'bad') ? 10 : 25
  } else {
    f.push({ header: 'Content-Security-Policy', level: 'bad', message: 'Missing. CSP is the main defence against XSS and data injection.' })
    if (cspRo) {
      csp = parseCsp(cspRo)
      f.push(...analyzeCsp(cspRo, true))
    }
  }
  const frameAncestors = csp && cspValue ? csp.find((d) => d.name === 'frame-ancestors') : undefined

  // HSTS
  const hsts = get(headers, 'strict-transport-security')
  if (hsts) {
    const hf = analyzeHsts(hsts)
    f.push(...hf)
    score += hf.some((x) => x.level === 'bad') ? 0 : hf.some((x) => x.level === 'warn') ? 12 : 20
  } else f.push({ header: 'Strict-Transport-Security', level: 'bad', message: 'Missing. Without HSTS the first visit can be downgraded to http:// (only sent over HTTPS).' })

  // X-Content-Type-Options
  const xcto = get(headers, 'x-content-type-options')
  if (xcto?.toLowerCase() === 'nosniff') { f.push({ header: 'X-Content-Type-Options', level: 'good', message: 'nosniff stops MIME-type sniffing.' }); score += 10 }
  else if (xcto) f.push({ header: 'X-Content-Type-Options', level: 'warn', message: `“${xcto}” is not valid; the only value is nosniff.` })
  else f.push({ header: 'X-Content-Type-Options', level: 'warn', message: 'Missing. Add X-Content-Type-Options: nosniff.' })

  // Clickjacking
  const xfo = get(headers, 'x-frame-options')?.toUpperCase()
  if (frameAncestors) {
    f.push({ header: 'frame-ancestors', level: 'good', message: `CSP frame-ancestors ${frameAncestors.sources.join(' ') || '(empty)'} controls framing${xfo ? ' and overrides X-Frame-Options in modern browsers' : ''}.` })
    score += 15
  } else if (xfo === 'DENY' || xfo === 'SAMEORIGIN') {
    f.push({ header: 'X-Frame-Options', level: 'good', message: `${xfo} protects against clickjacking. CSP frame-ancestors is the modern equivalent.` })
    score += 15
  } else if (xfo?.startsWith('ALLOW-FROM')) f.push({ header: 'X-Frame-Options', level: 'warn', message: 'ALLOW-FROM is not supported by modern browsers; use CSP frame-ancestors.' })
  else f.push({ header: 'X-Frame-Options', level: 'warn', message: 'No clickjacking protection: add X-Frame-Options: DENY or CSP frame-ancestors.' })

  // Referrer-Policy (last valid token wins)
  const rp = get(headers, 'referrer-policy')
  if (rp) {
    const last = rp.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).pop() ?? ''
    if (GOOD_REFERRER.includes(last)) { f.push({ header: 'Referrer-Policy', level: 'good', message: `${last} limits what URLs leak to other sites.` }); score += 10 }
    else if (last === 'unsafe-url') f.push({ header: 'Referrer-Policy', level: 'bad', message: 'unsafe-url sends the full URL (including query strings) to every site, even over http.' })
    else f.push({ header: 'Referrer-Policy', level: 'warn', message: `${last} can leak full URLs cross-origin; prefer strict-origin-when-cross-origin.` })
  } else { f.push({ header: 'Referrer-Policy', level: 'info', message: 'Missing; browsers default to strict-origin-when-cross-origin, which is reasonable.' }); score += 5 }

  // Permissions-Policy
  if (get(headers, 'permissions-policy')) { f.push({ header: 'Permissions-Policy', level: 'good', message: 'Restricts powerful browser features (camera, geolocation…).' }); score += 10 }
  else f.push({ header: 'Permissions-Policy', level: 'info', message: 'Missing. Consider disabling features you do not use, e.g. camera=(), microphone=(), geolocation=().' })
  if (get(headers, 'feature-policy')) f.push({ header: 'Feature-Policy', level: 'info', message: 'Deprecated; replaced by Permissions-Policy.' })

  // Cross-origin isolation
  const coop = get(headers, 'cross-origin-opener-policy')?.toLowerCase()
  const coep = get(headers, 'cross-origin-embedder-policy')?.toLowerCase()
  const corp = get(headers, 'cross-origin-resource-policy')?.toLowerCase()
  if (coop) { f.push({ header: 'Cross-Origin-Opener-Policy', level: coop.startsWith('same-origin') ? 'good' : 'info', message: `${coop}${coop.startsWith('same-origin') ? ': isolates your window from cross-origin popups.' : '.'}` }); if (coop.startsWith('same-origin')) score += 5 }
  else f.push({ header: 'Cross-Origin-Opener-Policy', level: 'info', message: 'Missing. same-origin protects against cross-window attacks like XS-Leaks.' })
  if (coep) f.push({ header: 'Cross-Origin-Embedder-Policy', level: 'good', message: `${coep}${coop === 'same-origin' && (coep === 'require-corp' || coep === 'credentialless') ? ' + COOP same-origin: the page is cross-origin isolated (SharedArrayBuffer allowed).' : '.'}` })
  if (corp) f.push({ header: 'Cross-Origin-Resource-Policy', level: corp === 'cross-origin' ? 'info' : 'good', message: `${corp}: ${corp === 'cross-origin' ? 'any site may embed this resource.' : 'limits which sites can embed this resource.'}` })

  // Cookies
  for (const c of getAll(headers, 'set-cookie')) f.push(...analyzeCookie(c))

  // Leakage
  for (const name of ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    const v = get(headers, name)
    if (!v) continue
    const hasVersion = /\d+\.\d+/.test(v)
    f.push({ header: name.replace(/(^|-)([a-z])/g, (_, a, b) => a + b.toUpperCase()), level: hasVersion || name !== 'server' ? 'warn' : 'info', message: `“${v}” ${hasVersion ? 'reveals software versions, helping attackers find known vulnerabilities.' : 'reveals the software stack.'} Consider removing it.` })
  }
  const xxss = get(headers, 'x-xss-protection')
  if (xxss && xxss.trim() !== '0') f.push({ header: 'X-XSS-Protection', level: 'info', message: 'Deprecated and removed from browsers; old implementations could be abused. Set it to 0 or drop it and rely on CSP.' })
  const acao = get(headers, 'access-control-allow-origin')
  if (acao === '*') f.push({ header: 'Access-Control-Allow-Origin', level: 'info', message: '* lets any website read this response (fine for public, non-personal data).' })

  score = Math.min(100, score)
  const grade = score >= 95 ? 'A+' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : score >= 20 ? 'E' : 'F'
  return { findings: f, csp, score, grade }
}

export function analyzeCookie(raw: string): Finding[] {
  const [pair, ...attrs] = raw.split(';').map((s) => s.trim())
  const name = pair.split('=')[0]
  const a = attrs.map((s) => s.toLowerCase())
  const secure = a.includes('secure')
  const httpOnly = a.includes('httponly')
  const sameSite = a.find((x) => x.startsWith('samesite'))?.split('=')[1]?.trim()
  const h = `Set-Cookie: ${name}`
  const problems: string[] = []
  let level: Level = 'good'
  if (!secure) { problems.push('no Secure flag (sent over plain http)'); level = 'warn' }
  if (!httpOnly) { problems.push('no HttpOnly (readable by JavaScript; fine only if scripts need it)'); level = 'warn' }
  if (!sameSite) problems.push('no SameSite (browsers default to Lax)')
  else if (sameSite === 'none' && !secure) { problems.push('SameSite=None without Secure is rejected by browsers'); level = 'bad' }
  else if (sameSite === 'none') problems.push('SameSite=None: sent on cross-site requests, so protect against CSRF')
  if (name.startsWith('__Host-') && (!secure || a.some((x) => x.startsWith('domain=')) || !a.includes('path=/'))) { problems.push('__Host- prefix requires Secure, Path=/ and no Domain, so browsers will reject it'); level = 'bad' }
  if (name.startsWith('__Secure-') && !secure) { problems.push('__Secure- prefix requires Secure'); level = 'bad' }
  return [{ header: h, level, message: problems.length ? problems.join('; ') + '.' : `Secure, HttpOnly, SameSite=${sameSite}.` }]
}
