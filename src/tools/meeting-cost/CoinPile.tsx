import { useRef } from 'react'
import { reducedMotion } from '../../motion/springs'
import Stage from '../../sim/Stage'
import { PILE_CAPACITY, pileSlots } from './logic'

const W = 360
const H = 150
const SLOTS = pileSlots(W, H)

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, tilt = 1) {
  ctx.beginPath()
  ctx.ellipse(x, y + 2, 11, 3.6 * tilt, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#b7791f'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x, y, 11, 3.6 * tilt, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#f6c343'
  ctx.fill()
  ctx.strokeStyle = '#d69e2e'
  ctx.lineWidth = 1
  ctx.stroke()
}

/** A heap of coins; new coins fall in from the top as `count` grows. */
export default function CoinPile({ count, label }: { count: number; label: string }) {
  const st = useRef({ settled: 0, falling: [] as { x: number; y: number; vy: number; spin: number }[], wait: 0 })
  const target = Math.min(count, PILE_CAPACITY)

  return (
    <Stage
      world={[W, H]}
      running
      label={label}
      onFrame={(ctx, f) => {
        const s = st.current
        const dt = Math.min(f.dt, 0.05)
        if (target < s.settled + s.falling.length || reducedMotion()) {
          s.settled = target
          s.falling = []
        }
        s.wait -= dt
        if (s.settled + s.falling.length < target && s.wait <= 0) {
          const slot = SLOTS[s.settled + s.falling.length]
          s.falling.push({ x: slot.x + (Math.random() - 0.5) * 30, y: -10, vy: 0, spin: Math.random() * 6 })
          // Catch up quickly when far behind.
          s.wait = target - s.settled > 20 ? 0.02 : 0.12
        }
        ctx.clearRect(0, 0, W, H)
        for (let i = 0; i < s.settled; i++) coin(ctx, SLOTS[i].x, SLOTS[i].y)
        s.falling.forEach((c, i) => {
          const slot = SLOTS[s.settled + i]
          c.vy += 1400 * dt
          c.y += c.vy * dt
          c.x += (slot.x - c.x) * Math.min(1, dt * 6)
          c.spin += dt * 14
          coin(ctx, c.x, Math.min(c.y, slot.y), 0.4 + Math.abs(Math.cos(c.spin)) * 0.6)
        })
        while (s.falling.length && s.falling[0].y >= SLOTS[s.settled].y) {
          s.falling.shift()
          s.settled++
        }
      }}
    />
  )
}
