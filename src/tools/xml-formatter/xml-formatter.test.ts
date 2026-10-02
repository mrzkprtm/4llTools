import { describe, expect, it } from 'vitest'
import { format, jsonToXml, minify, tokenize, validate, xmlToJson } from './xml'

const SRC = `<?xml version="1.0"?><catalog><!-- books --><book id="bk1"   lang='en'><title>XML &amp; You</title><price>9.5</price><tags/></book><note><![CDATA[a < b]]></note></catalog>`

const opts = { attrPrefix: '@_', indent: 2, parseValues: true, rootName: 'root' }

describe('xml-formatter', () => {
  it('tokenizes tags with quoted > in attributes', () => {
    const toks = tokenize('<a title="x > y"><b/></a>')
    expect(toks.map((t) => t.t)).toEqual(['open', 'open', 'close'])
  })

  it('pretty prints with nested indentation and inline short text', () => {
    expect(format(SRC, { indent: '  ' })).toBe(
      [
        '<?xml version="1.0"?>',
        '<catalog>',
        '  <!-- books -->',
        `  <book id="bk1" lang='en'>`,
        '    <title>XML &amp; You</title>',
        '    <price>9.5</price>',
        '    <tags />',
        '  </book>',
        '  <note>',
        '    <![CDATA[a < b]]>',
        '  </note>',
        '</catalog>',
      ].join('\n'),
    )
  })

  it('minifies back and can strip comments', () => {
    const pretty = format(SRC, { indent: '    ' })
    expect(minify(pretty)).toBe(SRC.replace('   lang', ' lang').replace('<tags/>', '<tags/>'))
    expect(minify(pretty, { stripComments: true })).not.toContain('<!--')
  })

  it('validates and reports line and column', () => {
    expect(validate(SRC)).toEqual({ ok: true })
    const bad = validate('<a>\n  <b>\n</a>')
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.line).toBeGreaterThanOrEqual(2)
      expect(bad.message).toMatch(/b|closing/i)
    }
    expect(validate('')).toMatchObject({ ok: false })
  })

  it('converts XML to JSON with an attribute prefix', () => {
    const obj = JSON.parse(xmlToJson(SRC, opts))
    expect(obj.catalog.book['@_id']).toBe('bk1')
    expect(obj.catalog.book.title).toBe('XML & You')
    expect(obj.catalog.book.price).toBe(9.5)
    const raw = JSON.parse(xmlToJson('<a n="1"><b>007</b></a>', { ...opts, attrPrefix: '$', parseValues: false }))
    expect(raw).toEqual({ a: { $n: '1', b: '007' } })
  })

  it('converts JSON to XML and wraps arrays in a root', () => {
    const xml = jsonToXml(JSON.stringify({ user: { '@_id': 7, name: 'Ada', role: ['admin', 'dev'] } }), opts)
    expect(xml).toContain('<user id="7">')
    expect(xml).toContain('<role>admin</role>')
    const arr = jsonToXml('[1,2]', { ...opts, rootName: 'list' })
    expect(arr).toContain('<list>')
    expect(arr).toContain('<item>1</item>')
    // round trip
    expect(JSON.parse(xmlToJson(xml, opts))).toEqual({ user: { '@_id': 7, name: 'Ada', role: ['admin', 'dev'] } })
  })
})
