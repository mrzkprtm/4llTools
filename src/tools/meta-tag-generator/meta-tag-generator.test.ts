import { describe, expect, it } from 'vitest'
import { breadcrumb, checkFields, escapeHtml, generateTags, hostOf, lengthState, LIMITS, normalizeHandle, truncate, type MetaFields } from './tags'

const base: MetaFields = {
  title: 'Hello',
  description: 'A page',
  url: 'https://example.com/a/b',
  image: 'https://example.com/og.png',
  imageAlt: 'Alt',
  siteName: 'Example',
  twitterHandle: 'example',
  twitterCard: 'summary_large_image',
  type: 'website',
  locale: 'en_US',
  themeColor: '#ffffff',
  author: '',
  index: true,
  follow: true,
}

describe('meta tag generator', () => {
  it('escapes every value', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    const html = generateTags({ ...base, title: 'Tom & "Jerry" <script>', description: "It's <b>bold</b>" })
    expect(html).toContain('<title>Tom &amp; &quot;Jerry&quot; &lt;script&gt;</title>')
    expect(html).toContain('<meta property="og:title" content="Tom &amp; &quot;Jerry&quot; &lt;script&gt;" />')
    expect(html).toContain('content="It&#39;s &lt;b&gt;bold&lt;/b&gt;"')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
  })

  it('writes Open Graph, X and canonical tags and skips empty fields', () => {
    const html = generateTags(base)
    expect(html).toContain('<link rel="canonical" href="https://example.com/a/b" />')
    expect(html).toContain('<meta property="og:image" content="https://example.com/og.png" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html).toContain('<meta name="twitter:site" content="@example" />')
    expect(html).toContain('<meta name="robots" content="index, follow" />')
    expect(html).not.toContain('name="author"')
    const noImg = generateTags({ ...base, image: '', index: false, follow: false })
    expect(noImg).not.toContain('og:image')
    expect(noImg).toContain('content="noindex, nofollow"')
  })

  it('rates lengths against the limits', () => {
    expect(lengthState('', LIMITS.title)).toBe('empty')
    expect(lengthState('Short', LIMITS.title)).toBe('short')
    expect(lengthState('x'.repeat(50), LIMITS.title)).toBe('good')
    expect(lengthState('x'.repeat(61), LIMITS.title)).toBe('long')
    expect(lengthState('x'.repeat(156), LIMITS.description)).toBe('long')
  })

  it('normalizes handles and URLs', () => {
    expect(normalizeHandle('@@abc')).toBe('@abc')
    expect(normalizeHandle('https://x.com/abc?s=1')).toBe('@abc')
    expect(normalizeHandle('  ')).toBe('')
    expect(hostOf('https://www.example.com/x')).toBe('example.com')
    expect(hostOf('not a url/x')).toBe('not a url')
    expect(breadcrumb('https://example.com/blog/my%20post')).toBe('example.com › blog › my post')
  })

  it('truncates on word boundaries', () => {
    expect(truncate('short', 10)).toBe('short')
    expect(truncate('The quick brown fox jumps over', 18)).toBe('The quick brown…')
  })

  it('flags missing and relative values', () => {
    const issues = checkFields({ ...base, image: '/og.png', title: '' })
    expect(issues.some((i) => i.includes('title'))).toBe(true)
    expect(issues.some((i) => i.includes('absolute https://'))).toBe(true)
    expect(checkFields(base)).toEqual([])
  })
})
