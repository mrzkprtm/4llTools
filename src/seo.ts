import type { Tool } from './tools/types'

/**
 * The public address of the site, used for canonical links, Open Graph tags,
 * structured data and the sitemap. Override it with the VITE_SITE_URL
 * environment variable at build time (for example in Cloudflare Pages).
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://4lltools.morizdigital.com').replace(/\/+$/, '')

export const SITE_NAME = '4llTools'

export const OG_IMAGE = '/og-image.png'

export interface PageMeta {
  title: string
  description: string
  /** Path part of the canonical URL, starting with a slash. */
  path: string
  /** Set for pages that should stay out of search results. */
  noindex?: boolean
}

export const homeMeta: PageMeta = {
  title: `${SITE_NAME}: Free Online Tools That Run in Your Browser`,
  description:
    'Free online tools: QR code reader and generator, JSON formatter, password generator, unit converter and more. No sign-up, nothing leaves your device.',
  path: '/',
}

export const notFoundMeta: PageMeta = {
  title: `Page not found | ${SITE_NAME}`,
  description: 'This page does not exist. Browse all the free tools on 4llTools instead.',
  path: '/404',
  noindex: true,
}

export function toolMeta(tool: Tool): PageMeta {
  return {
    title: `${tool.name}: Free Online Tool | ${SITE_NAME}`,
    description: `${tool.description} Free, no sign-up, and it runs entirely in your browser.`,
    path: `/${tool.slug}`,
  }
}

export const absoluteUrl = (path: string) => SITE_URL + path

/** JSON-LD objects describing a page, for search engines. */
export function structuredData(meta: PageMeta, tool?: Tool, allTools: Tool[] = []): object[] {
  const home = absoluteUrl('/')
  if (!tool) {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: home,
        description: meta.description,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: allTools.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: absoluteUrl(`/${t.slug}`),
        })),
      },
    ]
  }
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: tool.name,
      description: tool.description,
      url: absoluteUrl(meta.path),
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (runs in the browser)',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: home },
        { '@type': 'ListItem', position: 2, name: tool.name, item: absoluteUrl(meta.path) },
      ],
    },
  ]
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The <head> tags for a page, written into the prerendered HTML at build time. */
export function headTags(meta: PageMeta, data: object[] = []): string {
  const url = absoluteUrl(meta.path)
  const image = absoluteUrl(OG_IMAGE)
  const t = escapeHtml(meta.title)
  const d = escapeHtml(meta.description)
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    meta.noindex ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...data.map(
      (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`,
    ),
  ]
  return tags.join('\n    ')
}

/** Keeps the title, description, canonical link and social tags in sync during client-side navigation. */
export function applyPageMeta(meta: PageMeta) {
  document.title = meta.title
  const url = absoluteUrl(meta.path)
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', url)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical && !meta.noindex) canonical.href = url
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (el) el.content = content
}
