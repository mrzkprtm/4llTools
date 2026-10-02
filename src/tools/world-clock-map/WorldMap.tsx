import { useRef } from 'react'
import { makeBuffer, MONO } from '../../sim/draw'
import Stage from '../../sim/Stage'
import { alpha, useTheme } from '../../sim/theme'
import { LAND } from './land'
import { decodeLand, project, solarElevation, subsolarPoint, type City } from './logic'

const W = 720
const H = 360
const BW = 240
const BH = 120

interface Props {
  time: number
  cities: City[]
  label: (c: City) => string
  onScrub: (deltaHours: number) => void
  highlight: string | null
}

/** Equirectangular world map with a live day/night shadow and city clocks. */
export default function WorldMap({ time, cities, label, onScrub, highlight }: Props) {
  const theme = useTheme()
  const cache = useRef<{ land: Path2D | null; buf: ReturnType<typeof makeBuffer> | null; at: number }>({ land: null, buf: null, at: NaN })
  const drag = useRef<number | null>(null)

  return (
    <Stage
      world={[W, H]}
      running
      label="World map with the day and night regions and pinned city clocks"
      cursor="ew-resize"
      onPointer={(p) => {
        if (p.type === 'down') drag.current = p.x
        else if (p.type === 'move' && p.down && drag.current !== null) {
          onScrub((-(p.x - drag.current) / W) * 24)
          drag.current = p.x
        } else if (p.type === 'up') drag.current = null
      }}
      onFrame={(ctx) => {
        const c = cache.current
        if (!c.land) {
          c.land = new Path2D()
          for (const ring of decodeLand(LAND)) {
            ring.forEach(([lon, lat], i) => {
              const [x, y] = project(lat, lon, W, H)
              if (i) c.land!.lineTo(x, y)
              else c.land!.moveTo(x, y)
            })
            c.land.closePath()
          }
          c.buf = makeBuffer(BW, BH)
        }
        const date = new Date(time)
        const sun = subsolarPoint(date)
        // Recompute the night shade only when the sun has moved noticeably.
        if (!(Math.abs(time - c.at) < 20_000)) {
          const d = c.buf!.data
          for (let j = 0; j < BH; j++) {
            const lat = 90 - ((j + 0.5) / BH) * 180
            for (let i = 0; i < BW; i++) {
              const lon = ((i + 0.5) / BW) * 360 - 180
              const e = solarElevation(lat, lon, date, sun)
              // Full daylight above 0°, deepening through civil, nautical and astronomical twilight.
              const a = e > 0 ? 0 : Math.min(1, -e / 18) ** 0.6
              const k = (j * BW + i) * 4
              d[k] = 4
              d[k + 1] = 10
              d[k + 2] = 38
              d[k + 3] = Math.round(a * 150)
            }
          }
          c.buf!.flush()
          c.at = time
        }
        const dark = theme.dark
        ctx.fillStyle = dark ? '#10202f' : '#cfe2f1'
        ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = alpha(dark ? '#ffffff' : '#27435c', 0.12)
        ctx.lineWidth = 0.6
        ctx.beginPath()
        for (let lon = -150; lon < 180; lon += 30) {
          ctx.moveTo(((lon + 180) / 360) * W, 0)
          ctx.lineTo(((lon + 180) / 360) * W, H)
        }
        for (let lat = -60; lat <= 60; lat += 30) {
          ctx.moveTo(0, ((90 - lat) / 180) * H)
          ctx.lineTo(W, ((90 - lat) / 180) * H)
        }
        ctx.stroke()
        ctx.fillStyle = dark ? '#3d5a45' : '#b9cf9f'
        ctx.strokeStyle = dark ? '#557a5e' : '#8fae78'
        ctx.lineWidth = 0.7
        ctx.fill(c.land!)
        ctx.stroke(c.land!)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(c.buf!.canvas, 0, 0, W, H)

        const [sx, sy] = project(sun.lat, sun.lon, W, H)
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 34)
        glow.addColorStop(0, 'rgba(255, 214, 80, 0.75)')
        glow.addColorStop(1, 'rgba(255, 214, 80, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(sx - 34, sy - 34, 68, 68)
        ctx.beginPath()
        ctx.arc(sx, sy, 8, 0, Math.PI * 2)
        ctx.fillStyle = '#ffc93c'
        ctx.fill()

        // City dots with labels that dodge each other.
        const placed: [number, number, number, number][] = []
        ctx.font = `600 11px ${MONO}`
        ctx.textBaseline = 'middle'
        for (const city of cities) {
          const [x, y] = project(city.lat, city.lon, W, H)
          const day = solarElevation(city.lat, city.lon, date, sun) > -0.833
          const hi = city.name === highlight
          ctx.beginPath()
          ctx.arc(x, y, hi ? 6 : 4.5, 0, Math.PI * 2)
          ctx.fillStyle = day ? '#f59f00' : '#5c7cfa'
          ctx.fill()
          ctx.lineWidth = 1.5
          ctx.strokeStyle = '#fff'
          ctx.stroke()
          const txt = label(city)
          const tw = ctx.measureText(txt).width + 8
          const th = 16
          const spots: [number, number][] = [[x + 8, y - th / 2], [x - 8 - tw, y - th / 2], [x - tw / 2, y - 8 - th], [x - tw / 2, y + 8], [x + 8, y - th - 2], [x + 8, y + 2]]
          const fits = (r: [number, number, number, number]) => r[0] >= 0 && r[0] + r[2] <= W && r[1] >= 0 && r[1] + r[3] <= H && !placed.some((p) => r[0] < p[0] + p[2] && p[0] < r[0] + r[2] && r[1] < p[1] + p[3] && p[1] < r[1] + r[3])
          const spot = spots.map(([a, b]) => [a, b, tw, th] as [number, number, number, number]).find(fits) ?? [Math.min(W - tw, Math.max(0, x + 8)), Math.min(H - th, Math.max(0, y - th / 2)), tw, th]
          placed.push(spot)
          ctx.fillStyle = hi ? '#1b1a17' : 'rgba(20, 20, 24, 0.72)'
          ctx.beginPath()
          ctx.roundRect(spot[0], spot[1], tw, th, 4)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(txt, spot[0] + 4, spot[1] + th / 2 + 0.5)
        }
      }}
    />
  )
}
