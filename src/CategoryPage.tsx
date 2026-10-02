import { Link, useParams } from 'react-router-dom'
import ToolGrid from './components/ToolGrid'
import { categoryKey, groupByCategory } from './tools/grouping'
import { tools } from './tools/registry'

/** Finds a category by its URL key ("scan-code" → "Scan & Code"). */
export function findCategory(key: string): [string, typeof tools] | undefined {
  return groupByCategory(tools).find(([c]) => categoryKey(c) === key)
}

export default function CategoryPage() {
  const { category: key = '' } = useParams()
  const found = findCategory(key)
  if (!found) return null
  const [category, list] = found
  const others = groupByCategory(tools).filter(([c]) => c !== category)

  return (
    <section className="category category-page" data-cat={categoryKey(category)}>
      <p className="eyebrow">
        <Link to="/">All tools</Link> / {category}
      </p>
      <h1 className="tool-title">Free online {category.toLowerCase()} tools</h1>
      <p className="tool-desc">
        {list.length} {category.toLowerCase()} tools that run right in your browser. They're free, need no sign-up and
        work on any device.
      </p>
      <ToolGrid tools={list} />
      <nav className="more-cats" aria-label="Other categories">
        <h2>More categories</h2>
        <p>
          {others.map(([c, l], i) => (
            <span key={c}>
              {i > 0 && ' · '}
              <Link to={`/category/${categoryKey(c)}`}>
                {c} ({l.length})
              </Link>
            </span>
          ))}
        </p>
      </nav>
    </section>
  )
}
