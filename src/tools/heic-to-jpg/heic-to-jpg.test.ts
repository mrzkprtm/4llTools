import { describe, expect, it } from 'vitest'
import { detectHeif, friendlyError, looksLikeHeicName, outputName } from './heic'

function ftyp(major: string, compat: string[] = []): Uint8Array {
  const size = 16 + compat.length * 4
  const b = new Uint8Array(size + 8)
  b.set([0, 0, 0, size])
  const put = (s: string, at: number) => [...s].forEach((c, i) => (b[at + i] = c.charCodeAt(0)))
  put('ftyp', 4)
  put(major, 8)
  compat.forEach((c, i) => put(c, 16 + i * 4))
  return b
}

describe('heic detection', () => {
  it('recognizes iPhone HEIC and generic HEIF brands', () => {
    expect(detectHeif(ftyp('heic', ['mif1', 'heic']))).toBe('heic')
    expect(detectHeif(ftyp('mif1', ['heic']))).toBe('heic')
  })

  it('tells AVIF apart and rejects other files', () => {
    expect(detectHeif(ftyp('avif', ['mif1', 'miaf']))).toBe('avif')
    expect(detectHeif(ftyp('isom', ['mp41']))).toBeNull()
    expect(detectHeif(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })

  it('checks file names', () => {
    expect(looksLikeHeicName('IMG_0001.HEIC')).toBe(true)
    expect(looksLikeHeicName('a.heif')).toBe(true)
    expect(looksLikeHeicName('a.jpg')).toBe(false)
  })
})

describe('heic output names and errors', () => {
  it('swaps the extension and avoids duplicates', () => {
    const taken = new Set<string>()
    expect(outputName('IMG_1.HEIC', 'image/jpeg', taken)).toBe('IMG_1.jpg')
    expect(outputName('IMG_1.heic', 'image/jpeg', taken)).toBe('IMG_1-2.jpg')
    expect(outputName('IMG_1.heic', 'image/png', taken)).toBe('IMG_1.png')
    expect(outputName('.heic', 'image/png', taken)).toBe('photo.png')
  })

  it('explains heic2any errors', () => {
    expect(friendlyError({ code: 1, message: 'ERR_USER Image is not heic' })).toMatch(/not a HEIC/)
    expect(friendlyError({ code: 2, message: 'ERR_LIBHEIF format not supported' })).toMatch(/not a HEIC|decoded/)
    expect(friendlyError(new Error('boom'))).toBe('boom')
  })
})
