import type { Tool } from '../tools/types'
import { categoryKey } from '../tools/grouping'
import Icon from './Icon'

/** The tool's duotone icon on a tile tinted by category, with its short symbol in the corner. */
export default function ToolTile({ tool, size = 'md' }: { tool: Tool; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`tile tile-${size}`} data-cat={categoryKey(tool.category)} aria-hidden="true">
      {size !== 'sm' && <span className="tile-sym">{tool.symbol}</span>}
      <Icon name={tool.icon} size={size === 'sm' ? 18 : size === 'md' ? 28 : 44} />
    </span>
  )
}
