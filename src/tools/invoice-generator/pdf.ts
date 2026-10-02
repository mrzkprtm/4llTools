import { computeTotals, formatMoney, lineAmount, pdfSafe, wrapText } from './logic'
import type { Invoice } from './types'

/** Draws the invoice on A4 pages with pdf-lib's built-in Helvetica and returns the file bytes. */
export async function buildPdf(inv: Invoice): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Invoice ${inv.number}`))
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28
  const H = 841.89
  const M = 48
  const ink = rgb(0.11, 0.1, 0.09)
  const muted = rgb(0.42, 0.4, 0.36)
  const accent = rgb(0.76, 0.25, 0.05)
  const rule = rgb(0.85, 0.82, 0.76)
  let page = doc.addPage([W, H])
  let y = H - M

  type F = typeof font
  const draw = (s: string, x: number, yy: number, size = 10, f: F = font, color = ink) => page.drawText(pdfSafe(s), { x, y: yy, size, font: f, color })
  const right = (s: string, xr: number, yy: number, size = 10, f: F = font, color = ink) => draw(s, xr - f.widthOfTextAtSize(pdfSafe(s), size), yy, size, f, color)
  const wrap = (s: string, width: number, size = 10, f: F = font) => wrapText(pdfSafe(s), width, (t) => f.widthOfTextAtSize(t, size))
  const ensure = (need: number) => {
    if (y - need < M) {
      page = doc.addPage([W, H])
      y = H - M
    }
  }

  // Header: title on the left, logo on the right.
  let logoH = 0
  if (inv.logo) {
    try {
      const bytes = Uint8Array.from(atob(inv.logo.split(',')[1] ?? ''), (c) => c.charCodeAt(0))
      const img = inv.logo.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const s = Math.min(140 / img.width, 60 / img.height)
      logoH = img.height * s
      page.drawImage(img, { x: W - M - img.width * s, y: y - logoH, width: img.width * s, height: logoH })
    } catch {
      // Unsupported image: skip the logo.
    }
  }
  draw('INVOICE', M, y - 22, 26, bold, accent)
  y -= Math.max(40, logoH + 8)
  const meta: [string, string][] = [
    ['Invoice no.', inv.number],
    ['Date', inv.date],
    ['Due', inv.due],
  ]
  let my = y
  for (const [k, v] of meta) {
    right(`${k}: `, W - M - 110, my, 9, font, muted)
    right(v, W - M, my, 10, bold)
    my -= 15
  }
  // From / Bill to columns.
  const colW = (W - 2 * M - 150) / 2
  const block = (title: string, text: string, x: number) => {
    let by = y
    draw(title.toUpperCase(), x, by, 8, bold, muted)
    by -= 14
    wrap(text, colW - 10).forEach((l, i) => {
      draw(l, x, by, i === 0 ? 11 : 10, i === 0 ? bold : font)
      by -= 14
    })
    return by
  }
  const endA = block('From', inv.from, M)
  const endB = block('Bill to', inv.to, M + colW)
  y = Math.min(endA, endB, my) - 18

  // Items table.
  const cQty = W - M - 230
  const cPrice = W - M - 120
  const cAmt = W - M
  const descW = cQty - M - 40
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.95, 0.93, 0.89) })
    draw('Description', M + 6, y, 9, bold, muted)
    right('Qty', cQty, y, 9, bold, muted)
    right('Price', cPrice, y, 9, bold, muted)
    right('Amount', cAmt - 6, y, 9, bold, muted)
    y -= 26
  }
  header()
  for (const it of inv.items) {
    const lines = wrap(it.desc || '-', descW)
    const h = lines.length * 13 + 8
    if (y - h < M) {
      page = doc.addPage([W, H])
      y = H - M
      header()
    }
    lines.forEach((l, i) => draw(l, M + 6, y - i * 13, 10))
    right(String(it.qty), cQty, y, 10)
    right(formatMoney(it.price, inv.currency), cPrice, y, 10)
    right(formatMoney(lineAmount(it, inv.currency), inv.currency), cAmt - 6, y, 10)
    y -= h
    page.drawLine({ start: { x: M, y: y + 9 }, end: { x: W - M, y: y + 9 }, thickness: 0.5, color: rule })
  }

  // Totals.
  const t = computeTotals(inv.items, inv.discountType, inv.discount, inv.taxRate, inv.currency)
  const rows: [string, string, boolean][] = [['Subtotal', formatMoney(t.subtotal, inv.currency), false]]
  if (t.discount) rows.push([inv.discountType === 'pct' ? `Discount (${inv.discount}%)` : 'Discount', `-${formatMoney(t.discount, inv.currency)}`, false])
  if (inv.taxRate) rows.push([`${inv.taxLabel || 'Tax'} (${inv.taxRate}%)`, formatMoney(t.tax, inv.currency), false])
  rows.push(['Total', formatMoney(t.total, inv.currency), true])
  ensure(rows.length * 18 + 20)
  y -= 6
  for (const [k, v, strong] of rows) {
    if (strong) {
      page.drawRectangle({ x: W - M - 230, y: y - 8, width: 230, height: 26, color: accent })
      draw(k, W - M - 222, y, 12, bold, rgb(1, 1, 1))
      right(v, cAmt - 8, y, 12, bold, rgb(1, 1, 1))
    } else {
      right(k, W - M - 120, y, 10, font, muted)
      right(v, cAmt - 6, y, 10)
    }
    y -= strong ? 34 : 18
  }

  // Notes and bank details.
  for (const [title, text] of [
    ['Payment details', inv.bank],
    ['Notes', inv.notes],
  ] as const) {
    if (!text.trim()) continue
    const lines = wrap(text, W - 2 * M, 9.5)
    ensure(28)
    draw(title.toUpperCase(), M, y, 8, bold, muted)
    y -= 14
    for (const l of lines) {
      ensure(13)
      draw(l, M, y, 9.5)
      y -= 13
    }
    y -= 10
  }
  return doc.save()
}
