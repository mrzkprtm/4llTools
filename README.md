# 4llTools

A growing collection of small, handy web tools. Every tool runs entirely in the browser, so nothing you type or scan is sent anywhere.

## Tools

| Category | Tool | What it does |
| --- | --- | --- |
| Scan & Code | QR Code Reader | Scan a QR code with your camera, or read one from an image |
| Scan & Code | QR Code Generator | Turn text or a link into a downloadable QR code |
| Text | Case Converter | UPPER, lower, Title, camelCase, snake_case and more |
| Text | Line Tools | Sort, dedupe, reverse, trim or shuffle lines |
| Text | Lorem Ipsum Generator | Placeholder paragraphs, sentences or words |
| Text | Markdown Preview | Live Markdown rendering, with copyable HTML |
| Text | Slug Generator | Turn a title into a clean URL slug |
| Text | Text Diff | Compare two texts line by line |
| Text | Word Counter | Words, characters, sentences and reading time |
| Developer | Base64 Encode / Decode | Text to Base64 and back, with full Unicode support |
| Developer | HTML Entities | Escape or unescape HTML entities |
| Developer | JSON Formatter | Prettify, minify and validate JSON |
| Developer | JWT Decoder | Read a JSON Web Token's header, payload and expiry |
| Developer | Number Base Converter | Binary, octal, decimal and hex, exact for big numbers |
| Developer | Regex Tester | Highlight regular expression matches and groups |
| Developer | Timestamp Converter | Unix timestamps to dates and back |
| Developer | URL Encode / Decode | Percent-encode or decode text for links |
| Developer | UUID Generator | Random UUID v4s in bulk |
| Security | Hash Generator | SHA-1/256/384/512 of text or files |
| Security | Password Generator | Strong random passwords using the Web Crypto API |
| Convert | CSV ↔ JSON | Convert CSV to JSON and back, with download |
| Convert | Unit Converter | Length, weight, temperature, data size and more |
| Calculator | Date Calculator | Age, days between dates, add or subtract days |
| Calculator | Loan Calculator | Monthly installments, total interest and a payment schedule |
| Calculator | Percentage Calculator | Percent of, percent change and discounts |
| Design | Color Converter | HEX, RGB and HSL with a contrast check |
| Image | Image Resizer & Compressor | Resize, compress and convert to JPG, PNG or WebP |
| Utility | Stopwatch & Timer | Stopwatch with laps, countdown timer with alarm |

## Run it locally

Needs Node.js 20 or newer.

```bash
npm install
npm run dev      # start a dev server at http://localhost:5173
npm test         # run the unit tests
npm run build    # production build into dist/
```

## Add a new tool

Each folder in `src/tools/` is one tool. The folder name becomes its URL, and the home page picks it up automatically, so you never edit a central list.

1. Create `src/tools/my-tool/meta.ts`:

   ```ts
   import type { ToolMeta } from '../types'

   export const meta: ToolMeta = {
     name: 'My Tool',
     description: 'One sentence about what it does.',
     category: 'Text', // see Category in src/tools/types.ts
     keywords: ['extra', 'search', 'words'],
     symbol: 'Mt', // 1–3 characters, shown on the tool's tile
     icon: 'flask', // any Majesticons name (majesticons.com), without "-line"
   }
   ```

2. Create `src/tools/my-tool/Tool.tsx` with a default-exported React component.
3. Put any pure logic in its own file (like `format.ts`) and add a test for it in `src/tools/more-tools.test.ts`.
4. Add a row to the table above.

The tool is now live at `/my-tool` and shows up in the sidebar, on the home page and in the sitemap. Its search title and description come from `meta.ts`, so keep the description to one clear sentence. Each tool is loaded only when it's opened, so adding more doesn't slow down the home page.

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Use these build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Click **Save and Deploy**. Every push to `main` deploys, and pull requests get preview links.

`.node-version` pins Node 22 for the build, which Vite needs. The build writes one HTML file per tool (`dist/qr-reader.html` and so on), which Pages serves at `/qr-reader`, and a `404.html` for unknown paths. `public/_headers` sends `X-Robots-Tag: noindex` on the `*.pages.dev` addresses (production and previews), so only the custom domain shows up in search. Pages sites are always HTTPS, which the camera needs.

## SEO

`npm run build` prerenders every page, so search engines see real content without running JavaScript. Each page gets its own title, description, canonical link, Open Graph and Twitter tags, and JSON-LD structured data. The build also writes `sitemap.xml` and `robots.txt`. All of this lives in `src/seo.ts` and the `prerender` plugin in `vite.config.ts`.

The site address used in those tags defaults to `https://4lltools.morizdigital.com`. To change it, set the `VITE_SITE_URL` environment variable in Cloudflare Pages (**Settings → Variables and Secrets**), or edit the default in `src/seo.ts`. After the first deploy, submit `https://<your domain>/sitemap.xml` in Google Search Console.

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this repository.
2. Vercel detects Vite on its own. Keep the defaults (build command `npm run build`, output folder `dist`) and click **Deploy**.
3. From then on, every push to `main` deploys automatically, and every pull request gets its own preview link.

`vercel.json` turns on clean URLs, so `/qr-reader` serves the prerendered `qr-reader.html`, and sends any other path to `index.html`. The camera needs HTTPS, which Vercel provides.
