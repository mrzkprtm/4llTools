export type RegexMatch = { index: number; text: string; groups: (string | undefined)[] }
export type RegexResult = { ok: true; matches: RegexMatch[] } | { ok: false; error: string }

const MAX_MATCHES = 1000

export function findMatches(pattern: string, flags: string, text: string): RegexResult {
  let re: RegExp
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  const matches: RegexMatch[] = []
  for (const m of text.matchAll(re)) {
    matches.push({ index: m.index ?? 0, text: m[0], groups: m.slice(1) })
    if (matches.length >= MAX_MATCHES) break
    if (!flags.includes('g')) break
  }
  return { ok: true, matches }
}
