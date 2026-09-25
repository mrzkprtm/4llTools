import { useState } from 'react'
import { Link } from 'react-router-dom'
import { searchTools, tools } from './tools/registry'
import type { Tool } from './tools/types'

export default function Home() {
  const [query, setQuery] = useState('')
  const results = searchTools(tools, query)

  const byCategory = new Map<string, Tool[]>()
  for (const t of results) byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t])
  const categories = [...byCategory.keys()].sort()

  return (
    <>
      <div className="hero">
        <h1>All your handy tools in one place</h1>
        <p className="muted">
          {tools.length} tools, all running in your browser. Nothing you type leaves your device.
        </p>
        <input
          className="search"
          type="search"
          placeholder="Search tools… (e.g. qr, json, password)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {results.length === 0 && <p className="muted">No tool matches “{query}”.</p>}

      {categories.map((cat) => (
        <section key={cat} className="category">
          <h2>{cat}</h2>
          <div className="grid">
            {byCategory.get(cat)!.map((t) => (
              <Link key={t.slug} to={`/${t.slug}`} className="card">
                <span className="card-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="card-name">{t.name}</span>
                <span className="card-desc">{t.description}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
