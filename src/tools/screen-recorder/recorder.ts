/** MediaRecorder types in order of preference. Safari only records MP4. */
export const CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4;codecs=avc1',
  'video/mp4',
]

export function extFor(mime: string): 'webm' | 'mp4' | 'mkv' {
  if (/mp4/i.test(mime)) return 'mp4'
  if (/matroska|x-mkv/i.test(mime)) return 'mkv'
  return 'webm'
}

/** The first supported type, or '' to let the browser choose its default. */
export function pickMimeType(isSupported: (type: string) => boolean, withAudio = true): string {
  const list = withAudio ? CANDIDATES : CANDIDATES.filter((t) => !/opus|mp4a/.test(t))
  for (const t of list) {
    try {
      if (isSupported(t)) return t
    } catch {
      // Some browsers throw on unknown types.
    }
  }
  return ''
}

export interface CaptureSupport {
  ok: boolean
  reason?: string
}

/** Screen capture needs getDisplayMedia + MediaRecorder; most phones have neither. */
export function captureSupport(nav: { mediaDevices?: { getDisplayMedia?: unknown }; userAgent?: string } | undefined, hasRecorder: boolean, secure = true): CaptureSupport {
  if (!secure) return { ok: false, reason: 'Screen recording only works on a secure (https) page.' }
  if (!nav?.mediaDevices?.getDisplayMedia) {
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav?.userAgent ?? '')
    return { ok: false, reason: mobile ? 'Phones and tablets do not let websites record the screen. Use the built-in screen recorder in your phone’s quick settings, or open this page on a computer.' : 'This browser cannot capture the screen. Try a recent Chrome, Edge, Firefox or Safari on a computer.' }
  }
  if (!hasRecorder) return { ok: false, reason: 'This browser can capture the screen but cannot record it (MediaRecorder is missing).' }
  return { ok: true }
}

export function clock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function fileName(mime: string, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `screen-recording-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.${extFor(mime)}`
}

export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
