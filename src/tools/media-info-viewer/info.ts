export type MediaKind = 'audio' | 'video' | 'image' | 'other'

export function guessKind(mime: string, name: string): MediaKind {
  const m = mime.toLowerCase()
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('image/')) return 'image'
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus'].includes(ext)) return 'audio'
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(ext)) return 'image'
  return 'other'
}

export function gcd(a: number, b: number): number {
  let x = Math.max(1, Math.round(Math.abs(a)))
  let y = Math.max(1, Math.round(Math.abs(b)))
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

export function aspectRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return '—'
  const g = gcd(w, h)
  return `${Math.round(w / g)}:${Math.round(h / g)}`
}

export function overallBitrateKbps(sizeBytes: number, durationSec: number): number {
  if (durationSec <= 0) return 0
  return Math.round((sizeBytes * 8) / durationSec / 1000)
}
