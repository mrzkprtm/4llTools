export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

export function clampSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1
  return Math.min(4, Math.max(0.25, speed))
}

export function labelForSpeed(speed: number): string {
  return `${speed}×`
}

export function newDuration(duration: number, speed: number): number {
  return speed > 0 ? duration / speed : duration
}
