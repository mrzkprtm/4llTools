import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './components/Icon'
import ToolGrid from './components/ToolGrid'
import { categoryPath } from './seo'
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
            <Link to={categoryPath(category)}>{category}</Link>
            <span className="cat-count">{list.length}</span>
          </h2>
          <ToolGrid tools={list} />
        </section>
      ))}
    </>
  )
}
