/** A one-shot confetti burst drawn on a full-screen canvas that removes itself. */
export function confetti() {
  if (typeof document === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '100' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)
  const colors = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f59f00', '#e03131', '#0ca678']
  const bits = Array.from({ length: 180 }, (_, i) => {
    const side = i % 2 ? 1 : -1
    // Fire from both bottom corners, up and inward.
    const a = 0.35 + Math.random() * 0.6
    const v = 11 + Math.random() * 10
    return { x: side > 0 ? 0 : W, y: H * 0.8, vx: Math.sin(a) * v * side, vy: -Math.cos(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: colors[i % colors.length] }
  })
  const start = performance.now()
  const step = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    for (const b of bits) {
      b.vy += 0.28
      b.vx *= 0.99
      b.vy *= 0.99
      b.x += b.vx
      b.y += b.vy
      b.r += b.vr
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.r)
      ctx.scale(1, Math.cos(t / 120 + b.w))
      ctx.globalAlpha = Math.max(0, 1 - t / 4000)
      ctx.fillStyle = b.c
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
      ctx.restore()
    }
    if (t < 4000) requestAnimationFrame(step)
    else canvas.remove()
  }
  requestAnimationFrame(step)
}
