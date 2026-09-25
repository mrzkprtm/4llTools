import { describe, expect, it } from 'vitest'
import { decodeCaa, expandIPv6, formatTtl, mapResponse, normalizeName, parseDkim, parseDmarc, parseSpf, resolve, reverseName, unquoteTxt, type Fetcher } from './dns'

const fixture = {
  Status: 0,
  TC: false,
  RD: true,
  RA: true,
  AD: true,
  CD: false,
  Question: [{ name: 'example.com', type: 16 }],
  Answer: [
    { name: 'example.com.', type: 16, TTL: 3600, data: '"v=spf1 -all"' },
    { name: 'example.com.', type: 257, TTL: 300, data: '\\# 22 00 05 69 73 73 75 65 6c 65 74 73 65 6e 63 72 79 70 74 2e 6f 72 67' },
  ],
}

describe('dns lookup', () => {
  it('maps a DoH JSON response', () => {
    const r = mapResponse(fixture)
    expect(r.statusName).toBe('NOERROR')
    expect(r.ad).toBe(true)
    expect(r.answers[0]).toEqual({ name: 'example.com', type: 'TXT', ttl: 3600, data: '"v=spf1 -all"' })
    expect(r.answers[1].data).toBe('0 issue "letsencrypt.org"')
    const nx = mapResponse({ Status: 3, AD: false, Authority: [{ name: 'com.', type: 6, TTL: 900, data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1 1800 900 604800 86400' }] })
    expect(nx.statusName).toBe('NXDOMAIN')
    expect(nx.answers).toEqual([])
    expect(nx.authority[0].type).toBe('SOA')
    expect(() => mapResponse({ foo: 1 })).toThrow()
  })

  it('falls back to Google when Cloudflare fails', async () => {
    const urls: string[] = []
    const fake: Fetcher = async (url) => {
      urls.push(url)
      if (url.includes('cloudflare')) return new Response('nope', { status: 503 })
      return new Response(JSON.stringify(fixture), { status: 200 })
    }
    const r = await resolve('example.com', 'TXT', fake)
    expect(r.provider).toBe('Google')
    expect(urls[0]).toBe('https://cloudflare-dns.com/dns-query?name=example.com&type=TXT')
    expect(urls[1]).toBe('https://dns.google/resolve?name=example.com&type=TXT')
    await expect(resolve('x.test', 'A', async () => { throw new Error('offline') })).rejects.toThrow(/Could not reach/)
  })

  it('normalizes names and builds reverse names', () => {
    expect(normalizeName(' https://Www.Example.com/path?q=1 ')).toBe('www.example.com')
    expect(normalizeName('someone@Example.org')).toBe('example.org')
    expect(normalizeName('_dmarc.example.com.')).toBe('_dmarc.example.com')
    expect(normalizeName('bücher.de')).toBe('xn--bcher-kva.de')
    expect(reverseName('192.0.2.10')).toBe('10.2.0.192.in-addr.arpa')
    expect(reverseName('2001:db8::1')).toBe('1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa')
    expect(expandIPv6('::ffff:192.0.2.1')).toBe('00000000000000000000ffffc0000201')
    expect(reverseName('example.com')).toBeNull()
    expect(expandIPv6('1::2::3')).toBeNull()
  })

  it('explains SPF records', () => {
    const spf = parseSpf('v=spf1 include:_spf.google.com ip4:192.0.2.0/24 mx ~all')!
    expect(spf.lookups).toBe(2)
    expect(spf.warnings).toEqual([])
    expect(spf.parts.at(-1)!.level).toBe('good')
    expect(parseSpf('v=spf1 +all')!.warnings.join(' ')).toMatch(/anyone/)
    const many = parseSpf(`v=spf1 ${Array.from({ length: 11 }, (_, i) => `include:s${i}.test`).join(' ')} -all`)!
    expect(many.warnings.join(' ')).toMatch(/at most 10/)
    expect(parseSpf('google-site-verification=abc')).toBeNull()
  })

  it('explains DMARC and DKIM records', () => {
    const d = parseDmarc('v=DMARC1; p=none; rua=mailto:dmarc@example.com')!
    expect(d.policy).toBe('none')
    expect(d.warnings.join(' ')).toMatch(/only monitors/)
    expect(parseDmarc('v=DMARC1; p=reject; rua=mailto:r@example.com')!.warnings).toEqual([])
    const key2048 = 'A'.repeat(392)
    const k = parseDkim(`v=DKIM1; k=rsa; p=${key2048}`)!
    expect(k.keyBits).toBe(2048)
    expect(parseDkim(`v=DKIM1; k=rsa; p=${'A'.repeat(216)}`)!.warnings.join(' ')).toMatch(/1024-bit/)
    expect(parseDkim('v=DKIM1; p=')!.warnings.join(' ')).toMatch(/revoked/)
  })

  it('formats TXT chunks, CAA and TTLs', () => {
    expect(unquoteTxt('"v=spf1 include:a.test " "-all"')).toBe('v=spf1 include:a.test -all')
    expect(decodeCaa('0 issue "pki.goog"')).toBe('0 issue "pki.goog"')
    expect(formatTtl(30)).toBe('30s')
    expect(formatTtl(3600)).toBe('1h')
    expect(formatTtl(90061)).toBe('1d 1h')
  })
})
