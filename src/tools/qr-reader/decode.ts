import jsQR from 'jsqr'

/** Largest side, in pixels, that frames are scaled down to before decoding. */
const MAX_SIDE = 800

/** Where a code was found, as fractions (0–1) of the source's width and height. */
export interface CodeBox { left: number; top: number; right: number; bottom: number }

/** Draws a video frame or image onto the canvas and looks for a QR code in it. */
export function decodeFrom(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
  thorough = false,
): string | null {
  return decodeWithBox(source, width, height, canvas, thorough)?.data ?? null
}

/** Like decodeFrom, but also returns the box around the code so the UI can lock onto it. */
export function decodeWithBox(
  source: CanvasImageSource,
  width: number,
  height: number,
  canvas: HTMLCanvasElement,
  thorough = false,
): { data: string; box: CodeBox } | null {
  if (!width || !height) return null
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const code = jsQR(data, w, h, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' })
  if (!code) return null
  const { topLeftCorner: a, topRightCorner: b, bottomLeftCorner: c, bottomRightCorner: d } = code.location
  const xs = [a.x, b.x, c.x, d.x]
  const ys = [a.y, b.y, c.y, d.y]
  return { data: code.data, box: { left: Math.min(...xs) / w, top: Math.min(...ys) / h, right: Math.max(...xs) / w, bottom: Math.max(...ys) / h } }
}

export function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in your browser settings and try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. You can still read a QR code from an image below.'
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.'
  return 'Could not start the camera. You can still read a QR code from an image below.'
}
