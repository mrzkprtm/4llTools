import { describe, expect, it } from 'vitest'
import { CACHEABLE, CODES, classOf, describeUnknown, findCode, searchCodes } from './codes'
import { normalizeUrl } from './probe'

describe('http status codes', () => {
  it('has complete, unique, valid entries', () => {
    const seen = new Set<number>()
    for (const c of CODES) {
      expect(seen.has(c.code), String(c.code)).toBe(false)
      seen.add(c.code)
      expect(c.code).toBeGreaterThanOrEqual(100)
      expect(c.code).toBeLessThan(600)
      expect(c.name.length, String(c.code)).toBeGreaterThan(1)
      expect(c.desc.length, String(c.code)).toBeGreaterThan(20)
      expect(c.when.length, String(c.code)).toBeGreaterThan(5)
      expect(!!c.spec || !!c.unofficial, String(c.code)).toBe(true)
    }
  })

  it('includes every IANA-registered code', () => {
    const iana = [100, 101, 102, 103, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308,
      400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
      500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511]
    for (const code of iana) {
      const c = findCode(code)
      expect(c, String(code)).toBeDefined()
      expect(c!.unofficial, String(code)).toBeUndefined()
    }
  })

  it('marks vendor codes as unofficial', () => {
    for (const code of [418, 419, 499, 520, 521, 522, 523, 524, 525, 526]) expect(findCode(code)?.unofficial, String(code)).toBeTruthy()
  })

  it('lists related headers for key codes', () => {
    expect(findCode(301)!.headers).toContain('Location')
    expect(findCode(429)!.headers).toContain('Retry-After')
    expect(findCode(503)!.headers).toContain('Retry-After')
    expect(findCode(401)!.headers).toContain('WWW-Authenticate')
    expect(CACHEABLE.has(200) && CACHEABLE.has(404) && !CACHEABLE.has(500)).toBe(true)
  })

  it('searches by code, class and text', () => {
    expect(searchCodes('404', null).map((c) => c.code)).toEqual([404])
    expect(searchCodes('5xx', null).every((c) => classOf(c.code) === '5')).toBe(true)
    expect(searchCodes('', '2').every((c) => c.code >= 200 && c.code < 300)).toBe(true)
    expect(searchCodes('cloudflare', null).length).toBeGreaterThanOrEqual(7)
    expect(searchCodes('rate limit', null).map((c) => c.code)).toContain(429)
    expect(describeUnknown(299)).toMatch(/200/)
    expect(describeUnknown(700)).toMatch(/outside/)
  })

  it('normalizes test URLs', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
    expect(normalizeUrl('ftp://x')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
  })
})
