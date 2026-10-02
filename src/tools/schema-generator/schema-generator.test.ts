import { describe, expect, it } from 'vitest'
import { buildSchema, clean, minutesToDuration, missingRequired, toScriptTag, TYPE_BY_ID, TYPES } from './schema'

const t = (id: string) => TYPE_BY_ID.get(id)!

describe('schema markup generator', () => {
  it('covers every promised type, and each example builds valid JSON with a context and type', () => {
    for (const id of ['Article', 'Product', 'FAQPage', 'HowTo', 'LocalBusiness', 'Organization', 'Person', 'Event', 'BreadcrumbList', 'WebSite', 'Recipe']) expect(TYPE_BY_ID.has(id), id).toBe(true)
    for (const type of TYPES) {
      const obj = buildSchema(type, type.example)
      expect(obj['@context']).toBe('https://schema.org')
      expect(typeof obj['@type']).toBe('string')
      expect(JSON.parse(JSON.stringify(obj))).toEqual(obj)
      expect(missingRequired(type, type.example), type.id).toEqual([])
    }
  })

  it('drops empty values recursively', () => {
    expect(clean({ a: '', b: ' x ', c: [], d: { '@type': 'Thing', e: '' }, f: 0, g: [{ h: '' }, 'y'], i: null, j: NaN })).toEqual({ b: 'x', f: 0, g: ['y'] })
    const product = buildSchema(t('Product'), { fields: { name: 'Mug', price: '' }, rows: {} })
    expect(product).toEqual({ '@context': 'https://schema.org', '@type': 'Product', name: 'Mug' })
  })

  it('builds FAQ entries only from complete pairs', () => {
    const faq = buildSchema(t('FAQPage'), { fields: {}, rows: { faq: [{ q: 'Q1?', a: 'A1' }, { q: 'Q2?', a: '' }, { _id: '9', q: '', a: '' }] } })
    expect(faq.mainEntity).toEqual([{ '@type': 'Question', name: 'Q1?', acceptedAnswer: { '@type': 'Answer', text: 'A1' } }])
  })

  it('builds product offers and rating with numbers and schema.org URLs', () => {
    const p = buildSchema(t('Product'), t('Product').example) as Record<string, Record<string, unknown>>
    expect(p.offers).toMatchObject({ '@type': 'Offer', price: 95000, priceCurrency: 'IDR', availability: 'https://schema.org/InStock' })
    expect(p.aggregateRating).toMatchObject({ ratingValue: 4.8, reviewCount: 126 })
  })

  it('numbers breadcrumb positions and expands opening-hour day sets', () => {
    const b = buildSchema(t('BreadcrumbList'), t('BreadcrumbList').example) as { itemListElement: { position: number }[] }
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2, 3])
    const lb = buildSchema(t('LocalBusiness'), t('LocalBusiness').example) as { openingHoursSpecification: { dayOfWeek: string[] }[] }
    expect(lb.openingHoursSpecification[0].dayOfWeek).toHaveLength(5)
    expect(lb.openingHoursSpecification[1].dayOfWeek).toEqual(['Saturday', 'Sunday'])
  })

  it('adds a SearchAction only for a valid template', () => {
    const ok = buildSchema(t('WebSite'), t('WebSite').example) as { potentialAction?: Record<string, unknown> }
    expect(ok.potentialAction).toMatchObject({ '@type': 'SearchAction', 'query-input': 'required name=search_term_string' })
    const bad = buildSchema(t('WebSite'), { fields: { name: 'X', url: 'https://x.test', search: 'https://x.test/search?q=' }, rows: {} })
    expect(bad.potentialAction).toBeUndefined()
  })

  it('converts minutes to ISO 8601 durations and sums recipe time', () => {
    expect(minutesToDuration('30')).toBe('PT30M')
    expect(minutesToDuration('90')).toBe('PT1H30M')
    expect(minutesToDuration('120')).toBe('PT2H')
    expect(minutesToDuration('')).toBeUndefined()
    expect(minutesToDuration('-5')).toBeUndefined()
    expect(buildSchema(t('Recipe'), t('Recipe').example).totalTime).toBe('PT10M')
  })

  it('wraps JSON-LD in a script tag that text cannot break out of', () => {
    const tag = toScriptTag({ name: '</script><script>alert(1)</script>' })
    expect(tag.startsWith('<script type="application/ld+json">\n')).toBe(true)
    expect(tag.match(/<\/script>/g)).toHaveLength(1)
    const json = tag.replace(/^<script[^>]*>\n/, '').replace(/\n<\/script>$/, '')
    expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>')
  })

  it('reports missing required fields and empty required groups', () => {
    const m = missingRequired(t('Recipe'), { fields: { name: 'Tea' }, rows: { ingredients: [{ _id: '1', text: '' }] } })
    expect(m).toContain('Image URL(s)')
    expect(m).toContain('Ingredients')
    expect(m).toContain('Instructions')
  })
})
