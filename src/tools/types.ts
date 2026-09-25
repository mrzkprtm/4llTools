export type Category = 'Scan & Code' | 'Text' | 'Developer' | 'Security' | 'Convert'

export interface ToolMeta {
  /** Short display name. */
  name: string
  /** One sentence shown on the home page card. */
  description: string
  category: Category
  /** Extra words that should match in search (Indonesian synonyms welcome). */
  keywords?: string[]
  /** A single emoji used as the card icon. */
  icon: string
}

export interface Tool extends ToolMeta {
  /** URL slug, taken from the tool's folder name. */
  slug: string
}
