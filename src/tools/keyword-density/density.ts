export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and', 'any',
  'are', "aren't", 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'but', 'by', 'can', "can't", 'cannot', 'could', "couldn't", 'did', "didn't", 'do',
  'does', "doesn't", 'doing', "don't", 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'get', 'got', 'had', "hadn't", 'has', "hasn't", 'have', "haven't", 'having', 'he', "he'd",
  "he'll", "he's", 'her', 'here', "here's", 'hers', 'herself', 'him', 'himself', 'his', 'how',
  "how's", 'i', "i'd", "i'll", "i'm", "i've", 'if', 'in', 'into', 'is', "isn't", 'it', "it's",
  'its', 'itself', "let's", 'like', 'me', 'more', 'most', "mustn't", 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', "shan't", 'she', "she'd", "she'll", "she's",
  'should', "shouldn't", 'so', 'some', 'such', 'than', 'that', "that's", 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', "there's", 'these', 'they', "they'd",
  "they'll", "they're", "they've", 'thing', 'things', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', "wasn't", 'we', "we'd", "we'll", "we're", "we've",
  'were', "weren't", 'what', "what's", 'when', "when's", 'where', "where's", 'which', 'while',
  'who', "who's", 'whom', 'why', "why's", 'will', 'with', "won't", 'would', "wouldn't", 'you',
  "you'd", "you'll", "you're", "you've", 'your', 'yours', 'yourself', 'yourselves',
])

/** Lowercase word tokens: letters, digits and internal apostrophes only. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []
}

/** All n-grams of length n from tokens, joined with spaces. */
export function ngrams(tokens: string[], n: number): string[] {
  if (n < 1 || tokens.length < n) return []
  const out: string[] = []
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '))
  return out
}

export interface KwRow {
  term: string
  count: number
  pct: number
}

export interface DensityOptions {
  n: 1 | 2 | 3
  maxRows: number
  skipStopwords: boolean
}

/**
 * Keyword density table. Percentages are shares of all n-grams of the same
 * length, so a 2-gram row reads "this pair covers X% of all two-word pairs".
 */
export function density(text: string, opts: DensityOptions): { rows: KwRow[]; totalGrams: number; tokens: number } {
  const all = tokenize(text)
  const grams = ngrams(all, opts.n)
  const totalGrams = grams.length
  const counts = new Map<string, number>()
  for (const g of grams) {
    if (opts.skipStopwords && g.split(' ').every((w) => STOPWORDS.has(w))) continue
    counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  const rows: KwRow[] = [...counts.entries()]
    .map(([term, count]) => ({ term, count, pct: totalGrams === 0 ? 0 : (count / totalGrams) * 100 }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, opts.maxRows)
  return { rows, totalGrams, tokens: all.length }
}

export function toCsv(rows: KwRow[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return ['term,count,density_pct', ...rows.map((r) => `${esc(r.term)},${r.count},${r.pct.toFixed(2)}`)].join('\n')
}
