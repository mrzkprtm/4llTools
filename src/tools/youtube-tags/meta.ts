import type { ToolMeta } from '../types'

export const meta: ToolMeta = {
  name: 'YouTube Tag Extractor',
  description: 'Reveal the hidden keyword tags behind any YouTube video and copy them for your own uploads.',
  category: 'Utility',
  keywords: ['youtube', 'tags', 'keywords', 'seo', 'meta', 'extract'],
  symbol: 'Tag',
  icon: 'tag',
  network: "Fetches the video's watch page HTML through the allorigins.win proxy to read its keyword meta tag.",
}
