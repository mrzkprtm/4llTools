import { fmtTime } from '../../audio/fmt'

export interface CutRange {
  start: number
  end: number
}

export function clampRange(start: number, end: number, duration: number): CutRange {
  const d = Math.max(0, duration)
  const s = Math.min(Math.max(0, start), d)
  const e = Math.min(Math.max(s, end), d)
  return { start: s, end: e }
}

export function formatRange(start: number, end: number): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`
}

export function cutStats(duration: number, range: CutRange): { length: number; pct: number } {
  const length = Math.max(0, range.end - range.start)
  return { length, pct: duration > 0 ? (length / duration) * 100 : 0 }
}

export interface PeakBucket {
  min: number
  max: number
}

export function computePeaks(data: Float32Array, buckets: number): PeakBucket[] {
  if (buckets <= 0) return []
  const out: PeakBucket[] = []
  const per = data.length / buckets
  for (let i = 0; i < buckets; i++) {
    const from = Math.floor(i * per)
    const to = Math.max(from + 1, Math.floor((i + 1) * per))
    let min = 0
    let max = 0
    for (let j = from; j < to && j < data.length; j++) {
      const v = data[j]
      if (v < min) min = v
      if (v > max) max = v
    }
    out.push({ min, max })
  }
  return out
}
