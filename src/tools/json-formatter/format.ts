export type FormatResult = { ok: true; text: string } | { ok: false; error: string }

export function formatJson(input: string, indent: number | 'min'): FormatResult {
  if (!input.trim()) return { ok: true, text: '' }
  try {
    const value = JSON.parse(input)
    return { ok: true, text: indent === 'min' ? JSON.stringify(value) : JSON.stringify(value, null, indent) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
