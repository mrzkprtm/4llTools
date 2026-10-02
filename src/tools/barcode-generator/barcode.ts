/** jsbarcode format names, with a label and an example for each. */
export const FORMATS = [
  { id: 'CODE128', label: 'Code 128', example: '4LLTOOLS-2026', hint: 'Any ASCII text. The most common general-purpose 1D barcode (shipping labels, inventory).' },
  { id: 'EAN13', label: 'EAN-13', example: '590123412345', hint: '12 digits (the 13th check digit is added for you) or 13 with the check digit. Retail products worldwide.' },
  { id: 'EAN8', label: 'EAN-8', example: '9638507', hint: '7 digits (+ check digit) for small retail packages.' },
  { id: 'UPC', label: 'UPC-A', example: '03600029145', hint: '11 digits (+ check digit). Retail products in North America.' },
  { id: 'CODE39', label: 'Code 39', example: 'CODE-39 TEST', hint: 'Upper-case A–Z, digits, space and - . $ / + %. Lower case is converted for you.' },
  { id: 'ITF14', label: 'ITF-14', example: '1234567890123', hint: '13 digits (+ check digit). Outer cartons and shipping cases.' },
  { id: 'MSI', label: 'MSI', example: '1234567', hint: 'Digits only. Warehouse shelf labels.' },
  { id: 'pharmacode', label: 'Pharmacode', example: '1234', hint: 'A whole number from 3 to 131070. Pharmaceutical packaging.' },
  { id: 'codabar', label: 'Codabar', example: 'A40156B', hint: 'Digits and - $ : / . +, optionally wrapped in start/stop letters A–D. Libraries and blood banks.' },
] as const

export type Format = (typeof FORMATS)[number]['id']

export type Validation = { ok: true; value: string; note?: string } | { ok: false; error: string }

/**
 * GS1 mod-10 check digit for EAN/UPC/ITF: from the rightmost data digit,
 * weights alternate 3, 1, 3, …; the check digit brings the sum to a multiple of 10.
 */
export function gtinCheckDigit(data: string): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const d = Number(data[data.length - 1 - i])
    sum += d * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

function gtin(input: string, dataLen: number, name: string): Validation {
  const v = input.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(v)) return { ok: false, error: `${name} takes digits only.` }
  if (v.length === dataLen) return { ok: true, value: v + gtinCheckDigit(v), note: `Check digit ${gtinCheckDigit(v)} added.` }
  if (v.length === dataLen + 1) {
    const want = gtinCheckDigit(v.slice(0, dataLen))
    if (Number(v[dataLen]) !== want) return { ok: false, error: `Wrong check digit: the last digit should be ${want}, not ${v[dataLen]}.` }
    return { ok: true, value: v }
  }
  return { ok: false, error: `${name} needs ${dataLen} digits (or ${dataLen + 1} with the check digit); got ${v.length}.` }
}

export function validate(format: Format, raw: string): Validation {
  const input = raw.trim()
  if (!input) return { ok: false, error: 'Enter a value to encode.' }
  switch (format) {
    case 'CODE128':
      // eslint-disable-next-line no-control-regex
      return /^[\x00-\x7f]+$/.test(input) ? { ok: true, value: input } : { ok: false, error: 'Code 128 supports ASCII characters only (no accents or emoji).' }
    case 'EAN13':
      return gtin(input, 12, 'EAN-13')
    case 'EAN8':
      return gtin(input, 7, 'EAN-8')
    case 'UPC':
      return gtin(input, 11, 'UPC-A')
    case 'ITF14':
      return gtin(input, 13, 'ITF-14')
    case 'CODE39': {
      const up = input.toUpperCase()
      if (!/^[0-9A-Z \-.$/+%]+$/.test(up)) return { ok: false, error: 'Code 39 allows A–Z, 0–9, space and - . $ / + % only.' }
      return { ok: true, value: up, note: up !== input ? 'Converted to upper case.' : undefined }
    }
    case 'MSI':
      return /^\d+$/.test(input) ? { ok: true, value: input } : { ok: false, error: 'MSI takes digits only.' }
    case 'pharmacode': {
      if (!/^\d+$/.test(input)) return { ok: false, error: 'Pharmacode is a whole number.' }
      const n = Number(input)
      return n >= 3 && n <= 131070 ? { ok: true, value: String(n) } : { ok: false, error: 'Pharmacode must be between 3 and 131070.' }
    }
    case 'codabar': {
      const up = input.toUpperCase()
      if (/^[A-D][0-9\-$:/.+]+[A-D]$/.test(up) || /^[0-9\-$:/.+]+$/.test(up)) return { ok: true, value: up }
      return { ok: false, error: 'Codabar allows digits and - $ : / . + between optional start/stop letters A–D.' }
    }
  }
}

/** Splits bulk input into non-empty trimmed lines (max `limit`). */
export function bulkLines(text: string, limit = 50): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, limit)
}

/** A filename-safe version of a barcode value. */
export function fileSafe(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'barcode'
}
