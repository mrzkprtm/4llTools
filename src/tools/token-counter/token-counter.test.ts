import { describe, expect, it } from 'vitest'
import { countWords, estimateTokens, loadEncoder, showWhitespace, toPieces, usage } from './tokens'

describe('exact GPT token counts', () => {
  it('counts with o200k_base and cl100k_base', async () => {
    const o200k = await loadEncoder('o200k_base')
    const cl100k = await loadEncoder('cl100k_base')
    expect(o200k.encode('hello world')).toHaveLength(2)
    expect(cl100k.encode('hello world')).toHaveLength(2)
    expect(o200k.encode('')).toEqual([])
  })

  it('treats special-token text as ordinary characters', async () => {
    const enc = await loadEncoder('o200k_base')
    expect(() => enc.encode('before <|endoftext|> after')).not.toThrow()
    expect(enc.decode(enc.encode('before <|endoftext|> after'))).toBe('before <|endoftext|> after')
  })

  it('merges byte tokens so emoji show as one piece', async () => {
    const enc = await loadEncoder('cl100k_base')
    const text = 'hi 😢 ok'
    const pieces = toPieces(enc.encode(text), enc.decode)
    expect(pieces.map((p) => p.text).join('')).toBe(text)
    expect(pieces.some((p) => p.text.includes('�'))).toBe(false)
    expect(toPieces(enc.encode(text), enc.decode, 1)).toHaveLength(1)
  })
})

describe('helpers', () => {
  it('estimates from characters', () => {
    expect(estimateTokens('', 3.5)).toBe(0)
    expect(estimateTokens('abcdefg', 3.5)).toBe(2)
    expect(estimateTokens('abcdefgh', 4)).toBe(2)
    expect(estimateTokens('😀😀😀😀', 4)).toBe(1)
  })

  it('counts words across scripts', () => {
    expect(countWords("It's a well-known fact, kan?")).toBe(5)
    expect(countWords('  ')).toBe(0)
  })

  it('computes context usage', () => {
    expect(usage(4096, 8192)).toEqual({ ratio: 0.5, over: false })
    expect(usage(9000, 8192)).toEqual({ ratio: 1, over: true })
  })

  it('makes whitespace visible', () => {
    expect(showWhitespace(' a\tb\n')).toBe('·a→b↵\n')
  })
})
