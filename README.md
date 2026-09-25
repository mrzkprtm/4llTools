# 4llTools

A growing collection of small, handy web tools. Every tool runs entirely in the browser, so nothing you type or scan is sent anywhere.

## Tools

| Tool | What it does |
| --- | --- |
| QR Code Reader | Scan a QR code with your camera, or read one from an image |
| QR Code Generator | Turn text or a link into a downloadable QR code |
| JSON Formatter | Prettify, minify and validate JSON |
| Base64 Encode / Decode | Text to Base64 and back, with full Unicode support |
| URL Encode / Decode | Percent-encode or decode text for links |
| Password Generator | Strong random passwords using the Web Crypto API |
| Word Counter | Words, characters, sentences and reading time |
| Unit Converter | Length, weight, temperature, data size and more |

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
     category: 'Text', // 'Scan & Code' | 'Text' | 'Developer' | 'Security' | 'Convert'
     keywords: ['extra', 'search', 'words'],
     icon: '✨',
   }
   ```

2. Create `src/tools/my-tool/Tool.tsx` with a default-exported React component.
3. Put any pure logic in its own file (like `format.ts`) and add a test for it in `src/tools/tools.test.ts`.
4. Add a row to the table above.

The tool is now live at `/my-tool`. Each tool is loaded only when it's opened, so adding more doesn't slow down the home page.

## Deploy on Cloudflare Pages

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repository.
2. Use these build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Click **Save and Deploy**. Every push to `main` deploys, and pull requests get preview links.

`.node-version` pins Node 22 for the build, which Vite needs. There is no `404.html`, so Pages serves `index.html` for unknown paths and direct links like `/qr-reader` work. Pages sites are always HTTPS, which the camera needs.

## Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this repository.
2. Vercel detects Vite on its own. Keep the defaults (build command `npm run build`, output folder `dist`) and click **Deploy**.
3. From then on, every push to `main` deploys automatically, and every pull request gets its own preview link.

`vercel.json` sends every path to `index.html`, so direct links like `/qr-reader` work. The camera needs HTTPS, which Vercel provides.
