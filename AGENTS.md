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
`Scan & Code` | `Text` | `Developer` | `Security` | `Convert` | `Calculator` | `Design` | `Image` | `Network` | `Utility` | `Productivity` | `Travel` | `Learning` | `Music` | `Work` | `Everyday` | `Utility`

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

## All Tools (127+)

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

### Productivity
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Habit Tracker | habit-tracker | A streak heatmap grid with a satisfying check animation and flame streak counters; stored locally | Ht | calendar |
| Kanban Board | kanban-board | A drag-and-drop task board with columns, WIP limits, and local persistence | Kb | kanban |
| Event Countdown | event-countdown | Create multiple countdowns to future dates with live ticking, progress bars, and shareable links | Ec | timer |
| Day Planner | day-planner | Time-block your day in 30-min slots with drag-to-resize tasks, focus mode timer, and daily stats | Dp | calendar-clock |
| Meeting Cost Calculator | meeting-cost | Calculate the real cost of meetings based on attendees, salaries, and duration | Mc | users |
| Working Days Calculator | working-days | Calculate business days between dates, add/subtract work days, with Indonesian holiday support | Wd | calendar-check |
| Eisenhower Matrix | eisenhower-matrix | Prioritize tasks in the Urgent/Important 2×2 matrix with drag-and-drop | Em | grid-2x2 |
| Decision Matrix | decision-matrix | Score options against weighted criteria to make objective decisions | Dm | checklist |
| World Clock Map | world-clock-map | Visual world map with clickable time zones, multiple city clocks, and meeting planner | Wc | globe |
| Chore Rotation | chore-rotation | Fair rotation scheduler for recurring chores among housemates/team | Cr | refresh-cw |

### Travel
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Travel Budget Planner | travel-budget | Plan trip expenses by category, track actual vs planned, see daily averages | Tb | wallet |
| Packing List Generator | packing-list | Generate customized packing list based on trip type, duration, weather, and activities | Pl | suitcase |
| Currency Converter | currency-converter | Convert between 150+ currencies with live rates, historical charts, and offline mode | Cc | currency |
| Time Zone Planner | time-zone-planner | Find overlapping working hours across time zones with visual timeline and meeting scheduler | Tz | clock |
| Flight Layover Calculator | flight-layover | Calculate minimum connection times, check if layover is sufficient, and see risk level | Fl | plane |
| Visa Requirements Checker | visa-checker | Check visa requirements for any passport to any destination | Vc | shield-check |
| Travel Itinerary Builder | travel-itinerary | Build day-by-day trip itinerary with activities, times, locations, and notes | Ti | calendar |
| Fuel Cost Calculator | fuel-cost | Calculate fuel cost for road trips based on distance, fuel efficiency, and local fuel prices | Fc | fuel |
| Distance Calculator | distance-calculator | Calculate distance between two points (cities, coordinates, airports) | Dc | map-pin |
| Travel Insurance Comparator | travel-insurance | Compare travel insurance plans by coverage, price, and exclusions | Ti | shield |

### Learning
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Flashcard Maker | flashcards | Create, study, and share flashcard decks with spaced repetition and Anki export | Fc | card |
| Spaced Repetition Scheduler | spaced-repetition | SM-2 algorithm scheduler for any review items with optimal review dates | Sr | calendar-clock |
| Pomodoro Timer | pomodoro-timer | Customizable Pomodoro timer with work/break cycles, task tracking, and ambient sounds | Pt | timer |
| Language Vocabulary Builder | language-vocab | Build vocabulary lists with translations, example sentences, and spaced review | Lv | book-open |
| Citation Generator | citation-generator | Generate citations in APA, MLA, Chicago, Harvard, IEEE formats for various sources | Cg | quote |
| Grade Calculator | grade-calculator | Calculate weighted grades, GPA, and what you need on final exam | Gc | award |
| Study Planner | study-planner | Plan study sessions by subject, set goals, track hours, and see progress | Sp | calendar |
| Mind Map | mind-map | Visual mind mapping with nodes, connections, colors, and export to image | Mm | git-branch |
| Formula Sheet | formula-sheet | Reference sheet for math, physics, chemistry, and engineering formulas with LaTeX | Fs | calculator |
| Quiz Generator | quiz-generator | Create quizzes with multiple choice, true/false, short answer, timer, and scoring | Qg | help-circle |

### Music
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| BPM Tapper | bpm-tapper | Tap along to music to find the exact BPM with visual beat indicator and tap history | Bt | heart-pulse |
| Chord Transposer | chord-transposer | Transpose chords to any key with chord charts, capo positions, and Nashville numbers | Ct | music |
| Key Finder | key-finder | Identify the musical key from chords or notes with confidence scoring | Kf | key |
| Scale Finder | scale-finder | Visualize any scale on piano keyboard and fretboard with 80+ scales | Sf | piano |
| Interval Calculator | interval-calculator | Calculate intervals between any two notes with quality, inversion, and song examples | Ic | ruler |
| Metronome | metronome | Precise metronome with visual pendulum, subdivision clicks, time signatures, and tap tempo | Mt | timer |
| Tuner | tuner | Chromatic tuner with microphone input, visual needle, note detection, and reference tones | Tn | mic |
| Frequency Analyzer | frequency-analyzer | Real-time spectrum analyzer with FFT visualization, peak detection, and note mapping | Fa | bar-chart |
| Audio Waveform Visualizer | audio-waveform | Real-time oscilloscope and waveform display with zoom and measurements | Aw | waveform |
| Setlist Manager | setlist-manager | Create and manage setlists for gigs with drag-to-reorder, notes, and duration tracking | Sl | list-music |

### Work
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Salary Calculator | salary-calculator | Calculate net salary from gross with tax brackets, deductions, and allowances | Sc | wallet |
| Invoice Generator | invoice-generator | Create professional invoices with line items, tax, discounts, and PDF export | Ig | file-text |
| Contract Generator | contract-generator | Generate legal contracts from templates: NDA, Service Agreement, Employment, Freelance | Cg | file-contract |
| Meeting Notes | meeting-notes | Take structured meeting notes with agenda, attendees, action items, and decisions | Mn | clipboard |
| Project Estimator | project-estimator | Estimate project effort and cost using work breakdown structure with risk adjustment | Pe | calculator |
| Freelance Rate Calculator | freelance-rate | Calculate your minimum hourly rate based on expenses, desired income, and billable hours | Fr | dollar-sign |
| Timesheet | timesheet | Track work hours by project/client with weekly/monthly views and CSV export | Ts | clock |
| Expense Tracker | expense-tracker | Track business expenses by category with receipt capture and monthly reports | Et | receipt |
| ROI Calculator | roi-calculator | Calculate Return on Investment for projects, campaigns, or equipment | Rc | trending-up |
| Break-Even Calculator | break-even | Calculate break-even point for products or services with fixed/variable costs | Be | target |

### Everyday
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| Grocery List | grocery-list | Smart grocery list with categories, quantities, price tracking, and store sections | Gl | shopping-cart |
| Meal Planner | meal-planner | Weekly meal planner with recipes, grocery auto-generation, and nutrition tracking | Mp | calendar |
| Recipe Scaler | recipe-scaler | Scale recipes up or down by servings, weight, or ingredient amount with unit conversion | Rs | scale |
| Gift Idea Generator | gift-idea | Get personalized gift suggestions based on recipient, occasion, interests, and budget | Gi | gift |
| Event RSVP Tracker | event-rsvp | Manage event invitations, track RSVPs, dietary restrictions, plus-ones, and send reminders | Er | calendar-plus |
| Budget Envelope System | budget-envelope | Digital envelope budgeting with spending tracking and visual progress bars | Be | wallet |
| Clothing Size Converter | clothing-size | Convert clothing sizes between US, UK, EU, JP, CN, AU standards for all categories | Cs | shirt |
| Home Inventory | home-inventory | Catalog your belongings by room with value tracking, warranty tracking, and insurance reports | Hi | home |
| Pet Care Tracker | pet-care | Track pet feeding, medication, vet visits, weight, and activities for multiple pets | Pc | heart |
| Plant Care Tracker | plant-care | Track watering, fertilizing, repotting, and sunlight needs with reminders | Pc | leaf |

### Utility
| Tool | Slug | Description | Symbol | Icon |
|------|------|-------------|--------|------|
| UUID Generator | uuid-generator | Generate UUIDs v1, v4, v7 with bulk generation, formatting options, and validation | Ug | fingerprint |
| Hash Generator | hash-generator | Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes for text or files | Hg | hash |
| Base64 Encoder/Decoder | base64-encoder | Encode text to Base64 or decode Base64 back to text with UTF-8 and URL-safe support | B64 | code |
| JSON Formatter | json-formatter | Format, validate, minify, and query JSON with syntax highlighting and tree view | Jf | braces |
| Color Picker & Converter | color-picker | Pick colors and convert between HEX, RGB, HSL, HSV, CMYK, LAB with palette generation | Cp | eye-dropper |
| QR Code Generator | qr-generator | Generate QR codes for URLs, text, WiFi, vCard, email, SMS with customization | Qg | qr-code |
| Text Diff | text-diff | Compare two texts at character, word, or line level with unified and split views | Td | git-compare |
| Regex Tester | regex-tester | Test regular expressions with live highlighting, capture groups, and replacement | Rx | code |
| CRON Expression Parser | cron-parser | Parse, validate, and explain CRON expressions with next run times and timezone support | Cp | clock |
| Unit Converter | unit-converter | Convert between length, weight, temperature, volume, area, speed, time, data, pressure, energy | Uc | ruler |