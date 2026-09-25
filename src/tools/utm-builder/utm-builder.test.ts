import { describe, expect, it } from 'vitest'
import { buildBulk, buildFromParts, buildUtmUrl, emptyParams, missingRequired, normalizeValue, parseUrl, toCsv } from './utm'

const params = { ...emptyParams(), utm_source: 'Instagram', utm_medium: 'social', utm_campaign: 'Ramadan Sale 2026' }

describe('utm builder', () => {
  it('keeps existing query params and the hash', () => {
    const r = buildUtmUrl('https://example.com/promo?ref=home#pricing', params)
    expect(r).toEqual({ url: 'https://example.com/promo?ref=home&utm_source=Instagram&utm_medium=social&utm_campaign=Ramadan+Sale+2026#pricing' })
  })

  it('normalizes values and adds https:// when missing', () => {
    const r = buildUtmUrl('example.com', params, true)
    expect(r).toEqual({ url: 'https://example.com/?utm_source=instagram&utm_medium=social&utm_campaign=ramadan_sale_2026' })
    expect(normalizeValue('  Spring   Sale ')).toBe('spring_sale')
  })

  it('replaces existing utm values and skips empty fields', () => {
    const r = buildUtmUrl('https://x.test/?utm_source=old&utm_term=keep', { ...emptyParams(), utm_source: 'new' })
    expect(r).toEqual({ url: 'https://x.test/?utm_source=new&utm_term=keep' })
  })

  it('reports bad input', () => {
    expect('error' in buildUtmUrl('', params)).toBe(true)
    expect('error' in buildUtmUrl('http://', params)).toBe(true)
    expect(missingRequired({ ...emptyParams(), utm_source: 'a' })).toEqual(['utm_medium', 'utm_campaign'])
  })

  it('parses a URL into parts and rebuilds it after edits', () => {
    const p = parseUrl('https://shop.example.com:8080/a/b?utm_source=google&x=1&x=2#top')!
    expect(p.protocol).toBe('https')
    expect(p.host).toBe('shop.example.com:8080')
    expect(p.pathname).toBe('/a/b')
    expect(p.params).toEqual([['utm_source', 'google'], ['x', '1'], ['x', '2']])
    expect(p.hash).toBe('top')
    const edited = { ...p, params: [...p.params.filter(([k]) => k !== 'utm_source'), ['q', 'kopi susu'] as [string, string], ['', 'ignored'] as [string, string]] }
    expect(buildFromParts(edited)).toEqual({ url: 'https://shop.example.com:8080/a/b?x=1&x=2&q=kopi+susu#top' })
    expect(parseUrl('not a url at all')).toBeNull()
  })

  it('tags many URLs and exports CSV', () => {
    const rows = buildBulk('https://a.test\n\n  b.test/x?y=1 \nhttp://', params, true)
    expect(rows).toHaveLength(3)
    expect(rows[1].url).toBe('https://b.test/x?y=1&utm_source=instagram&utm_medium=social&utm_campaign=ramadan_sale_2026')
    expect(rows[2].error).toBeTruthy()
    expect(toCsv(rows).split('\n')[0]).toBe('original,tagged_url')
  })
})
