import { describe, expect, it } from 'vitest'
import { constantTimeEqual, decode, hmac, parseSignature, parseStripeHeader, toBase64, toBase64Url, toHex } from './hmac'

const bytes = (n: number, v: number) => new Uint8Array(n).fill(v)
const text = (s: string) => new TextEncoder().encode(s)

describe('hmac-generator', () => {
  it('matches RFC 4231 test vectors', async () => {
    // Test case 1
    expect(toHex(await hmac('SHA-256', bytes(20, 0x0b), text('Hi There')))).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
    expect(toHex(await hmac('SHA-384', bytes(20, 0x0b), text('Hi There')))).toBe('afd03944d84895626b0825f4ab46907f15f9dadbe4101ec682aa034c7cebc59cfaea9ea9076ede7f4af152e8b2fa9cb6')
    expect(toHex(await hmac('SHA-512', bytes(20, 0x0b), text('Hi There')))).toBe('87aa7cdea5ef619d4ff0b4241a1d6cb02379f4e2ce4ec2787ad0b30545e17cdedaa833b7d6b8a702038b274eaea3f4e4be9d914eeb61f1702e696c203a126854')
    // Test case 2
    expect(toHex(await hmac('SHA-256', text('Jefe'), text('what do ya want for nothing?')))).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
    expect(toHex(await hmac('SHA-512', text('Jefe'), text('what do ya want for nothing?')))).toBe('164b7a7bfcf819e2e395fbe73b56e0a387bd64222e831fd610270cd7ea2505549758bf75c05a994a6d034f65f8f0e6fdcaeab1a34d4a6b4b636e070a38bce737')
    // Test case 3 (hex key and data)
    expect(toHex(await hmac('SHA-256', decode('aa'.repeat(20), 'hex'), decode('dd'.repeat(50), 'hex')))).toBe('773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe')
    // Test case 6 (key longer than block size)
    expect(toHex(await hmac('SHA-256', bytes(131, 0xaa), text('Test Using Larger Than Block-Size Key - Hash Key First')))).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54')
  })

  it('encodes output and decodes secrets', () => {
    const b = new Uint8Array([0xfb, 0xff, 0x01])
    expect(toBase64(b)).toBe('+/8B')
    expect(toBase64Url(b)).toBe('-_8B')
    expect(decode('+/8B', 'base64')).toEqual(b)
    expect(decode('-_8B', 'base64')).toEqual(b)
    expect(decode('FB:FF:01', 'hex')).toEqual(b)
    expect(() => decode('abc', 'hex')).toThrow()
    expect(() => decode('zz', 'hex')).toThrow()
    expect(() => decode('a$b', 'base64')).toThrow()
  })

  it('parses prefixed signatures and compares them', async () => {
    const mac = await hmac('SHA-256', text('secret'), text('{"a":1}'))
    const hex = toHex(mac)
    for (const sig of [hex, `sha256=${hex}`, hex.toUpperCase(), toBase64(mac), toBase64Url(mac), `v1=${hex}`]) {
      const p = parseSignature(sig, 32)
      expect(constantTimeEqual(p.bytes, mac), sig).toBe(true)
    }
    expect(parseSignature(`sha256=${hex}`).prefix).toBe('sha256')
    expect(constantTimeEqual(mac, mac.slice(0, 31))).toBe(false)
    const other = mac.slice()
    other[5] ^= 1
    expect(constantTimeEqual(mac, other)).toBe(false)
    expect(() => parseSignature('not a sig!')).toThrow()
  })

  it('reads Stripe signature headers', () => {
    expect(parseStripeHeader('t=1492774577,v1=abc,v0=def,v1=123')).toEqual({ timestamp: '1492774577', signatures: ['abc', '123'] })
    expect(parseStripeHeader('v1=abc')).toBeNull()
  })
})
