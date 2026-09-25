/** Parses CSV per RFC 4180: quoted fields, escaped quotes ("") and newlines inside quotes. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += '"', i++
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) row.push(field), (field = '')
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field), rows.push(row), (row = []), (field = '')
    } else field += c
  }
  if (field !== '' || row.length) row.push(field), rows.push(row)
  return rows.filter((r) => r.length > 1 || r[0] !== '')
}

export function csvToJson(text: string, delimiter = ',', header = true): unknown[] {
  const rows = parseCsv(text, delimiter)
  if (!header) return rows
  const [keys = [], ...rest] = rows
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])))
}

function csvField(value: unknown, delimiter: string): string {
  const s = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Converts an array of objects (or arrays) to CSV. Columns are the union of all object keys. */
export function jsonToCsv(json: unknown, delimiter = ','): string {
  const list = Array.isArray(json) ? json : [json]
  if (list.every(Array.isArray)) return list.map((r) => (r as unknown[]).map((v) => csvField(v, delimiter)).join(delimiter)).join('\n')
  const keys = [...new Set(list.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))]
  const lines = [keys.map((k) => csvField(k, delimiter)).join(delimiter)]
  for (const o of list) lines.push(keys.map((k) => csvField((o as Record<string, unknown>)?.[k], delimiter)).join(delimiter))
  return lines.join('\n')
}
