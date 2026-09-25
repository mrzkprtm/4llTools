/** Splits text into words, also breaking camelCase, snake_case and kebab-case apart. */
export function splitWords(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()

export const CASES: { name: string; convert: (text: string) => string }[] = [
  { name: 'UPPER CASE', convert: (t) => t.toUpperCase() },
  { name: 'lower case', convert: (t) => t.toLowerCase() },
  { name: 'Title Case', convert: (t) => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, s, c) => s + c.toUpperCase()) },
  { name: 'Sentence case', convert: (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, s, c) => s + c.toUpperCase()) },
  { name: 'camelCase', convert: (t) => splitWords(t).map((w, i) => (i ? cap(w) : w.toLowerCase())).join('') },
  { name: 'PascalCase', convert: (t) => splitWords(t).map(cap).join('') },
  { name: 'snake_case', convert: (t) => splitWords(t).map((w) => w.toLowerCase()).join('_') },
  { name: 'kebab-case', convert: (t) => splitWords(t).map((w) => w.toLowerCase()).join('-') },
  { name: 'CONSTANT_CASE', convert: (t) => splitWords(t).map((w) => w.toUpperCase()).join('_') },
  { name: 'aLtErNaTiNg', convert: (t) => [...t].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('') },
]
