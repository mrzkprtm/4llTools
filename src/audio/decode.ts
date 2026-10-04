import { isBufferLike, type BufferLike } from './wav'

let ctx: AudioContext | null = null

function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Decode any browser-supported audio/video file to an AudioBuffer-shaped object. */
export async function decodeFile(file: File): Promise<BufferLike> {
  const bytes = await file.arrayBuffer()
  const decoded = await audioContext().decodeAudioData(bytes)
  if (!isBufferLike(decoded)) throw new Error('Decoded output is not usable.')
  return decoded
}

export function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Base name of a file without its extension. */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'audio'
}
