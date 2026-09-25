/** Formats milliseconds as h:mm:ss.cc (hours only when needed). */
export function formatDuration(ms: number, showCentis = true): string {
  const total = Math.max(0, Math.floor(ms))
  const h = Math.floor(total / 3600000)
  const m = Math.floor((total % 3600000) / 60000)
  const s = Math.floor((total % 60000) / 1000)
  const cs = Math.floor((total % 1000) / 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (h ? `${h}:${pad(m)}` : pad(m)) + `:${pad(s)}` + (showCentis ? `.${pad(cs)}` : '')
}
