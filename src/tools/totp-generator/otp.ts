export type OtpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512'
export const ALGORITHMS: OtpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512']

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

/** Decodes Base32 (RFC 4648), ignoring spaces, dashes, padding and case. */
export function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!clean) throw new Error('Enter a secret key.')
  const bad = clean.match(/[^A-Z2-7]/)
  if (bad) throw new Error(`“${bad[0]}” is not a Base32 character (only A–Z and 2–7${/[018]/.test(bad[0]) ? '; 0, 1 and 8 are not used, maybe you meant O, I or B' : ''}).`)
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export function randomSecret(bytes = 20): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Groups a secret in blocks of 4 for easier typing. */
export function groupSecret(s: string): string {
  return s.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ')
}

/** RFC 4226 HOTP. */
export async function hotp(key: Uint8Array, counter: number, digits = 6, algorithm: OtpAlgorithm = 'SHA-1'): Promise<string> {
  const msg = new Uint8Array(8)
  const view = new DataView(msg.buffer)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: algorithm }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg as BufferSource))
  const offset = mac[mac.length - 1] & 0x0f
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

/** RFC 6238 TOTP for a Unix time in seconds. */
export function totp(key: Uint8Array, unixSeconds: number, period = 30, digits = 6, algorithm: OtpAlgorithm = 'SHA-1'): Promise<string> {
  return hotp(key, Math.floor(unixSeconds / period), digits, algorithm)
}

export interface OtpConfig {
  type: 'totp' | 'hotp'
  secret: string
  issuer: string
  account: string
  algorithm: OtpAlgorithm
  digits: number
  period: number
  counter: number
}

export const DEFAULT_CONFIG: OtpConfig = { type: 'totp', secret: '', issuer: '', account: '', algorithm: 'SHA-1', digits: 6, period: 30, counter: 0 }

/** Parses an otpauth://totp/Issuer:account?secret=…&issuer=… URI (what authenticator QR codes contain). */
export function parseOtpauth(uri: string): OtpConfig {
  let u: URL
  try {
    u = new URL(uri.trim())
  } catch {
    throw new Error('Not a valid otpauth:// link.')
  }
  if (u.protocol !== 'otpauth:') throw new Error('The link must start with otpauth://')
  const type = u.hostname.toLowerCase() || u.pathname.replace(/^\/\//, '').split('/')[0].toLowerCase()
  if (type !== 'totp' && type !== 'hotp') throw new Error(`Unknown OTP type “${type}” (expected totp or hotp).`)
  const label = decodeURIComponent(u.pathname.replace(/^\/+/, '').replace(/^(totp|hotp)\//i, ''))
  const [labelIssuer, labelAccount] = label.includes(':') ? [label.slice(0, label.indexOf(':')), label.slice(label.indexOf(':') + 1)] : ['', label]
  const q = u.searchParams
  const secret = (q.get('secret') ?? '').replace(/\s+/g, '').toUpperCase()
  if (!secret) throw new Error('The link has no secret= parameter.')
  base32Decode(secret)
  const alg = (q.get('algorithm') ?? 'SHA1').toUpperCase().replace(/^SHA-?/, 'SHA-')
  if (!ALGORITHMS.includes(alg as OtpAlgorithm)) throw new Error(`Unsupported algorithm ${q.get('algorithm')}.`)
  const digits = Number(q.get('digits') ?? 6)
  const period = Number(q.get('period') ?? 30)
  if (![6, 7, 8].includes(digits)) throw new Error('digits must be 6, 7 or 8.')
  if (!(period >= 1 && period <= 3600)) throw new Error('period must be between 1 and 3600 seconds.')
  return {
    type,
    secret,
    issuer: q.get('issuer') ?? labelIssuer.trim(),
    account: labelAccount.trim(),
    algorithm: alg as OtpAlgorithm,
    digits,
    period,
    counter: Number(q.get('counter') ?? 0) || 0,
  }
}

export function buildOtpauth(c: OtpConfig): string {
  const label = encodeURIComponent(c.issuer ? `${c.issuer}:${c.account}` : c.account).replace(/%3A/g, ':')
  const q = new URLSearchParams({ secret: c.secret.replace(/\s+/g, '').toUpperCase() })
  if (c.issuer) q.set('issuer', c.issuer)
  if (c.algorithm !== 'SHA-1') q.set('algorithm', c.algorithm.replace('-', ''))
  if (c.digits !== 6) q.set('digits', String(c.digits))
  if (c.type === 'totp' && c.period !== 30) q.set('period', String(c.period))
  if (c.type === 'hotp') q.set('counter', String(c.counter))
  return `otpauth://${c.type}/${label}?${q.toString()}`
}
