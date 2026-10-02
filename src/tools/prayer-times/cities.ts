/** Bundled city list: [name, region, lat, lng, IANA zone, standard UTC offset]. */
export interface City {
  name: string
  region: string
  lat: number
  lng: number
  zone: string
  tz: number
}

type Row = [string, string, number, number, string, number]

const WIB = 'Asia/Jakarta'
const WITA = 'Asia/Makassar'
const WIT = 'Asia/Jayapura'

const ROWS: Row[] = [
  // Java
  ['Jakarta', 'DKI Jakarta', -6.2088, 106.8456, WIB, 7],
  ['Bogor', 'Jawa Barat', -6.5971, 106.806, WIB, 7],
  ['Depok', 'Jawa Barat', -6.4025, 106.7942, WIB, 7],
  ['Tangerang', 'Banten', -6.1783, 106.6319, WIB, 7],
  ['Tangerang Selatan', 'Banten', -6.2886, 106.7179, WIB, 7],
  ['Bekasi', 'Jawa Barat', -6.2383, 106.9756, WIB, 7],
  ['Serang', 'Banten', -6.1103, 106.164, WIB, 7],
  ['Cilegon', 'Banten', -6.0025, 106.0111, WIB, 7],
  ['Bandung', 'Jawa Barat', -6.9175, 107.6191, WIB, 7],
  ['Cimahi', 'Jawa Barat', -6.8722, 107.5425, WIB, 7],
  ['Sukabumi', 'Jawa Barat', -6.9277, 106.93, WIB, 7],
  ['Cianjur', 'Jawa Barat', -6.8168, 107.1425, WIB, 7],
  ['Garut', 'Jawa Barat', -7.2279, 107.9087, WIB, 7],
  ['Tasikmalaya', 'Jawa Barat', -7.3274, 108.2207, WIB, 7],
  ['Cirebon', 'Jawa Barat', -6.732, 108.5523, WIB, 7],
  ['Karawang', 'Jawa Barat', -6.3227, 107.3376, WIB, 7],
  ['Purwakarta', 'Jawa Barat', -6.5569, 107.4431, WIB, 7],
  ['Indramayu', 'Jawa Barat', -6.3275, 108.3249, WIB, 7],
  ['Semarang', 'Jawa Tengah', -6.9667, 110.4167, WIB, 7],
  ['Solo (Surakarta)', 'Jawa Tengah', -7.5755, 110.8243, WIB, 7],
  ['Magelang', 'Jawa Tengah', -7.4797, 110.2177, WIB, 7],
  ['Salatiga', 'Jawa Tengah', -7.3305, 110.5084, WIB, 7],
  ['Pekalongan', 'Jawa Tengah', -6.8898, 109.6746, WIB, 7],
  ['Tegal', 'Jawa Tengah', -6.8694, 109.1402, WIB, 7],
  ['Purwokerto', 'Jawa Tengah', -7.4245, 109.2302, WIB, 7],
  ['Cilacap', 'Jawa Tengah', -7.7266, 109.0096, WIB, 7],
  ['Kudus', 'Jawa Tengah', -6.8048, 110.8405, WIB, 7],
  ['Jepara', 'Jawa Tengah', -6.5887, 110.6684, WIB, 7],
  ['Klaten', 'Jawa Tengah', -7.7058, 110.6061, WIB, 7],
  ['Yogyakarta', 'DI Yogyakarta', -7.7956, 110.3695, WIB, 7],
  ['Sleman', 'DI Yogyakarta', -7.7163, 110.3552, WIB, 7],
  ['Bantul', 'DI Yogyakarta', -7.8876, 110.3289, WIB, 7],
  ['Surabaya', 'Jawa Timur', -7.2575, 112.7521, WIB, 7],
  ['Sidoarjo', 'Jawa Timur', -7.4478, 112.7183, WIB, 7],
  ['Gresik', 'Jawa Timur', -7.1557, 112.6517, WIB, 7],
  ['Malang', 'Jawa Timur', -7.9666, 112.6326, WIB, 7],
  ['Batu', 'Jawa Timur', -7.8671, 112.5239, WIB, 7],
  ['Kediri', 'Jawa Timur', -7.848, 112.0178, WIB, 7],
  ['Blitar', 'Jawa Timur', -8.0955, 112.1609, WIB, 7],
  ['Madiun', 'Jawa Timur', -7.6298, 111.5239, WIB, 7],
  ['Jember', 'Jawa Timur', -8.1845, 113.6681, WIB, 7],
  ['Banyuwangi', 'Jawa Timur', -8.2192, 114.3691, WIB, 7],
  ['Probolinggo', 'Jawa Timur', -7.7543, 113.2159, WIB, 7],
  ['Pasuruan', 'Jawa Timur', -7.6453, 112.9075, WIB, 7],
  ['Mojokerto', 'Jawa Timur', -7.4722, 112.4336, WIB, 7],
  ['Tuban', 'Jawa Timur', -6.8976, 112.0648, WIB, 7],
  ['Bangkalan', 'Jawa Timur', -7.0455, 112.7351, WIB, 7],
  ['Pamekasan', 'Jawa Timur', -7.1569, 113.4744, WIB, 7],
  // Sumatra
  ['Banda Aceh', 'Aceh', 5.5483, 95.3238, WIB, 7],
  ['Lhokseumawe', 'Aceh', 5.1801, 97.1507, WIB, 7],
  ['Medan', 'Sumatera Utara', 3.5952, 98.6722, WIB, 7],
  ['Binjai', 'Sumatera Utara', 3.6001, 98.4854, WIB, 7],
  ['Pematangsiantar', 'Sumatera Utara', 2.9595, 99.0687, WIB, 7],
  ['Sibolga', 'Sumatera Utara', 1.7427, 98.7792, WIB, 7],
  ['Padang', 'Sumatera Barat', -0.9471, 100.4172, WIB, 7],
  ['Bukittinggi', 'Sumatera Barat', -0.3056, 100.3692, WIB, 7],
  ['Pekanbaru', 'Riau', 0.5071, 101.4478, WIB, 7],
  ['Dumai', 'Riau', 1.6666, 101.4001, WIB, 7],
  ['Batam', 'Kepulauan Riau', 1.0456, 104.0305, WIB, 7],
  ['Tanjung Pinang', 'Kepulauan Riau', 0.9186, 104.4554, WIB, 7],
  ['Jambi', 'Jambi', -1.6101, 103.6131, WIB, 7],
  ['Palembang', 'Sumatera Selatan', -2.9761, 104.7754, WIB, 7],
  ['Prabumulih', 'Sumatera Selatan', -3.4323, 104.2358, WIB, 7],
  ['Bengkulu', 'Bengkulu', -3.7928, 102.2608, WIB, 7],
  ['Bandar Lampung', 'Lampung', -5.3971, 105.2668, WIB, 7],
  ['Metro', 'Lampung', -5.1131, 105.3067, WIB, 7],
  ['Pangkal Pinang', 'Bangka Belitung', -2.1291, 106.1138, WIB, 7],
  ['Tanjung Pandan', 'Bangka Belitung', -2.75, 107.65, WIB, 7],
  // Kalimantan
  ['Pontianak', 'Kalimantan Barat', -0.0263, 109.3425, WIB, 7],
  ['Singkawang', 'Kalimantan Barat', 0.9067, 108.9846, WIB, 7],
  ['Palangka Raya', 'Kalimantan Tengah', -2.2136, 113.9108, WIB, 7],
  ['Sampit', 'Kalimantan Tengah', -2.5387, 112.9491, WIB, 7],
  ['Banjarmasin', 'Kalimantan Selatan', -3.3186, 114.5944, WITA, 8],
  ['Banjarbaru', 'Kalimantan Selatan', -3.4572, 114.8103, WITA, 8],
  ['Samarinda', 'Kalimantan Timur', -0.5022, 117.1536, WITA, 8],
  ['Balikpapan', 'Kalimantan Timur', -1.2379, 116.8529, WITA, 8],
  ['Bontang', 'Kalimantan Timur', 0.1333, 117.5, WITA, 8],
  ['Nusantara (IKN)', 'Kalimantan Timur', -0.9737, 116.7053, WITA, 8],
  ['Tarakan', 'Kalimantan Utara', 3.3, 117.6333, WITA, 8],
  ['Tanjung Selor', 'Kalimantan Utara', 2.8375, 117.3653, WITA, 8],
  // Bali & Nusa Tenggara
  ['Denpasar', 'Bali', -8.6705, 115.2126, WITA, 8],
  ['Singaraja', 'Bali', -8.112, 115.0882, WITA, 8],
  ['Mataram', 'NTB', -8.5833, 116.1167, WITA, 8],
  ['Bima', 'NTB', -8.4606, 118.7278, WITA, 8],
  ['Sumbawa Besar', 'NTB', -8.4932, 117.4201, WITA, 8],
  ['Kupang', 'NTT', -10.1772, 123.607, WITA, 8],
  ['Ende', 'NTT', -8.8432, 121.6623, WITA, 8],
  ['Labuan Bajo', 'NTT', -8.4964, 119.8877, WITA, 8],
  ['Maumere', 'NTT', -8.6199, 122.2111, WITA, 8],
  // Sulawesi
  ['Makassar', 'Sulawesi Selatan', -5.1477, 119.4327, WITA, 8],
  ['Parepare', 'Sulawesi Selatan', -4.0135, 119.6255, WITA, 8],
  ['Palopo', 'Sulawesi Selatan', -2.9925, 120.1969, WITA, 8],
  ['Bone (Watampone)', 'Sulawesi Selatan', -4.5386, 120.3279, WITA, 8],
  ['Mamuju', 'Sulawesi Barat', -2.6748, 118.8885, WITA, 8],
  ['Palu', 'Sulawesi Tengah', -0.8917, 119.8707, WITA, 8],
  ['Kendari', 'Sulawesi Tenggara', -3.9985, 122.5129, WITA, 8],
  ['Baubau', 'Sulawesi Tenggara', -5.4667, 122.6333, WITA, 8],
  ['Gorontalo', 'Gorontalo', 0.5435, 123.0568, WITA, 8],
  ['Manado', 'Sulawesi Utara', 1.4748, 124.8421, WITA, 8],
  ['Bitung', 'Sulawesi Utara', 1.4404, 125.1217, WITA, 8],
  // Maluku & Papua
  ['Ambon', 'Maluku', -3.6954, 128.1814, WIT, 9],
  ['Tual', 'Maluku', -5.6431, 132.7475, WIT, 9],
  ['Ternate', 'Maluku Utara', 0.7893, 127.3842, WIT, 9],
  ['Sofifi', 'Maluku Utara', 0.7379, 127.5588, WIT, 9],
  ['Jayapura', 'Papua', -2.5337, 140.7181, WIT, 9],
  ['Sorong', 'Papua Barat Daya', -0.8762, 131.2558, WIT, 9],
  ['Manokwari', 'Papua Barat', -0.8615, 134.062, WIT, 9],
  ['Merauke', 'Papua Selatan', -8.4932, 140.4018, WIT, 9],
  ['Timika', 'Papua Tengah', -4.5467, 136.8837, WIT, 9],
  ['Nabire', 'Papua Tengah', -3.3667, 135.4833, WIT, 9],
  ['Wamena', 'Papua Pegunungan', -4.0928, 138.9459, WIT, 9],
  ['Biak', 'Papua', -1.1761, 136.082, WIT, 9],
  // World
  ['Makkah', 'Saudi Arabia', 21.4225, 39.8262, 'Asia/Riyadh', 3],
  ['Madinah', 'Saudi Arabia', 24.4672, 39.6112, 'Asia/Riyadh', 3],
  ['Riyadh', 'Saudi Arabia', 24.7136, 46.6753, 'Asia/Riyadh', 3],
  ['Jeddah', 'Saudi Arabia', 21.4858, 39.1925, 'Asia/Riyadh', 3],
  ['Dubai', 'UAE', 25.2048, 55.2708, 'Asia/Dubai', 4],
  ['Doha', 'Qatar', 25.2854, 51.531, 'Asia/Qatar', 3],
  ['Kuwait City', 'Kuwait', 29.3759, 47.9774, 'Asia/Kuwait', 3],
  ['Cairo', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo', 2],
  ['Istanbul', 'Türkiye', 41.0082, 28.9784, 'Europe/Istanbul', 3],
  ['Tehran', 'Iran', 35.6892, 51.389, 'Asia/Tehran', 3.5],
  ['Karachi', 'Pakistan', 24.8607, 67.0011, 'Asia/Karachi', 5],
  ['Lahore', 'Pakistan', 31.5204, 74.3587, 'Asia/Karachi', 5],
  ['Delhi', 'India', 28.6139, 77.209, 'Asia/Kolkata', 5.5],
  ['Mumbai', 'India', 19.076, 72.8777, 'Asia/Kolkata', 5.5],
  ['Dhaka', 'Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka', 6],
  ['Kuala Lumpur', 'Malaysia', 3.139, 101.6869, 'Asia/Kuala_Lumpur', 8],
  ['Johor Bahru', 'Malaysia', 1.4927, 103.7414, 'Asia/Kuala_Lumpur', 8],
  ['Singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore', 8],
  ['Bandar Seri Begawan', 'Brunei', 4.9031, 114.9398, 'Asia/Brunei', 8],
  ['Bangkok', 'Thailand', 13.7563, 100.5018, 'Asia/Bangkok', 7],
  ['Manila', 'Philippines', 14.5995, 120.9842, 'Asia/Manila', 8],
  ['Dili', 'Timor-Leste', -8.5569, 125.5603, 'Asia/Dili', 9],
  ['Hong Kong', 'China', 22.3193, 114.1694, 'Asia/Hong_Kong', 8],
  ['Beijing', 'China', 39.9042, 116.4074, 'Asia/Shanghai', 8],
  ['Seoul', 'South Korea', 37.5665, 126.978, 'Asia/Seoul', 9],
  ['Tokyo', 'Japan', 35.6762, 139.6503, 'Asia/Tokyo', 9],
  ['Taipei', 'Taiwan', 25.033, 121.5654, 'Asia/Taipei', 8],
  ['Sydney', 'Australia', -33.8688, 151.2093, 'Australia/Sydney', 10],
  ['Melbourne', 'Australia', -37.8136, 144.9631, 'Australia/Melbourne', 10],
  ['Perth', 'Australia', -31.9505, 115.8605, 'Australia/Perth', 8],
  ['Auckland', 'New Zealand', -36.8485, 174.7633, 'Pacific/Auckland', 12],
  ['London', 'United Kingdom', 51.5074, -0.1278, 'Europe/London', 0],
  ['Paris', 'France', 48.8566, 2.3522, 'Europe/Paris', 1],
  ['Amsterdam', 'Netherlands', 52.3676, 4.9041, 'Europe/Amsterdam', 1],
  ['Berlin', 'Germany', 52.52, 13.405, 'Europe/Berlin', 1],
  ['Moscow', 'Russia', 55.7558, 37.6173, 'Europe/Moscow', 3],
  ['New York', 'USA', 40.7128, -74.006, 'America/New_York', -5],
  ['Los Angeles', 'USA', 34.0522, -118.2437, 'America/Los_Angeles', -8],
  ['Toronto', 'Canada', 43.6532, -79.3832, 'America/Toronto', -5],
  ['Johannesburg', 'South Africa', -26.2041, 28.0473, 'Africa/Johannesburg', 2],
  ['Lagos', 'Nigeria', 6.5244, 3.3792, 'Africa/Lagos', 1],
]

export const CITIES: City[] = ROWS.map(([name, region, lat, lng, zone, tz]) => ({ name, region, lat, lng, zone, tz }))

/** Case- and accent-insensitive search over name and region; name prefix matches first. */
export function searchCities(query: string, limit = 8): City[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(query.trim())
  if (!q) return CITIES.slice(0, limit)
  const scored: [number, City][] = []
  for (const c of CITIES) {
    const n = norm(c.name)
    const r = norm(c.region)
    const s = n.startsWith(q) ? 0 : n.includes(q) ? 1 : r.includes(q) ? 2 : -1
    if (s >= 0) scored.push([s, c])
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1])
}
