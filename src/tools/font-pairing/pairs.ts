/** Curated heading + body font pairings, all built from well-known font names. */

export interface Pair {
  heading: string
  body: string
  mood: Mood
  note: string
}

export type Mood = 'Modern' | 'Classic' | 'Editorial' | 'Playful' | 'Minimal' | 'Technical'

/** Filter chips shown above the list. 'All' is handled by `filterPairs`. */
export const MOODS: Mood[] = ['Modern', 'Classic', 'Editorial', 'Playful', 'Minimal', 'Technical']

const SERIF = new Set([
  'Playfair Display',
  'DM Serif Display',
  'Merriweather',
  'Lora',
  'Libre Baskerville',
  'Cormorant Garamond',
  'EB Garamond',
  'Source Serif 4',
  'Crimson Pro',
  'Bitter',
  'Fraunces',
])

const MONO = new Set(['JetBrains Mono', 'IBM Plex Mono', 'Space Mono', 'Fira Code', 'Source Code Pro'])

/** The generic family a font name should fall back to. */
export function genericFor(name: string): string {
  if (SERIF.has(name)) return 'Georgia, serif'
  if (MONO.has(name)) return 'ui-monospace, monospace'
  return 'system-ui, -apple-system, sans-serif'
}

/** A complete font stack for a well-known font name, with a sensible fallback. */
export function stackFor(name: string): string {
  return `'${name}', ${genericFor(name)}`
}

export const PAIRS: Pair[] = [
  { heading: 'Playfair Display', body: 'Source Sans 3', mood: 'Editorial', note: 'High-contrast display serif over a quiet humanist sans.' },
  { heading: 'Inter', body: 'Inter', mood: 'Minimal', note: 'One family for everything; lean on weight for hierarchy.' },
  { heading: 'Montserrat', body: 'Merriweather', mood: 'Classic', note: 'Geometric caps headline long-form serif reading.' },
  { heading: 'Poppins', body: 'Nunito', mood: 'Playful', note: 'Rounded geometric pair for friendly product pages.' },
  { heading: 'Space Grotesk', body: 'IBM Plex Sans', mood: 'Technical', note: 'Techy display with a workhorse UI sans underneath.' },
  { heading: 'DM Serif Display', body: 'DM Sans', mood: 'Editorial', note: 'Same foundry, so the two share subtle proportions.' },
  { heading: 'Bricolage Grotesque', body: 'Work Sans', mood: 'Modern', note: 'A quirky grotesque balanced by a neutral body face.' },
  { heading: 'Lora', body: 'Lato', mood: 'Classic', note: 'Warm serif headings with a understated sans body.' },
  { heading: 'Raleway', body: 'Open Sans', mood: 'Minimal', note: 'Elegant thin caps over a dependable UI sans.' },
  { heading: 'Fraunces', body: 'Karla', mood: 'Playful', note: 'Soft wonky serif with a slightly technical sans.' },
  { heading: 'Libre Baskerville', body: 'Work Sans', mood: 'Editorial', note: 'Bookish headlines with an airy modern call for body.' },
  { heading: 'Archivo', body: 'Roboto', mood: 'Modern', note: 'Grotesque display over the most familiar UI face.' },
  { heading: 'Cormorant Garamond', body: 'Montserrat', mood: 'Classic', note: 'Fine old-style serif paired with sturdy geometric caps.' },
  { heading: 'JetBrains Mono', body: 'Inter', mood: 'Technical', note: 'Monospace headings for docs and developer brands.' },
  { heading: 'Sora', body: 'Manrope', mood: 'Modern', note: 'Two contemporary faces with matching round letterforms.' },
  { heading: 'Oswald', body: 'Merriweather', mood: 'Editorial', note: 'Condensed display caps with a readable serif body.' },
  { heading: 'Fraunces', body: 'DM Sans', mood: 'Minimal', note: 'One expressive serif, one neutral sans; nothing else.' },
  { heading: 'Nunito', body: 'Nunito Sans', mood: 'Playful', note: 'Soft rounded pair that stays legible at small sizes.' },
]

/** Keep pairs that match the selected mood (or 'All') and, if given, the search text. */
export function filterPairs(pairs: Pair[], mood: string, query: string): Pair[] {
  const q = query.trim().toLowerCase()
  return pairs.filter((p) => {
    if (mood && mood !== 'All' && p.mood !== mood) return false
    if (!q) return true
    return [p.heading, p.body, p.mood, p.note].some((s) => s.toLowerCase().includes(q))
  })
}

/** CSS custom properties that wire a pair into a page. */
export function cssFor(pair: Pair): string {
  return `--font-heading: ${stackFor(pair.heading)};\n--font-body: ${stackFor(pair.body)};`
}
