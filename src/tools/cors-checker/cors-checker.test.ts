import { describe, expect, it } from 'vitest'
import { curlCommands, parseRequestHeaders, simulateCors } from './cors'
import { parseHeaders } from './headers'
import { analyzeCookie, analyzeCsp, analyzeHsts, analyzeSecurity, parseCsp } from './security'

const RAW = `HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=63072000; includeSubDomains; preload
content-security-policy: default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), geolocation=()
cross-origin-opener-policy: same-origin
set-cookie: __Host-sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax
set-cookie: theme=dark
server: nginx/1.25.3`

describe('header parsing', () => {
  it('parses curl -I output and keeps repeated headers', () => {
    const h = parseHeaders(RAW)
    expect(h.filter(([k]) => k === 'set-cookie')).toHaveLength(2)
    expect(h.find(([k]) => k === 'content-type')?.[1]).toBe('text/html; charset=utf-8')
  })

  it('parses the DevTools two-line format', () => {
    const h = parseHeaders('content-type:\ntext/html\nx-frame-options:\nDENY')
    expect(h).toEqual([['content-type', 'text/html'], ['x-frame-options', 'DENY']])
  })
})

describe('security headers', () => {
  it('grades a strong configuration highly', () => {
    const r = analyzeSecurity(parseHeaders(RAW))
    expect(r.grade).toMatch(/^A/)
    expect(r.csp?.map((d) => d.name)).toContain('script-src')
    expect(r.findings.some((f) => f.header === 'Server' && f.level === 'warn')).toBe(true)
    expect(r.findings.some((f) => f.header === 'Set-Cookie: theme' && f.level === 'warn')).toBe(true)
  })

  it('fails an empty response', () => {
    const r = analyzeSecurity(parseHeaders('content-type: text/html'))
    expect(r.grade).toBe('F')
    expect(r.findings.filter((f) => f.level === 'bad').length).toBeGreaterThanOrEqual(2)
  })

  it('flags weak CSP', () => {
    const f = analyzeCsp("script-src 'self' 'unsafe-inline' 'unsafe-eval' https:")
    const text = f.map((x) => x.message).join('\n')
    expect(text).toMatch(/unsafe-inline/)
    expect(text).toMatch(/unsafe-eval/)
    expect(text).toMatch(/No default-src/)
    expect(text).toMatch(/object-src/)
    expect(text).toMatch(/https:/)
    expect(f.some((x) => x.level === 'bad')).toBe(true)
    // nonce neutralizes unsafe-inline
    expect(analyzeCsp("default-src 'self'; script-src 'nonce-x' 'unsafe-inline'").find((x) => /unsafe-inline/.test(x.message))?.level).toBe('info')
    expect(parseCsp("default-src 'self'; default-src *")).toHaveLength(1)
  })

  it('checks HSTS', () => {
    expect(analyzeHsts('max-age=300').some((f) => f.level === 'warn')).toBe(true)
    expect(analyzeHsts('max-age=0')[0].level).toBe('bad')
    expect(analyzeHsts('max-age=86400; preload').some((f) => /preload requires/.test(f.message))).toBe(true)
    expect(analyzeHsts('includeSubDomains')[0].level).toBe('bad')
  })

  it('checks cookie flags', () => {
    expect(analyzeCookie('a=1; SameSite=None')[0].level).toBe('bad')
    expect(analyzeCookie('a=1; Secure; HttpOnly; SameSite=Strict')[0].level).toBe('good')
    expect(analyzeCookie('__Host-a=1; Secure; Path=/; Domain=x.com')[0].level).toBe('bad')
  })

  it('prefers frame-ancestors over X-Frame-Options', () => {
    const r = analyzeSecurity(parseHeaders("content-security-policy: frame-ancestors 'self'\nx-frame-options: DENY"))
    expect(r.findings.some((f) => f.header === 'frame-ancestors' && f.level === 'good')).toBe(true)
  })
})

describe('cors simulation', () => {
  const base = { origin: 'https://app.example.com', url: 'https://api.example.com/v1', requestHeaders: [] as [string, string][], credentials: false }

  it('allows a simple GET with *', () => {
    const r = simulateCors({ ...base, method: 'GET', response: parseHeaders('access-control-allow-origin: *') })
    expect(r.preflight).toBe(false)
    expect(r.allowed).toBe(true)
  })

  it('rejects * with credentials', () => {
    const r = simulateCors({ ...base, method: 'GET', credentials: true, response: parseHeaders('access-control-allow-origin: *\naccess-control-allow-credentials: true') })
    expect(r.allowed).toBe(false)
    expect(r.steps.some((s) => /credentials/.test(s.text) && s.ok === false)).toBe(true)
  })

  it('requires a preflight for JSON and custom methods', () => {
    const r = simulateCors({ ...base, method: 'PUT', requestHeaders: parseRequestHeaders('Content-Type: application/json\nX-Api-Key: 1'), response: parseHeaders('access-control-allow-origin: https://app.example.com\naccess-control-allow-methods: GET, POST') })
    expect(r.preflight).toBe(true)
    expect(r.preflightReasons.join()).toMatch(/PUT/)
    expect(r.preflightReasons.join()).toMatch(/application\/json/)
    expect(r.allowed).toBe(false)
    expect(r.steps.some((s) => /PUT is not in Access-Control-Allow-Methods/.test(s.text))).toBe(true)
    expect(r.steps.some((s) => /content-type is not in Access-Control-Allow-Headers/.test(s.text))).toBe(true)
  })

  it('passes a full credentialed preflight and advises Vary: Origin', () => {
    const r = simulateCors({
      ...base, method: 'DELETE', credentials: true, requestHeaders: parseRequestHeaders('Authorization: Bearer x'),
      response: parseHeaders('access-control-allow-origin: https://app.example.com\naccess-control-allow-credentials: true\naccess-control-allow-methods: GET, DELETE\naccess-control-allow-headers: authorization\naccess-control-expose-headers: X-Request-Id\ncontent-type: application/json\nx-request-id: 1\nx-internal: 2'),
    })
    expect(r.allowed).toBe(true)
    expect(r.advice.join()).toMatch(/Vary: Origin/)
    expect(r.readable).toEqual(['content-type', 'x-request-id'])
  })

  it('does not let * cover Authorization', () => {
    const r = simulateCors({ ...base, method: 'GET', requestHeaders: [['authorization', 'Bearer x']], response: parseHeaders('access-control-allow-origin: *\naccess-control-allow-headers: *') })
    expect(r.allowed).toBe(false)
  })

  it('detects origin mismatch and same origin', () => {
    expect(simulateCors({ ...base, method: 'GET', response: parseHeaders('access-control-allow-origin: https://other.com') }).allowed).toBe(false)
    expect(simulateCors({ ...base, url: 'https://app.example.com/x', method: 'GET', response: [] }).sameOrigin).toBe(true)
    expect(simulateCors({ ...base, method: 'GET', response: [] }).allowed).toBe(false)
  })

  it('builds curl commands', () => {
    const c = curlCommands('https://api.example.com/v1', 'https://app.example.com', 'PUT', [['content-type', 'application/json']], false)
    expect(c.head).toBe("curl -sI 'https://api.example.com/v1'")
    expect(c.preflight).toContain('-X OPTIONS')
    expect(c.preflight).toContain('Access-Control-Request-Method: PUT')
    expect(c.preflight).toContain('Access-Control-Request-Headers: content-type')
  })
})
