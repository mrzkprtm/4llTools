import { describe, expect, it } from 'vitest'
import { buildHtml, buildManifest, clampText, encodeIco, fitSquare, letterSvg, normalizePath, readIco } from './favicon'

const fakePng = (n: number) => {
  const b = new Uint8Array(n)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  b[n - 1] = 0xaa
  return b
}

describe('favicon ICO encoder', () => {
  it('writes a valid header and directory pointing at each PNG', () => {
    const a = fakePng(20)
    const b = fakePng(33)
    const c = fakePng(41)
    const ico = encodeIco([{ size: 16, png: a }, { size: 32, png: b }, { size: 256, png: c }])
    expect([...ico.slice(0, 6)]).toEqual([0, 0, 1, 0, 3, 0])
    expect(ico.length).toBe(6 + 16 * 3 + 20 + 33 + 41)
    const dir = readIco(ico)
    expect(dir.map((d) => d.size)).toEqual([16, 32, 256])
    expect(dir.map((d) => d.bytes)).toEqual([20, 33, 41])
    expect(dir[0].offset).toBe(54)
    expect(dir.every((d) => d.isPng)).toBe(true)
    // Bytes are copied intact.
    expect([...ico.slice(dir[1].offset, dir[1].offset + 33)]).toEqual([...b])
    // 256 is stored as 0; bpp is 32 and planes 1.
    const view = new DataView(ico.buffer)
    expect(ico[6 + 32]).toBe(0)
    expect(view.getUint16(6 + 4, true)).toBe(1)
    expect(view.getUint16(6 + 6, true)).toBe(32)
  })

  it('rejects empty input and impossible sizes', () => {
    expect(() => encodeIco([])).toThrow()
    expect(() => encodeIco([{ size: 300, png: fakePng(10) }])).toThrow()
    expect(() => readIco(new Uint8Array([1, 2, 3]))).toThrow()
  })
})

describe('favicon layout', () => {
  it('contains a wide image with padding', () => {
    const r = fitSquare(200, 100, 100, 0.1, 'contain')
    expect(r.dw).toBeCloseTo(80)
    expect(r.dh).toBeCloseTo(40)
    expect(r.dx).toBeCloseTo(10)
    expect(r.dy).toBeCloseTo(30)
  })

  it('covers a tall image, overflowing the square', () => {
    const r = fitSquare(100, 300, 60, 0, 'cover')
    expect(r.dw).toBeCloseTo(60)
    expect(r.dh).toBeCloseTo(180)
    expect(r.dy).toBeCloseTo(-60)
  })
})

describe('favicon text, manifest and html', () => {
  it('keeps at most three characters and emoji whole', () => {
    expect(clampText('  Hello ')).toBe('Hel')
    expect(clampText('👍🏽A')).toBe('👍🏽A')
  })

  it('builds an escaped SVG', () => {
    const svg = letterSvg({ text: '<a', fg: '#fff', bg: '#000', shape: 'circle', scale: 0.6, bold: true })
    expect(svg).toContain('<circle')
    expect(svg).toContain('&lt;a')
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  })

  it('writes a manifest and head tags using the chosen folder', () => {
    const site = { name: 'Toko', shortName: '', themeColor: '#123456', backgroundColor: '#ffffff', path: 'icons', hasSvg: false }
    expect(normalizePath('icons')).toBe('/icons/')
    const m = JSON.parse(buildManifest(site))
    expect(m.short_name).toBe('Toko')
    expect(m.icons.map((i: { src: string }) => i.src)).toContain('/icons/android-chrome-512x512.png')
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
    const html = buildHtml(site)
    expect(html).toContain('href="/icons/favicon.ico"')
    expect(html).not.toContain('favicon.svg')
    expect(buildHtml({ ...site, hasSvg: true })).toContain('favicon.svg')
  })
})
