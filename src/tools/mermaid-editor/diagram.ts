export interface DiagramTemplate {
  id: string
  name: string
  code: string
}

export const TEMPLATES: DiagramTemplate[] = [
  {
    id: 'flowchart',
    name: 'Flowchart',
    code: `flowchart TD
    A[User opens app] --> B{Logged in?}
    B -- Yes --> C[Show dashboard]
    B -- No --> D[Login page]
    D --> E[/Enter email and password/]
    E --> F{Valid?}
    F -- Yes --> C
    F -- No --> G[Show error]
    G --> D
    C --> H((Done))`,
  },
  {
    id: 'sequence',
    name: 'Sequence',
    code: `sequenceDiagram
    autonumber
    actor U as User
    participant W as Web app
    participant A as API
    participant DB as Database
    U->>W: Click "Pay"
    W->>A: POST /orders
    activate A
    A->>DB: INSERT order
    DB-->>A: order id
    A-->>W: 201 Created
    deactivate A
    W-->>U: Show receipt
    Note over W,A: All calls use HTTPS`,
  },
  {
    id: 'class',
    name: 'Class',
    code: `classDiagram
    class Animal {
      +String name
      +int age
      +makeSound() void
    }
    class Dog {
      +String breed
      +fetch() void
    }
    class Cat {
      +bool indoor
      +purr() void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Dog "1" --> "*" Toy : plays with`,
  },
  {
    id: 'state',
    name: 'State',
    code: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review : submit
    Review --> Draft : request changes
    Review --> Approved : approve
    Approved --> Published : publish
    Published --> Archived : archive
    Archived --> [*]`,
  },
  {
    id: 'er',
    name: 'ER',
    code: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "is in"
    CUSTOMER {
      int id PK
      string name
      string email
    }
    ORDER {
      int id PK
      int customer_id FK
      date created_at
    }
    PRODUCT {
      int id PK
      string title
      decimal price
    }`,
  },
  {
    id: 'gantt',
    name: 'Gantt',
    code: `gantt
    title Website launch
    dateFormat YYYY-MM-DD
    section Design
      Wireframes      :done, d1, 2026-01-05, 5d
      Visual design   :active, d2, after d1, 7d
    section Build
      Frontend        :b1, after d2, 10d
      Backend API     :b2, after d1, 12d
    section Launch
      QA and fixes    :l1, after b1, 5d
      Go live         :milestone, after l1, 0d`,
  },
  {
    id: 'pie',
    name: 'Pie',
    code: `pie showData
    title Traffic sources
    "Search" : 48
    "Direct" : 22
    "Social" : 18
    "Referral" : 12`,
  },
  {
    id: 'mindmap',
    name: 'Mindmap',
    code: `mindmap
  root((Product idea))
    Users
      Students
      Freelancers
    Features
      Offline mode
      Sharing
      Dark theme
    Growth
      SEO
      Referrals`,
  },
  {
    id: 'timeline',
    name: 'Timeline',
    code: `timeline
    title History of the web
    1991 : First website
    1995 : JavaScript
         : PHP
    2004 : Web 2.0
    2008 : Chrome
    2015 : ES2015
    2020 : Remote everything`,
  },
]

/** Calls `fn` once calls stop for `wait` ms. `cancel()` drops a pending call. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number): ((...args: A) => void) & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | undefined
  const d = (...args: A) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
  d.cancel = () => clearTimeout(t)
  return d
}

/** Pulls "line N" out of a Mermaid parse error message. */
export function errorLine(message: string): number | null {
  const m = /\bline\s+(\d+)/i.exec(message)
  return m ? Number(m[1]) : null
}

/** Cleans a Mermaid error for display: drops the stack-like noise, keeps the pointer lines. */
export function cleanError(message: string): string {
  return message
    .replace(/^Error:\s*/, '')
    .split('\n')
    .slice(0, 6)
    .join('\n')
    .trim()
}

/** Size of an SVG from its viewBox (preferred) or width/height attributes. */
export function svgSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? ''
  const vb = /viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(root)
  if (vb) return { width: Number(vb[3]), height: Number(vb[4]) }
  const w = /\swidth\s*=\s*["']([\d.]+)(px)?["']/i.exec(root)
  const h = /\sheight\s*=\s*["']([\d.]+)(px)?["']/i.exec(root)
  return { width: w ? Number(w[1]) : 800, height: h ? Number(h[1]) : 600 }
}

/** Pixel size for a PNG export at `scale`, shrunk so neither side passes `max` (canvas limits). */
export function pngSize(width: number, height: number, scale = 2, max = 8192): { width: number; height: number; scale: number } {
  const s = Math.max(0.1, Math.min(scale, max / Math.max(width, 1), max / Math.max(height, 1)))
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)), scale: s }
}

/** Gives the root <svg> explicit pixel width/height (Mermaid uses width="100%"), for standalone files and canvas drawing. */
export function withPixelSize(svg: string, width: number, height: number): string {
  return svg.replace(/<svg\b[^>]*>/i, (tag) => {
    let t = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/i, '')
    t = t.replace(/^<svg/i, `<svg width="${width}" height="${height}"`)
    if (!/xmlns=/.test(t)) t = t.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
    return t
  })
}
