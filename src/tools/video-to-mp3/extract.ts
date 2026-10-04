export const QUALITIES = [96, 128, 192] as const

export function mp3Name(videoName: string): string {
  const dot = videoName.lastIndexOf('.')
  const base = dot > 0 ? videoName.slice(0, dot) : videoName
  return `${base || 'audio'}.mp3`
}

export function estimateMp3Size(durationSec: number, kbps: number): number {
  return Math.round(Math.max(0, durationSec) * kbps * 125) + 4096
}

export function qualityHint(kbps: number): string {
  if (kbps <= 96) return 'Compact — voice notes and podcasts'
  if (kbps <= 128) return 'Balanced — good for most uses'
  return 'High quality — music and archiving'
}
