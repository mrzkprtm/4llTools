import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Icon from './components/Icon'
import ToolTile from './components/ToolTile'
import { categoryKey, groupByCategory } from './tools/grouping'
import { searchTools, tools } from './tools/registry'

export default function Home() {
  const [query, setQuery] = useState('')
  const groups = groupByCategory(searchTools(tools, query))

  return (
    <>
      <section className="hero">
        <p className="eyebrow">A pocket workbench · {tools.length} tools</p>
        <h1>
          Small tools for everyday jobs. <em>Nothing you type leaves this tab.</em>
        </h1>
        <p className="hero-sub">
          Scan a QR code, tidy some JSON, work out a loan or resize a photo. Every tool runs in your browser, with no
          sign-up and no upload.
        </p>
        <div className="search-box search-box-lg">
          <Icon name="search" size={20} />
          <input
            className="search"
            type="search"
            placeholder="What do you need to do?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter tools"
          />
        </div>
      </section>

      {groups.length === 0 && <p className="muted">No tool matches “{query}”. Try a shorter word.</p>}

      {groups.map(([category, list]) => (
        <section key={category} className="category" data-cat={categoryKey(category)}>
          <h2>
            <span className="cat-dot" aria-hidden="true" />
            {category}
            <span className="cat-count">{list.length}</span>
          </h2>
          <div className="grid">
            {list.map((t, i) => (
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
        </section>
      ))}
    </>
  )
}
