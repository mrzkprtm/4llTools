import type { Tool } from '../tools/types'
import { categoryKey, indexOf } from '../tools/grouping'

/** The tool's symbol set like an element on a periodic table: index number on top, symbol below. */
export default function ToolTile({ tool, size = 'md' }: { tool: Tool; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`tile tile-${size}`} data-cat={categoryKey(tool.category)} aria-hidden="true">
      {size !== 'sm' && <span className="tile-num">{indexOf(tool)}</span>}
      <span className="tile-sym">{tool.symbol}</span>
    </span>
  )
}
