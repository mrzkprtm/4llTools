import { useRef } from 'react'
import Stage from '../../sim/Stage'
import { circle, clear, line } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import { swell, type LayerId } from './noise'

const W = 200
const H = 110

interface Props {
  id: LayerId
  color: string
  volume: number
  playing: boolean
  /** Audio-clock swell for the ocean, when the engine is running. */
  swellNow: () => number | null
}

/** One animated picture per layer that moves faster or fuller with its volume. */
export default function Tile({ id, color, volume, playing, swellNow }: Props) {
  const theme = useTheme()
  const st = useRef({ drops: [] as { x: number; y: number; v: number; splash: number }[], angle: 0, steam: [] as { x: number; y: number; a: number }[], phase: 0 })

  function draw(c: CanvasRenderingContext2D, f: { dt: number; t: number }) {
    const s = st.current
    const v = volume / 100
    const dt = f.dt
    clear(c, W, H, theme.sunken)
    if (id === 'rain') {
      const target = Math.round(v * 70)
      while (s.drops.length < target) s.drops.push({ x: Math.random() * W, y: Math.random() * H, v: 140 + Math.random() * 120, splash: 0 })
      if (s.drops.length > target) s.drops.length = target
      for (const d of s.drops) {
        if (d.splash > 0) {
          d.splash -= dt * 3
          circle(c, d.x, H - 6, (1 - d.splash) * 9, undefined, alpha(color, d.splash), 1)
          if (d.splash <= 0) Object.assign(d, { x: Math.random() * W, y: -10 })
          continue
        }
        d.y += d.v * dt
        if (d.y > H - 6) d.splash = 1
        line(c, d.x, d.y, d.x - 2, d.y - 9, alpha(color, 0.75), 1.5)
      }
      line(c, 0, H - 5, W, H - 5, alpha(color, 0.35), 2)
    } else if (id === 'ocean') {
      s.phase += dt * (0.8 + v)
      const sw = swellNow() ?? swell(f.t)
      for (let k = 0; k < 3; k++) {
        c.beginPath()
        const base = H * (0.45 + k * 0.17) - sw * 18 * v * (1 - k * 0.25)
        c.moveTo(0, H)
        for (let x = 0; x <= W; x += 6) c.lineTo(x, base + Math.sin(x / (22 + k * 6) + s.phase * (1 + k * 0.4)) * (3 + 8 * v))
        c.lineTo(W, H)
        c.fillStyle = alpha(color, 0.25 + k * 0.22)
        c.fill()
      }
    } else if (id === 'fan') {
      s.angle += dt * v * 22
      const cx = W / 2
      const cy = H / 2
      circle(c, cx, cy, 46, undefined, alpha(theme.text, 0.25), 2)
      for (let k = 0; k < 3; k++) {
        const a = s.angle + (k * Math.PI * 2) / 3
        c.save()
        c.translate(cx, cy)
        c.rotate(a)
        c.beginPath()
        c.ellipse(22, 0, 20, 9, 0.3, 0, Math.PI * 2)
        c.fillStyle = alpha(color, v > 0 ? 0.55 + 0.3 * v : 0.3)
        c.fill()
        c.restore()
      }
      circle(c, cx, cy, 7, theme.surface, color, 2)
    } else if (id === 'cafe') {
      const cx = W / 2
      if (dt > 0 && Math.random() < v * 0.5) s.steam.push({ x: cx - 12 + Math.random() * 24, y: 62, a: 1 })
      for (const p of s.steam) {
        p.y -= dt * 22
        p.a -= dt * 0.45
        p.x += Math.sin(p.y / 7) * 0.4
        circle(c, p.x, p.y, 3 + (1 - p.a) * 5, alpha(theme.muted, Math.max(0, p.a) * 0.35))
      }
      s.steam = s.steam.filter((p) => p.a > 0)
      c.beginPath()
      c.moveTo(cx - 26, 64)
      c.lineTo(cx + 26, 64)
      c.lineTo(cx + 20, 96)
      c.lineTo(cx - 20, 96)
      c.closePath()
      c.fillStyle = color
      c.fill()
      c.beginPath()
      c.arc(cx + 28, 76, 8, -Math.PI / 2, Math.PI / 2)
      c.strokeStyle = color
      c.lineWidth = 4
      c.stroke()
      line(c, cx - 40, 99, cx + 40, 99, alpha(theme.text, 0.3), 3)
    } else {
      // Noise colors: a scrolling waveform whose roughness matches the color.
      s.phase += dt * 60
      const smooth = id === 'white' ? 1 : id === 'pink' ? 4 : 14
      c.beginPath()
      let y = H / 2
      for (let x = 0; x <= W; x += 2) {
        const n = Math.sin((x + s.phase) * 0.37 * (3 / smooth)) * 0.5 + Math.sin((x + s.phase) * 1.91 / smooth + 1.3) * 0.3 + Math.sin((x * 7.3 + s.phase * 3) / smooth) * 0.2
        y = H / 2 + n * 38 * Math.max(0.08, v)
        if (x) c.lineTo(x, y)
        else c.moveTo(x, y)
      }
      c.strokeStyle = alpha(color, 0.9)
      c.lineWidth = 2
      c.stroke()
    }
    if (!playing || volume === 0) {
      c.fillStyle = alpha(theme.sunken, 0.45)
      c.fillRect(0, 0, W, H)
    }
  }

  return <Stage world={[W, H]} running={playing && volume > 0} onFrame={draw} label={`${id} layer at ${volume}%`} className="an-stage" />
}
