/** Accepts seconds or milliseconds; 13+ digit numbers are treated as milliseconds. */
export function parseTimestamp(input: string): Date | null {
  const t = input.trim()
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  const ms = Math.abs(n) >= 1e12 ? n : n * 1000
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d
}
