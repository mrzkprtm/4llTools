import { get, splitList, type Headers } from './headers'

export interface CorsInput {
  /** The page making the request, e.g. https://app.example.com */
  origin: string
  /** The URL being requested (optional; used for same-origin detection and curl commands). */
  url?: string
  method: string
  /** Request headers the script sets, as "Name: value" lines or bare names. */
  requestHeaders: [string, string][]
  credentials: boolean
  /** Response headers of the preflight (OPTIONS) response. Defaults to `response`. */
  preflight?: Headers
  /** Response headers of the actual response. */
  response: Headers
}

export interface Step {
  ok: boolean | null
  text: string
}

export interface CorsResult {
  sameOrigin: boolean
  preflight: boolean
  preflightReasons: string[]
  allowed: boolean
  steps: Step[]
  advice: string[]
  /** Response headers JavaScript can read if allowed. */
  readable: string[]
}

const SAFE_METHODS = ['GET', 'HEAD', 'POST']
const SAFE_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']
const SAFE_RESPONSE = ['cache-control', 'content-language', 'content-length', 'content-type', 'expires', 'last-modified', 'pragma']
const FORBIDDEN_REQUEST = ['accept-charset', 'accept-encoding', 'access-control-request-headers', 'access-control-request-method', 'connection', 'content-length', 'cookie', 'date', 'dnt', 'expect', 'host', 'keep-alive', 'origin', 'referer', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via']

export function parseRequestHeaders(text: string): [string, string][] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':')
      return i > 0 ? [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()] : [l.toLowerCase(), '']
    }) as [string, string][]
}

/** Why a header makes the request non-simple, or null if it is CORS-safelisted. */
export function unsafeHeaderReason(name: string, value: string): string | null {
  const n = name.toLowerCase()
  if (n === 'accept' || n === 'accept-language' || n === 'content-language') {
    if (value.length > 128) return `${name} value is longer than 128 bytes`
    return null
  }
  if (n === 'content-type') {
    const mime = value.split(';')[0].trim().toLowerCase()
    if (!value) return 'Content-Type without a value (assumed non-simple, e.g. application/json)'
    return SAFE_CONTENT_TYPES.includes(mime) ? null : `Content-Type ${mime} is not form, multipart or text/plain`
  }
  if (n === 'range' && /^bytes=\d+-\d*$/.test(value.trim())) return null
  return `${name} is not a CORS-safelisted header`
}

export function originOf(url: string): string | null {
  try {
    const u = new URL(url)
    return u.origin === 'null' ? null : u.origin
  } catch {
    return null
  }
}

export function simulateCors(input: CorsInput): CorsResult {
  const method = input.method.trim().toUpperCase() || 'GET'
  const origin = input.origin.trim().replace(/\/+$/, '')
  const steps: Step[] = []
  const advice: string[] = []
  const target = input.url ? originOf(input.url) : null
  const sameOrigin = !!target && target === origin
  if (sameOrigin) {
    return { sameOrigin, preflight: false, preflightReasons: [], allowed: true, steps: [{ ok: true, text: 'Same origin: CORS does not apply, the browser allows it.' }], advice: [], readable: [] }
  }

  // 1. Is a preflight needed?
  const reasons: string[] = []
  if (!SAFE_METHODS.includes(method)) reasons.push(`method ${method} is not GET, HEAD or POST`)
  const customHeaders: string[] = []
  for (const [name, value] of input.requestHeaders) {
    if (FORBIDDEN_REQUEST.includes(name) || name.startsWith('sec-') || name.startsWith('proxy-')) {
      advice.push(`Scripts cannot set the ${name} header; the browser ignores it.`)
      continue
    }
    const r = unsafeHeaderReason(name, value)
    if (r) {
      reasons.push(r)
      customHeaders.push(name)
    }
  }
  const preflight = reasons.length > 0
  const pre = input.preflight ?? input.response
  const cred = input.credentials

  const checkOrigin = (h: Headers, label: string): boolean => {
    const acao = get(h, 'access-control-allow-origin')
    if (acao === undefined) {
      steps.push({ ok: false, text: `${label}: no Access-Control-Allow-Origin header, so the browser blocks it.` })
      return false
    }
    if (acao.includes(',')) {
      steps.push({ ok: false, text: `${label}: Access-Control-Allow-Origin has several values (“${acao}”). Only one origin (or *) is allowed; echo back the matching Origin instead.` })
      return false
    }
    if (acao === '*') {
      if (cred) {
        steps.push({ ok: false, text: `${label}: Access-Control-Allow-Origin is * but the request includes credentials. With credentials the server must echo the exact origin (${origin}).` })
        return false
      }
      steps.push({ ok: true, text: `${label}: Access-Control-Allow-Origin * allows any origin.` })
      return true
    }
    if (acao.replace(/\/+$/, '') !== origin) {
      steps.push({ ok: false, text: `${label}: Access-Control-Allow-Origin is ${acao}, which does not match ${origin} (scheme, host and port must all match).` })
      return false
    }
    steps.push({ ok: true, text: `${label}: Access-Control-Allow-Origin matches ${origin}.` })
    const vary = splitList(get(h, 'vary')).map((v) => v.toLowerCase())
    if (!vary.includes('origin') && !vary.includes('*')) advice.push('The origin is echoed back but Vary: Origin is missing. Caches and CDNs may serve this response to other origins; add Vary: Origin.')
    return true
  }

  const checkCredentials = (h: Headers, label: string): boolean => {
    if (!cred) return true
    const acac = get(h, 'access-control-allow-credentials')
    if (acac !== 'true') {
      steps.push({ ok: false, text: `${label}: credentials are included but Access-Control-Allow-Credentials is ${acac === undefined ? 'missing' : `“${acac}”`}; it must be exactly true.` })
      return false
    }
    steps.push({ ok: true, text: `${label}: Access-Control-Allow-Credentials: true.` })
    return true
  }

  let allowed = true
  if (preflight) {
    steps.push({ ok: null, text: `Preflight needed: ${reasons.join('; ')}. The browser first sends OPTIONS with Access-Control-Request-Method: ${method}${customHeaders.length ? ` and Access-Control-Request-Headers: ${customHeaders.join(',')}` : ''}.` })
    const okOrigin = checkOrigin(pre, 'Preflight')
    const okCred = checkCredentials(pre, 'Preflight')
    // methods
    const methods = splitList(get(pre, 'access-control-allow-methods')).map((m) => m.toUpperCase())
    let okMethod = true
    if (!SAFE_METHODS.includes(method)) {
      if (methods.includes(method)) steps.push({ ok: true, text: `Preflight: Access-Control-Allow-Methods includes ${method}.` })
      else if (methods.includes('*') && !cred) steps.push({ ok: true, text: `Preflight: Access-Control-Allow-Methods * allows ${method} (no credentials).` })
      else {
        okMethod = false
        steps.push({ ok: false, text: methods.includes('*') ? `Preflight: * in Access-Control-Allow-Methods is treated literally when credentials are included; list ${method} explicitly.` : `Preflight: ${method} is not in Access-Control-Allow-Methods (${methods.join(', ') || 'missing'}).` })
      }
    }
    // headers
    const allowedHeaders = splitList(get(pre, 'access-control-allow-headers')).map((x) => x.toLowerCase())
    let okHeaders = true
    for (const name of customHeaders) {
      if (allowedHeaders.includes(name)) continue
      if (allowedHeaders.includes('*') && !cred && name !== 'authorization') continue
      okHeaders = false
      steps.push({
        ok: false,
        text: allowedHeaders.includes('*')
          ? name === 'authorization'
            ? 'Preflight: Authorization is never covered by the * wildcard in Access-Control-Allow-Headers; list it explicitly.'
            : `Preflight: * in Access-Control-Allow-Headers is literal when credentials are included; list ${name} explicitly.`
          : `Preflight: request header ${name} is not in Access-Control-Allow-Headers (${allowedHeaders.join(', ') || 'missing'}).`,
      })
    }
    if (okHeaders && customHeaders.length) steps.push({ ok: true, text: `Preflight: all custom request headers are allowed.` })
    const maxAge = get(pre, 'access-control-max-age')
    if (maxAge) steps.push({ ok: null, text: `Preflight result may be cached for ${maxAge} s (browsers cap it: Chrome at 7200 s, Firefox at 86400 s).` })
    allowed = okOrigin && okCred && okMethod && okHeaders
    if (!allowed) steps.push({ ok: false, text: 'Preflight failed, so the actual request is never sent.' })
  } else {
    steps.push({ ok: null, text: `Simple request: no preflight. The browser sends ${method} directly with an Origin header${method === 'POST' ? ' (the server receives and may act on it even if the response is blocked)' : ''}.` })
  }

  if (allowed) {
    const okOrigin = checkOrigin(input.response, 'Response')
    const okCred = checkCredentials(input.response, 'Response')
    allowed = okOrigin && okCred
  }

  const expose = splitList(get(input.response, 'access-control-expose-headers')).map((x) => x.toLowerCase())
  const readable = allowed
    ? expose.includes('*') && !cred
      ? input.response.map(([k]) => k).filter((k) => k !== 'set-cookie' && k !== 'set-cookie2')
      : [...new Set([...SAFE_RESPONSE.filter((k) => input.response.some(([n]) => n === k)), ...expose.filter((k) => k !== '*')])]
    : []
  if (allowed && input.response.length && readable.length < input.response.filter(([k]) => k !== 'set-cookie').length) {
    advice.push('JavaScript can only read the safelisted response headers plus those in Access-Control-Expose-Headers.')
  }
  steps.push(allowed ? { ok: true, text: 'The browser lets the page read the response.' } : { ok: false, text: 'Blocked: the page gets a network error (“TypeError: Failed to fetch”) and cannot read the response.' })
  return { sameOrigin, preflight, preflightReasons: reasons, allowed, steps, advice, readable }
}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

export function curlCommands(url: string, origin: string, method: string, headers: [string, string][], credentials: boolean): { head: string; preflight: string; actual: string } {
  const m = method.toUpperCase() || 'GET'
  const custom = headers.filter(([n, v]) => unsafeHeaderReason(n, v) !== null).map(([n]) => n)
  const head = `curl -sI ${q(url)}`
  const preflight = [
    `curl -s -X OPTIONS ${q(url)}`,
    `  -H ${q(`Origin: ${origin}`)}`,
    `  -H ${q(`Access-Control-Request-Method: ${m}`)}`,
    ...(custom.length ? [`  -H ${q(`Access-Control-Request-Headers: ${custom.join(',')}`)}`] : []),
  ].join(' \\\n') + ' -o /dev/null -D -'
  const actual = [
    `curl -s -X ${m} ${q(url)}`,
    `  -H ${q(`Origin: ${origin}`)}`,
    ...headers.map(([n, v]) => `  -H ${q(`${n}: ${v}`)}`),
    ...(credentials ? [`  -H 'Cookie: session=…'`] : []),
  ].join(' \\\n') + ' -o /dev/null -D -'
  return { head, preflight, actual }
}
