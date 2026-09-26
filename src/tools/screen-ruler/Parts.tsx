import { useEffect, useRef, useState, type PointerEvent as RPE, type RefObject } from 'react'
import { angleAt, arcPath, dist, formatLength, MM_PER_IN, pxToMm, type Pt } from './logic'

export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** Pointer drag helper: calls `move` with coordinates in the SVG's CSS pixels. */
function dragger(svg: RefObject<SVGSVGElement | null>, move: (p: Pt) => void) {
  return {
    onPointerDown: (e: RPE<SVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove: (e: RPE<SVGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId) || !svg.current) return
      const r = svg.current.getBoundingClientRect()
      move({ x: e.clientX - r.left, y: e.clientY - r.top })
    },
  }
}

const H = 150

export function Ruler({ pxPerMm }: { pxPerMm: number }) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const w = useWidth(box)
  const [a, setA] = useState(20)
  const [b, setB] = useState(20 + pxPerMm * 50)
  const clampX = (x: number) => Math.max(0, Math.min(w, x))
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const mm = pxToMm(hi - lo, pxPerMm)
  const ticks = []
  for (let m = 0; m * pxPerMm <= w; m++) {
    const x = m * pxPerMm
    const len = m % 10 === 0 ? 22 : m % 5 === 0 ? 14 : 8
    ticks.push(<line key={`m${m}`} x1={x} x2={x} y1={0} y2={len} />)
    if (m % 10 === 0 && m) ticks.push(<text key={`t${m}`} x={x + 2} y={34} className="sr-num">{m / 10}</text>)
  }
  const pxPerIn = pxPerMm * MM_PER_IN
  for (let s = 0; (s * pxPerIn) / 16 <= w; s++) {
    const x = (s * pxPerIn) / 16
    const len = s % 16 === 0 ? 22 : s % 8 === 0 ? 16 : s % 4 === 0 ? 11 : s % 2 === 0 ? 7 : 4
    ticks.push(<line key={`i${s}`} x1={x} x2={x} y1={H} y2={H - len} />)
    if (s % 16 === 0 && s) ticks.push(<text key={`n${s}`} x={x + 2} y={H - 26} className="sr-num">{s / 16}</text>)
  }
  const handle = (x: number, set: (v: number) => void, label: string) => (
    <g className="sr-handle" {...dragger(svg, (p) => set(clampX(p.x)))} role="slider" aria-label={label} aria-valuenow={Math.round(pxToMm(x, pxPerMm))} tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); set(clampX(x + (e.key === 'ArrowLeft' ? -1 : 1) * pxPerMm * (e.shiftKey ? 10 : 1))) } }}>
      <rect x={x - 20} y={0} width={40} height={H} fill="transparent" />
      <line x1={x} x2={x} y1={0} y2={H} />
      <circle cx={x} cy={H / 2} r={11} />
    </g>
  )
  return (
    <div ref={box} className="sr-ruler-box">
      {w > 0 && (
        <svg ref={svg} width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="sr-ruler">
          <rect x={lo} y={0} width={hi - lo} height={H} className="sr-band" />
          <g className="sr-ticks">{ticks}</g>
          <text x={6} y={52} className="sr-unit">cm</text>
          <text x={6} y={H - 44} className="sr-unit">in</text>
          <text x={(lo + hi) / 2} y={H / 2 + 5} textAnchor="middle" className="sr-len">{formatLength(mm)}</text>
          {handle(a, setA, 'Start handle')}
          {handle(b, setB, 'End handle')}
        </svg>
      )}
      <p className="sr-readout"><b>{mm.toFixed(1)} mm</b> · {formatLength(mm)}</p>
    </div>
  )
}

export function Protractor({ pxPerMm }: { pxPerMm: number }) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const w = useWidth(box)
  const PH = 360
  const [pts, setPts] = useState<{ v: Pt; a: Pt; b: Pt } | null>(null)
  useEffect(() => {
    if (w && !pts) setPts({ v: { x: w * 0.25, y: 290 }, a: { x: w * 0.85, y: 290 }, b: { x: w * 0.62, y: 70 } })
  }, [w, pts])
  if (!w || !pts) return <div ref={box} className="sr-pro-box" style={{ height: PH }} />
  const { deg, start, sweep } = angleAt(pts.v, pts.a, pts.b)
  const r = Math.min(70, dist(pts.v, pts.a) * 0.6, dist(pts.v, pts.b) * 0.6)
  const mid = start + sweep / 2
  const clamp = (p: Pt) => ({ x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(PH, p.y)) })
  const knob = (k: 'v' | 'a' | 'b', label: string) => (
    <g className={`sr-handle ${k === 'v' ? 'vertex' : ''}`} {...dragger(svg, (p) => setPts((s) => (s ? { ...s, [k]: clamp(p) } : s)))} aria-label={label}>
      <circle cx={pts[k].x} cy={pts[k].y} r={22} fill="transparent" stroke="none" />
      <circle cx={pts[k].x} cy={pts[k].y} r={k === 'v' ? 9 : 12} />
    </g>
  )
  return (
    <div ref={box} className="sr-pro-box">
      <svg ref={svg} width={w} height={PH} viewBox={`0 0 ${w} ${PH}`} className="sr-pro">
        <path d={arcPath(pts.v, r, start, sweep)} className="sr-arc" />
        <line x1={pts.v.x} y1={pts.v.y} x2={pts.a.x} y2={pts.a.y} className="sr-arm" />
        <line x1={pts.v.x} y1={pts.v.y} x2={pts.b.x} y2={pts.b.y} className="sr-arm" />
        <text x={pts.v.x + Math.cos(mid) * (r + 30)} y={pts.v.y + Math.sin(mid) * (r + 30) + 6} textAnchor="middle" className="sr-deg">{deg.toFixed(1)}°</text>
        {knob('v', 'Vertex')}
        {knob('a', 'First arm')}
        {knob('b', 'Second arm')}
      </svg>
      <p className="sr-readout"><b>{deg.toFixed(1)}°</b> · reflex {(360 - deg).toFixed(1)}° · arms {(pxToMm(dist(pts.v, pts.a), pxPerMm) / 10).toFixed(1)} and {(pxToMm(dist(pts.v, pts.b), pxPerMm) / 10).toFixed(1)} cm</p>
    </div>
  )
}
