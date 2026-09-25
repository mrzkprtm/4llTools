import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'

export { tools } from './tools/registry'
export * from './seo'

/** Renders a route to HTML at build time, so crawlers see real content before JavaScript runs. */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  )
}
