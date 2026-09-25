import { existsSync, readFileSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), majesticons(), prerender()],
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
        plugins: [react(), majesticons()],
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

/**
 * Serves `virtual:majesticons`: only the Majesticons the site uses, as
 * { name: [solid inner SVG or null, line inner SVG] }. The Icon component
 * stacks the two into a duotone icon. Names come from `icon: '…'` in each
 * tool's meta.ts and from quoted names inside <Icon …> tags in .tsx files.
 */
function majesticons(): Plugin {
  const id = 'virtual:majesticons'
  let dir = ''
  let src = ''
  const inner = (file: string) => readFileSync(file, 'utf8').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')

  async function usedNames() {
    const required = new Set<string>()
    const optional = new Set<string>()
    for (const f of await readdir(src, { recursive: true })) {
      if (!/\.tsx?$/.test(f) || /\.test\./.test(f)) continue
      const code = await readFile(resolve(src, f), 'utf8')
      if (f.endsWith('meta.ts')) for (const m of code.matchAll(/\bicon:\s*'([\w-]+)'/g)) required.add(m[1])
      for (const tag of code.matchAll(/<Icon\b[^>]*>/g))
        for (const m of tag[0].matchAll(/['"]([a-z0-9]+(?:-[a-z0-9]+)*)['"]/g)) optional.add(m[1])
    }
    return { required, optional }
  }

  return {
    name: '4lltools-majesticons',
    configResolved(config) {
      dir = resolve(config.root, 'node_modules/majesticons')
      src = resolve(config.root, 'src')
    },
    resolveId: (source) => (source === id ? '\0' + id : undefined),
    async load(resolved) {
      if (resolved !== '\0' + id) return
      const { required, optional } = await usedNames()
      const icons: Record<string, [string | null, string]> = {}
      for (const name of [...required, ...optional].sort()) {
        const line = resolve(dir, `line/${name}-line.svg`)
        const solid = resolve(dir, `solid/${name}.svg`)
        if (!existsSync(line)) {
          if (required.has(name)) this.error(`Majesticons has no icon called "${name}". Pick one from https://majesticons.com (use the name without "-line").`)
          continue
        }
        icons[name] = [existsSync(solid) ? inner(solid) : null, inner(line)]
      }
      return `export default ${JSON.stringify(icons)}`
    },
    // New icon names only show up after the module is rebuilt, so rebuild it whenever a source file changes.
    handleHotUpdate({ server, file }) {
      if (!file.startsWith(src)) return
      const mod = server.moduleGraph.getModuleById('\0' + id)
      if (mod) server.moduleGraph.invalidateModule(mod)
    },
  }
}
