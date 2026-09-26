export type Category =
  | 'Scan & Code'
  | 'Text'
  | 'Developer'
  | 'Security'
  | 'Convert'
  | 'Calculator'
  | 'Design'
  | 'Image'
  | 'Network'
  | 'Utility'
  | 'Money'
  | 'Health'
  | 'Home'
  | 'Productivity'
  | 'Travel'
  | 'Learning'
  | 'Music'
  | 'Work'
  | 'Everyday'

export interface ToolMeta {
  /** Short display name. */
  name: string
  /** One sentence shown on the home page card. */
  description: string
  category: Category
  /** Extra words that should match in search (Indonesian synonyms welcome). */
  keywords?: string[]
  /** 1–3 characters shown on the tool's tile, like an element symbol ("Qr", "{}"). */
  symbol: string
  /** A Majesticons name (https://majesticons.com), without "-line", drawn as a duotone icon. */
  icon: string
}

export interface Tool extends ToolMeta {
  /** URL slug, taken from the tool's folder name. */
  slug: string
}
