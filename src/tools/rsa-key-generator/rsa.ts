/** RSA key pair helpers: PEM wrapping and OpenSSH public key encoding. */

export type Purpose = 'sign' | 'encrypt'
export const KEY_SIZES = [2048, 3072, 4096] as const
export type KeySize = (typeof KEY_SIZES)[number]

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Wraps DER bytes in a PEM block with 64-character lines. */
export function pemWrap(label: string, der: Uint8Array): string {
  const b64 = bytesToBase64(der)
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function uint32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])
}

/** SSH "string": 4-byte big-endian length followed by the bytes. */
export function sshString(bytes: Uint8Array): Uint8Array {
  return concat(uint32(bytes.length), bytes)
}

/** SSH "mpint" for a positive big-endian integer: strip leading zeros, add 0x00 if the high bit is set. */
export function mpint(bytes: Uint8Array): Uint8Array {
  let i = 0
  while (i < bytes.length && bytes[i] === 0) i++
  let body = bytes.subarray(i)
  if (body.length && body[0] & 0x80) body = concat(new Uint8Array([0]), body)
  return sshString(body)
}

/** Builds the ssh-rsa public key blob from JWK base64url n and e. */
export function sshRsaBlob(n: string, e: string): Uint8Array {
  return concat(sshString(new TextEncoder().encode('ssh-rsa')), mpint(base64ToBytes(e)), mpint(base64ToBytes(n)))
}

export function sshPublicKey(n: string, e: string, comment = ''): string {
  const line = `ssh-rsa ${bytesToBase64(sshRsaBlob(n, e))}`
  return comment.trim() ? `${line} ${comment.trim()}` : line
}

/** OpenSSH-style SHA-256 fingerprint: "SHA256:" + unpadded base64 of the blob digest. */
export async function sshFingerprint(blob: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', blob as BufferSource))
  return `SHA256:${bytesToBase64(digest).replace(/=+$/, '')}`
}

export interface GeneratedKeys {
  privatePem: string
  publicPem: string
  sshPublic: string
  fingerprint: string
  bits: number
  algorithm: string
  ms: number
}

export async function generateRsaKeys(bits: KeySize, purpose: Purpose, comment: string): Promise<GeneratedKeys> {
  const start = performance.now()
  const algorithm = purpose === 'sign' ? 'RSASSA-PKCS1-v1_5' : 'RSA-OAEP'
  const pair = (await crypto.subtle.generateKey(
    { name: algorithm, modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    purpose === 'sign' ? ['sign', 'verify'] : ['encrypt', 'decrypt'],
  )) as CryptoKeyPair
  const [pkcs8, spki, jwk] = await Promise.all([
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ])
  const blob = sshRsaBlob(jwk.n!, jwk.e!)
  return {
    privatePem: pemWrap('PRIVATE KEY', new Uint8Array(pkcs8)),
    publicPem: pemWrap('PUBLIC KEY', new Uint8Array(spki)),
    sshPublic: sshPublicKey(jwk.n!, jwk.e!, comment),
    fingerprint: await sshFingerprint(blob),
    bits,
    algorithm,
    ms: performance.now() - start,
  }
}
