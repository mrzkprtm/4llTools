import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), prerender()],
})

/**
 * After the client build, renders every route to its own HTML file with its
 * own title, description, canonical link, social tags and structured data,
 * then writes sitemap.xml and robots.txt. Each tool is served as
 * dist/<slug>.html, which Cloudflare Pages serves at /<slug>.
 */
function prerender(): Plugin {
  let outDir = 'dist'
  return {
    name: '4lltools-prerender',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const server = await createServer({
        configFile: false,
        plugins: [react()],
        server: { middlewareMode: true, hmr: false },
        appType: 'custom',
        logLevel: 'error',
      })
      try {
        const mod = (await server.ssrLoadModule('/src/entry-server.tsx')) as typeof import('./src/entry-server')
        const template = await readFile(resolve(outDir, 'index.html'), 'utf8')

        const page = (url: string, meta: import('./src/seo').PageMeta, data: object[]) =>
          template
            .replace(/<title>[\s\S]*?<\/title>\s*/, '')
            .replace(/<meta name="description"[^>]*>\s*/, '')
            .replace('</head>', `  ${mod.headTags(meta, data)}\n  </head>`)
            .replace('<div id="root"></div>', `<div id="root">${mod.render(url)}</div>`)

        await writeFile(resolve(outDir, 'index.html'), page('/', mod.homeMeta, mod.structuredData(mod.homeMeta, undefined, mod.tools)))
        await writeFile(resolve(outDir, '404.html'), page('/404', mod.notFoundMeta, []))
        for (const tool of mod.tools) {
          const meta = mod.toolMeta(tool)
          await writeFile(resolve(outDir, `${tool.slug}.html`), page(meta.path, meta, mod.structuredData(meta, tool)))
        }

        const urls = [mod.homeMeta.path, ...mod.tools.map((t) => `/${t.slug}`)]
        await writeFile(
          resolve(outDir, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls.map((u) => `  <url><loc>${mod.absoluteUrl(u)}</loc></url>`).join('\n') +
            `\n</urlset>\n`,
        )
        await writeFile(
          resolve(outDir, 'robots.txt'),
          `User-agent: *\nAllow: /\n\nSitemap: ${mod.absoluteUrl('/sitemap.xml')}\n`,
        )
      } finally {
        await server.close()
      }
    },
  }
}
