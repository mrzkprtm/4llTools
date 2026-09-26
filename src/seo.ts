import { categoryKey, groupByCategory } from './tools/grouping'
import type { Tool } from './tools/types'

/**
 * The public address of the site, used for canonical links, Open Graph tags,
 * structured data and the sitemap. Override it with the VITE_SITE_URL
 * environment variable at build time (for example in Cloudflare Pages).
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://4lltools.morizdigital.com').replace(/\/+$/, '')

export const SITE_NAME = '4llTools'

/** Search Console / Bing Webmaster / Yandex verification codes, set as environment variables at build time. */
const VERIFICATION: Record<string, string | undefined> = {
  'google-site-verification': import.meta.env.VITE_GOOGLE_SITE_VERIFICATION,
  'msvalidate.01': import.meta.env.VITE_BING_SITE_VERIFICATION,
  'yandex-verification': import.meta.env.VITE_YANDEX_VERIFICATION,
}

export interface PageMeta {
  title: string
  description: string
  /** Path part of the canonical URL, starting with a slash. */
  path: string
  /** Path of the 1200×630 share image. */
  image: string
  /** Set for pages that should stay out of search results. */
  noindex?: boolean
}

export interface Faq {
  q: string
  a: string
}

export const categoryPath = (category: string) => `/category/${categoryKey(category)}`

export const absoluteUrl = (path: string) => SITE_URL + path

export function homeMeta(tools: Tool[]): PageMeta {
  return {
    title: `${SITE_NAME}: ${tools.length} Free Online Tools That Run in Your Browser`,
    description: `${tools.length} free online tools: budget and health calculators, timers, music tools, simulations, QR, JSON, PDF and image tools. No sign-up, runs in your browser.`,
    path: '/',
    image: '/og-image.png',
  }
}

export const notFoundMeta: PageMeta = {
  title: `Page not found | ${SITE_NAME}`,
  description: 'This page does not exist. Browse all the free tools on 4llTools instead.',
  path: '/404',
  image: '/og-image.png',
  noindex: true,
}

export function toolMeta(tool: Tool): PageMeta {
  return {
    title: `${tool.name}: Free Online Tool | ${SITE_NAME}`,
    description: `${tool.description} Free, no sign-up, and it runs entirely in your browser.`,
    path: `/${tool.slug}`,
    image: `/og/${tool.slug}.png`,
  }
}

export function categoryMeta(category: string, inCategory: Tool[]): PageMeta {
  const names = inCategory.slice(0, 3).map((t) => t.name)
  const lead = `${inCategory.length} free ${category.toLowerCase()} tools that run in your browser`
  const tail = ' and more. No sign-up, nothing to install.'
  let description = `${lead}: ${names.join(', ')}${tail}`
  while (description.length > 160 && names.length > 1) {
    names.pop()
    description = `${lead}: ${names.join(', ')}${tail}`
  }
  return {
    title: `Free Online ${category} Tools | ${SITE_NAME}`,
    description,
    path: categoryPath(category),
    image: `/og/category-${categoryKey(category)}.png`,
  }
}

/**
 * Honest, generated questions and answers for a tool page. They are shown on
 * the page and repeated as FAQPage structured data.
 */
export function toolFaq(tool: Tool): Faq[] {
  return [
    {
      q: `Is the ${tool.name} free?`,
      a: 'Yes. It is completely free, with no sign-up, no account and no usage limits.',
    },
    tool.network
      ? { q: 'Does it send my data anywhere?', a: `${tool.network} Nothing is stored by 4llTools.` }
      : {
          q: 'Is my data uploaded to a server?',
          a: 'No. It runs entirely in your browser, so what you type or open never leaves your device.',
        },
    {
      q: 'Do I need to install anything?',
      a: 'No. It works in any modern browser on Windows, macOS, Linux, Android and iPhone. Just open the page.',
    },
  ]
}

/** Other tools worth linking from a tool page: same category first, then shared keywords. */
export function relatedTools(tool: Tool, all: Tool[], count = 6): Tool[] {
  const wordsOf = (t: Tool) => [...(t.keywords ?? []), ...t.name.toLowerCase().split(/\W+/)].filter((w) => w.length > 2)
  const words = new Set(wordsOf(tool))
  const score = (t: Tool) => (t.category === tool.category ? 10 : 0) + wordsOf(t).filter((w) => words.has(w)).length
  return all
    .filter((t) => t.slug !== tool.slug)
    .map((t) => ({ t, s: score(t) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name))
    .slice(0, count)
    .map(({ t }) => t)
}

const ctx = { '@context': 'https://schema.org' }
const WEBSITE_ID = `${SITE_URL}/#website`
const ORG_ID = `${SITE_URL}/#organization`

const breadcrumbs = (items: { name: string; path: string }[]) => ({
  ...ctx,
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
})

export function homeStructuredData(meta: PageMeta, tools: Tool[]): object[] {
  return [
    {
      ...ctx,
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icons/icon-512.png'), width: 512, height: 512 },
    },
    {
      ...ctx,
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: meta.description,
      inLanguage: 'en',
      publisher: { '@id': ORG_ID },
    },
    {
      ...ctx,
      '@type': 'ItemList',
      name: 'Tool categories',
      itemListElement: groupByCategory(tools).map(([category, list], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${category} tools (${list.length})`,
        url: absoluteUrl(categoryPath(category)),
      })),
    },
  ]
}

export function categoryStructuredData(meta: PageMeta, category: string, inCategory: Tool[]): object[] {
  return [
    {
      ...ctx,
      '@type': 'CollectionPage',
      name: `${category} tools`,
      description: meta.description,
      url: absoluteUrl(meta.path),
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: inCategory.length,
        itemListElement: inCategory.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: absoluteUrl(`/${t.slug}`),
        })),
      },
    },
    breadcrumbs([
      { name: SITE_NAME, path: '/' },
      { name: category, path: meta.path },
    ]),
  ]
}

export function toolStructuredData(meta: PageMeta, tool: Tool): object[] {
  return [
    {
      ...ctx,
      '@type': 'WebApplication',
      name: tool.name,
      description: tool.description,
      url: absoluteUrl(meta.path),
      image: absoluteUrl(meta.image),
      applicationCategory:
        tool.category === 'Developer' || tool.category === 'Network' ? 'DeveloperApplication' : 'UtilitiesApplication',
      applicationSubCategory: tool.category,
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript and a modern web browser.',
      inLanguage: 'en',
      isAccessibleForFree: true,
      ...(tool.keywords?.length ? { keywords: tool.keywords.join(', ') } : {}),
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': WEBSITE_ID },
    },
    breadcrumbs([
      { name: SITE_NAME, path: '/' },
      { name: tool.category, path: categoryPath(tool.category) },
      { name: tool.name, path: meta.path },
    ]),
    {
      ...ctx,
      '@type': 'FAQPage',
      mainEntity: toolFaq(tool).map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The <head> tags for a page, written into the prerendered HTML at build time. */
export function headTags(meta: PageMeta, data: object[] = []): string {
  const url = absoluteUrl(meta.path)
  const image = absoluteUrl(meta.image)
  const t = escapeHtml(meta.title)
  const d = escapeHtml(meta.description)
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    ...(meta.noindex
      ? [`<meta name="robots" content="noindex" />`]
      : [
          `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
          `<link rel="canonical" href="${url}" />`,
        ]),
    ...Object.entries(VERIFICATION)
      .filter(([, v]) => v)
      .map(([k, v]) => `<meta name="${k}" content="${escapeHtml(v!)}" />`),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...data.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`),
  ]
  return tags.join('\n    ')
}

/** Keeps the title, description, canonical link and social tags in sync during client-side navigation. */
export function applyPageMeta(meta: PageMeta) {
  document.title = meta.title
  const url = absoluteUrl(meta.path)
  const image = absoluteUrl(meta.image)
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', url)
  setMeta('property', 'og:image', image)
  setMeta('property', 'og:image:alt', meta.title)
  setMeta('name', 'twitter:title', meta.title)
  setMeta('name', 'twitter:description', meta.description)
  setMeta('name', 'twitter:image', image)
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical && !meta.noindex) canonical.href = url
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (el) el.content = content
}

/** llms.txt: a plain Markdown map of the site for AI assistants (https://llmstxt.org). */
export function llmsTxt(tools: Tool[]): string {
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${tools.length} free online tools that run entirely in the browser: QR codes, JSON and code formatters, PDF and image tools, password and security tools, converters, calculators, and interactive physics, math, science and algorithm simulations. No sign-up, and input stays on the user's device unless a tool is marked "network".`,
    '',
    `Every tool lives at ${SITE_URL}/<slug> and works without an account. Tools marked "network" send requests from the user's browser to the address they enter, never through 4llTools.`,
    '',
  ]
  for (const [category, list] of groupByCategory(tools)) {
    lines.push(`## ${category}`, '')
    for (const t of list) lines.push(`- [${t.name}](${absoluteUrl(`/${t.slug}`)}): ${t.description}${t.network ? ' (network)' : ''}`)
    lines.push('')
  }
  lines.push(
    '## Optional',
    '',
    `- [All tools in detail](${absoluteUrl('/llms-full.txt')}): every tool with its keywords and FAQ`,
    `- [Sitemap](${absoluteUrl('/sitemap.xml')})`,
    '',
  )
  return lines.join('\n')
}

/** llms-full.txt: every tool with its description, keywords and FAQ, in one file. */
export function llmsFullTxt(tools: Tool[]): string {
  const lines = [`# ${SITE_NAME}: all tools`, '', `> ${tools.length} free browser tools. Base URL: ${SITE_URL}`, '']
  for (const [category, list] of groupByCategory(tools)) {
    lines.push(`## ${category}`, '')
    for (const t of list) {
      lines.push(`### ${t.name}`, '', `URL: ${absoluteUrl(`/${t.slug}`)}`, '', t.description, '')
      if (t.keywords?.length) lines.push(`Also searched as: ${t.keywords.join(', ')}`, '')
      for (const f of toolFaq(t)) lines.push(`- **${f.q}** ${f.a}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
