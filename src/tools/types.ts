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
  /**
   * Set only when the tool sends requests over the network (for example a DNS
   * lookup). Says what is sent and where, and is shown in the tool's FAQ.
   * Tools without it promise that nothing leaves the device.
   */
  network?: string
}

export interface Tool extends ToolMeta {
  /** URL slug, taken from the tool's folder name. */
  slug: string
}
