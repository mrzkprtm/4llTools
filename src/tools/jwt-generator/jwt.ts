export const ALGORITHMS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512'] as const
export type JwtAlg = (typeof ALGORITHMS)[number]

export const isHmac = (alg: string) => alg.startsWith('HS')

const HASH: Record<string, string> = { '256': 'SHA-256', '384': 'SHA-384', '512': 'SHA-512' }
const CURVE: Record<string, string> = { ES256: 'P-256', ES384: 'P-384', ES512: 'P-521' }

function params(alg: JwtAlg): { importAlg: RsaHashedImportParams | EcKeyImportParams | HmacImportParams; signAlg: AlgorithmIdentifier | RsaPssParams | EcdsaParams } {
  const hash = HASH[alg.slice(2)]
  if (alg.startsWith('HS')) return { importAlg: { name: 'HMAC', hash }, signAlg: 'HMAC' }
  if (alg.startsWith('RS')) return { importAlg: { name: 'RSASSA-PKCS1-v1_5', hash }, signAlg: 'RSASSA-PKCS1-v1_5' }
  if (alg.startsWith('PS')) return { importAlg: { name: 'RSA-PSS', hash }, signAlg: { name: 'RSA-PSS', saltLength: Number(alg.slice(2)) / 8 } }
  return { importAlg: { name: 'ECDSA', namedCurve: CURVE[alg] }, signAlg: { name: 'ECDSA', hash } }
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('Not valid Base64url.')
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const enc = (o: unknown) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)))

// ---------- PEM helpers ----------

function pemBody(pem: string, labels: string[]): { label: string; der: Uint8Array } {
  const m = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/)
  if (!m) throw new Error(`Paste a PEM key that starts with -----BEGIN ${labels[0]}-----.`)
  const label = m[1]
  if (!labels.includes(label)) throw new Error(`Expected ${labels.join(' or ')}, but this is a ${label}.`)
  const bin = atob(m[2].replace(/\s+/g, ''))
  return { label, der: Uint8Array.from(bin, (c) => c.charCodeAt(0)) }
}

function derLen(n: number): number[] {
  if (n < 0x80) return [n]
  const out: number[] = []
  while (n > 0) {
    out.unshift(n & 0xff)
    n >>= 8
  }
  return [0x80 | out.length, ...out]
}

function der(tag: number, body: number[] | Uint8Array): number[] {
  return [tag, ...derLen(body.length), ...body]
}

/** Wraps a PKCS#1 "RSA PRIVATE KEY" in a PKCS#8 envelope, which is what Web Crypto can import. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const rsaAlgId = der(0x30, [...der(0x06, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]), 0x05, 0x00])
  return new Uint8Array(der(0x30, [...der(0x02, [0]), ...rsaAlgId, ...der(0x04, pkcs1)]))
}

function toPem(label: string, bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return `-----BEGIN ${label}-----\n${btoa(bin).match(/.{1,64}/g)!.join('\n')}\n-----END ${label}-----`
}

async function signingKey(alg: JwtAlg, key: string): Promise<CryptoKey> {
  const { importAlg } = params(alg)
  if (isHmac(alg)) {
    if (!key) throw new Error('Enter a secret.')
    return crypto.subtle.importKey('raw', new TextEncoder().encode(key) as BufferSource, importAlg, false, ['sign'])
  }
  const { label, der: body } = pemBody(key, ['PRIVATE KEY', 'RSA PRIVATE KEY', 'EC PRIVATE KEY'])
  if (label === 'EC PRIVATE KEY') throw new Error('This is a SEC1 “EC PRIVATE KEY”. Convert it to PKCS#8 first: openssl pkcs8 -topk8 -nocrypt -in key.pem')
  if (label === 'RSA PRIVATE KEY' && !alg.startsWith('RS') && !alg.startsWith('PS')) throw new Error(`${alg} needs an EC key, but this is an RSA key.`)
  const pkcs8 = label === 'RSA PRIVATE KEY' ? pkcs1ToPkcs8(body) : body
  try {
    return await crypto.subtle.importKey('pkcs8', pkcs8 as BufferSource, importAlg, false, ['sign'])
  } catch {
    throw new Error(`This private key does not fit ${alg} (${alg.startsWith('ES') ? `needs an EC ${CURVE[alg]} key` : 'needs an RSA key'}).`)
  }
}

async function verifyingKey(alg: JwtAlg, key: string): Promise<CryptoKey> {
  const { importAlg } = params(alg)
  if (isHmac(alg)) return crypto.subtle.importKey('raw', new TextEncoder().encode(key) as BufferSource, importAlg, false, ['verify'])
  const { der: body } = pemBody(key, ['PUBLIC KEY'])
  try {
    return await crypto.subtle.importKey('spki', body as BufferSource, importAlg, false, ['verify'])
  } catch {
    throw new Error(`This public key does not fit ${alg}.`)
  }
}

// ---------- sign / verify ----------

export async function signJwt(header: Record<string, unknown>, payload: unknown, alg: JwtAlg, key: string): Promise<string> {
  const h = { ...header, alg }
  if (!('typ' in h)) (h as Record<string, unknown>).typ = 'JWT'
  const input = `${enc(h)}.${enc(payload)}`
  const k = await signingKey(alg, key)
  const sig = new Uint8Array(await crypto.subtle.sign(params(alg).signAlg, k, new TextEncoder().encode(input) as BufferSource))
  return `${input}.${b64urlEncode(sig)}`
}

export interface Verified {
  valid: boolean
  alg: string
  header: Record<string, unknown>
  payload: unknown
}

export function decodeParts(token: string): { header: Record<string, unknown>; payload: unknown; parts: string[] } {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) throw new Error(`A signed JWT has 3 parts separated by dots; this has ${parts.length}.`)
  const json = (s: string, what: string) => {
    try {
      return JSON.parse(new TextDecoder().decode(b64urlDecode(s)))
    } catch {
      throw new Error(`The ${what} is not valid Base64url JSON.`)
    }
  }
  return { header: json(parts[0], 'header'), payload: json(parts[1], 'payload'), parts }
}

export async function verifyJwt(token: string, key: string): Promise<Verified> {
  const { header, payload, parts } = decodeParts(token)
  const alg = String(header.alg ?? '')
  if (alg === 'none') throw new Error('alg "none" means the token is unsigned; never accept it.')
  if (!(ALGORITHMS as readonly string[]).includes(alg)) throw new Error(`Unsupported algorithm “${alg}”.`)
  const k = await verifyingKey(alg as JwtAlg, key)
  let sig: Uint8Array
  try {
    sig = b64urlDecode(parts[2])
  } catch {
    return { valid: false, alg, header, payload }
  }
  const valid = await crypto.subtle.verify(params(alg as JwtAlg).signAlg, k, sig as BufferSource, new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource)
  return { valid, alg, header, payload }
}

export async function generateKeyPair(alg: JwtAlg): Promise<{ privatePem: string; publicPem: string }> {
  if (isHmac(alg)) throw new Error('HMAC uses a shared secret, not a key pair.')
  const { importAlg } = params(alg)
  const gen = alg.startsWith('ES') ? importAlg : { ...(importAlg as RsaHashedImportParams), modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }
  const pair = (await crypto.subtle.generateKey(gen as RsaHashedKeyGenParams | EcKeyGenParams, true, ['sign', 'verify'])) as CryptoKeyPair
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const pub = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey))
  return { privatePem: toPem('PRIVATE KEY', priv), publicPem: toPem('PUBLIC KEY', pub) }
}

export function randomSecret(bytes = 32): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Time claims: seconds since the epoch. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export const EXPIRY_PRESETS: [string, number][] = [
  ['5 min', 300],
  ['1 hour', 3600],
  ['1 day', 86400],
  ['7 days', 604800],
  ['30 days', 2592000],
]

export function timeStatus(payload: unknown, now = nowSeconds()): string[] {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as Record<string, unknown>
  const out: string[] = []
  if (typeof p.exp === 'number') out.push(p.exp < now ? `Expired ${new Date(p.exp * 1000).toLocaleString()}` : `Expires ${new Date(p.exp * 1000).toLocaleString()}`)
  if (typeof p.nbf === 'number' && p.nbf > now) out.push(`Not valid before ${new Date(p.nbf * 1000).toLocaleString()}`)
  return out
}
