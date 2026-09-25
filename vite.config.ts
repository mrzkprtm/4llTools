import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { renderShareCard, writeFavicons, type ShareCard } from './build/seo-assets.ts'

export default defineConfig({
  plugins: [react(), majesticons(), prerender()],
})

/**
 * After the client build, renders every route to its own HTML file with its
 * own title, description, canonical link, social tags, share image and
 * structured data, then writes the sitemap, robots.txt, llms.txt, the web
 * manifest and the favicon set. Each tool is served as dist/<slug>.html and
 * each category as dist/category/<key>.html, which Cloudflare Pages serves
 * without the .html. Everything comes from the tools' meta.ts files.
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
        const { tools } = mod
        const template = await readFile(resolve(outDir, 'index.html'), 'utf8')
        const out = (path: string) => resolve(outDir, path.replace(/^\//, ''))
        const write = async (path: string, data: string | Buffer) => {
          await mkdir(dirname(out(path)), { recursive: true })
          await writeFile(out(path), data)
        }

        const page = (meta: import('./src/seo').PageMeta, data: object[]) =>
          template
            .replace(/<title>[\s\S]*?<\/title>\s*/, '')
            .replace(/<meta name="description"[^>]*>\s*/, '')
            .replace('</head>', `  ${mod.headTags(meta, data)}\n  </head>`)
            .replace('<div id="root"></div>', `<div id="root">${mod.render(meta.path)}</div>`)

        const home = mod.homeMeta(tools)
        await write('/index.html', page(home, mod.homeStructuredData(home, tools)))
        await write('/404.html', page(mod.notFoundMeta, []))
        const cards: [string, ShareCard][] = [
          [home.image, { eyebrow: `A pocket workbench · ${tools.length} tools`, title: 'Free online tools that run in your browser', description: 'QR codes, JSON, PDFs, images, passwords, calculators and more. No sign-up.' }],
        ]

        const groups = mod.groupByCategory(tools)
        for (const [category, list] of groups) {
          const meta = mod.categoryMeta(category, list)
          await write(`${meta.path}.html`, page(meta, mod.categoryStructuredData(meta, category, list)))
          cards.push([meta.image, {
            eyebrow: `${list.length} free tools`, title: `${category} tools`,
            description: list.slice(0, 4).map((t) => t.name).join(' · '),
            categoryKey: mod.categoryKey(category), icon: list[0].icon,
          }])
        }
        for (const tool of tools) {
          const meta = mod.toolMeta(tool)
          await write(`${meta.path}.html`, page(meta, mod.toolStructuredData(meta, tool)))
          cards.push([meta.image, {
            eyebrow: tool.category, title: tool.name, description: tool.description,
            categoryKey: mod.categoryKey(tool.category), icon: tool.icon, symbol: tool.symbol,
          }])
        }

        // Share images render a few at a time; each takes a few tens of milliseconds.
        for (let i = 0; i < cards.length; i += 8)
          await Promise.all(cards.slice(i, i + 8).map(async ([path, card]) => write(path, await renderShareCard(card))))
        await writeFavicons(outDir)

        const urls = [home.path, ...groups.map(([c]) => mod.categoryPath(c)), ...tools.map((t) => `/${t.slug}`)]
        await write(
          '/sitemap.xml',
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
            urls.map((u) => `  <url><loc>${mod.absoluteUrl(u)}</loc></url>`).join('\n') +
            `\n</urlset>\n`,
        )
        await write('/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${mod.absoluteUrl('/sitemap.xml')}\n`)
        await write('/llms.txt', mod.llmsTxt(tools))
        await write('/llms-full.txt', mod.llmsFullTxt(tools))
        await write(
          '/site.webmanifest',
          JSON.stringify(
            {
              name: `${mod.SITE_NAME}: free online tools`,
              short_name: mod.SITE_NAME,
              description: home.description,
              start_url: '/',
              scope: '/',
              display: 'standalone',
              background_color: '#f3f0e8',
              theme_color: '#c2410c',
              icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            null,
            2,
          ),
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
