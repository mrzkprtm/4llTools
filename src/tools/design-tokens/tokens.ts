/** Design tokens: a small editable model plus CSS, Tailwind and JSON exporters. */

export type TokenKind = 'color' | 'space' | 'radius' | 'font'

export interface Token {
  name: string
  value: string
}

export interface TokenGroup {
  kind: TokenKind
  label: string
  tokens: Token[]
}

export const DEFAULT_TOKENS: TokenGroup[] = [
  {
    kind: 'color',
    label: 'Colors',
    tokens: [
      { name: 'Primary', value: '#c2410c' },
      { name: 'Ink', value: '#1b1a17' },
      { name: 'Surface', value: '#fcfbf7' },
    ],
  },
  {
    kind: 'space',
    label: 'Spacing',
    tokens: [
      { name: 'Sm', value: '8px' },
      { name: 'Md', value: '16px' },
      { name: 'Lg', value: '24px' },
    ],
  },
  {
    kind: 'radius',
    label: 'Radius',
    tokens: [
      { name: 'Sm', value: '6px' },
      { name: 'Md', value: '10px' },
      { name: 'Lg', value: '16px' },
    ],
  },
  {
    kind: 'font',
    label: 'Fonts',
    tokens: [
      { name: 'Heading', value: "'Bricolage Grotesque', system-ui, sans-serif" },
      { name: 'Body', value: 'system-ui, sans-serif' },
    ],
  },
]

const PREFIX: Record<TokenKind, string> = { color: 'color', space: 'space', radius: 'radius', font: 'font' }
const TW_GROUP: Record<TokenKind, string> = { color: 'colors', space: 'spacing', radius: 'borderRadius', font: 'fontFamily' }

/** A safe custom-property fragment: lowercase, hyphenated, never empty. */
export function slugToken(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'token'
}

/** `:root` custom properties for every token. */
export function toCss(groups: TokenGroup[]): string {
  const lines: string[] = []
  for (const group of groups) {
    for (const token of group.tokens) {
      if (!token.name.trim()) continue
      lines.push(`  --${PREFIX[group.kind]}-${slugToken(token.name)}: ${token.value};`)
    }
  }
  return `:root {\n${lines.join('\n')}\n}`
}

/** A `theme.extend` block for a Tailwind config. */
export function toTailwind(groups: TokenGroup[]): string {
  const blocks = groups.map((group) => {
    const entries = group.tokens
      .filter((token) => token.name.trim())
      .map((token) => `      '${slugToken(token.name)}': '${token.value.replace(/'/g, "\\'")}',`)
    return `    ${TW_GROUP[group.kind]}: {\n${entries.join('\n')}\n    },`
  })
  return `theme: {\n  extend: {\n${blocks.join('\n')}\n  },\n}`
}

/** Tokens as a grouped JSON object. */
export function toJson(groups: TokenGroup[]): string {
  const out: Record<string, Record<string, string>> = {}
  for (const group of groups) {
    const obj: Record<string, string> = {}
    for (const token of group.tokens) if (token.name.trim()) obj[slugToken(token.name)] = token.value
    out[group.kind] = obj
  }
  return JSON.stringify(out, null, 2)
}
