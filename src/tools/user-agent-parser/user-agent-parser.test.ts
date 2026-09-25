import { describe as suite, expect, it } from 'vitest'
import { SAMPLES, describe, detectBot, deviceKind, parseUa } from './ua'

const ua = (label: string) => SAMPLES.find((s) => s.label === label)!.ua

suite('user agent parser', () => {
  it('parses an iPhone', () => {
    const r = parseUa(ua('iPhone Safari'))
    expect(r.browser.name).toBe('Mobile Safari')
    expect(r.os).toEqual({ name: 'iOS', version: '17.5' })
    expect(r.device).toEqual({ type: 'mobile', vendor: 'Apple', model: 'iPhone' })
    expect(r.engine.name).toBe('WebKit')
    expect(r.bot).toBeNull()
    expect(deviceKind(r)).toBe('Mobile')
  })

  it('parses Android Chrome and Windows Edge', () => {
    const a = parseUa(ua('Android Chrome'))
    expect(a.browser.name).toMatch(/Chrome/)
    expect(a.os.name).toBe('Android')
    expect(a.device.vendor).toBe('Samsung')
    const e = parseUa(ua('Windows Edge'))
    expect(e.browser.name).toBe('Edge')
    expect(e.browser.major).toBe('126')
    expect(e.engine.name).toBe('Blink')
    expect(e.cpu.architecture).toBe('amd64')
    expect(deviceKind(e)).toBe('Desktop (or unknown)')
    expect(describe(e)).toBe('Edge 126 on Windows 10')
  })

  it('flags bots, CLIs and AI crawlers', () => {
    const g = parseUa(ua('Googlebot'))
    expect(g.bot).toEqual({ name: 'Googlebot', kind: 'search', version: '2.1' })
    expect(g.browser.name).toBe('Googlebot')
    expect(describe(g)).toMatch(/search engine crawler/)
    const c = parseUa(ua('curl'))
    expect(c.bot?.kind).toBe('cli')
    expect(describe(c)).toMatch(/command-line/)
    expect(parseUa(ua('GPTBot')).bot?.kind).toBe('ai')
  })

  it('detects many crawlers and clients', () => {
    const cases: [string, string, string][] = [
      ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Bingbot', 'search'],
      ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'ClaudeBot (Anthropic)', 'ai'],
      ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)', 'PerplexityBot', 'ai'],
      ['CCBot/2.0 (https://commoncrawl.org/faq/)', 'CCBot (Common Crawl)', 'ai'],
      ['Wget/1.21.4', 'Wget', 'cli'],
      ['python-requests/2.32.3', 'Python requests', 'library'],
      ['Go-http-client/2.0', 'Go http client', 'library'],
      ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Facebook link preview', 'social'],
      ['Mozilla/5.0 (compatible; FooCrawler/3.1; +https://foo.test/bot)', 'FooCrawler', 'generic'],
    ]
    for (const [s, name, kind] of cases) expect(detectBot(s), s).toMatchObject({ name, kind })
    expect(detectBot(ua('iPhone Safari'))).toBeNull()
    expect(detectBot(ua('Windows Edge'))).toBeNull()
    expect(detectBot('')).toBeNull()
  })

  it('handles empty and garbage input', () => {
    expect(describe(parseUa(''))).toBe('Empty user agent.')
    const r = parseUa('hello world')
    expect(r.browser).toEqual({})
    expect(deviceKind(r)).toBe('Unknown')
  })
})
