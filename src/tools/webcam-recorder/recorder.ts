export function pickVideoMimeType(supported: (mime: string) => boolean): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find((mime) => {
    try {
      return supported(mime)
    } catch {
      return false
    }
  }) ?? ''
}

export function extForVideoMime(mime: string): string {
  return mime.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
}

export function describeResolution(w: number, h: number): string {
  if (w <= 0 || h <= 0) return '—'
  return `${w} × ${h}`
}
