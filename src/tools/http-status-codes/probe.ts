export type ProbeResult =
  | { kind: 'response'; status: number; statusText: string; ms: number; redirected: boolean; finalUrl: string; type: ResponseType }
  | { kind: 'opaque-redirect'; ms: number }
  | { kind: 'blocked'; ms: number; reachable: boolean | null; message: string }

export function normalizeUrl(input: string): string | null {
  let s = input.trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * Fetches a URL from the browser. A CORS failure and a network failure look the
 * same to JavaScript, so on failure it retries in no-cors mode: if that gets an
 * opaque response, the server is reachable and CORS is the likely blocker.
 */
export async function probe(url: string, method: 'GET' | 'HEAD', followRedirects: boolean, timeoutMs = 15000): Promise<ProbeResult> {
  const start = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method, mode: 'cors', redirect: followRedirects ? 'follow' : 'manual', cache: 'no-store', credentials: 'omit', signal: ctrl.signal })
    const ms = performance.now() - start
    if (res.type === 'opaqueredirect') return { kind: 'opaque-redirect', ms }
    return { kind: 'response', status: res.status, statusText: res.statusText, ms, redirected: res.redirected, finalUrl: res.url, type: res.type }
  } catch (err) {
    const ms = performance.now() - start
    const message = ctrl.signal.aborted ? `Timed out after ${timeoutMs / 1000} s.` : err instanceof Error ? err.message : String(err)
    if (ctrl.signal.aborted) return { kind: 'blocked', ms, reachable: null, message }
    let reachable: boolean | null = null
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' })
      reachable = true
    } catch {
      reachable = false
    }
    return { kind: 'blocked', ms, reachable, message }
  } finally {
    clearTimeout(timer)
  }
}
