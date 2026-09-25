import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { groupByCategory } from './tools/grouping'
import { searchTools, tools } from './tools/registry'

export default function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const [query, setQuery] = useState('')
  const results = searchTools(tools, query)

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Tools">
      <input
        className="search"
        type="search"
        placeholder={`Search ${tools.length} tools…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search tools"
      />
      <nav>
        <NavLink to="/" end className="nav-link" onClick={onNavigate}>
          <span aria-hidden="true">🏠</span> All tools
        </NavLink>
        {results.length === 0 && <p className="muted nav-empty">No tool matches “{query}”.</p>}
        {groupByCategory(results).map(([category, list]) => (
          <div key={category} className="nav-group">
            <h2>{category}</h2>
            {list.map((t) => (
              <NavLink key={t.slug} to={`/${t.slug}`} className="nav-link" onClick={onNavigate}>
                <span aria-hidden="true">{t.icon}</span> {t.name}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
