/** UUID v4/v7, ULID, NanoID and CUID2-style ids, plus timestamp decoding. */

export type RandomBytes = (n: number) => Uint8Array

export const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n))

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

function formatUuid(bytes: Uint8Array): string {
  const h = hex(bytes)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function uuidV4(rand: RandomBytes = cryptoBytes): string {
  const b = rand(16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  return formatUuid(b)
}

// ---------------------------------------------------------------- monotonic helpers

/** Adds 1 to a big-endian byte array in place. Returns false on overflow. */
function increment(bytes: Uint8Array): boolean {
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] < 255) {
      bytes[i]++
      return true
    }
    bytes[i] = 0
  }
  return false
}

export interface BatchOptions {
  count: number
  /** Within the same millisecond, increment the random part instead of re-rolling, so ids sort in creation order. */
  monotonic: boolean
  now?: () => number
  rand?: RandomBytes
}

// ---------------------------------------------------------------- UUID v7 (RFC 9562)

/**
 * 48-bit Unix ms | ver 7 | 12 bits rand_a | var 10 | 62 bits rand_b.
 * For monotonic batches the 74 random bits are treated as one counter.
 */
export function uuidV7Batch({ count, monotonic, now = Date.now, rand = cryptoBytes }: BatchOptions): string[] {
  const out: string[] = []
  let lastMs = -1
  let bits: Uint8Array = new Uint8Array(10) // 80 bits, top 6 unused (74 random bits)
  for (let n = 0; n < count; n++) {
    let ms = now()
    if (monotonic && ms <= lastMs) {
      ms = lastMs
      if (!increment(bits) || bits[0] >= 4) {
        ms = lastMs + 1
        bits = rand(10)
        bits[0] &= 0x01 // leave headroom for increments
      }
    } else {
      bits = rand(10)
      bits[0] &= monotonic ? 0x01 : 0x03
    }
    lastMs = ms
    out.push(uuidV7FromParts(ms, bits))
  }
  return out
}

function uuidV7FromParts(ms: number, bits: Uint8Array): string {
  // bits: 80-bit big-endian number whose low 74 bits are used.
  let r = 0n
  for (const b of bits) r = (r << 8n) | BigInt(b)
  r &= (1n << 74n) - 1n
  const randA = Number(r >> 62n) // 12 bits
  const randB = r & ((1n << 62n) - 1n)
  const b = new Uint8Array(16)
  let t = BigInt(ms)
  for (let i = 5; i >= 0; i--) {
    b[i] = Number(t & 0xffn)
    t >>= 8n
  }
  b[6] = 0x70 | (randA >> 8)
  b[7] = randA & 0xff
  let rb = randB | (0b10n << 62n)
  for (let i = 15; i >= 8; i--) {
    b[i] = Number(rb & 0xffn)
    rb >>= 8n
  }
  return formatUuid(b)
}

export function uuidV7(ms = Date.now(), rand: RandomBytes = cryptoBytes): string {
  return uuidV7Batch({ count: 1, monotonic: false, now: () => ms, rand })[0]
}

// ---------------------------------------------------------------- ULID

export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeBase32(value: bigint, length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) {
    s = CROCKFORD[Number(value & 31n)] + s
    value >>= 5n
  }
  return s
}

export function ulidBatch({ count, monotonic, now = Date.now, rand = cryptoBytes }: BatchOptions): string[] {
  const out: string[] = []
  let lastMs = -1
  let bits: Uint8Array = new Uint8Array(10)
  for (let n = 0; n < count; n++) {
    let ms = now()
    if (monotonic && ms <= lastMs) {
      ms = lastMs
      if (!increment(bits)) {
        ms = lastMs + 1
        bits = rand(10)
      }
    } else bits = rand(10)
    lastMs = ms
    let r = 0n
    for (const b of bits) r = (r << 8n) | BigInt(b)
    out.push(encodeBase32(BigInt(ms), 10) + encodeBase32(r, 16))
  }
  return out
}

export function ulid(ms = Date.now(), rand: RandomBytes = cryptoBytes): string {
  return ulidBatch({ count: 1, monotonic: false, now: () => ms, rand })[0]
}

// ---------------------------------------------------------------- NanoID

export const NANO_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

/** Unbiased NanoID using a bit mask and rejection sampling, like the reference implementation. */
export function nanoid(size = 21, alphabet = NANO_ALPHABET, rand: RandomBytes = cryptoBytes): string {
  const chars = [...new Set([...alphabet])]
  if (chars.length < 2) throw new Error('The alphabet needs at least 2 different characters.')
  if (chars.length > 256) throw new Error('The alphabet can have at most 256 characters.')
  const mask = (2 << Math.floor(Math.log2(chars.length - 1))) - 1
  const step = Math.ceil((1.6 * mask * size) / chars.length)
  let id = ''
  for (;;) {
    const bytes = rand(step)
    for (let i = 0; i < step; i++) {
      const c = chars[bytes[i] & mask]
      if (c !== undefined) {
        id += c
        if (id.length === size) return id
      }
    }
  }
}

/**
 * How many ids you can create before a 1% chance of any collision
 * (birthday bound n ≈ sqrt(2·N·ln(1/(1-p)))), as log10 to avoid overflow.
 */
export function collisionLog10(alphabetSize: number, size: number, p = 0.01): number {
  const log10N = size * Math.log10(alphabetSize)
  return 0.5 * (Math.log10(2) + log10N + Math.log10(Math.log(1 / (1 - p))))
}

/** Plain-language form of collisionLog10, e.g. "~2.3 trillion". */
export function humanCount(log10: number): string {
  if (log10 < 3) return `~${Math.max(1, Math.round(10 ** log10))}`
  const units: [number, string][] = [
    [33, 'decillion'],
    [30, 'nonillion'],
    [27, 'octillion'],
    [24, 'septillion'],
    [21, 'sextillion'],
    [18, 'quintillion'],
    [15, 'quadrillion'],
    [12, 'trillion'],
    [9, 'billion'],
    [6, 'million'],
    [3, 'thousand'],
  ]
  if (log10 >= 36) return `~10^${Math.floor(log10)}`
  const [exp, name] = units.find(([e]) => log10 >= e)!
  const v = 10 ** (log10 - exp)
  return `~${v < 10 ? v.toFixed(1) : Math.round(v)} ${name}`
}

// ---------------------------------------------------------------- CUID2-style

const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** A CUID2-shaped id: a lowercase letter then base36 characters (random, not hashed like real CUID2). */
export function cuid2Like(length = 24, rand: RandomBytes = cryptoBytes): string {
  const first = nanoid(1, 'abcdefghijklmnopqrstuvwxyz', rand)
  return first + nanoid(length - 1, BASE36, rand)
}

// ---------------------------------------------------------------- decoding

export type Decoded =
  | { ok: true; kind: string; ms: number | null; version?: number; note?: string }
  | { ok: false; error: string }

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const ULID_RE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i

export function decodeUlidTime(id: string): number {
  let t = 0
  for (const c of id.slice(0, 10).toUpperCase()) t = t * 32 + CROCKFORD.indexOf(c)
  return t
}

/** Reads the timestamp from a UUID v1/v6/v7 or a ULID. */
export function decode(raw: string): Decoded {
  const id = raw.trim().replace(/^urn:uuid:/i, '').replace(/^\{|\}$/g, '')
  if (!id) return { ok: false, error: 'Paste a UUID or ULID.' }
  if (ULID_RE.test(id)) return { ok: true, kind: 'ULID', ms: decodeUlidTime(id) }
  if (!UUID_RE.test(id)) return { ok: false, error: 'Not a UUID (32 hex digits) or ULID (26 Crockford base32 characters).' }
  const h = id.replace(/-/g, '').toLowerCase()
  if (/^0+$/.test(h)) return { ok: true, kind: 'Nil UUID', ms: null }
  if (/^f+$/.test(h)) return { ok: true, kind: 'Max UUID', ms: null }
  const version = parseInt(h[12], 16)
  const variant = parseInt(h[16], 16)
  const rfc = (variant & 0xc) === 0x8
  const note = rfc ? undefined : 'The variant bits are not the RFC 9562 variant, so this may not be a standard UUID.'
  if (version === 7) return { ok: true, kind: 'UUID v7', version, ms: parseInt(h.slice(0, 12), 16), note }
  if (version === 1 || version === 6) {
    // 60-bit count of 100 ns intervals since 1582-10-15.
    const ts = version === 1 ? h.slice(13, 16) + h.slice(8, 12) + h.slice(0, 8) : h.slice(0, 12) + h.slice(13, 16)
    const ms = Number(BigInt('0x' + ts) / 10000n - 12219292800000n)
    return { ok: true, kind: `UUID v${version}`, version, ms, note }
  }
  return { ok: true, kind: `UUID v${version}`, version, ms: null, note: note ?? (version === 4 ? 'UUID v4 is fully random, so it has no timestamp.' : 'This UUID version has no timestamp.') }
}
