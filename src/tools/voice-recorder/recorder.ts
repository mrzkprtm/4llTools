/** Choose the best-supported recording format, most compressed first. */
export function pickMimeType(supported: (type: string) => boolean): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  for (const type of candidates) {
    if (supported(type)) return type
  }
  return ''
}

export function extForMime(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return 'm4a'
  return 'webm'
}
