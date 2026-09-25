/** Lossless, byte-level metadata removal for JPEG, PNG and WebP. */

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'other'

export interface StripResult {
  bytes: Uint8Array
  /** Human-readable names of what was removed, e.g. "EXIF (APP1)". */
  removed: string[]
}

export function detectKind(b: Uint8Array): ImageKind {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  return 'other'
}

function ascii(b: Uint8Array, start: number, len: number): string {
  let s = ''
  for (let i = start; i < start + len && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/* ---------- JPEG ---------- */

/** A minimal APP1 EXIF segment that only carries the orientation, so rotated photos still display upright. */
export function orientationSegment(orientation: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF header, IFD0 at offset 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation & 0xff, 0x00, 0x00, // Orientation SHORT
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff] // "Exif\0\0"
  const len = payload.length + 2
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload])
}

function jpegSegmentName(marker: number, b: Uint8Array, dataStart: number): string {
  if (marker === 0xe1) {
    const id = ascii(b, dataStart, 29)
    if (id.startsWith('Exif')) return 'EXIF (APP1)'
    if (id.startsWith('http://ns.adobe.com/xap/1.0/')) return 'XMP (APP1)'
    if (id.startsWith('http://ns.adobe.com/xmp/exten')) return 'Extended XMP (APP1)'
    return 'APP1 data'
  }
  if (marker === 0xed) return 'IPTC / Photoshop (APP13)'
  if (marker === 0xfe) return 'Comment (COM)'
  return `APP${marker - 0xe0} data`
}

/**
 * Removes APP1 (EXIF/XMP), APP13 (IPTC), COM and other vendor APPn segments.
 * Keeps APP0 (JFIF), APP2 (ICC profile / MPF) and APP14 (Adobe colour transform),
 * and copies the image data after the first SOS untouched.
 */
export function stripJpeg(b: Uint8Array, opts: { orientation?: number } = {}): StripResult {
  if (detectKind(b) !== 'jpeg') throw new Error('Not a JPEG file.')
  const keep: Uint8Array[] = [b.subarray(0, 2)]
  const removed: string[] = []
  let insertedOrientation = false
  const maybeInsertOrientation = () => {
    if (!insertedOrientation && opts.orientation && opts.orientation > 1 && opts.orientation <= 8) {
      keep.push(orientationSegment(opts.orientation))
      insertedOrientation = true
    }
  }
  let pos = 2
  while (pos < b.length) {
    if (b[pos] !== 0xff) throw new Error(`Corrupt JPEG: expected a marker at byte ${pos}.`)
    // Skip fill bytes.
    let p = pos
    while (p < b.length && b[p] === 0xff) p++
    if (p >= b.length) throw new Error('Corrupt JPEG: truncated marker.')
    const marker = b[p]
    const markerStart = p - 1
    if (marker === 0xd9) {
      keep.push(b.subarray(markerStart, p + 1))
      pos = p + 1
      break
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      keep.push(b.subarray(markerStart, p + 1))
      pos = p + 1
      continue
    }
    if (p + 2 >= b.length) throw new Error('Corrupt JPEG: truncated segment.')
    const len = (b[p + 1] << 8) | b[p + 2]
    if (len < 2) throw new Error('Corrupt JPEG: bad segment length.')
    const end = p + 1 + len
    if (end > b.length) throw new Error('Corrupt JPEG: segment runs past the end of the file.')
    if (marker === 0xda) {
      maybeInsertOrientation()
      // Start of scan: copy the header and the entropy-coded data up to the next real marker.
      let q = end
      while (q < b.length) {
        if (b[q] === 0xff && q + 1 < b.length && b[q + 1] !== 0x00 && !(b[q + 1] >= 0xd0 && b[q + 1] <= 0xd7) && b[q + 1] !== 0xff) break
        q++
      }
      keep.push(b.subarray(markerStart, q))
      pos = q
      continue
    }
    const isApp = marker >= 0xe0 && marker <= 0xef
    const isMpf = marker === 0xe2 && ascii(b, p + 3, 4) === 'MPF\0'
    const drop = marker === 0xfe || isMpf || (isApp && marker !== 0xe0 && marker !== 0xe2 && marker !== 0xee)
    if (drop) {
      removed.push(isMpf ? 'Multi-picture index (APP2 MPF)' : jpegSegmentName(marker, b, p + 3))
    } else {
      // Put the orientation-only EXIF right after JFIF (APP0), or before the first other kept segment.
      if (marker !== 0xe0) maybeInsertOrientation()
      keep.push(b.subarray(markerStart, end))
    }
    pos = end
  }
  if (pos < b.length) removed.push(`Data after the end of the image (${b.length - pos} bytes)`)
  return { bytes: concat(keep), removed: dedupeCount(removed) }
}

function dedupeCount(names: string[]): string[] {
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n))
}

/* ---------- PNG ---------- */

const PNG_DROP = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'])

export function stripPng(b: Uint8Array): StripResult {
  if (detectKind(b) !== 'png') throw new Error('Not a PNG file.')
  const keep: Uint8Array[] = [b.subarray(0, 8)]
  const removed: string[] = []
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let pos = 8
  while (pos < b.length) {
    if (pos + 12 > b.length) throw new Error('Corrupt PNG: truncated chunk.')
    const len = view.getUint32(pos)
    const type = ascii(b, pos + 4, 4)
    const end = pos + 12 + len
    if (end > b.length) throw new Error(`Corrupt PNG: chunk ${type} runs past the end of the file.`)
    if (PNG_DROP.has(type)) removed.push(`${type} chunk`)
    else keep.push(b.subarray(pos, end))
    pos = end
    if (type === 'IEND') break
  }
  return { bytes: concat(keep), removed: dedupeCount(removed) }
}

/* ---------- WebP ---------- */

export function stripWebp(b: Uint8Array): StripResult {
  if (detectKind(b) !== 'webp') throw new Error('Not a WebP file.')
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const riffEnd = Math.min(b.length, 8 + view.getUint32(4, true))
  const chunks: Uint8Array[] = []
  const removed: string[] = []
  let vp8xIndex = -1
  let pos = 12
  while (pos + 8 <= riffEnd) {
    const type = ascii(b, pos, 4)
    const size = view.getUint32(pos + 4, true)
    const end = pos + 8 + size + (size & 1)
    if (pos + 8 + size > riffEnd) throw new Error(`Corrupt WebP: chunk ${type} runs past the end of the file.`)
    if (type === 'EXIF' || type === 'XMP ') {
      removed.push(type === 'EXIF' ? 'EXIF chunk' : 'XMP chunk')
    } else {
      if (type === 'VP8X') vp8xIndex = chunks.length
      chunks.push(b.slice(pos, Math.min(end, riffEnd)))
    }
    pos = end
  }
  if (vp8xIndex >= 0) {
    // Clear the EXIF (0x08) and XMP (0x04) presence flags.
    chunks[vp8xIndex][8] &= ~0x0c
  }
  const body = concat(chunks)
  const header = new Uint8Array(12)
  header.set(b.subarray(0, 12))
  new DataView(header.buffer).setUint32(4, body.length + 4, true)
  return { bytes: concat([header, body]), removed }
}

export function stripImage(b: Uint8Array, opts: { orientation?: number } = {}): StripResult & { kind: ImageKind } {
  const kind = detectKind(b)
  if (kind === 'jpeg') return { kind, ...stripJpeg(b, opts) }
  if (kind === 'png') return { kind, ...stripPng(b) }
  if (kind === 'webp') return { kind, ...stripWebp(b) }
  throw new Error('Unsupported format for lossless stripping.')
}
