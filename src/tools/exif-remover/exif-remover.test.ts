import { describe, expect, it } from 'vitest'
import { detectKind, stripJpeg, stripPng, stripWebp } from './strip'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))

/** A JPEG segment: marker + big-endian length + payload. */
const seg = (marker: number, payload: number[] | string) => {
  const body = typeof payload === 'string' ? [...payload].map((c) => c.charCodeAt(0)) : payload
  const len = body.length + 2
  return [0xff, marker, len >> 8, len & 0xff, ...body]
}

describe('jpeg', () => {
  const sos = [...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]
  const jpeg = bytes(
    [0xff, 0xd8],
    seg(0xe0, 'JFIF\0\x01\x01'),
    seg(0xe1, 'Exif\0\0MM\0*GPS'),
    seg(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x/>'),
    seg(0xe2, 'ICC_PROFILE\0'),
    seg(0xed, 'Photoshop 3.0\0'),
    seg(0xfe, 'secret comment'),
    seg(0xee, 'Adobe'),
    seg(0xdb, [0, 1, 2]),
    sos,
    [0xff, 0xd9],
  )

  it('removes EXIF, XMP, IPTC and comments but keeps JFIF, ICC, Adobe and image data', () => {
    const { bytes: out, removed } = stripJpeg(jpeg)
    const expected = bytes([0xff, 0xd8], seg(0xe0, 'JFIF\0\x01\x01'), seg(0xe2, 'ICC_PROFILE\0'), seg(0xee, 'Adobe'), seg(0xdb, [0, 1, 2]), sos, [0xff, 0xd9])
    expect([...out]).toEqual([...expected])
    expect(removed).toEqual(['EXIF (APP1)', 'XMP (APP1)', 'IPTC / Photoshop (APP13)', 'Comment (COM)'])
  })

  it('can keep only the orientation', () => {
    const { bytes: out } = stripJpeg(jpeg, { orientation: 6 })
    // SOI, APP0, then the new APP1
    const app1At = 2 + seg(0xe0, 'JFIF\0\x01\x01').length
    expect(out[app1At + 1]).toBe(0xe1)
    expect(String.fromCharCode(...out.subarray(app1At + 4, app1At + 8))).toBe('Exif')
    expect(out[app1At + 4 + 6 + 8 + 2 + 9]).toBe(6)
  })

  it('drops data appended after the end of the image', () => {
    const withTrailer = new Uint8Array([...jpeg, 1, 2, 3])
    const r = stripJpeg(withTrailer)
    expect(r.bytes[r.bytes.length - 1]).toBe(0xd9)
    expect(r.removed.at(-1)).toMatch(/3 bytes/)
  })

  it('rejects corrupt input', () => {
    expect(() => stripJpeg(bytes([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toThrow()
  })
})

function pngChunk(type: string, data: number[]) {
  const len = data.length
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
}

describe('png', () => {
  it('drops text, time and eXIf chunks only', () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    const ihdr = pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
    const idat = pngChunk('IDAT', [1, 2, 3])
    const iend = pngChunk('IEND', [])
    const png = bytes(sig, ihdr, pngChunk('tEXt', [65, 0, 66]), pngChunk('eXIf', [1]), pngChunk('iCCP', [9]), idat, pngChunk('tIME', [7, 7]), iend)
    const r = stripPng(png)
    expect([...r.bytes]).toEqual([...bytes(sig, ihdr, pngChunk('iCCP', [9]), idat, iend)])
    expect(r.removed).toEqual(['tEXt chunk', 'eXIf chunk', 'tIME chunk'])
    expect(detectKind(r.bytes)).toBe('png')
  })
})

describe('webp', () => {
  const le32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24]
  const chunk = (type: string, data: number[]) => [...[...type].map((c) => c.charCodeAt(0)), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])]

  it('removes EXIF/XMP chunks, clears VP8X flags and fixes the RIFF size', () => {
    const vp8x = chunk('VP8X', [0x0c | 0x10, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    const body = [...[...'WEBP'].map((c) => c.charCodeAt(0)), ...vp8x, ...chunk('VP8 ', [1, 2, 3]), ...chunk('EXIF', [5, 5, 5, 5]), ...chunk('XMP ', [6])]
    const webp = bytes('RIFF', le32(body.length), body)
    const r = stripWebp(webp)
    expect(r.removed).toEqual(['EXIF chunk', 'XMP chunk'])
    const view = new DataView(r.bytes.buffer)
    expect(view.getUint32(4, true)).toBe(r.bytes.length - 8)
    expect(r.bytes[20]).toBe(0x10) // alpha flag kept, EXIF/XMP flags cleared
    expect(r.bytes.length).toBe(12 + vp8x.length + chunk('VP8 ', [1, 2, 3]).length)
  })
})
