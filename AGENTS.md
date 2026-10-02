# 4llTools Agent Instructions

## Commands
- `npm run dev` — Start dev server at http://localhost:5173
- `npm test` — Run unit tests (vitest run)
- `npm run build` — Production build (`tsc -b && vite build`), outputs to `dist/`
- `npm run preview` — Preview production build

## Architecture
- **Vite 8 + React 19 + TypeScript 7** (strict mode, `noUnusedLocals/Parameters`)
- **Single-page app** with client-side routing via `react-router-dom`
- **Auto-discovery**: Tools live in `src/tools/<tool-name>/` — each folder = one tool, picked up automatically
- **Code splitting**: Each tool's `Tool.tsx` is lazy-loaded via `import.meta.glob` (see `src/tools/registry.ts`)
- **Prerendering**: Custom Vite plugin generates `dist/<slug>.html` per tool + `sitemap.xml`, `robots.txt` at build time
- **Majesticons**: Custom plugin bundles only used icons from `majesticons` package (duotone: solid + line layers)

## Tool Structure
Each tool folder contains:
- `meta.ts` — Exports `const meta: ToolMeta` (name, description, category, icon, symbol, optional keywords)
- `Tool.tsx` — Default-exported React component (lazy-loaded)
- `*.ts` — Pure logic functions (testable independently)
- `*.test.ts` — Colocated unit tests (vitest)

**Categories** (from `src/tools/types.ts`, each with a tile hue in `src/styles.css` and in `HUE` in `docs/readme/generate.mjs`):
- Everyday tools: `Scan & Code` | `Text` | `Developer` | `Security` | `Convert` | `Calculator` | `Design` | `Image` | `Network` | `Utility` | `Money` | `Health` | `Home` | `Productivity` | `Travel` | `Learning` | `Music` | `Work` | `Everyday`
- Simulations: `Physics` | `Math` | `Algorithms` | `Science` | `Art`

**Uniqueness and length rules** (enforced by `src/tools/more-tools.test.ts` and `src/seo.test.ts`): unique name and unique 1–3 character symbol across all tools; `"<name>: Free Online Tool | 4llTools"` ≤ 70 characters; description + `" Free, no sign-up, and it runs entirely in your browser."` between 70 and 160 characters. The count in `more-tools.test.ts` must match the number of tools.

**Icon**: Any Majesticons name (https://majesticons.com) without `-line` suffix. Rendered duotone via `Icon` component.

**Symbol**: 1–3 chars shown on tile (like element symbol).

**Slug**: Folder name becomes URL path (`/my-tool`).

## Adding a Tool
1. Create `src/tools/my-tool/meta.ts` with `ToolMeta` export
2. Create `src/tools/my-tool/Tool.tsx` (default export React component)
3. Put pure logic in separate `.ts` files, add tests
4. Tool auto-appears at `/my-tool` — no central registry to update
5. Run `node docs/readme/generate.mjs` to add it to the README catalog, banner and category chart

**Shared building blocks** — use these instead of writing your own:
- `src/sim/` — simulation kit: `Stage` (canvas + animation loop in world units), `controls.tsx` (`useRunning`, `SimLayout`, `PlayBar`, `Slider`, `Toggle`, `Choice`, `Select`, `Readout`, `Legend`, `Hint`), `draw.ts`, `math.ts`, `theme.ts` (`useTheme` for light/dark canvas colors), `audio.ts`
- `src/motion/` — `springs.ts` (`reducedMotion()`, spring easings), `Roll` (odometer digits, **default export**), `PillRow`, `useFlip`, `Check`
- `src/components/` — `Icon`, `CopyButton`, `ToolTile`

**Rules every tool follows**
- Runs in the browser only; if a tool must use the network, set `network` in `meta.ts` (it is shown in the tool's FAQ and on the privacy page)
- `localStorage` keys are `4lltools:<slug>`, every access is wrapped in try/catch, never at module top level; list the tool on the privacy page (`src/legal/LegalPages.tsx`, "Things saved in your browser")
- Camera, microphone, location, orientation, notifications, fullscreen and wake lock are requested only after a click, fail gracefully, and are listed on the privacy page
- Respect `prefers-reduced-motion` (`reducedMotion()` / `useRunning()`), support light and dark mode, work at 360 px wide with touch
- US English in UI text

## Registry & Routing
- `src/tools/registry.ts` uses `import.meta.glob` to discover all `meta.ts` and `Tool.tsx` files
- `tools` array sorted alphabetically by name
- `getTool(slug)` / `getToolComponent(slug)` for runtime lookup
- `searchTools(list, query)` filters by name, description, category, keywords
- Routes: `/` (Home), `/category/:key` (category pages), `/about`, `/privacy`, `/terms`, `/licenses` (legal pages in `src/legal/`) and `/:slug` (ToolPage with Suspense boundary)

## Testing
- `vitest run` — runs all `*.test.ts` files
- Tests colocated with source (e.g., `hmac-generator.test.ts`) or grouped (`sims-*.test.ts` for simulations, `everyday-*.test.ts` for everyday tools)
- Some tools have multiple test files (e.g., `css-tailwind.test.ts`, `more-tools.test.ts`)
- No integration/e2e tests — pure logic tested in isolation

## Deployment
- **Cloudflare Pages**: Build command `npm run build`, output `dist/`, Node 22 (`.node-version`)
- **Vercel**: Auto-detects Vite, uses `vercel.json` for clean URLs (`/slug` serves `dist/slug.html`)
- `public/_headers` adds `X-Robots-Tag: noindex` on `*.pages.dev` to keep previews out of search
- Prerendered HTML means search engines see content without JS

## CI (`.github/workflows/ci.yml`)
- Runs on push to `main` and PRs
- Steps: `npm ci` → `npm test` → `npm run build`
- Node 22 (via `actions/setup-node@v4`)

## SEO (`src/seo.ts`)
- `SITE_URL` from `VITE_SITE_URL` env (default: `https://4lltools.morizdigital.com`)
- Per-page meta: title, description, canonical, OG/Twitter tags
- JSON-LD structured data: `WebSite` + `ItemList` (home), `WebApplication` + `BreadcrumbList` (tools)
- `headTags(meta, data)` generates `<head>` content for prerendering
- `applyPageMeta(meta)` keeps meta in sync during client-side navigation

## Prerendering (`vite.config.ts`)
- Custom `prerender()` plugin runs after client build
- Spins up Vite SSR server with `entry-server.tsx`
- Renders each route (`/`, `/404`, `/<slug>`) to static HTML
- Injects `headTags` and SSR-rendered markup into template
- Generates `sitemap.xml` and `robots.txt`

## Majesticons Plugin (`vite.config.ts`)
- Scans all `.tsx`/`.ts` (except `*.test.*`) for icon references
- Required: `icon: 'name'` in `meta.ts`
- Optional: `<Icon name="name" />` in components
- Builds `virtual:majesticons` module with only used icons
- Hot-reloads when source files change

## Key Files
- `vite.config.ts` — custom prerender & majesticons plugins
- `src/tools/types.ts` — category list, ToolMeta/Tool interfaces
- `src/tools/registry.ts` — auto-discovery, lazy loading, search
- `src/entry-server.tsx` — SSR rendering for prerender
- `src/seo.ts` — page metadata, structured data, sitemap, head tags
- `src/App.tsx` — routing, layout, SEO sync on navigation
- `src/components/Icon.tsx` — duotone Majesticons renderer
- `public/_headers` — noindex for `*.pages.dev`

## TypeScript Config
- Target: ES2022, Module: ESNext, Bundler resolution
- JSX: react-jsx
- Strict: true, noUnusedLocals/Parameters: true
- No emit (Vite handles), isolatedModules: true
- Types: `vite/client`

## Environment
- Node 22 required (`.node-version`, CI, Cloudflare)
- No `.env` needed locally (defaults in `src/seo.ts`)
- Override site URL with `VITE_SITE_URL` at build time

## Tool list

The full, always-current list of tools lives in the README catalog, generated from every `meta.ts` by `node docs/readme/generate.mjs`.
