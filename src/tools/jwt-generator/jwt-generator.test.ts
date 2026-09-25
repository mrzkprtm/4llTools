import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { b64urlDecode, b64urlEncode, decodeParts, generateKeyPair, signJwt, timeStatus, verifyJwt } from './jwt'

// The example from jwt.io; its signature is public and documented.
const JWTIO_KEY = ['your', '256', 'bit', 'secret'].join('-')
const JWTIO_SIG = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

describe('jwt generator', () => {
  it('reproduces the jwt.io HS256 example', async () => {
    const token = await signJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '1234567890', name: 'John Doe', iat: 1516239022 }, 'HS256', JWTIO_KEY)
    expect(token.split('.')[2]).toBe(JWTIO_SIG)
    expect((await verifyJwt(token, JWTIO_KEY)).valid).toBe(true)
    expect((await verifyJwt(token, 'other')).valid).toBe(false)
  })

  it('signs and verifies RS256 and ES256 with generated keys', async () => {
    for (const alg of ['RS256', 'ES256', 'PS256'] as const) {
      const { privatePem, publicPem } = await generateKeyPair(alg)
      expect(privatePem).toMatch(/^-----BEGIN PRIVATE KEY-----/)
      const token = await signJwt({}, { sub: 'u1', role: 'admin' }, alg, privatePem)
      const r = await verifyJwt(token, publicPem)
      expect(r.valid).toBe(true)
      expect(r.header).toEqual({ alg, typ: 'JWT' })
      const [h, , s] = token.split('.')
      const tampered = `${h}.${b64urlEncode(new TextEncoder().encode('{"sub":"u2"}'))}.${s}`
      expect((await verifyJwt(tampered, publicPem)).valid).toBe(false)
    }
  })

  it('accepts PKCS#1 RSA private keys', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
    expect(privateKey).toMatch(/BEGIN RSA PRIVATE KEY/)
    const token = await signJwt({}, { a: 1 }, 'RS256', privateKey)
    expect((await verifyJwt(token, publicKey)).valid).toBe(true)
  })

  it('explains wrong keys and bad tokens', async () => {
    const { privatePem } = await generateKeyPair('ES256')
    await expect(signJwt({}, {}, 'RS256', privatePem)).rejects.toThrow(/RSA key/)
    await expect(signJwt({}, {}, 'RS256', 'nope')).rejects.toThrow(/BEGIN PRIVATE KEY/)
    await expect(verifyJwt('a.b', 'k')).rejects.toThrow(/3 parts/)
    const none = `${b64urlEncode(new TextEncoder().encode('{"alg":"none"}'))}.${b64urlEncode(new TextEncoder().encode('{}'))}.`
    await expect(verifyJwt(none, 'k')).rejects.toThrow(/unsigned/)
    expect(() => decodeParts('x.y.z')).toThrow(/Base64url JSON/)
  })

  it('handles base64url and time claims', () => {
    expect(new TextDecoder().decode(b64urlDecode(b64urlEncode(new TextEncoder().encode('héllo?>'))))).toBe('héllo?>')
    expect(timeStatus({ exp: 100 }, 200)[0]).toMatch(/^Expired/)
    expect(timeStatus({ exp: 300, nbf: 250 }, 200)).toHaveLength(2)
    expect(timeStatus('x')).toEqual([])
  })
})
