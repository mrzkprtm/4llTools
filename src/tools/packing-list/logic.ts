/** Packing list generator. Pure and tested. */

export type TripType = 'beach' | 'city' | 'business' | 'hiking' | 'mudik' | 'umrah'
export type Weather = 'hot' | 'rainy' | 'cold'
export type Category = 'Documents' | 'Clothes' | 'Toiletries' | 'Health' | 'Electronics' | 'Extras'

export const CATEGORIES: readonly Category[] = ['Documents', 'Clothes', 'Toiletries', 'Health', 'Electronics', 'Extras']

export const TRIP_TYPES: readonly (readonly [TripType, string])[] = [
  ['beach', 'Beach'],
  ['city', 'City'],
  ['business', 'Business'],
  ['hiking', 'Hiking'],
  ['mudik', 'Mudik / family'],
  ['umrah', 'Umrah'],
]

export const WEATHERS: readonly (readonly [Weather, string])[] = [
  ['hot', 'Hot'],
  ['rainy', 'Rainy'],
  ['cold', 'Cold'],
]

export interface TripSettings {
  type: TripType
  weather: Weather
  days: number
  travelers: number
  laundry: boolean
  abroad: boolean
}

export interface PackItem {
  id: string
  name: string
  category: Category
  qty: number
}

interface Ctx extends TripSettings {
  /** Days of clothes to pack: all days, or at most 4 when you can do laundry. */
  wear: number
  is: (...types: TripType[]) => boolean
}

interface Rule {
  id: string
  name: string
  category: Category
  /** Quantity for one traveler (or for the group when `shared`). 0 leaves the item out. */
  qty: (c: Ctx) => number
  shared?: boolean
}

const one = () => 1
const when = (test: (c: Ctx) => boolean, qty: (c: Ctx) => number = one) => (c: Ctx) => (test(c) ? qty(c) : 0)

const RULES: Rule[] = [
  // Documents
  { id: 'id', name: 'ID card (KTP)', category: 'Documents', qty: one },
  { id: 'passport', name: 'Passport (6+ months valid)', category: 'Documents', qty: when((c) => c.abroad || c.is('umrah')) },
  { id: 'visa', name: 'Visa and printed bookings', category: 'Documents', qty: when((c) => c.abroad || c.is('umrah')), shared: true },
  { id: 'tickets', name: 'Tickets and hotel booking', category: 'Documents', qty: one, shared: true },
  { id: 'wallet', name: 'Wallet, cash and cards', category: 'Documents', qty: one },
  { id: 'vaccine', name: 'Meningitis vaccine certificate', category: 'Documents', qty: when((c) => c.is('umrah')) },
  { id: 'bizcards', name: 'Business cards', category: 'Documents', qty: when((c) => c.is('business')) },
  // Clothes
  { id: 'underwear', name: 'Underwear', category: 'Clothes', qty: (c) => c.wear + 1 },
  { id: 'tops', name: 'T-shirts / tops', category: 'Clothes', qty: (c) => (c.is('business') ? Math.ceil(c.wear / 2) : c.wear) },
  { id: 'bottoms', name: 'Pants / skirts', category: 'Clothes', qty: (c) => Math.max(1, Math.ceil(c.wear / (c.is('business') ? 3 : 2))) },
  { id: 'socks', name: 'Pairs of socks', category: 'Clothes', qty: (c) => (c.is('beach') && c.weather === 'hot' ? 1 : c.wear + (c.is('hiking') ? 1 : 0)) },
  { id: 'sleep', name: 'Sleepwear', category: 'Clothes', qty: (c) => (c.days > 7 && !c.laundry ? 2 : 1) },
  { id: 'shirts', name: 'Work shirts', category: 'Clothes', qty: when((c) => c.is('business'), (c) => c.wear) },
  { id: 'blazer', name: 'Blazer / formal outfit', category: 'Clothes', qty: when((c) => c.is('business')) },
  { id: 'dress-shoes', name: 'Formal shoes', category: 'Clothes', qty: when((c) => c.is('business')) },
  { id: 'swim', name: 'Swimwear', category: 'Clothes', qty: when((c) => c.is('beach'), (c) => (c.days > 3 ? 2 : 1)) },
  { id: 'coverup', name: 'Beach cover-up', category: 'Clothes', qty: when((c) => c.is('beach')) },
  { id: 'boots', name: 'Hiking boots', category: 'Clothes', qty: when((c) => c.is('hiking')) },
  { id: 'quickdry', name: 'Quick-dry shirts', category: 'Clothes', qty: when((c) => c.is('hiking'), (c) => Math.min(c.wear, 3)) },
  { id: 'ihram', name: 'Ihram set (men) / abaya', category: 'Clothes', qty: when((c) => c.is('umrah'), () => 2) },
  { id: 'prayer-clothes', name: 'Mukena / prayer clothes', category: 'Clothes', qty: when((c) => c.is('umrah', 'mudik')) },
  { id: 'lebaran', name: 'Lebaran outfit', category: 'Clothes', qty: when((c) => c.is('mudik'), () => 2) },
  { id: 'jacket', name: 'Warm jacket', category: 'Clothes', qty: when((c) => c.weather === 'cold' || c.is('hiking')) },
  { id: 'thermal', name: 'Thermal base layer', category: 'Clothes', qty: when((c) => c.weather === 'cold', (c) => (c.days > 4 ? 2 : 1)) },
  { id: 'beanie', name: 'Beanie and gloves', category: 'Clothes', qty: when((c) => c.weather === 'cold') },
  { id: 'raincoat', name: 'Raincoat / poncho', category: 'Clothes', qty: when((c) => c.weather === 'rainy' || c.is('hiking')) },
  { id: 'hat', name: 'Hat and sunglasses', category: 'Clothes', qty: when((c) => c.weather === 'hot' || c.is('beach')) },
  { id: 'sandals', name: 'Sandals', category: 'Clothes', qty: when((c) => c.is('beach', 'umrah', 'mudik', 'city')) },
  { id: 'sneakers', name: 'Comfortable walking shoes', category: 'Clothes', qty: when((c) => c.is('city', 'umrah', 'mudik')) },
  // Toiletries
  { id: 'toothbrush', name: 'Toothbrush and toothpaste', category: 'Toiletries', qty: one },
  { id: 'deodorant', name: 'Deodorant', category: 'Toiletries', qty: when((c) => !c.is('umrah')) },
  { id: 'unscented', name: 'Unscented soap and deodorant (for ihram)', category: 'Toiletries', qty: when((c) => c.is('umrah')) },
  { id: 'shampoo', name: 'Shampoo and body wash', category: 'Toiletries', qty: one, shared: true },
  { id: 'sunscreen', name: 'Sunscreen', category: 'Toiletries', qty: when((c) => c.weather === 'hot' || c.is('beach', 'hiking', 'umrah')), shared: true },
  { id: 'lipbalm', name: 'Lip balm and moisturizer', category: 'Toiletries', qty: when((c) => c.weather === 'cold' || c.is('umrah')) },
  { id: 'towel', name: 'Quick-dry towel', category: 'Toiletries', qty: when((c) => c.is('beach', 'hiking')) },
  { id: 'tissues', name: 'Tissues and wet wipes', category: 'Toiletries', qty: one, shared: true },
  // Health
  { id: 'meds', name: 'Personal medicine', category: 'Health', qty: one },
  { id: 'firstaid', name: 'First aid kit', category: 'Health', qty: when((c) => c.is('hiking', 'mudik', 'umrah') || c.days > 5), shared: true },
  { id: 'masks', name: 'Face masks', category: 'Health', qty: when((c) => c.is('umrah', 'city'), (c) => Math.min(c.days, 10)) },
  { id: 'repellent', name: 'Insect repellent', category: 'Health', qty: when((c) => c.weather === 'rainy' || c.is('beach', 'hiking')), shared: true },
  { id: 'motion', name: 'Motion sickness pills', category: 'Health', qty: when((c) => c.is('mudik')), shared: true },
  // Electronics
  { id: 'charger', name: 'Phone and charger', category: 'Electronics', qty: one },
  { id: 'powerbank', name: 'Power bank', category: 'Electronics', qty: one },
  { id: 'laptop', name: 'Laptop and charger', category: 'Electronics', qty: when((c) => c.is('business')) },
  { id: 'adapter', name: 'Travel plug adapter', category: 'Electronics', qty: when((c) => c.abroad && !c.is('umrah')), shared: true },
  { id: 'adapter-g', name: 'Plug adapter (type G, Saudi)', category: 'Electronics', qty: when((c) => c.is('umrah')), shared: true },
  { id: 'headphones', name: 'Earphones', category: 'Electronics', qty: when((c) => !c.is('hiking')) },
  { id: 'headlamp', name: 'Headlamp + batteries', category: 'Electronics', qty: when((c) => c.is('hiking')) },
  // Extras
  { id: 'bottle', name: 'Reusable water bottle', category: 'Extras', qty: one },
  { id: 'daypack', name: 'Daypack', category: 'Extras', qty: when((c) => c.is('city', 'hiking', 'beach', 'umrah')) },
  { id: 'umbrella', name: 'Umbrella', category: 'Extras', qty: when((c) => c.weather === 'rainy' || c.is('umrah')), shared: true },
  { id: 'snacks', name: 'Snacks for the road', category: 'Extras', qty: when((c) => c.is('mudik', 'hiking')), shared: true },
  { id: 'oleh', name: 'Oleh-oleh (gifts for family)', category: 'Extras', qty: when((c) => c.is('mudik')), shared: true },
  { id: 'prayer-mat', name: 'Travel prayer mat', category: 'Extras', qty: when((c) => c.is('umrah', 'mudik')) },
  { id: 'quran', name: 'Pocket Quran / dua book', category: 'Extras', qty: when((c) => c.is('umrah')) },
  { id: 'dry-bag', name: 'Dry bag for phone', category: 'Extras', qty: when((c) => c.is('beach', 'hiking') || c.weather === 'rainy'), shared: true },
  { id: 'laundry-bag', name: 'Laundry bag', category: 'Extras', qty: when((c) => c.days > 3), shared: true },
  { id: 'ziplock', name: 'Ziplock bags', category: 'Extras', qty: one, shared: true },
]

export function generateList(s: TripSettings): PackItem[] {
  const days = Math.max(1, Math.round(s.days))
  const travelers = Math.max(1, Math.round(s.travelers))
  const c: Ctx = { ...s, days, travelers, wear: s.laundry ? Math.min(days, 4) : days, is: (...t) => t.includes(s.type) }
  const out: PackItem[] = []
  for (const r of RULES) {
    const q = r.qty(c)
    if (q <= 0) continue
    out.push({ id: r.id, name: r.name, category: r.category, qty: r.shared ? q : q * travelers })
  }
  return out
}
