export interface MetaFields {
  title: string
  description: string
  url: string
  image: string
  imageAlt: string
  siteName: string
  twitterHandle: string
  twitterCard: 'summary_large_image' | 'summary'
  type: 'website' | 'article' | 'product' | 'profile' | 'video.other'
  locale: string
  themeColor: string
  author: string
  index: boolean
  follow: boolean
}

export const LIMITS = {
  title: { min: 30, max: 60 },
  description: { min: 70, max: 155 },
}

export type LengthState = 'empty' | 'short' | 'good' | 'long'

export function lengthState(text: string, { min, max }: { min: number; max: number }): LengthState {
  const n = [...text.trim()].length
  if (n === 0) return 'empty'
  if (n < min) return 'short'
  if (n > max) return 'long'
  return 'good'
}

/** Escapes text for an HTML attribute value or element text. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** "@name", "name" or a profile URL → "@name". */
export function normalizeHandle(h: string): string {
  const t = h.trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '')
  return t ? `@${t}` : ''
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^https?:\/\//, '').split(/[/?#]/)[0] || ''
  }
}

/** Google-style breadcrumb: "example.com › blog › post". */
export function breadcrumb(url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p))
    return [u.hostname.replace(/^www\./, ''), ...parts].join(' › ')
  } catch {
    return url
  }
}

/** Cuts text to `max` characters on a word boundary and adds an ellipsis. */
export function truncate(text: string, max: number): string {
  const t = text.trim()
  if ([...t].length <= max) return t
  const cut = [...t].slice(0, max).join('')
  const sp = cut.lastIndexOf(' ')
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

export function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(s.trim())
}

/** Builds the <head> tags. Empty fields are left out; every value is HTML-escaped. */
export function generateTags(f: MetaFields): string {
  const out: string[] = []
  const meta = (attr: 'name' | 'property', key: string, value: string) => {
    if (value.trim()) out.push(`<meta ${attr}="${key}" content="${escapeHtml(value.trim())}" />`)
  }
  const handle = normalizeHandle(f.twitterHandle)

  out.push('<!-- Primary meta tags -->')
  if (f.title.trim()) out.push(`<title>${escapeHtml(f.title.trim())}</title>`)
  meta('name', 'title', f.title)
  meta('name', 'description', f.description)
  meta('name', 'author', f.author)
  const robots = `${f.index ? 'index' : 'noindex'}, ${f.follow ? 'follow' : 'nofollow'}`
  meta('name', 'robots', robots)
  if (f.url.trim()) out.push(`<link rel="canonical" href="${escapeHtml(f.url.trim())}" />`)
  meta('name', 'theme-color', f.themeColor)
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1" />')

  out.push('', '<!-- Open Graph / Facebook / LinkedIn / WhatsApp -->')
  meta('property', 'og:type', f.type)
  meta('property', 'og:url', f.url)
  meta('property', 'og:title', f.title)
  meta('property', 'og:description', f.description)
  meta('property', 'og:image', f.image)
  meta('property', 'og:image:alt', f.image ? f.imageAlt : '')
  if (f.image.trim() && f.twitterCard === 'summary_large_image') {
    meta('property', 'og:image:width', '1200')
    meta('property', 'og:image:height', '630')
  }
  meta('property', 'og:site_name', f.siteName)
  meta('property', 'og:locale', f.locale)

  out.push('', '<!-- X (Twitter) -->')
  meta('name', 'twitter:card', f.twitterCard)
  meta('name', 'twitter:site', handle)
  meta('name', 'twitter:creator', handle)
  meta('name', 'twitter:title', f.title)
  meta('name', 'twitter:description', f.description)
  meta('name', 'twitter:image', f.image)
  meta('name', 'twitter:image:alt', f.image ? f.imageAlt : '')
  return out.join('\n')
}

/** Friendly problems worth fixing before publishing. */
export function checkFields(f: MetaFields): string[] {
  const issues: string[] = []
  if (!f.title.trim()) issues.push('Add a title: it is the headline in search results and link previews.')
  if (!f.description.trim()) issues.push('Add a description so search engines and chat apps show a summary.')
  if (f.url.trim() && !isAbsoluteUrl(f.url)) issues.push('The page URL should be absolute, like https://example.com/page.')
  if (f.image.trim() && !isAbsoluteUrl(f.image)) issues.push('og:image must be an absolute https:// URL, or most platforms ignore it.')
  if (!f.image.trim()) issues.push('Without an image, social cards show as plain text. 1200 × 630 px works everywhere.')
  if (f.image.trim() && !f.imageAlt.trim()) issues.push('Add image alt text for screen reader users.')
  if (!f.index) issues.push('noindex is on: search engines will not list this page.')
  return issues
}
