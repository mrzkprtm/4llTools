import { Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Home from './Home'
import Sidebar from './Sidebar'
import { applyPageMeta, homeMeta, notFoundMeta, toolMeta } from './seo'
import { getTool, getToolComponent } from './tools/registry'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
    const tool = getTool(pathname.slice(1))
    applyPageMeta(pathname === '/' ? homeMeta : tool ? toolMeta(tool) : notFoundMeta)
  }, [pathname])

  return (
    <div className="app">
      <header className="topbar">
        <button
          type="button"
          className="menu-btn"
          aria-label={menuOpen ? 'Close tool list' : 'Open tool list'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <Link to="/" className="brand">
          <span className="brand-mark">4</span>llTools
        </Link>
      </header>
      <div className="layout">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:slug" element={<ToolPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function ToolPage() {
  const { slug = '' } = useParams()
  const tool = getTool(slug)
  const Component = getToolComponent(slug)

  if (!tool || !Component) {
    return (
      <section className="panel">
        <h1>Tool not found</h1>
        <p>
          <Link to="/">Back to all tools</Link>
        </p>
      </section>
    )
  }

  return (
    <section>
      <h1 className="tool-title">
        <span aria-hidden="true">{tool.icon}</span> {tool.name}
      </h1>
      <p className="muted">{tool.description}</p>
      <div className="panel">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Component />
        </Suspense>
      </div>
    </section>
  )
}
