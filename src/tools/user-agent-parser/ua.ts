import { UAParser } from 'ua-parser-js'

export type BotKind = 'search' | 'ai' | 'social' | 'monitor' | 'seo' | 'cli' | 'library' | 'generic'

export interface BotInfo {
  name: string
  kind: BotKind
  version?: string
}

/** Known automated clients, most specific first. The first capture group (if any) is the version. */
const BOTS: [RegExp, string, BotKind][] = [
  [/GPTBot\/?([\d.]*)/i, 'GPTBot (OpenAI)', 'ai'],
  [/ChatGPT-User\/?([\d.]*)/i, 'ChatGPT-User (OpenAI)', 'ai'],
  [/OAI-SearchBot\/?([\d.]*)/i, 'OAI-SearchBot (OpenAI)', 'ai'],
  [/ClaudeBot\/?([\d.]*)/i, 'ClaudeBot (Anthropic)', 'ai'],
  [/Claude-(?:User|SearchBot|Web)\/?([\d.]*)/i, 'Claude (Anthropic)', 'ai'],
  [/anthropic-ai/i, 'anthropic-ai', 'ai'],
  [/PerplexityBot\/?([\d.]*)/i, 'PerplexityBot', 'ai'],
  [/Perplexity-User\/?([\d.]*)/i, 'Perplexity-User', 'ai'],
  [/CCBot\/?([\d.]*)/i, 'CCBot (Common Crawl)', 'ai'],
  [/Google-Extended/i, 'Google-Extended', 'ai'],
  [/Bytespider/i, 'Bytespider (ByteDance)', 'ai'],
  [/Amazonbot\/?([\d.]*)/i, 'Amazonbot', 'ai'],
  [/Applebot-Extended/i, 'Applebot-Extended', 'ai'],
  [/meta-externalagent\/?([\d.]*)/i, 'Meta-ExternalAgent', 'ai'],
  [/cohere-ai/i, 'cohere-ai', 'ai'],
  [/Diffbot\/?([\d.]*)/i, 'Diffbot', 'ai'],
  [/Googlebot(?:-Image|-Video|-News)?\/?([\d.]*)/i, 'Googlebot', 'search'],
  [/Google-InspectionTool\/?([\d.]*)/i, 'Google-InspectionTool', 'search'],
  [/AdsBot-Google/i, 'AdsBot-Google', 'search'],
  [/Mediapartners-Google/i, 'Mediapartners-Google', 'search'],
  [/bingbot\/?([\d.]*)/i, 'Bingbot', 'search'],
  [/BingPreview/i, 'BingPreview', 'search'],
  [/DuckDuckBot\/?([\d.]*)/i, 'DuckDuckBot', 'search'],
  [/YandexBot\/?([\d.]*)/i, 'YandexBot', 'search'],
  [/Baiduspider\/?([\d.]*)/i, 'Baiduspider', 'search'],
  [/Applebot\/?([\d.]*)/i, 'Applebot', 'search'],
  [/Slurp/i, 'Yahoo Slurp', 'search'],
  [/SeznamBot/i, 'SeznamBot', 'search'],
  [/facebookexternalhit\/?([\d.]*)/i, 'Facebook link preview', 'social'],
  [/Twitterbot\/?([\d.]*)/i, 'Twitterbot', 'social'],
  [/LinkedInBot\/?([\d.]*)/i, 'LinkedInBot', 'social'],
  [/Slackbot/i, 'Slackbot', 'social'],
  [/Discordbot\/?([\d.]*)/i, 'Discordbot', 'social'],
  [/TelegramBot/i, 'TelegramBot', 'social'],
  [/WhatsApp\/?([\d.]*)/i, 'WhatsApp link preview', 'social'],
  [/Pinterest(?:bot)?\/?([\d.]*)/i, 'Pinterestbot', 'social'],
  [/AhrefsBot\/?([\d.]*)/i, 'AhrefsBot', 'seo'],
  [/SemrushBot\/?([\d.~]*)/i, 'SemrushBot', 'seo'],
  [/MJ12bot/i, 'MJ12bot (Majestic)', 'seo'],
  [/DotBot/i, 'DotBot (Moz)', 'seo'],
  [/UptimeRobot\/?([\d.]*)/i, 'UptimeRobot', 'monitor'],
  [/Pingdom/i, 'Pingdom', 'monitor'],
  [/HeadlessChrome\/?([\d.]*)/i, 'Headless Chrome', 'generic'],
  [/^curl\/([\d.]+)/i, 'curl', 'cli'],
  [/^Wget\/([\d.]+)/i, 'Wget', 'cli'],
  [/^HTTPie\/([\d.]+)/i, 'HTTPie', 'cli'],
  [/PowerShell\/([\d.]+)/i, 'PowerShell', 'cli'],
  [/python-requests\/([\d.]+)/i, 'Python requests', 'library'],
  [/python-urllib\d?\/?([\d.]*)/i, 'Python urllib', 'library'],
  [/python-httpx\/([\d.]+)/i, 'Python httpx', 'library'],
  [/aiohttp\/([\d.]+)/i, 'Python aiohttp', 'library'],
  [/Go-http-client\/([\d.]+)/i, 'Go http client', 'library'],
  [/okhttp\/([\d.]+)/i, 'OkHttp', 'library'],
  [/axios\/([\d.]+)/i, 'axios', 'library'],
  [/node-fetch\/?([\d.]*)/i, 'node-fetch', 'library'],
  [/^undici/i, 'Node.js fetch (undici)', 'library'],
  [/Java\/([\d._]+)/, 'Java HTTP client', 'library'],
  [/libwww-perl\/([\d.]+)/i, 'libwww-perl', 'library'],
  [/Scrapy\/([\d.]+)/i, 'Scrapy', 'library'],
  [/PostmanRuntime\/([\d.]+)/i, 'Postman', 'library'],
  [/insomnia\/([\d.]+)/i, 'Insomnia', 'library'],
]

const GENERIC = /bot\b|crawler|spider|scraper|fetcher|\+https?:\/\//i

/** Recognizes crawlers, AI bots, CLI tools and HTTP libraries from their user agent. */
export function detectBot(ua: string): BotInfo | null {
  const s = ua.trim()
  if (!s) return null
  for (const [re, name, kind] of BOTS) {
    const m = s.match(re)
    if (m) return { name, kind, version: m[1] || undefined }
  }
  if (GENERIC.test(s)) {
    const m = s.match(/([A-Za-z][\w.-]*(?:bot|crawler|spider))\/?([\d.]*)/i)
    return { name: m?.[1] ?? 'Unknown bot', kind: 'generic', version: m?.[2] || undefined }
  }
  return null
}

const KIND_TEXT: Record<BotKind, string> = {
  search: 'a search engine crawler',
  ai: 'an AI crawler or AI assistant fetcher',
  social: 'a link-preview bot for a social or chat app',
  monitor: 'an uptime monitor',
  seo: 'an SEO crawler',
  cli: 'a command-line tool',
  library: 'an HTTP library in a script or app',
  generic: 'a bot or automated client',
}

export interface UaSummary {
  ua: string
  browser: { name?: string; version?: string; major?: string; type?: string }
  engine: { name?: string; version?: string }
  os: { name?: string; version?: string }
  device: { type?: string; vendor?: string; model?: string }
  cpu: { architecture?: string }
  bot: BotInfo | null
}

function plain<T extends object>(o: T): T {
  // Keep only non-empty string fields so empty ones don't show up.
  return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'string' && v)) as T
}

export function parseUa(ua: string): UaSummary {
  const r = new UAParser(ua.trim()).getResult()
  const bot = detectBot(r.ua)
  return {
    ua: r.ua,
    browser: bot ? { name: bot.name, version: bot.version, major: bot.version?.split('.')[0], type: bot.kind } : plain(r.browser),
    engine: plain(r.engine),
    os: plain(r.os),
    device: plain(r.device),
    cpu: plain(r.cpu),
    bot,
  }
}

/** A device type for display; desktop browsers report no type at all. */
export function deviceKind(s: UaSummary): string {
  if (s.bot) return 'Bot / automated client'
  const t = s.device.type
  if (!t) return s.os.name ? 'Desktop (or unknown)' : 'Unknown'
  return t[0].toUpperCase() + t.slice(1)
}

export function joinName(name?: string, version?: string): string {
  return [name, version].filter(Boolean).join(' ') || 'Unknown'
}

/** One-line human summary, like "Chrome 126 on Android 14 (Samsung SM-S918B, mobile)". */
export function describe(s: UaSummary): string {
  if (!s.ua) return 'Empty user agent.'
  const browser = joinName(s.browser.name, s.browser.major ?? s.browser.version)
  if (s.bot) return `${browser}: ${KIND_TEXT[s.bot.kind]}, not a person in a browser.`
  const os = s.os.name ? ` on ${joinName(s.os.name, s.os.version)}` : ''
  const dev = [s.device.vendor, s.device.model].filter(Boolean).join(' ')
  const extra = [dev, s.device.type].filter(Boolean).join(', ')
  return `${browser}${os}${extra ? ` (${extra})` : ''}`
}

export const SAMPLES: { label: string; ua: string }[] = [
  { label: 'iPhone Safari', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { label: 'Android Chrome', ua: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36' },
  { label: 'Windows Edge', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87' },
  { label: 'macOS Firefox', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0' },
  { label: 'iPad', ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { label: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'GPTBot', ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot' },
  { label: 'curl', ua: 'curl/8.7.1' },
  { label: 'Python requests', ua: 'python-requests/2.32.3' },
]
