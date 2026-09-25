export type FieldKind = 'text' | 'url' | 'textarea' | 'date' | 'datetime' | 'number' | 'select' | 'time'

export interface FieldDef {
  key: string
  label: string
  kind?: FieldKind
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  help?: string
}

export interface RowsDef {
  key: string
  label: string
  item: string
  fields: FieldDef[]
  required?: boolean
}

export type Row = Record<string, string>
export interface FormData {
  fields: Record<string, string>
  rows: Record<string, Row[]>
}

export interface SchemaType {
  id: string
  name: string
  fields: FieldDef[]
  rows?: RowsDef[]
  example: FormData
  build: (d: FormData) => Record<string, unknown>
}

type Json = unknown

/** Recursively drops empty strings, null/undefined, empty arrays and objects that hold nothing but @type. */
export function clean(value: Json): Json {
  if (Array.isArray(value)) {
    const arr = value.map(clean).filter((v) => v !== undefined)
    return arr.length ? arr : undefined
  }
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {}
    for (const [k, v] of Object.entries(value as Record<string, Json>)) {
      const c = clean(v)
      if (c !== undefined) out[k] = c
    }
    const keys = Object.keys(out).filter((k) => k !== '@type' && k !== '@context')
    return keys.length ? out : undefined
  }
  if (typeof value === 'string') return value.trim() ? value.trim() : undefined
  if (value === null || value === undefined) return undefined
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined
  return value
}

/** "30" minutes → "PT30M", "90" → "PT1H30M". Empty or invalid → undefined. */
export function minutesToDuration(min: string | undefined): string | undefined {
  const n = Math.round(Number(min))
  if (!min?.trim() || !Number.isFinite(n) || n <= 0) return undefined
  const h = Math.floor(n / 60)
  const m = n % 60
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`
}

const num = (s: string | undefined): number | undefined => {
  if (!s?.trim()) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

const lines = (rows: Row[] | undefined, key: string) => (rows ?? []).map((r) => r[key]).filter((v) => v?.trim())

const DAY_SETS: Record<string, string[]> = {
  'Mo-Fr': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  'Sa-Su': ['Saturday', 'Sunday'],
  'Mo-Su': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  'Mo-Sa': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}
const DAY_OPTIONS = [
  { value: 'Mo-Fr', label: 'Mon–Fri' },
  { value: 'Mo-Sa', label: 'Mon–Sat' },
  { value: 'Mo-Su', label: 'Every day' },
  { value: 'Sa-Su', label: 'Sat–Sun' },
  ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => ({ value: d, label: d })),
]

const AVAILABILITY = ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder', 'LimitedAvailability', 'Discontinued', 'SoldOut', 'OnlineOnly'].map((v) => ({ value: v, label: v.replace(/([a-z])([A-Z])/g, '$1 $2') }))
const schemaUrl = (v: string | undefined) => (v ? `https://schema.org/${v}` : undefined)

const person = (name?: string, url?: string) => (name?.trim() ? { '@type': 'Person', name, url } : undefined)
const imageList = (s: string | undefined) => {
  const parts = (s ?? '').split(/\s*[\n,]\s*/).filter(Boolean)
  return parts.length > 1 ? parts : parts[0]
}

const rating = (value?: string, count?: string) =>
  num(value) !== undefined ? { '@type': 'AggregateRating', ratingValue: num(value), bestRating: 5, ratingCount: num(count) } : undefined

export const TYPES: SchemaType[] = [
  {
    id: 'Article',
    name: 'Article',
    fields: [
      { key: 'type', label: 'Article type', kind: 'select', options: ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'].map((v) => ({ value: v, label: v })) },
      { key: 'headline', label: 'Headline', required: true, placeholder: 'Max ~110 characters' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'url', label: 'Article URL', kind: 'url' },
      { key: 'image', label: 'Image URL(s)', kind: 'url', required: true, help: 'Separate several with commas.' },
      { key: 'datePublished', label: 'Published', kind: 'date', required: true },
      { key: 'dateModified', label: 'Modified', kind: 'date' },
      { key: 'authorName', label: 'Author name', required: true },
      { key: 'authorUrl', label: 'Author URL', kind: 'url' },
      { key: 'publisherName', label: 'Publisher' },
      { key: 'publisherLogo', label: 'Publisher logo URL', kind: 'url' },
    ],
    example: {
      fields: {
        type: 'BlogPosting', headline: 'How to Brew Better Coffee at Home', description: 'Five simple changes that make home-brewed coffee taste like a café.', url: 'https://example.com/blog/better-coffee',
        image: 'https://example.com/images/coffee-1200.jpg', datePublished: '2026-09-01', dateModified: '2026-09-20', authorName: 'Rina Wijaya', authorUrl: 'https://example.com/about/rina', publisherName: 'Example Coffee Co.', publisherLogo: 'https://example.com/logo.png',
      },
      rows: {},
    },
    build: ({ fields: f }) => ({
      '@context': 'https://schema.org',
      '@type': f.type || 'Article',
      headline: f.headline,
      description: f.description,
      image: imageList(f.image),
      datePublished: f.datePublished,
      dateModified: f.dateModified,
      author: person(f.authorName, f.authorUrl),
      publisher: f.publisherName ? { '@type': 'Organization', name: f.publisherName, logo: f.publisherLogo ? { '@type': 'ImageObject', url: f.publisherLogo } : undefined } : undefined,
      mainEntityOfPage: f.url ? { '@type': 'WebPage', '@id': f.url } : undefined,
    }),
  },
  {
    id: 'Product',
    name: 'Product',
    fields: [
      { key: 'name', label: 'Product name', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'image', label: 'Image URL(s)', kind: 'url', required: true, help: 'Separate several with commas.' },
      { key: 'brand', label: 'Brand' },
      { key: 'sku', label: 'SKU' },
      { key: 'gtin', label: 'GTIN / EAN / UPC' },
      { key: 'url', label: 'Product URL', kind: 'url' },
      { key: 'price', label: 'Price', kind: 'number', required: true },
      { key: 'currency', label: 'Currency', placeholder: 'USD, IDR, EUR…' },
      { key: 'availability', label: 'Availability', kind: 'select', options: AVAILABILITY },
      { key: 'condition', label: 'Condition', kind: 'select', options: ['NewCondition', 'UsedCondition', 'RefurbishedCondition'].map((v) => ({ value: v, label: v.replace('Condition', '') })) },
      { key: 'priceValidUntil', label: 'Price valid until', kind: 'date' },
      { key: 'ratingValue', label: 'Average rating (1–5)', kind: 'number' },
      { key: 'reviewCount', label: 'Number of reviews', kind: 'number' },
    ],
    example: {
      fields: {
        name: 'Gayo Arabica Whole Beans 250 g', description: 'Medium roast single-origin beans from Aceh with notes of chocolate and citrus.', image: 'https://example.com/images/gayo-250.jpg', brand: 'Example Coffee Co.',
        sku: 'GAYO-250', gtin: '', url: 'https://example.com/shop/gayo-250', price: '95000', currency: 'IDR', availability: 'InStock', condition: 'NewCondition', priceValidUntil: '', ratingValue: '4.8', reviewCount: '126',
      },
      rows: {},
    },
    build: ({ fields: f }) => ({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: f.name,
      description: f.description,
      image: imageList(f.image),
      sku: f.sku,
      gtin: f.gtin,
      brand: f.brand ? { '@type': 'Brand', name: f.brand } : undefined,
      offers:
        num(f.price) !== undefined
          ? { '@type': 'Offer', url: f.url, price: num(f.price), priceCurrency: f.currency?.toUpperCase(), availability: schemaUrl(f.availability), itemCondition: schemaUrl(f.condition), priceValidUntil: f.priceValidUntil }
          : undefined,
      aggregateRating: num(f.ratingValue) !== undefined ? { '@type': 'AggregateRating', ratingValue: num(f.ratingValue), bestRating: 5, reviewCount: num(f.reviewCount) } : undefined,
    }),
  },
  {
    id: 'FAQPage',
    name: 'FAQ',
    fields: [],
    rows: [{ key: 'faq', label: 'Questions', item: 'question', required: true, fields: [{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', kind: 'textarea', help: 'Basic HTML like <a>, <b>, <ul> is allowed.' }] }],
    example: {
      fields: {},
      rows: {
        faq: [
          { q: 'How fresh is the coffee?', a: 'Every order is roasted to order and shipped within 48 hours of roasting.' },
          { q: 'Can I pause my subscription?', a: 'Yes. Pause, skip or cancel anytime from your account page.' },
          { q: 'Do you ship outside Indonesia?', a: 'We currently ship to Indonesia, Malaysia and Singapore.' },
        ],
      },
    },
    build: ({ rows }) => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: (rows.faq ?? [])
        .filter((r) => r.q?.trim() && r.a?.trim())
        .map((r) => ({ '@type': 'Question', name: r.q, acceptedAnswer: { '@type': 'Answer', text: r.a } })),
    }),
  },
  {
    id: 'HowTo',
    name: 'How-to',
    fields: [
      { key: 'name', label: 'Title', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'image', label: 'Image URL', kind: 'url' },
      { key: 'totalTime', label: 'Total time (minutes)', kind: 'number' },
      { key: 'cost', label: 'Estimated cost', kind: 'number' },
      { key: 'currency', label: 'Currency' },
    ],
    rows: [
      { key: 'supplies', label: 'Supplies', item: 'supply', fields: [{ key: 'name', label: 'Supply' }] },
      { key: 'tools', label: 'Tools', item: 'tool', fields: [{ key: 'name', label: 'Tool' }] },
      { key: 'steps', label: 'Steps', item: 'step', required: true, fields: [{ key: 'name', label: 'Step title' }, { key: 'text', label: 'Instructions', kind: 'textarea' }, { key: 'image', label: 'Image URL', kind: 'url' }] },
    ],
    example: {
      fields: { name: 'How to make pour-over coffee', description: 'Brew a clean, bright cup with a dripper in about five minutes.', image: 'https://example.com/images/pour-over.jpg', totalTime: '5', cost: '0', currency: 'USD' },
      rows: {
        supplies: [{ name: '20 g coffee beans' }, { name: '320 ml hot water (93 °C)' }],
        tools: [{ name: 'Pour-over dripper' }, { name: 'Paper filter' }, { name: 'Kettle' }],
        steps: [
          { name: 'Rinse the filter', text: 'Place the filter in the dripper and rinse it with hot water. Discard the water.', image: '' },
          { name: 'Bloom', text: 'Add ground coffee, pour 40 ml of water and wait 30 seconds.', image: '' },
          { name: 'Pour', text: 'Pour the rest of the water in slow circles over 2 minutes.', image: '' },
        ],
      },
    },
    build: ({ fields: f, rows }) => ({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: f.name,
      description: f.description,
      image: f.image,
      totalTime: minutesToDuration(f.totalTime),
      estimatedCost: num(f.cost) !== undefined ? { '@type': 'MonetaryAmount', currency: f.currency?.toUpperCase(), value: num(f.cost) } : undefined,
      supply: lines(rows.supplies, 'name').map((name) => ({ '@type': 'HowToSupply', name })),
      tool: lines(rows.tools, 'name').map((name) => ({ '@type': 'HowToTool', name })),
      step: (rows.steps ?? []).filter((s) => s.text?.trim() || s.name?.trim()).map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text || s.name, image: s.image })),
    }),
  },
  {
    id: 'LocalBusiness',
    name: 'Local business',
    fields: [
      { key: 'type', label: 'Business type', kind: 'select', options: ['LocalBusiness', 'Restaurant', 'CafeOrCoffeeShop', 'Store', 'Bakery', 'Dentist', 'MedicalClinic', 'HairSalon', 'AutoRepair', 'Hotel', 'RealEstateAgent', 'LegalService'].map((v) => ({ value: v, label: v })) },
      { key: 'name', label: 'Business name', required: true },
      { key: 'image', label: 'Photo URL', kind: 'url' },
      { key: 'url', label: 'Website', kind: 'url' },
      { key: 'telephone', label: 'Phone', placeholder: '+62 22 1234 5678' },
      { key: 'priceRange', label: 'Price range', placeholder: '$$' },
      { key: 'street', label: 'Street address', required: true },
      { key: 'city', label: 'City' },
      { key: 'region', label: 'Region / province' },
      { key: 'postalCode', label: 'Postal code' },
      { key: 'country', label: 'Country code', placeholder: 'ID' },
      { key: 'lat', label: 'Latitude', kind: 'number' },
      { key: 'lng', label: 'Longitude', kind: 'number' },
    ],
    rows: [{ key: 'hours', label: 'Opening hours', item: 'hours', fields: [{ key: 'days', label: 'Days', kind: 'select', options: DAY_OPTIONS }, { key: 'opens', label: 'Opens', kind: 'time' }, { key: 'closes', label: 'Closes', kind: 'time' }] }],
    example: {
      fields: { type: 'CafeOrCoffeeShop', name: 'Fresh Roast Café', image: 'https://example.com/images/cafe.jpg', url: 'https://example.com', telephone: '+62 22 1234 5678', priceRange: '$$', street: 'Jl. Braga No. 10', city: 'Bandung', region: 'Jawa Barat', postalCode: '40111', country: 'ID', lat: '-6.9175', lng: '107.6096' },
      rows: { hours: [{ days: 'Mo-Fr', opens: '07:00', closes: '21:00' }, { days: 'Sa-Su', opens: '08:00', closes: '22:00' }] },
    },
    build: ({ fields: f, rows }) => ({
      '@context': 'https://schema.org',
      '@type': f.type || 'LocalBusiness',
      name: f.name,
      image: f.image,
      url: f.url,
      telephone: f.telephone,
      priceRange: f.priceRange,
      address: { '@type': 'PostalAddress', streetAddress: f.street, addressLocality: f.city, addressRegion: f.region, postalCode: f.postalCode, addressCountry: f.country?.toUpperCase() },
      geo: num(f.lat) !== undefined && num(f.lng) !== undefined ? { '@type': 'GeoCoordinates', latitude: num(f.lat), longitude: num(f.lng) } : undefined,
      openingHoursSpecification: (rows.hours ?? [])
        .filter((h) => h.days && h.opens && h.closes)
        .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_SETS[h.days] ?? [h.days], opens: h.opens, closes: h.closes })),
    }),
  },
  {
    id: 'Organization',
    name: 'Organization',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'url', label: 'Website', kind: 'url', required: true },
      { key: 'logo', label: 'Logo URL', kind: 'url' },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'email', label: 'Email' },
      { key: 'telephone', label: 'Phone' },
      { key: 'contactType', label: 'Contact type', kind: 'select', options: ['customer service', 'technical support', 'sales', 'billing support'].map((v) => ({ value: v, label: v })) },
    ],
    rows: [{ key: 'sameAs', label: 'Social profiles (sameAs)', item: 'profile', fields: [{ key: 'url', label: 'Profile URL', kind: 'url' }] }],
    example: {
      fields: { name: 'Example Coffee Co.', url: 'https://example.com', logo: 'https://example.com/logo.png', description: 'Small-batch coffee roaster based in Bandung.', email: 'hello@example.com', telephone: '+62 22 1234 5678', contactType: 'customer service' },
      rows: { sameAs: [{ url: 'https://www.instagram.com/example' }, { url: 'https://www.linkedin.com/company/example' }] },
    },
    build: ({ fields: f, rows }) => ({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: f.name,
      url: f.url,
      logo: f.logo,
      description: f.description,
      email: f.email,
      contactPoint: f.telephone || f.email ? { '@type': 'ContactPoint', telephone: f.telephone, email: f.email, contactType: f.contactType } : undefined,
      sameAs: lines(rows.sameAs, 'url'),
    }),
  },
  {
    id: 'Person',
    name: 'Person',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'jobTitle', label: 'Job title' },
      { key: 'worksFor', label: 'Works for' },
      { key: 'url', label: 'Website', kind: 'url' },
      { key: 'image', label: 'Photo URL', kind: 'url' },
      { key: 'email', label: 'Email' },
    ],
    rows: [{ key: 'sameAs', label: 'Profiles (sameAs)', item: 'profile', fields: [{ key: 'url', label: 'Profile URL', kind: 'url' }] }],
    example: {
      fields: { name: 'Rina Wijaya', jobTitle: 'Head Roaster', worksFor: 'Example Coffee Co.', url: 'https://example.com/about/rina', image: 'https://example.com/images/rina.jpg', email: '' },
      rows: { sameAs: [{ url: 'https://github.com/example' }] },
    },
    build: ({ fields: f, rows }) => ({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: f.name,
      jobTitle: f.jobTitle,
      worksFor: f.worksFor ? { '@type': 'Organization', name: f.worksFor } : undefined,
      url: f.url,
      image: f.image,
      email: f.email,
      sameAs: lines(rows.sameAs, 'url'),
    }),
  },
  {
    id: 'Event',
    name: 'Event',
    fields: [
      { key: 'name', label: 'Event name', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'startDate', label: 'Starts', kind: 'datetime', required: true },
      { key: 'endDate', label: 'Ends', kind: 'datetime' },
      { key: 'mode', label: 'Attendance', kind: 'select', options: [{ value: 'OfflineEventAttendanceMode', label: 'In person' }, { value: 'OnlineEventAttendanceMode', label: 'Online' }, { value: 'MixedEventAttendanceMode', label: 'Hybrid' }] },
      { key: 'status', label: 'Status', kind: 'select', options: ['EventScheduled', 'EventPostponed', 'EventRescheduled', 'EventMovedOnline', 'EventCancelled'].map((v) => ({ value: v, label: v.replace('Event', '') })) },
      { key: 'locationName', label: 'Venue name' },
      { key: 'address', label: 'Venue address' },
      { key: 'onlineUrl', label: 'Online URL', kind: 'url' },
      { key: 'image', label: 'Image URL', kind: 'url' },
      { key: 'organizerName', label: 'Organizer' },
      { key: 'organizerUrl', label: 'Organizer URL', kind: 'url' },
      { key: 'price', label: 'Ticket price', kind: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'offerUrl', label: 'Ticket URL', kind: 'url' },
      { key: 'availability', label: 'Ticket availability', kind: 'select', options: AVAILABILITY },
    ],
    example: {
      fields: {
        name: 'Latte Art Workshop', description: 'A hands-on evening class on milk texturing and basic latte art.', startDate: '2026-10-18T18:30', endDate: '2026-10-18T21:00', mode: 'OfflineEventAttendanceMode', status: 'EventScheduled',
        locationName: 'Fresh Roast Café', address: 'Jl. Braga No. 10, Bandung', onlineUrl: '', image: 'https://example.com/images/workshop.jpg', organizerName: 'Example Coffee Co.', organizerUrl: 'https://example.com',
        price: '150000', currency: 'IDR', offerUrl: 'https://example.com/events/latte-art', availability: 'InStock',
      },
      rows: {},
    },
    build: ({ fields: f }) => {
      const place = f.locationName || f.address ? { '@type': 'Place', name: f.locationName, address: f.address } : undefined
      const virtual = f.onlineUrl ? { '@type': 'VirtualLocation', url: f.onlineUrl } : undefined
      const location = place && virtual ? [place, virtual] : (place ?? virtual)
      return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: f.name,
        description: f.description,
        startDate: f.startDate,
        endDate: f.endDate,
        eventAttendanceMode: schemaUrl(f.mode),
        eventStatus: schemaUrl(f.status),
        location,
        image: f.image,
        organizer: f.organizerName ? { '@type': 'Organization', name: f.organizerName, url: f.organizerUrl } : undefined,
        offers: num(f.price) !== undefined || f.offerUrl ? { '@type': 'Offer', price: num(f.price), priceCurrency: f.currency?.toUpperCase(), url: f.offerUrl, availability: schemaUrl(f.availability) } : undefined,
      }
    },
  },
  {
    id: 'BreadcrumbList',
    name: 'Breadcrumb',
    fields: [],
    rows: [{ key: 'items', label: 'Trail (top level first)', item: 'level', required: true, fields: [{ key: 'name', label: 'Name' }, { key: 'url', label: 'URL', kind: 'url' }] }],
    example: {
      fields: {},
      rows: { items: [{ name: 'Home', url: 'https://example.com/' }, { name: 'Shop', url: 'https://example.com/shop' }, { name: 'Gayo Arabica 250 g', url: 'https://example.com/shop/gayo-250' }] },
    },
    build: ({ rows }) => ({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: (rows.items ?? []).filter((r) => r.name?.trim()).map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, item: r.url })),
    }),
  },
  {
    id: 'WebSite',
    name: 'Website + search',
    fields: [
      { key: 'name', label: 'Site name', required: true },
      { key: 'alternateName', label: 'Alternate name' },
      { key: 'url', label: 'Home page URL', kind: 'url', required: true },
      { key: 'search', label: 'Search URL template', kind: 'url', placeholder: 'https://example.com/search?q={search_term_string}', help: 'Must contain {search_term_string}.' },
    ],
    example: {
      fields: { name: 'Example Coffee', alternateName: 'Fresh Roast', url: 'https://example.com/', search: 'https://example.com/search?q={search_term_string}' },
      rows: {},
    },
    build: ({ fields: f }) => ({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: f.name,
      alternateName: f.alternateName,
      url: f.url,
      potentialAction: f.search?.includes('{search_term_string}')
        ? { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: f.search }, 'query-input': 'required name=search_term_string' }
        : undefined,
    }),
  },
  {
    id: 'Recipe',
    name: 'Recipe',
    fields: [
      { key: 'name', label: 'Recipe name', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'image', label: 'Image URL(s)', kind: 'url', required: true, help: 'Separate several with commas.' },
      { key: 'authorName', label: 'Author' },
      { key: 'prepTime', label: 'Prep time (minutes)', kind: 'number' },
      { key: 'cookTime', label: 'Cook time (minutes)', kind: 'number' },
      { key: 'recipeYield', label: 'Yield', placeholder: '4 servings' },
      { key: 'category', label: 'Category', placeholder: 'Dessert' },
      { key: 'cuisine', label: 'Cuisine', placeholder: 'Indonesian' },
      { key: 'calories', label: 'Calories per serving', kind: 'number' },
      { key: 'keywords', label: 'Keywords', placeholder: 'iced coffee, summer' },
      { key: 'ratingValue', label: 'Average rating (1–5)', kind: 'number' },
      { key: 'ratingCount', label: 'Number of ratings', kind: 'number' },
    ],
    rows: [
      { key: 'ingredients', label: 'Ingredients', item: 'ingredient', required: true, fields: [{ key: 'text', label: 'Ingredient' }] },
      { key: 'steps', label: 'Instructions', item: 'step', required: true, fields: [{ key: 'text', label: 'Step', kind: 'textarea' }] },
    ],
    example: {
      fields: { name: 'Es Kopi Susu Gula Aren', description: 'Indonesian iced coffee with palm sugar syrup and milk.', image: 'https://example.com/images/es-kopi-susu.jpg', authorName: 'Rina Wijaya', prepTime: '5', cookTime: '5', recipeYield: '2 glasses', category: 'Drink', cuisine: 'Indonesian', calories: '180', keywords: 'iced coffee, palm sugar', ratingValue: '4.9', ratingCount: '58' },
      rows: {
        ingredients: [{ text: '2 shots espresso' }, { text: '40 ml palm sugar syrup' }, { text: '300 ml fresh milk' }, { text: 'Ice cubes' }],
        steps: [{ text: 'Brew two shots of espresso.' }, { text: 'Add palm sugar syrup and ice to two glasses.' }, { text: 'Pour in the milk, then top with espresso. Stir before drinking.' }],
      },
    },
    build: ({ fields: f, rows }) => {
      const prep = Number(f.prepTime) || 0
      const cook = Number(f.cookTime) || 0
      return {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: f.name,
        description: f.description,
        image: imageList(f.image),
        author: person(f.authorName),
        prepTime: minutesToDuration(f.prepTime),
        cookTime: minutesToDuration(f.cookTime),
        totalTime: minutesToDuration(prep + cook ? String(prep + cook) : ''),
        recipeYield: f.recipeYield,
        recipeCategory: f.category,
        recipeCuisine: f.cuisine,
        keywords: f.keywords,
        nutrition: num(f.calories) !== undefined ? { '@type': 'NutritionInformation', calories: `${num(f.calories)} calories` } : undefined,
        recipeIngredient: lines(rows.ingredients, 'text'),
        recipeInstructions: lines(rows.steps, 'text').map((text) => ({ '@type': 'HowToStep', text })),
        aggregateRating: rating(f.ratingValue, f.ratingCount),
      }
    },
  },
]

export const TYPE_BY_ID = new Map(TYPES.map((t) => [t.id, t]))

/** Builds the cleaned JSON-LD object for a type. */
export function buildSchema(type: SchemaType, data: FormData): Record<string, unknown> {
  return (clean(type.build(data)) as Record<string, unknown> | undefined) ?? { '@context': 'https://schema.org', '@type': type.id }
}

/** Wraps JSON-LD in a script tag; `<` is escaped so text can never close the tag early. */
export function toScriptTag(obj: unknown): string {
  const json = JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">\n${json}\n</script>`
}

/** Required fields and row groups that are still empty. */
export function missingRequired(type: SchemaType, data: FormData): string[] {
  const out: string[] = []
  for (const f of type.fields) if (f.required && !data.fields[f.key]?.trim()) out.push(f.label)
  for (const r of type.rows ?? []) {
    if (r.required && !(data.rows[r.key] ?? []).some((row) => Object.entries(row).some(([k, v]) => !k.startsWith('_') && v?.trim()))) out.push(r.label)
  }
  return out
}
