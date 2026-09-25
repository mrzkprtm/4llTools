import { describe, expect, it } from 'vitest'
import { headTags, homeMeta, structuredData, toolMeta } from './seo'
import { tools } from './tools/registry'

describe('seo', () => {
  const pages = [homeMeta, ...tools.map(toolMeta)]

  it('gives every page a unique title and description of a length search engines show in full', () => {
    for (const p of pages) {
      expect(p.title.length, p.title).toBeLessThanOrEqual(70)
      expect(p.description.length, p.description).toBeGreaterThanOrEqual(70)
      expect(p.description.length, p.description).toBeLessThanOrEqual(160)
    }
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length)
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length)
  })

  it('writes an absolute canonical link and escapes quotes', () => {
    const html = headTags({ title: 'A "b"', description: 'x', path: '/qr-reader' })
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/qr-reader" \/>/)
    expect(html).toContain('A &quot;b&quot;')
  })

  it('describes a tool page as a free web application', () => {
    const tool = tools.find((t) => t.slug === 'qr-reader')!
    const [app] = structuredData(toolMeta(tool), tool) as { '@type': string; isAccessibleForFree: boolean }[]
    expect(app['@type']).toBe('WebApplication')
    expect(app.isAccessibleForFree).toBe(true)
  })
})
