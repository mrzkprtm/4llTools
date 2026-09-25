import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Tool } from '../tools/types'
import Icon from './Icon'
import ToolTile from './ToolTile'

/** The grid of tool cards used on the home page, category pages and "related tools". */
export default function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <div className="grid">
      {tools.map((t, i) => (
        <Link key={t.slug} to={`/${t.slug}`} className="card" style={{ '--i': i } as CSSProperties}>
          <ToolTile tool={t} />
          <span className="card-body">
            <span className="card-name">{t.name}</span>
            <span className="card-desc">{t.description}</span>
          </span>
          <Icon name="arrow-right" size={18} className="card-arrow" />
        </Link>
      ))}
    </div>
  )
}
