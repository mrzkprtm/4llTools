import { Link } from 'react-router-dom'
import { groupByCategory } from './tools/grouping'
import { tools } from './tools/registry'

export default function Home() {
  return (
    <>
      <div className="hero">
        <h1>All your handy tools in one place</h1>
        <p className="muted">
          {tools.length} tools, all running in your browser. Nothing you type leaves your device.
        </p>
      </div>

      {groupByCategory(tools).map(([category, list]) => (
        <section key={category} className="category">
          <h2>{category}</h2>
          <div className="grid">
            {list.map((t) => (
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
