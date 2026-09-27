import { downloadCanvas } from '../../sim/draw'
import { FH, FW } from './Floor'
import { seatKey, seatPositions, tableSize, type Guest, type Seating, type Table } from './logic'

/** Draws the floor plan with full guest names beside each seat and downloads it. */
export function exportFloor(tables: Table[], guests: Guest[], seating: Seating, colorOf: (g: string) => string) {
  const s = 2
  const c = document.createElement('canvas')
  c.width = FW * s
  c.height = FH * s
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.scale(s, s)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, FW, FH)
  const byId = new Map(guests.map((g) => [g.id, g]))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const t of tables) {
    const { r, w, h } = tableSize(t)
    ctx.fillStyle = '#f1ece0'
    ctx.strokeStyle = '#b9b2a1'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (t.shape === 'round') ctx.arc(t.x, t.y, r, 0, Math.PI * 2)
    else ctx.roundRect(t.x - w / 2, t.y - h / 2, w, h, 8)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#1b1a17'
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.fillText(t.name, t.x, t.y)
    seatPositions(t).forEach((p, i) => {
      const g = byId.get(seating[seatKey(t.id, i)] ?? -1)
      const x = t.x + p.x
      const y = t.y + p.y
      ctx.beginPath()
      ctx.arc(x, y, 15, 0, Math.PI * 2)
      ctx.fillStyle = g ? colorOf(g.group) : '#ffffff'
      ctx.fill()
      ctx.strokeStyle = '#b9b2a1'
      ctx.stroke()
      if (g) {
        const out = Math.hypot(p.x, p.y) || 1
        ctx.fillStyle = '#1b1a17'
        ctx.font = '600 10px system-ui, sans-serif'
        ctx.fillText(g.name, x + (p.x / out) * 30, y + (p.y / out) * 26)
      }
    })
  }
  downloadCanvas(c, 'seating-chart.png')
}
