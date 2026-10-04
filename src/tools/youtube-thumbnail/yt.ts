/** Extracts an 11-character video ID from any common YouTube URL shape. */
export function parseVideoId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      return /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/)
      if (m) return m[2]
    }
    return null
  } catch {
    return null
  }
}

export interface ThumbSize {
  key: string
  label: string
  width: number
  height: number
}

/** Largest first; not every video has every size, missing ones just 404. */
export const SIZES: ThumbSize[] = [
  { key: 'maxresdefault', label: '1280 × 720', width: 1280, height: 720 },
  { key: 'sddefault', label: '640 × 480', width: 640, height: 480 },
  { key: 'hqdefault', label: '480 × 360', width: 480, height: 360 },
  { key: 'mqdefault', label: '320 × 180', width: 320, height: 180 },
  { key: 'default', label: '120 × 90', width: 120, height: 90 },
]

export const thumbUrl = (id: string, key: string) => `https://i.ytimg.com/vi/${id}/${key}.jpg`
