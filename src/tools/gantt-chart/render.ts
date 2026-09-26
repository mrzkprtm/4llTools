import { downloadCanvas } from '../../sim/draw'
import { connector, geometry, GUT, HEAD, ROW } from './Chart'
import { addDays, end, type Task } from './logic'

/** Draws the chart onto a canvas (on white paper) and downloads it as PNG. */
export function exportPng(tasks: Task[], start: string, dayW: number, today: number) {
  const g = geometry(tasks, dayW, today)
  const s = 2
  const c = document.createElement('canvas')
  c.width = g.width * s
  c.height = g.height * s
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.scale(s, s)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, g.width, g.height)
  const font = (px: number, w = 500) => `${w} ${px}px system-ui, sans-serif`
  const weeks = dayW < 20
  for (let d = 0; d < g.days; d++) {
    const iso = addDays(start, d)
    const dow = new Date(iso + 'T00:00:00Z').getUTCDay()
    const x = GUT + d * dayW
    if (!weeks && (dow === 0 || dow === 6)) {
      ctx.fillStyle = '#f3f0e8'
      ctx.fillRect(x, HEAD, dayW, g.height - HEAD)
    }
    if (weeks && dow !== 1) continue
    ctx.strokeStyle = dow === 1 ? '#d0c9b8' : '#ebe6da'
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 22)
    ctx.lineTo(x + 0.5, g.height)
    ctx.stroke()
    ctx.fillStyle = '#676357'
    ctx.font = font(10)
    ctx.textAlign = weeks ? 'left' : 'center'
    ctx.fillText(String(+iso.slice(8, 10)), x + (weeks ? 3 : dayW / 2), 38)
    if (iso.endsWith('-01') || d === 0) {
      ctx.textAlign = 'left'
      ctx.font = font(11, 700)
      ctx.fillText(iso.slice(0, 7), x + 3, 16)
    }
  }
  const idx = new Map(tasks.map((t, i) => [t.id, i]))
  tasks.forEach((t, i) => {
    ctx.fillStyle = '#1b1a17'
    ctx.font = font(12, 600)
    ctx.textAlign = 'left'
    ctx.fillText(t.name.slice(0, 18), 10, HEAD + i * ROW + ROW / 2 + 4)
  })
  ctx.strokeStyle = '#676357'
  ctx.lineWidth = 1.5
  for (const t of tasks)
    for (const d of t.deps) {
      if (!idx.has(d)) continue
      const p = tasks[idx.get(d)!]
      const x1 = GUT + end(p) * dayW
      const y1 = HEAD + idx.get(d)! * ROW + ROW / 2
      const x2 = GUT + t.start * dayW
      const y2 = HEAD + idx.get(t.id)! * ROW + ROW / 2
      ctx.stroke(new Path2D(connector(x1, y1, x2, y2)))
      ctx.fillStyle = '#676357'
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - 7, y2 - 4)
      ctx.lineTo(x2 - 7, y2 + 4)
      ctx.fill()
    }
  tasks.forEach((t, i) => {
    const x = GUT + t.start * dayW
    const y = HEAD + i * ROW + 8
    const w = t.duration * dayW
    ctx.fillStyle = t.color
    ctx.beginPath()
    ctx.roundRect(x, y, w, ROW - 16, 6)
    ctx.fill()
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath()
    ctx.roundRect(x, y, (w * t.progress) / 100, ROW - 16, 6)
    ctx.fill()
    if (w > 46) {
      ctx.fillStyle = '#fff'
      ctx.font = font(11, 700)
      ctx.fillText(`${t.progress}%`, x + 8, y + (ROW - 16) / 2 + 4)
    }
  })
  if (today >= 0 && today < g.days) {
    ctx.strokeStyle = '#e03131'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(GUT + today * dayW, 22)
    ctx.lineTo(GUT + today * dayW, g.height)
    ctx.stroke()
  }
  downloadCanvas(c, 'gantt-chart.png')
}
