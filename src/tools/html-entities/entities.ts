const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(text: string, encodeNonAscii = false): string {
  let out = text.replace(/[&<>"']/g, (c) => ESCAPES[c])
  if (encodeNonAscii) out = out.replace(/[^\x00-\x7f]/gu, (c) => `&#${c.codePointAt(0)};`)
  return out
}

/** Decodes named and numeric entities using the browser's own HTML parser. */
export function unescapeHtml(text: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body><textarea>${text.replace(/<\/textarea/gi, '&lt;/textarea')}</textarea>`, 'text/html')
  return doc.querySelector('textarea')?.value ?? ''
}
