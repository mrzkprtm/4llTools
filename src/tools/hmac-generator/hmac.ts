export const HMAC_ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
export type HmacAlgorithm = (typeof HMAC_ALGORITHMS)[number]
export type Encoding = 'text' | 'hex' | 'base64'

export const DIGEST_BYTES: Record<HmacAlgorithm, number> = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 }

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').replace(/[\s:]/g, '')
  if (clean.length % 2 !== 0) throw new Error('Hex needs an even number of digits.')
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex can only contain 0–9 and a–f.')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.replace(/=+$/, '').length % 4 === 1) throw new Error('This is not valid Base64.')
  const padded = clean.replace(/=+$/, '') + '='.repeat((4 - (clean.replace(/=+$/, '').length % 4)) % 4)
  const bin = atob(padded)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function decode(value: string, encoding: Encoding): Uint8Array {
  if (encoding === 'hex') return hexToBytes(value)
  if (encoding === 'base64') return base64ToBytes(value)
  return new TextEncoder().encode(value)
}

export async function hmac(algorithm: HmacAlgorithm, key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  // WebCrypto rejects zero-length HMAC keys, but HMAC defines an empty key as a block of zeros.
  const k = key.length ? key : new Uint8Array(1)
  const cryptoKey = await crypto.subtle.importKey('raw', k as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource))
}

/** Compares two byte arrays without stopping at the first difference. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export interface ParsedSignature {
  bytes: Uint8Array
  format: 'hex' | 'base64'
  prefix?: string
}

/**
 * Reads an expected signature as hex or Base64/Base64url, allowing prefixes like
 * "sha256=" (GitHub), "v1=" (Stripe) or "sha512:".
 */
export function parseSignature(input: string, expectedBytes?: number): ParsedSignature {
  let s = input.trim()
  let prefix: string | undefined
  // Base64 only has "=" at the very end, so "name=" or "name:" followed by more text is a prefix.
  const m = s.match(/^([A-Za-z][A-Za-z0-9_-]{0,15})[=:](?=.)/)
  if (m) {
    prefix = m[1]
    s = s.slice(m[0].length).trim()
  }
  if (!s) throw new Error('Paste the signature to check.')
  const hexLike = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0
  if (hexLike && (!expectedBytes || s.length === expectedBytes * 2)) return { bytes: hexToBytes(s), format: 'hex', prefix }
  try {
    return { bytes: base64ToBytes(s), format: 'base64', prefix }
  } catch {
    if (hexLike) return { bytes: hexToBytes(s), format: 'hex', prefix }
    throw new Error('The signature is neither hex nor Base64.')
  }
}

export interface StripeHeader {
  timestamp: string
  signatures: string[]
}

/** Parses a Stripe-Signature header: "t=1492774577,v1=5257a8…,v0=…". */
export function parseStripeHeader(header: string): StripeHeader | null {
  const parts = header.split(',').map((p) => p.trim().split('='))
  const t = parts.find(([k]) => k === 't')?.[1]
  const sigs = parts.filter(([k, v]) => k === 'v1' && v).map(([, v]) => v)
  return t && sigs.length ? { timestamp: t, signatures: sigs } : null
}
