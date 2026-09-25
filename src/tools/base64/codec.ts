export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

/** Decodes standard or URL-safe Base64. Throws if the input is not valid. */
export function decodeBase64(b64: string): string {
  let clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  while (clean.length % 4) clean += '='
  const binary = atob(clean)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
