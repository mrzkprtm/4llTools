/**
 * Passphrase encryption: PBKDF2-SHA256 → AES-256-GCM.
 *
 * Output layout (then Base64 for text):
 *   "4LT" magic (3 bytes) | version 1 (1 byte) | iterations (uint32 BE) | salt (16) | iv (12) | ciphertext + 16-byte GCM tag
 * The header is also fed to GCM as additional data, so changing the iteration count or version breaks decryption.
 */
export const MAGIC = [0x34, 0x4c, 0x54] // "4LT"
export const VERSION = 1
export const DEFAULT_ITERATIONS = 600_000
export const SALT_BYTES = 16
export const IV_BYTES = 12
const HEADER = MAGIC.length + 1 + 4

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase, or the data was changed or cut off.')
    this.name = 'WrongPassphraseError'
  }
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase) as BufferSource, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, usage)
}

export async function encryptBytes(data: Uint8Array, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  if (!passphrase) throw new Error('Enter a passphrase.')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const header = new Uint8Array(HEADER)
  header.set(MAGIC, 0)
  header[3] = VERSION
  new DataView(header.buffer).setUint32(4, iterations)
  const key = await deriveKey(passphrase, salt, iterations, ['encrypt'])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource, additionalData: header as BufferSource }, key, data as BufferSource))
  const out = new Uint8Array(HEADER + SALT_BYTES + IV_BYTES + ct.length)
  out.set(header, 0)
  out.set(salt, HEADER)
  out.set(iv, HEADER + SALT_BYTES)
  out.set(ct, HEADER + SALT_BYTES + IV_BYTES)
  return out
}

export interface Envelope {
  version: number
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
  header: Uint8Array
}

export function parseEnvelope(blob: Uint8Array): Envelope {
  if (blob.length < HEADER + SALT_BYTES + IV_BYTES + 16 || MAGIC.some((b, i) => blob[i] !== b)) throw new Error('This is not data encrypted by this tool (the 4LT header is missing).')
  const version = blob[3]
  if (version !== VERSION) throw new Error(`Unsupported format version ${version}.`)
  const iterations = new DataView(blob.buffer, blob.byteOffset).getUint32(4)
  if (iterations < 1 || iterations > 10_000_000) throw new Error('The iteration count in the header is invalid.')
  return {
    version,
    iterations,
    header: blob.slice(0, HEADER),
    salt: blob.slice(HEADER, HEADER + SALT_BYTES),
    iv: blob.slice(HEADER + SALT_BYTES, HEADER + SALT_BYTES + IV_BYTES),
    ciphertext: blob.slice(HEADER + SALT_BYTES + IV_BYTES),
  }
}

export async function decryptBytes(blob: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const env = parseEnvelope(blob)
  const key = await deriveKey(passphrase, env.salt, env.iterations, ['decrypt'])
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: env.iv as BufferSource, additionalData: env.header as BufferSource }, key, env.ciphertext as BufferSource))
  } catch {
    throw new WrongPassphraseError()
  }
}

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!clean) throw new Error('Paste the encrypted text.')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new Error('The encrypted text is not valid Base64 (it may be cut off or have extra characters).')
  const bin = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function encryptText(text: string, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  return toBase64(await encryptBytes(new TextEncoder().encode(text), passphrase, iterations))
}

export async function decryptText(b64: string, passphrase: string): Promise<string> {
  const bytes = await decryptBytes(fromBase64(b64), passphrase)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/** Wraps Base64 at `width` characters for pasting into email or chat. */
export function wrap(b64: string, width = 64): string {
  return b64.match(new RegExp(`.{1,${width}}`, 'g'))?.join('\n') ?? ''
}
