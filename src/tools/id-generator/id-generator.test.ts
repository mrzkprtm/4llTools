import { describe, expect, it } from 'vitest'
import { collisionLog10, cuid2Like, decode, decodeUlidTime, humanCount, nanoid, ulid, ulidBatch, uuidV4, uuidV7, uuidV7Batch } from './ids'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('id-generator', () => {
  it('makes RFC-shaped v4 and v7 UUIDs', () => {
    const v4 = uuidV4()
    expect(v4).toMatch(UUID)
    expect(v4[14]).toBe('4')
    const v7 = uuidV7()
    expect(v7).toMatch(UUID)
    expect(v7[14]).toBe('7')
  })

  it('round-trips the v7 timestamp', () => {
    const ms = Date.UTC(2026, 8, 25, 12, 34, 56, 789)
    const d = decode(uuidV7(ms))
    expect(d).toMatchObject({ ok: true, kind: 'UUID v7', ms })
  })

  it('makes monotonic v7 batches that sort in creation order within one millisecond', () => {
    const ids = uuidV7Batch({ count: 500, monotonic: true, now: () => 1_700_000_000_000 })
    expect([...ids].sort()).toEqual(ids)
    expect(new Set(ids).size).toBe(500)
    for (const id of ids) expect(id).toMatch(UUID)
  })

  it('encodes and decodes ULIDs (spec example time)', () => {
    // From the ULID reference README: ulid(1469918176385) → 01ARYZ6S41…
    expect(decodeUlidTime('01ARYZ6S41TSV4RRFFQ69G5FAV')).toBe(1469918176385)
    const ms = 1469918176385
    const id = ulid(ms)
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(id.slice(0, 10)).toBe('01ARYZ6S41')
    expect(decode(id.toLowerCase())).toMatchObject({ ok: true, kind: 'ULID', ms })
  })

  it('increments the random part of monotonic ULIDs', () => {
    const zero = (n: number) => new Uint8Array(n)
    const ids = ulidBatch({ count: 3, monotonic: true, now: () => 0, rand: zero })
    expect(ids).toEqual(['00000000000000000000000000', '00000000000000000000000001', '00000000000000000000000002'])
  })

  it('makes NanoIDs from a custom alphabet', () => {
    expect(nanoid()).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(nanoid(12, '0123456789')).toMatch(/^\d{12}$/)
    expect(() => nanoid(5, 'aaaa')).toThrow()
    expect(cuid2Like()).toMatch(/^[a-z][0-9a-z]{23}$/)
  })

  it('estimates collision-safe counts', () => {
    // NanoID default has 126 random bits: sqrt(2 · 2^126 · ln(1/0.99)) ≈ 1.3 × 10^18.
    expect(collisionLog10(64, 21)).toBeCloseTo(18.12, 1)
    expect(humanCount(12.36)).toBe('~2.3 trillion')
    expect(humanCount(2)).toBe('~100')
  })

  it('decodes v1 time and explains v4 and bad input', () => {
    // RFC 9562 appendix A test vectors (both encode 2022-02-22T19:22:22Z)
    expect(decode('C232AB00-9414-11EC-B3C8-9F6BDECED846')).toMatchObject({ ok: true, kind: 'UUID v1', ms: Date.parse('2022-02-22T19:22:22Z') })
    expect(decode('017F22E2-79B0-7CC3-98C4-DC0C0C07398F')).toMatchObject({ kind: 'UUID v7', ms: Date.parse('2022-02-22T19:22:22Z') })
    expect(decode(uuidV4())).toMatchObject({ ok: true, ms: null })
    expect(decode('hello')).toMatchObject({ ok: false })
  })
})
