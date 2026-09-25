export type LineAction = 'sort' | 'sort-desc' | 'sort-num' | 'dedupe' | 'reverse' | 'trim' | 'remove-empty' | 'shuffle'

export function applyLineAction(text: string, action: LineAction, caseSensitive = true, rand = Math.random): string {
  const lines = text.split('\n')
  const collator = new Intl.Collator(undefined, { sensitivity: caseSensitive ? 'variant' : 'base', numeric: true })
  switch (action) {
    case 'sort':
      return [...lines].sort(collator.compare).join('\n')
    case 'sort-desc':
      return [...lines].sort((a, b) => collator.compare(b, a)).join('\n')
    case 'sort-num':
      return [...lines].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)).join('\n')
    case 'dedupe': {
      const seen = new Set<string>()
      return lines
        .filter((l) => {
          const key = caseSensitive ? l : l.toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .join('\n')
    }
    case 'reverse':
      return [...lines].reverse().join('\n')
    case 'trim':
      return lines.map((l) => l.trim()).join('\n')
    case 'remove-empty':
      return lines.filter((l) => l.trim()).join('\n')
    case 'shuffle': {
      const out = [...lines]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out.join('\n')
    }
  }
}
