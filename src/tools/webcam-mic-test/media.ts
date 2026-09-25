/** Root-mean-square level of time-domain samples in -1…1. */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/** Level (0–1 amplitude) to decibels relative to full scale, floored at `floor`. */
export function levelToDb(level: number, floor = -100): number {
  if (!(level > 0)) return floor
  return Math.max(floor, 20 * Math.log10(level))
}

/** Maps dBFS onto 0–1 for a meter, with `floor` dB as empty and 0 dB as full. */
export function dbToMeter(db: number, floor = -60): number {
  return Math.min(1, Math.max(0, (db - floor) / -floor))
}

export type Quality = 'hd' | 'fhd' | 'uhd' | 'vga'
export const QUALITIES: Record<Quality, { label: string; width: number; height: number }> = {
  vga: { label: '480p (640×480)', width: 640, height: 480 },
  hd: { label: '720p HD (1280×720)', width: 1280, height: 720 },
  fhd: { label: '1080p Full HD (1920×1080)', width: 1920, height: 1080 },
  uhd: { label: '4K (3840×2160)', width: 3840, height: 2160 },
}

/** Camera constraints: `ideal` sizes so the browser picks the closest the camera supports. */
export function videoConstraints(deviceId: string, quality: Quality, fps = 30): MediaStreamConstraints {
  const q = QUALITIES[quality]
  const video: MediaTrackConstraints = { width: { ideal: q.width }, height: { ideal: q.height }, frameRate: { ideal: fps } }
  if (deviceId) video.deviceId = { exact: deviceId }
  else video.facingMode = 'user'
  return { video, audio: false }
}

/** Microphone constraints; processing off shows the raw level, on shows what calls hear. */
export function audioConstraints(deviceId: string, processing: boolean): MediaStreamConstraints {
  const audio: MediaTrackConstraints = { echoCancellation: processing, noiseSuppression: processing, autoGainControl: processing }
  if (deviceId) audio.deviceId = { exact: deviceId }
  return { audio, video: false }
}

/** Turns getUserMedia errors into a sentence a person can act on. */
export function describeMediaError(err: unknown, what: 'camera' | 'microphone'): string {
  const name = (err as { name?: string })?.name ?? ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return `Access to the ${what} was blocked. Click the ${what} or lock icon in the address bar, allow it, then try again.`
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return `No ${what} was found. Check that it is plugged in and not disabled in your system settings.`
    case 'NotReadableError':
    case 'TrackStartError':
      return `The ${what} is busy or failed to start. Close other apps that may be using it (Zoom, Meet, Teams, OBS) and try again.`
    case 'OverconstrainedError':
      return `This ${what} cannot do the selected setting. Pick a lower quality or another device.`
    case 'SecurityError':
      return `The browser blocked the ${what} on this page. It needs a secure (https) connection.`
    case 'AbortError':
      return `Starting the ${what} was interrupted. Try again.`
    default:
      return `Could not start the ${what}${err instanceof Error && err.message ? `: ${err.message}` : '.'}`
  }
}

/** A short "1280×720 · 30 fps" description of a video track's actual settings. */
export function describeVideo(s: { width?: number; height?: number; frameRate?: number }): string {
  const parts: string[] = []
  if (s.width && s.height) parts.push(`${s.width}×${s.height}`)
  if (s.frameRate) parts.push(`${Math.round(s.frameRate)} fps`)
  return parts.join(' · ') || 'Unknown size'
}

/** Nearest common name for a resolution, like "720p" or "1080p". */
export function resolutionName(width = 0, height = 0): string {
  const h = Math.min(width, height)
  if (h >= 2160) return '4K'
  if (h >= 1440) return '1440p'
  if (h >= 1080) return '1080p'
  if (h >= 720) return '720p'
  if (h >= 480) return '480p'
  return h ? `${h}p` : ''
}
