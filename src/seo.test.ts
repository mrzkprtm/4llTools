import { describe, expect, it } from 'vitest'
import {
  categoryMeta,
  headTags,
  homeMeta,
  llmsTxt,
  relatedTools,
  toolFaq,
  toolMeta,
  toolStructuredData,
} from './seo'
import { groupByCategory } from './tools/grouping'
import { tools } from './tools/registry'

describe('seo', () => {
  const pages = [homeMeta(tools), ...groupByCategory(tools).map(([c, l]) => categoryMeta(c, l)), ...tools.map(toolMeta)]

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
    const html = headTags({ title: 'A "b"', description: 'x', path: '/qr-reader', image: '/og/qr-reader.png' })
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/qr-reader" \/>/)
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/[^"]+\/og\/qr-reader.png" \/>/)
    expect(html).toContain('A &quot;b&quot;')
  })

  it('describes a tool page as a free web application with breadcrumbs and a FAQ', () => {
    const tool = tools.find((t) => t.slug === 'qr-reader')!
    const types = toolStructuredData(toolMeta(tool), tool).map((o) => (o as { '@type': string })['@type'])
    expect(types).toEqual(['WebApplication', 'BreadcrumbList', 'FAQPage'])
  })

  it('only promises privacy for tools that keep data on the device', () => {
    const dns = tools.find((t) => t.slug === 'dns-lookup')!
    expect(toolFaq(dns).map((f) => f.a).join(' ')).not.toContain('never leaves your device')
    const qr = tools.find((t) => t.slug === 'qr-reader')!
    expect(toolFaq(qr).map((f) => f.a).join(' ')).toContain('never leaves your device')
  })

  it('links every tool to related tools, never itself', () => {
    for (const t of tools) {
      const related = relatedTools(t, tools)
      expect(related.length, t.slug).toBeGreaterThan(0)
      expect(related.map((r) => r.slug)).not.toContain(t.slug)
    }
  })

  it('lists every tool in llms.txt', () => {
    const txt = llmsTxt(tools)
    for (const t of tools) expect(txt).toContain(`/${t.slug})`)
  })
})
