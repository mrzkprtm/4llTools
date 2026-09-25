import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from './build'
import { pageSize, pdfFileName, placeImage, targetPixels } from './layout'

describe('images to pdf layout', () => {
  it('picks page sizes and orientation', () => {
    expect(pageSize(800, 600, 'a4', 'auto', 20)).toEqual([841.89, 595.28])
    expect(pageSize(600, 800, 'a4', 'auto', 20)).toEqual([595.28, 841.89])
    expect(pageSize(800, 600, 'letter', 'portrait', 0)).toEqual([612, 792])
    expect(pageSize(400, 200, 'fit', 'auto', 10)).toEqual([320, 170])
  })

  it('contains an image centered inside the margins', () => {
    const p = placeImage(1000, 500, 600, 800, 50, 'contain')
    expect(p.w).toBeCloseTo(500)
    expect(p.h).toBeCloseTo(250)
    expect(p.x).toBeCloseTo(50)
    expect(p.y).toBeCloseTo(275)
    expect(p.crop).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 500 })
  })

  it('covers the box and crops the middle of the image', () => {
    const p = placeImage(1000, 500, 600, 800, 0, 'cover')
    expect([p.x, p.y, p.w, p.h]).toEqual([0, 0, 600, 800])
    expect(p.crop.sh).toBeCloseTo(500)
    expect(p.crop.sw).toBeCloseTo(375)
    expect(p.crop.sx).toBeCloseTo(312.5)
  })

  it('downsamples to a DPI but never upscales', () => {
    expect(targetPixels(4000, 3000, 72 * 4, 72 * 3, 150)).toEqual({ w: 600, h: 450 })
    expect(targetPixels(300, 200, 72 * 10, 72 * 10, 300)).toEqual({ w: 300, h: 200 })
    expect(targetPixels(1234, 567, 10, 10, 0)).toEqual({ w: 1234, h: 567 })
  })

  it('makes safe file names', () => {
    expect(pdfFileName(' my/scan.pdf ')).toBe('my-scan.pdf')
    expect(pdfFileName('')).toBe('images.pdf')
  })
})

describe('images to pdf build', () => {
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))

  it('creates one page per image with the chosen size', async () => {
    const seen: number[] = []
    const bytes = await buildPdf(
      [{ bytes: png, kind: 'png', srcW: 800, srcH: 600 }, { bytes: png, kind: 'png', srcW: 600, srcH: 800 }],
      { size: 'a4', orientation: 'auto', margin: 20, fit: 'contain', title: 'Test' },
      (n) => seen.push(n),
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getPage(0).getWidth()).toBeCloseTo(841.89)
    expect(doc.getPage(1).getWidth()).toBeCloseTo(595.28)
    expect(doc.getTitle()).toBe('Test')
    expect(seen).toEqual([1, 2])
    await expect(buildPdf([], { size: 'a4', orientation: 'auto', margin: 0, fit: 'contain' })).rejects.toThrow()
  })
})
