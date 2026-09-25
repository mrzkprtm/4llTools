import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { CloseIcon, MenuIcon } from './components/Icons'
import ToolTile from './components/ToolTile'
import Home from './Home'
import Sidebar from './Sidebar'
import { getTool, getToolComponent, tools } from './tools/registry'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const openMenu = useCallback(() => setMenuOpen(true), [])

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

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
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
        <Link to="/" className="brand" aria-label="4llTools home">
          <span className="brand-4">4</span>ll<span className="brand-tools">Tools</span>
        </Link>
        <span className="topbar-meta">
          {tools.length} tools · everything runs in your browser
        </span>
      </header>
      <div className="layout">
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} onRequestOpen={openMenu} />
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

  useEffect(() => {
    document.title = tool ? `${tool.name} · 4llTools` : 'Not found · 4llTools'
    return () => {
      document.title = '4llTools'
    }
  }, [tool])

  if (!tool || !Component) {
    return (
      <section className="not-found">
        <p className="eyebrow">404</p>
        <h1>There's no tool called “{slug}”.</h1>
        <p>
          <Link to="/" className="btn primary">
            Browse all tools
          </Link>
        </p>
      </section>
    )
  }

  return (
    <article className="tool-page">
      <header className="tool-head">
        <ToolTile tool={tool} size="lg" />
        <div>
          <p className="eyebrow">
            <Link to="/">All tools</Link> / {tool.category}
          </p>
          <h1 className="tool-title">{tool.name}</h1>
          <p className="tool-desc">{tool.description}</p>
        </div>
      </header>
      <div className="panel">
        <Suspense fallback={<p className="muted loading">Loading {tool.name}…</p>}>
          <Component />
        </Suspense>
      </div>
    </article>
  )
}
