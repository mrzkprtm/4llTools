export function clampEvery(sec: number): number {
  if (!Number.isFinite(sec)) return 1
  return Math.min(60, Math.max(0.1, sec))
}

export function frameCount(duration: number, everySec: number): number {
  if (duration <= 0 || everySec <= 0) return 0
  return Math.max(1, Math.floor(duration / everySec) + 1)
}

export function frameTimes(duration: number, everySec: number, maxFrames = 60): number[] {
  const count = Math.min(frameCount(duration, everySec), maxFrames)
  const times: number[] = []
  for (let i = 0; i < count; i++) {
    times.push(Math.min(duration - 0.001, i * everySec))
  }
  return times
}

export function frameName(base: string, index: number, ext: string): string {
  const stem = base.replace(/\.[^.]+$/, '') || 'frame'
  return `${stem}-frame-${String(index + 1).padStart(4, '0')}.${ext}`
}
