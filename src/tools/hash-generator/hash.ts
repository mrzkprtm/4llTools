export const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
export type Algorithm = (typeof ALGORITHMS)[number]

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashBytes(algorithm: Algorithm, data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest(algorithm, data))
}

export function hashText(algorithm: Algorithm, text: string): Promise<string> {
  return hashBytes(algorithm, new TextEncoder().encode(text))
}
