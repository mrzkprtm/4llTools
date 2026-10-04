/** Decodes the handful of HTML entities YouTube puts in meta attributes. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (all, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
    return named[ent.toLowerCase()] ?? all
  })
}

export function splitTags(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw.split(',')) {
    const tag = t.trim()
    const key = tag.toLowerCase()
    if (tag && !seen.has(key)) {
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

/**
 * YouTube publishes tags twice on a watch page: a <meta name="keywords"> tag
 * and a "keywords" array inside the embedded player JSON. Try both.
 */
export function extractTags(html: string): string[] {
  const meta = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i)
  if (meta) return splitTags(decodeEntities(meta[1]))
  const json = html.match(/"keywords"\s*:\s*\[([^\]]*)\]/)
  if (json) {
    const tags: string[] = []
    for (const m of json[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      try {
        tags.push(JSON.parse(`"${m[1]}"`) as string)
      } catch {
        tags.push(m[1])
      }
    }
    return splitTags(tags.join(','))
  }
  return []
}

export function extractTitle(html: string): string | null {
  const og = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)
  if (og) return decodeEntities(og[1])
  const t = html.match(/<title>([^<]*)<\/title>/i)
  return t ? decodeEntities(t[1]).replace(/ - YouTube$/, '') : null
}

export function extractChannel(html: string): string | null {
  const m =
    html.match(/"ownerChannelName"\s*:\s*"((?:[^"\\]|\\.)*)"/) ||
    html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i)
  if (!m) return null
  try {
    return JSON.parse(`"${m[1]}"`) as string
  } catch {
    return decodeEntities(m[1])
  }
}

/** Comma-separated for pasting into YouTube Studio, and #hashtag form for descriptions. */
export const toPlain = (tags: string[]) => tags.join(', ')
export const toHashtags = (tags: string[]) => tags.map((t) => '#' + t.replace(/\s+/g, '')).join(' ')

export async function fetchWatchHtml(id: string): Promise<string> {
  const watch = `https://www.youtube.com/watch?v=${id}`
  const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(watch)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text.includes('youtube')) throw new Error('unexpected response')
  return text
}
