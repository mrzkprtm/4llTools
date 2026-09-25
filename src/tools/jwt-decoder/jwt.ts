import { decodeBase64 } from '../base64/codec'

export type JwtResult =
  | { ok: true; header: unknown; payload: Record<string, unknown>; signature: string }
  | { ok: false; error: string }

export function decodeJwt(token: string): JwtResult {
  const parts = token.trim().replace(/^Bearer\s+/i, '').split('.')
  if (parts.length !== 3) return { ok: false, error: 'A JWT has three parts separated by dots.' }
  try {
    const header = JSON.parse(decodeBase64(parts[0]))
    const payload = JSON.parse(decodeBase64(parts[1]))
    return { ok: true, header, payload, signature: parts[2] }
  } catch {
    return { ok: false, error: 'This token could not be decoded. Check that it was copied completely.' }
  }
}

/** Formats the standard time claims (exp, iat, nbf) as readable dates. */
export function timeClaims(payload: Record<string, unknown>, now = Date.now()): { claim: string; date: Date; expired?: boolean }[] {
  return (['iat', 'nbf', 'exp'] as const)
    .filter((c) => typeof payload[c] === 'number')
    .map((c) => {
      const date = new Date((payload[c] as number) * 1000)
      return c === 'exp' ? { claim: c, date, expired: date.getTime() < now } : { claim: c, date }
    })
}
