import { useEffect, useRef, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import './sim.css'

export interface Frame {
  /** World width and height: the coordinate system `onFrame` draws in. */
  w: number
  h: number
  /** Seconds since the last frame (0 while paused), already multiplied by `speed`. */
  dt: number
  /** Total simulated seconds. */
  t: number
  running: boolean
  /** Frames drawn so far. */
  frame: number
}

export interface SimPointer {
  type: 'down' | 'move' | 'up'
  /** Position in world units. */
  x: number
  y: number
  /** True while a button, finger or pen is pressed. */
  down: boolean
  button: number
  shift: boolean
  id: number
}

interface Props {
  /** Logical size in world units. The canvas keeps this aspect ratio and scales to fit. */
  world: [number, number]
  running: boolean
  /** Called every animation frame with the context already scaled to world units. */
  onFrame: (ctx: CanvasRenderingContext2D, f: Frame) => void
  onPointer?: (p: SimPointer) => void
  /** Describes what the canvas shows, for screen readers. */
  label: string
  canvasRef?: RefObject<HTMLCanvasElement | null>
  /** Time multiplier applied to dt. */
  speed?: number
  cursor?: string
  className?: string
  /** Cap on devicePixelRatio for heavy per-pixel sims. */
  maxDpr?: number
}

/**
 * A canvas that runs a simulation loop. It sizes itself to its container at the
 * device pixel ratio, draws in fixed world units, skips frames while scrolled
 * out of view and maps pointer events into world coordinates.
 */
export default function Stage({ world, running, onFrame, onPointer, label, canvasRef, speed = 1, cursor, className = '', maxDpr = 2 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const props = useRef({ world, running, onFrame, onPointer, speed })
  props.current = { world, running, onFrame, onPointer, speed }

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (canvasRef) canvasRef.current = canvas
    let raf = 0
    let last = performance.now()
    let t = 0
    let n = 0
    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(canvas)
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      const bw = Math.max(1, Math.round(r.width * dpr))
      const bh = Math.max(1, Math.round(r.height * dpr))
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
    }
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    fit()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const real = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      if (!visible && n > 0) return
      const p = props.current
      const dt = p.running ? real * p.speed : 0
      t += dt
      const [W, H] = p.world
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      p.onFrame(ctx, { w: W, h: H, dt, t, running: p.running, frame: n++ })
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  function emit(type: SimPointer['type'], e: PointerEvent<HTMLCanvasElement>) {
    const handler = props.current.onPointer
    if (!handler) return
    const r = e.currentTarget.getBoundingClientRect()
    const [W, H] = props.current.world
    handler({
      type,
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
      down: type === 'up' ? false : e.buttons > 0 || type === 'down',
      button: e.button,
      shift: e.shiftKey,
      id: e.pointerId,
    })
  }

  const [W, H] = world
  return (
    <div className={`sim-stage ${className}`} style={{ '--ar': W / H } as CSSProperties}>
      <canvas
        ref={ref}
        role="img"
        aria-label={label}
        style={{ aspectRatio: `${W} / ${H}`, cursor: cursor ?? (onPointer ? 'crosshair' : undefined) }}
        onPointerDown={(e) => {
          if (!onPointer) return
          e.currentTarget.setPointerCapture(e.pointerId)
          emit('down', e)
        }}
        onPointerMove={(e) => emit('move', e)}
        onPointerUp={(e) => emit('up', e)}
        onPointerCancel={(e) => emit('up', e)}
        onContextMenu={(e) => onPointer && e.preventDefault()}
      />
    </div>
  )
}
