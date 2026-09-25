import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { SearchIcon } from './components/Icons'
import ToolTile from './components/ToolTile'
import { groupByCategory } from './tools/grouping'
import { searchTools, tools } from './tools/registry'

interface Props {
  open: boolean
  onNavigate: () => void
  /** Called when the "/" shortcut needs the list visible (on phones it's a drawer). */
  onRequestOpen: () => void
}

export default function Sidebar({ open, onNavigate, onRequestOpen }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = searchTools(tools, query)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== '/' || e.metaKey || e.ctrlKey || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      e.preventDefault()
      onRequestOpen()
      // Wait a tick so the phone drawer is visible before focusing into it.
      setTimeout(() => inputRef.current?.focus(), 30)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRequestOpen])

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Tools">
      <div className="search-box">
        <SearchIcon />
        <input
          ref={inputRef}
          className="search"
          type="search"
          placeholder="Find a tool"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tools"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>
      <nav>
        <NavLink to="/" end className="nav-link nav-home" onClick={onNavigate}>
          Index of all tools
        </NavLink>
        {results.length === 0 && <p className="muted nav-empty">Nothing matches “{query}”.</p>}
        {groupByCategory(results).map(([category, list]) => (
          <div key={category} className="nav-group">
            <h2>
              {category} <span>{list.length}</span>
            </h2>
            {list.map((t) => (
              <NavLink key={t.slug} to={`/${t.slug}`} className="nav-link" onClick={onNavigate}>
                <ToolTile tool={t} size="sm" />
                <span className="nav-name">{t.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
