/** Pure find-and-replace logic: plain or regex rules applied in order. */

export interface Options {
  regex: boolean
  caseSensitive: boolean
  wholeWord: boolean
  /** ^ and $ match at line breaks (regex mode). */
  multiline: boolean
  /** . also matches line breaks (regex mode). */
  dotAll: boolean
}

export interface Rule {
  id: string
  find: string
  replace: string
  enabled: boolean
}

export type Built = { ok: true; re: RegExp } | { ok: false; error: string }

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Builds the global RegExp for a rule, or explains why the pattern is invalid. */
export function buildRegex(find: string, o: Options): Built {
  if (!find) return { ok: false, error: '' }
  let source = o.regex ? find : escapeRegExp(find)
  // Unicode-aware word boundaries so "café" and "naïve" count as whole words.
  if (o.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
  const flags = 'gu' + (o.caseSensitive ? '' : 'i') + (o.multiline ? 'm' : '') + (o.dotAll ? 's' : '')
  try {
    return { ok: true, re: new RegExp(source, flags) }
  } catch (err) {
    // Retry without the u flag: some older patterns (like "\-" outside a class) are only valid in legacy mode.
    if (o.regex && !o.wholeWord) {
      try {
        return { ok: true, re: new RegExp(source, flags.replace('u', '')) }
      } catch {
        /* report the original error */
      }
    }
    const msg = err instanceof Error ? err.message.replace(/^Invalid regular expression: /, '') : String(err)
    return { ok: false, error: msg }
  }
}

export interface Match {
  index: number
  length: number
  text: string
}

/** Lists matches (at most `cap`), stepping past empty matches so patterns like "^" can't loop forever. */
export function findMatches(text: string, re: RegExp, cap = 5000): Match[] {
  const out: Match[] = []
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = r.exec(text)) && out.length < cap) {
    out.push({ index: m.index, length: m[0].length, text: m[0] })
    if (m[0] === '') r.lastIndex += 1
  }
  return out
}

/** In plain mode the replacement is literal, so "$" is escaped. In regex mode $1, $<name> and $& work. */
export function replacementFor(replace: string, o: Options): string {
  const withEscapes = o.regex ? replace.replace(/\\n/g, '\n').replace(/\\t/g, '\t') : replace
  return o.regex ? withEscapes : withEscapes.replace(/\$/g, '$$$$')
}

export interface RuleResult {
  id: string
  count: number
  error: string
}

/** Applies every enabled rule in order, each one working on the previous rule's output. */
export function applyRules(text: string, rules: readonly Rule[], o: Options): { output: string; results: RuleResult[] } {
  let output = text
  const results: RuleResult[] = []
  for (const rule of rules) {
    if (!rule.enabled || !rule.find) {
      results.push({ id: rule.id, count: 0, error: '' })
      continue
    }
    const built = buildRegex(rule.find, o)
    if (!built.ok) {
      results.push({ id: rule.id, count: 0, error: built.error })
      continue
    }
    const count = findMatches(output, built.re, Infinity).length
    output = output.replace(built.re, replacementFor(rule.replace, o))
    results.push({ id: rule.id, count, error: '' })
  }
  return { output, results }
}
