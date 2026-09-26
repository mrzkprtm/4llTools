import { DAY_END, DAY_START, dayActs, durLabel, endOf, gaps, hhmm, TYPES, type Activity } from './logic'

const SANS = '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif'
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'

/** Draws the plan onto a canvas (light colors, for sharing) and downloads it as a PNG. */
export function exportPng(title: string, dayLabels: string[], acts: Activity[], clashes: Set<string>) {
  const colW = 240
  const hourPx = 44
  const left = 56
  const top = 84
  const hours = (DAY_END - DAY_START) / 60
  const W = left + colW * dayLabels.length + 20
  const H = top + hours * hourPx + 30
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fcfbf7'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#1b1a17'
  ctx.font = `700 22px ${SANS}`
  ctx.fillText(title, left, 36)
  const y = (m: number) => top + ((m - DAY_START) / 60) * hourPx

  ctx.font = `500 11px ${MONO}`
  for (let h = DAY_START / 60; h <= DAY_END / 60; h++) {
    ctx.strokeStyle = '#e4dfd3'
    ctx.beginPath()
    ctx.moveTo(left, y(h * 60))
    ctx.lineTo(W - 20, y(h * 60))
    ctx.stroke()
    ctx.fillStyle = '#676357'
    ctx.fillText(`${String(h % 24).padStart(2, '0')}:00`, 8, y(h * 60) + 4)
  }

  dayLabels.forEach((label, d) => {
    const x = left + d * colW
    ctx.fillStyle = '#1b1a17'
    ctx.font = `700 14px ${SANS}`
    ctx.fillText(label, x + 8, top - 14)
    for (const g of gaps(acts, d)) {
      const cx = x + colW / 2
      ctx.strokeStyle = '#8a8577'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(cx, y(g.start))
      ctx.lineTo(cx, y(g.end))
      ctx.stroke()
      ctx.setLineDash([])
      if (y(g.end) - y(g.start) > 14) {
        ctx.fillStyle = '#676357'
        ctx.font = `500 10px ${MONO}`
        ctx.fillText(durLabel(g.minutes), cx + 6, (y(g.start) + y(g.end)) / 2 + 4)
      }
    }
    for (const a of dayActs(acts, d)) {
      const bx = x + 6
      const by = y(a.start) + 1
      const bh = Math.max(12, y(endOf(a)) - y(a.start) - 2)
      ctx.fillStyle = TYPES[a.type].color
      ctx.beginPath()
      ctx.roundRect(bx, by, colW - 12, bh, 6)
      ctx.fill()
      if (clashes.has(a.id)) {
        ctx.strokeStyle = '#b42318'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.lineWidth = 1
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(bx, by, colW - 12, bh)
      ctx.clip()
      ctx.fillStyle = '#fff'
      ctx.font = `700 12px ${SANS}`
      ctx.fillText(a.name, bx + 8, by + 15)
      if (bh > 30) {
        ctx.font = `500 10px ${MONO}`
        ctx.fillText(`${hhmm(a.start)}–${hhmm(endOf(a))}${a.place ? ' · ' + a.place : ''}`, bx + 8, by + 29)
      }
      ctx.restore()
    }
  })

  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${title.replace(/[^\w-]+/g, '-').toLowerCase() || 'itinerary'}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}
