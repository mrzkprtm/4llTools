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

**Categories** (from `src/tools/types.ts`):
`Scan & Code` | `Text` | `Developer` | `Security` | `Convert` | `Calculator` | `Design` | `Image` | `Network` | `Utility`

**Icon**: Any Majesticons name (https://majesticons.com) without `-line` suffix. Rendered duotone via `Icon` component.

**Symbol**: 1–3 chars shown on tile (like element symbol).

**Slug**: Folder name becomes URL path (`/my-tool`).

## Adding a Tool
1. Create `src/tools/my-tool/meta.ts` with `ToolMeta` export
2. Create `src/tools/my-tool/Tool.tsx` (default export React component)
3. Put pure logic in separate `.ts` files, add tests
4. Tool auto-appears at `/my-tool` — no central registry to update

## Registry & Routing
- `src/tools/registry.ts` uses `import.meta.glob` to discover all `meta.ts` and `Tool.tsx` files
- `tools` array sorted alphabetically by name
- `getTool(slug)` / `getToolComponent(slug)` for runtime lookup
- `searchTools(list, query)` filters by name, description, category, keywords
- Routes: `/` (Home) and `/:slug` (ToolPage with Suspense boundary)

## Testing
- `vitest run` — runs all `*.test.ts` files
- Tests colocated with source (e.g., `hmac-generator.test.ts`)
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

## All Tools (57)

### Scan & Code
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| QR Code Generator | qr-generator | Turn any text or link into a QR code you can download | Qg | qr-code |
| QR Code Reader | qr-reader | Scan a QR code with your camera, or read one from an image | Qr | camera |

### Text
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Case Converter | case-converter | Switch text between UPPER, lower, Title, camelCase, snake_case and more | Aa | font-size |
| Line Tools | line-tools | Sort, dedupe, reverse, trim or shuffle lines of text | Ln | list-box |
| Lorem Ipsum Generator | lorem-ipsum | Generate placeholder paragraphs, sentences or words | Li | paragraph |
| Markdown Preview | markdown-preview | Write Markdown and see it rendered live | Md | article |
| Slug Generator | slug-generator | Turn a title into a clean URL slug | Sl | link |
| Text Diff | text-diff | Compare two texts and see what was added or removed | Df | git-compare |
| Word Counter | word-counter | Count words, characters, sentences and reading time | Wc | text |

### Developer
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Base64 Encode / Decode | base64 | Convert text to Base64 and back, with full Unicode support | B64 | code-block |
| CSS ↔ Tailwind Converter | css-tailwind | Turn plain CSS into Tailwind utility classes, or Tailwind classes back into CSS | C2 | code-block |
| HTML Entities | html-entities | Escape text for HTML, or turn entities back into text | &; | code |
| JWT Decoder | jwt-decoder | Read the header and payload of a JSON Web Token | Jw | ticket |
| JSON Formatter | json-formatter | Prettify, minify and validate JSON | {} | curly-braces |
| Minifier / Beautifier (JS & CSS) | minifier | Minify JavaScript and CSS for faster pages, or beautify minified code to read it | Se | minimize |
| Mock Data Generator | mock-data | Generate fake names, emails, addresses and more as JSON, CSV or SQL inserts for testing | Mb | table |
| Number Base Converter | number-base | Convert numbers between binary, octal, decimal and hex | 0x | cpu |
| Regex Tester | regex-tester | Test a regular expression and see every match highlighted | .* | flask |
| Regex Visualizer & Explainer | regex-visualizer | Draw a JavaScript regex as a railroad diagram and explain every part in plain English | Rx | git-branch |
| SemVer Calculator | semver-calculator | Bump, compare and sort semantic versions, and test npm ranges like ^1.2.3 or ~1.2 | Sem | tag |
| SQL Formatter & Query Checker | sql-formatter | Format messy SQL for many dialects and spot risky or broken queries instantly | Sq | data |
| Timestamp Converter | timestamp-converter | Convert Unix timestamps to dates and back | Ts | clock |
| URL Encode / Decode | url-encoder | Percent-encode text for links, or decode an encoded link | Ur | link-circle |
| UUID Generator | uuid-generator | Generate random UUID v4 identifiers in bulk | Id | tag |
| CRON Expression Generator & Parser | cron-expression | Build, explain and validate cron schedules and preview the next run times | Ch | clock |

### Security
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Bcrypt Hash Generator & Checker | bcrypt | Hash passwords with bcrypt at any cost and check a password against an existing bcrypt hash | Bc | lock |
| Hash Generator | hash-generator | Compute SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files | Sh | scan-fingerprint |
| HMAC Generator & Verifier | hmac-generator | Sign messages with HMAC SHA-256/512 and verify webhook signatures from GitHub or Stripe | Hm | scan-fingerprint |
| Password Generator | password-generator | Create strong random passwords right in your browser | Pw | key |
| RSA Key Pair Generator | rsa-key-generator | Create RSA public and private keys as PEM plus an OpenSSH public key, right in your browser | Rsa | key |

### Convert
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| CSV ↔ JSON | csv-json | Convert CSV to JSON and JSON back to CSV | Cj | table |
| Unit Converter | unit-converter | Convert length, weight, temperature, data size and more | Un | ruler-2 |
| YAML ↔ JSON ↔ TOML Converter | yaml-json-toml | Convert config files between YAML, JSON and TOML in any direction, with clear error lines | Yj | curly-braces |

### Calculator
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| CHMOD Permission Calculator | chmod-calculator | Convert Unix file permissions between checkboxes, octal like 755 and rwxr-xr-x | Cm | folder-check |
| Date Calculator | date-calculator | Find your age or the days between two dates | Dt | calendar |
| Loan Calculator | loan-calculator | Estimate monthly installments and total interest | Lo | coins |
| Percentage Calculator | percentage-calculator | Work out percentages, changes and discounts | % | percent |

### Design
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Aspect Ratio & Screen Calculator | aspect-ratio-calculator | Work out aspect ratios, screen PPI and px, rem, em, pt, vw and vh conversions | Px | monitor |
| Box-Shadow & Gradient Generator | shadow-gradient | Design layered CSS box-shadows and linear, radial or conic gradients with a live preview | Shd | lidquid-drop-waves-2 |
| Color Converter | color-converter | Pick a color and get HEX, RGB and HSL values | Hx | lidquid-drop-waves-2 |
| SVG Optimizer | svg-optimizer | Shrink SVG files with SVGO: strip metadata, comments and junk, then compare before and after | Svg | image-frame |

### Image
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| EXIF / Metadata Remover | exif-remover | Strip GPS location, camera details and other hidden metadata from photos | Ex | image-off |
| Image Resizer & Compressor | image-resizer | Resize, compress and convert images to JPG, PNG or WebP | Im | image |

### Network
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| cURL to Code Converter | curl-to-code | Turn a curl command into fetch, axios, Python requests, PHP, Go or Rust code | Cu | code |
| CORS & Security Header Checker | cors-checker | Grade security headers like CSP and HSTS, and simulate whether CORS allows a request | Crs | shield |
| HTTP Status Code Reference | http-status-codes | Look up any HTTP status code from 1xx to 5xx with causes, fixes and headers | Hsc | pulse |
| Subnet & CIDR Calculator | subnet-calculator | Work out network, broadcast, host range and mask for any IPv4 or IPv6 CIDR block | Sub | sitemap |

### Utility
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Stopwatch & Timer | stopwatch-timer | A stopwatch with laps and a countdown timer with an alarm | St | timer |