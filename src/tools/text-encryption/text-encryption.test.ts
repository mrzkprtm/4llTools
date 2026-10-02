import { describe, expect, it } from 'vitest'
import { WrongPassphraseError, decryptBytes, decryptText, encryptBytes, encryptText, fromBase64, parseEnvelope, toBase64, wrap } from './crypto'

const phrase = ['blue', 'mango', 'river'].join('-')

describe('text encryption', () => {
  it('round-trips unicode text with a self-describing header', async () => {
    const msg = 'Rahasia: rapat jam 10 ☕ — ok?'
    const b64 = await encryptText(msg, phrase, 1000)
    const env = parseEnvelope(fromBase64(b64))
    expect(env.version).toBe(1)
    expect(env.iterations).toBe(1000)
    expect(env.salt).toHaveLength(16)
    expect(env.iv).toHaveLength(12)
    expect(env.ciphertext.length).toBe(new TextEncoder().encode(msg).length + 16)
    expect(await decryptText(wrap(b64, 20), phrase)).toBe(msg)
  })

  it('uses a fresh salt and IV each time', async () => {
    const a = await encryptText('same', phrase, 1000)
    const b = await encryptText('same', phrase, 1000)
    expect(a).not.toBe(b)
  })

  it('rejects the wrong passphrase and tampered data', async () => {
    const b64 = await encryptText('hello', phrase, 1000)
    await expect(decryptText(b64, 'nope')).rejects.toBeInstanceOf(WrongPassphraseError)
    const bytes = fromBase64(b64)
    bytes[bytes.length - 1] ^= 1
    await expect(decryptBytes(bytes, phrase)).rejects.toBeInstanceOf(WrongPassphraseError)
    // Changing the iteration count in the header also fails (the header is authenticated).
    const hdr = fromBase64(b64)
    hdr[7] ^= 1
    await expect(decryptBytes(hdr, phrase)).rejects.toThrow()
  })

  it('reports input that is not ours', async () => {
    await expect(decryptText('aGVsbG8gd29ybGQ=', phrase)).rejects.toThrow(/4LT header/)
    await expect(decryptText('%%%', phrase)).rejects.toThrow(/Base64/)
    await expect(encryptText('x', '', 1000)).rejects.toThrow(/passphrase/)
  })

  it('encrypts binary data', async () => {
    const data = new Uint8Array(70000).map((_, i) => i % 256)
    const enc = await encryptBytes(data, phrase, 1000)
    expect(await decryptBytes(enc, phrase)).toEqual(data)
    expect(fromBase64(toBase64(enc))).toEqual(enc)
  })
})
