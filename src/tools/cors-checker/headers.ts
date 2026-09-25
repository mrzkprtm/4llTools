export type Headers = [name: string, value: string][]

/**
 * Parses raw response headers as copied from `curl -I`, DevTools "raw" view,
 * or DevTools' two-line "name:\nvalue" copy format. Status lines are skipped.
 * Names are lower-cased; repeated headers are kept.
 */
export function parseHeaders(raw: string): Headers {
  const lines = raw.replace(/\r/g, '').split('\n')
  const out: Headers = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || /^HTTP\/\d/i.test(line)) continue
    const idx = line.indexOf(':', line.startsWith(':') ? 1 : 0) // HTTP/2 pseudo headers like :status
    if (idx <= 0) continue
    const name = line.slice(0, idx).trim().toLowerCase()
    let value = line.slice(idx + 1).trim()
    if (!/^:?[a-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue
    if (!value && i + 1 < lines.length && !lines[i + 1].includes(': ')) {
      value = lines[i + 1].trim()
      i++
    }
    if (name.startsWith(':')) continue
    out.push([name, value])
  }
  return out
}

export function get(headers: Headers, name: string): string | undefined {
  const all = getAll(headers, name)
  return all.length ? all.join(', ') : undefined
}

export function getAll(headers: Headers, name: string): string[] {
  const n = name.toLowerCase()
  return headers.filter(([k]) => k === n).map(([, v]) => v)
}

export const splitList = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean)
