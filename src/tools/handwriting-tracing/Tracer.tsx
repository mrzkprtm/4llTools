import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { tone } from '../../sim/audio'
import { circle, line, text } from '../../sim/draw'
import Stage from '../../sim/Stage'
import { alpha, useTheme } from '../../sim/theme'
import { BOX, GLYPHS } from './glyphs'
import { nearShare, partialPath, pathLength, samplePath, stars, traceScore, type Pt, type TraceScore } from './logic'

const W = 240
const H = 300
const S = 3
const OX = 30
const TOL = 7
const SPEED = 110 // glyph units per second in the demo

const wx = (x: number) => OX + x * S
const wy = (y: number) => y * S

function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(wx(x), wy(y)) : ctx.moveTo(wx(x), wy(y))))
  ctx.stroke()
}

function arrowHead(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, color: string, size = 11) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0])
  const [x, y] = [wx(to[0]), wy(to[1])]
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size)
  ctx.lineTo(x + Math.cos(a + 2.5) * size, y + Math.sin(a + 2.5) * size)
  ctx.lineTo(x + Math.cos(a - 2.5) * size, y + Math.sin(a - 2.5) * size)
  ctx.fill()
}

/** Traces one glyph: an animated stroke-order demo, then the visitor's ink scored against the guide. */
export default function Tracer({ ch }: { ch: string }) {
  const theme = useTheme()
  const strokes = GLYPHS[ch] ?? []
  const lens = strokes.map(pathLength)
  const total = lens.reduce((a, b) => a + b, 0)
  const [demo, setDemo] = useState(false)
  const [score, setScore] = useState<TraceScore | null>(null)
  const [inkCount, setInkCount] = useState(0)
  const progress = useRef(0)
  const ink = useRef<Pt[][]>([])
  const drawing = useRef(false)
  const guideSamples = useRef<Pt[]>([])

  useEffect(() => {
    ink.current = []
    setInkCount(0)
    setScore(null)
    guideSamples.current = strokes.flatMap((s) => samplePath(s, 2))
    progress.current = 0
    setDemo(!reducedMotion())
  }, [ch])

  const watch = () => {
    progress.current = 0
    setDemo(true)
  }
  const clear = () => {
    ink.current = []
    setInkCount(0)
    setScore(null)
  }

  const onFrame = (ctx: CanvasRenderingContext2D, f: { dt: number }) => {
    ctx.fillStyle = theme.surface
    ctx.fillRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // Handwriting lines.
    line(ctx, 0, wy(BOX.top), W, wy(BOX.top), alpha(theme.muted, 0.5), 1.5)
    line(ctx, 0, wy(BOX.mid), W, wy(BOX.mid), alpha(theme.muted, 0.5), 1.5, [8, 6])
    line(ctx, 0, wy(BOX.base), W, wy(BOX.base), alpha(theme.danger, 0.55), 2)
    line(ctx, 0, wy(BOX.desc), W, wy(BOX.desc), alpha(theme.muted, 0.35), 1, [2, 5])
    // Faint guide and its center line.
    ctx.strokeStyle = alpha(theme.muted, theme.dark ? 0.3 : 0.2)
    ctx.lineWidth = TOL * 2 * S * 0.75
    strokes.forEach((s) => poly(ctx, s))
    ctx.strokeStyle = alpha(theme.muted, 0.6)
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 7])
    strokes.forEach((s) => poly(ctx, s))
    ctx.setLineDash([])

    // Demo: strokes draw themselves in order.
    if (demo) {
      progress.current += f.dt * SPEED
      if (progress.current >= total + 25) {
        progress.current = total + 25
        setDemo(false)
      }
    }
    const shown = demo ? progress.current : 0
    let left = shown
    strokes.forEach((s, i) => {
      if (left <= 0) return
      const part = partialPath(s, left)
      ctx.strokeStyle = theme.accent
      ctx.lineWidth = 9
      poly(ctx, part)
      if (left < lens[i] && part.length > 1) {
        arrowHead(ctx, part[part.length - 2], part[part.length - 1], theme.accent, 13)
        const p = part[part.length - 1]
        circle(ctx, wx(p[0]), wy(p[1]), 5, theme.text)
      }
      left -= lens[i]
    })

    // Numbered start points with a direction arrow.
    strokes.forEach((s, i) => {
      const [x, y] = s[0]
      const ahead = partialPath(s, 9)
      if (ahead.length > 1) {
        ctx.strokeStyle = alpha(theme.accent, 0.8)
        ctx.lineWidth = 2
        poly(ctx, ahead)
        arrowHead(ctx, ahead[ahead.length - 2], ahead[ahead.length - 1], alpha(theme.accent, 0.8), 7)
      }
      circle(ctx, wx(x), wy(y), 10, theme.accent)
      text(ctx, String(i + 1), wx(x), wy(y) + 0.5, { color: '#fff', size: 12, align: 'center', baseline: 'middle', weight: 700 })
    })

    // The visitor's ink, green where it follows the guide once scored.
    ctx.lineWidth = 8
    for (const s of ink.current) {
      if (s.length === 1) {
        circle(ctx, wx(s[0][0]), wy(s[0][1]), 4, '#1c7ed6')
        continue
      }
      if (!score) {
        ctx.strokeStyle = '#1c7ed6'
        poly(ctx, s)
        continue
      }
      for (let i = 1; i < s.length; i++) {
        const on = nearShare([s[i]], guideSamples.current, TOL) > 0
        ctx.strokeStyle = on ? theme.ok : theme.danger
        poly(ctx, [s[i - 1], s[i]])
      }
    }
  }

  const onPointer = (p: { type: string; x: number; y: number; down: boolean }) => {
    const pt: Pt = [(p.x - OX) / S, p.y / S]
    if (p.type === 'down') {
      if (demo) setDemo(false)
      drawing.current = true
      if (score) setScore(null)
      ink.current.push([pt])
    } else if (p.type === 'move' && drawing.current && p.down) {
      const s = ink.current[ink.current.length - 1]
      const last = s[s.length - 1]
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 0.8) s.push(pt)
    } else if (p.type === 'up' && drawing.current) {
      drawing.current = false
      setInkCount(ink.current.length)
      if (ink.current.length >= strokes.length) {
        const sc = traceScore(strokes, ink.current, TOL)
        setScore(sc)
        if (sc.score >= 75) tone(660, 90)
      }
    }
  }

  const n = score ? stars(score.score) : 0
  return (
    <div className="hw-tracer">
      <Stage world={[W, H]} running={demo} onFrame={onFrame} onPointer={onPointer} label={`Trace the character ${ch}`} cursor="crosshair" className="hw-stage" />
      <div className="hw-panel">
        <div className="row hw-actions">
          <button type="button" className="btn primary" onClick={watch}>Watch strokes</button>
          <button type="button" className="btn" onClick={clear}>Clear</button>
          <button type="button" className="btn" disabled={!inkCount} onClick={() => setScore(traceScore(strokes, ink.current, TOL))}>Check</button>
        </div>
        <p className="muted hw-count">{strokes.length} stroke{strokes.length === 1 ? '' : 's'}. Start at 1 and follow the arrows.</p>
        {score && (
          <div className="hw-score settle-in">
            <div className="hw-big"><Roll>{score.score}</Roll>%</div>
            <div className="hw-stars" aria-label={`${n} of 3 stars`}>
              {[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''} style={{ animationDelay: `${i * 140}ms` }}>★</span>)}
            </div>
            <p className="muted">Covered {Math.round(score.coverage * 100)}% of the letter, {Math.round(score.precision * 100)}% of your ink on the path.</p>
            <p className="hw-msg">{n === 3 ? 'Beautiful!' : n === 2 ? 'Great tracing!' : n === 1 ? 'Good start, try again!' : 'Follow the gray path and try again.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
