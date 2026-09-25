import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { base64ToBytes, generateRsaKeys, mpint, pemWrap, sshFingerprint, sshPublicKey, sshRsaBlob } from './rsa'

// A fixed 1024-bit test key (generated with openssl), as JWK and as SPKI PEM.
const JWK = {
  n: '3NgefUVQte0uBeLDMaXrE8GYytYzUpEpAll9gWjDT3SfGnRpsJb9_JjLQ5mUYqcKOn4aee1aCGcHnQPWV-F9TB3hHhD_tkHCiWXA1n1PlHR9JoNUOIQgyyepMx35bsnpCMgJo6s8YXKQVvfYxHEjasaGgIb8SACM0W1wF8cUy2M',
  e: 'AQAB',
}
const SPKI_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDc2B59RVC17S4F4sMxpesTwZjK
1jNSkSkCWX2BaMNPdJ8adGmwlv38mMtDmZRipwo6fhp57VoIZwedA9ZX4X1MHeEe
EP+2QcKJZcDWfU+UdH0mg1Q4hCDLJ6kzHfluyekIyAmjqzxhcpBW99jEcSNqxoaA
hvxIAIzRbXAXxxTLYwIDAQAB
-----END PUBLIC KEY-----
`
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')

describe('rsa-key-generator', () => {
  it('wraps DER in PEM with 64-character lines', () => {
    const der = base64ToBytes(SPKI_PEM.replace(/-----[^-]+-----/g, ''))
    expect(pemWrap('PUBLIC KEY', der)).toBe(SPKI_PEM)
    const lines = pemWrap('X', new Uint8Array(200)).split('\n').slice(1, -2)
    expect(lines.slice(0, -1).every((l) => l.length === 64)).toBe(true)
  })

  it('encodes mpints', () => {
    expect(hex(mpint(new Uint8Array([0x7f])))).toBe('000000017f')
    expect(hex(mpint(new Uint8Array([0x80])))).toBe('000000020080')
    expect(hex(mpint(new Uint8Array([0, 0, 0x01, 0x00, 0x01])))).toBe('00000003010001')
    expect(hex(mpint(new Uint8Array([0])))).toBe('00000000')
  })

  it('builds the ssh-rsa blob and fingerprint', async () => {
    const nHex = hex(base64ToBytes(JWK.n))
    expect(nHex.slice(0, 2)).toBe('dc') // high bit set → needs a 0x00 prefix
    const expected = '00000007' + Buffer.from('ssh-rsa').toString('hex') + '00000003010001' + '00000081' + '00' + nHex
    const blob = sshRsaBlob(JWK.n, JWK.e)
    expect(hex(blob)).toBe(expected)
    expect(sshPublicKey(JWK.n, JWK.e, 'me@laptop')).toBe(`ssh-rsa ${Buffer.from(blob).toString('base64')} me@laptop`)
    const fp = createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')
    expect(await sshFingerprint(blob)).toBe(`SHA256:${fp}`)
  })

  it('generates a usable key pair with WebCrypto', async () => {
    const k = await generateRsaKeys(2048, 'sign', 'test')
    expect(k.privatePem.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true)
    expect(k.publicPem.startsWith('-----BEGIN PUBLIC KEY-----\n')).toBe(true)
    expect(k.sshPublic).toMatch(/^ssh-rsa AAAAB3NzaC1yc2E\S+ test$/)
    expect(k.fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/)
  }, 20000)
})
