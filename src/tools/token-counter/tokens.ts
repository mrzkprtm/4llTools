/** Pure helpers for the AI Token Counter. */

export type EncodingName = 'o200k_base' | 'cl100k_base'

export interface Encoder {
  encode(text: string): number[]
  decode(tokens: Iterable<number>): string
}

export const ENCODINGS: { id: EncodingName; label: string; models: string }[] = [
  { id: 'o200k_base', label: 'o200k', models: 'GPT-4o, GPT-4.1, GPT-5, o1/o3/o4 (exact)' },
  { id: 'cl100k_base', label: 'cl100k', models: 'GPT-4, GPT-3.5 Turbo, text-embedding-3 (exact)' },
]

/** Loads the tokenizer on demand, because each encoding's data is a few megabytes. */
export async function loadEncoder(name: EncodingName): Promise<Encoder> {
  const mod = name === 'o200k_base' ? await import('gpt-tokenizer/encoding/o200k_base') : await import('gpt-tokenizer/encoding/cl100k_base')
  // Treat text like "<|endoftext|>" as ordinary characters instead of throwing.
  const opts = { disallowedSpecial: new Set<string>() }
  return { encode: (t) => mod.encode(t, opts), decode: (tokens) => mod.decode(tokens) }
}

/**
 * Other vendors do not publish browser tokenizers, so their counts are
 * character-based estimates. Ratios are average characters per token for
 * English prose; code and non-English text usually use more tokens.
 */
export const ESTIMATES: { id: string; label: string; charsPerToken: number }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', charsPerToken: 3.5 },
  { id: 'gemini', label: 'Gemini (Google)', charsPerToken: 4 },
  { id: 'llama', label: 'Llama 3 / 4 (Meta)', charsPerToken: 4 },
]

export function estimateTokens(text: string, charsPerToken: number): number {
  const chars = [...text].length
  return chars === 0 ? 0 : Math.ceil(chars / charsPerToken)
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)
  return m ? m.length : 0
}

export const CONTEXT_WINDOWS: { size: number; label: string }[] = [
  { size: 8_192, label: '8K' },
  { size: 32_768, label: '32K' },
  { size: 128_000, label: '128K' },
  { size: 200_000, label: '200K' },
  { size: 1_000_000, label: '1M' },
]

/** Share of a context window used, clamped to 0–1, plus whether it overflows. */
export function usage(tokens: number, size: number): { ratio: number; over: boolean } {
  return { ratio: Math.min(1, tokens / size), over: tokens > size }
}

export interface Piece {
  text: string
  /** The token ids that make up this piece (more than one when a character spans tokens). */
  ids: number[]
}

/**
 * Splits token ids into readable pieces. A single emoji or CJK character can be
 * split across several byte-level tokens, which decode to "�" on their own,
 * so those tokens are merged until they decode cleanly (up to 4 at a time).
 */
export function toPieces(tokens: readonly number[], decode: Encoder['decode'], cap = Infinity): Piece[] {
  const out: Piece[] = []
  let buf: number[] = []
  for (let i = 0; i < tokens.length && out.length < cap; i++) {
    buf.push(tokens[i])
    const text = decode(buf)
    if (text.includes('�') && buf.length < 4 && i < tokens.length - 1) continue
    out.push({ text, ids: buf })
    buf = []
  }
  return out
}

/** Makes whitespace visible inside a token chip. */
export function showWhitespace(s: string): string {
  return s.replace(/ /g, '·').replace(/\t/g, '→').replace(/\n/g, '↵\n')
}
