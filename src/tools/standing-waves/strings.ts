/** Frequency of the nth harmonic of a string fixed at both ends: fₙ = (n / 2L) · √(T / μ). */
export const harmonicFrequency = (n: number, L: number, tension: number, mu: number) => (n / (2 * L)) * Math.sqrt(tension / mu)

/** Wave speed on a string: v = √(T / μ). */
export const waveSpeed = (tension: number, mu: number) => Math.sqrt(tension / mu)

/** Positions (0–1 along the string) of the nodes of harmonic n, ends included. */
export const nodes = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n)

/** Positions of the antinodes of harmonic n. */
export const antinodes = (n: number) => Array.from({ length: n }, (_, i) => (i + 0.5) / n)

/** The name musicians give a frequency, like "A4 +3¢". */
export function noteName(freq: number): string {
  if (!(freq > 0)) return '—'
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  const midi = 69 + 12 * Math.log2(freq / 440)
  const r = Math.round(midi)
  const cents = Math.round((midi - r) * 100)
  return `${names[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}${cents ? ` ${cents > 0 ? '+' : ''}${cents}¢` : ''}`
}
