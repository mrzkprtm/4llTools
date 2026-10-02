export type Lang = 'en' | 'id'
export type Difficulty = 'easy' | 'medium' | 'hard'

const list = (s: string) => s.trim().split(/\s+/)

/** Family-friendly word lists: easy 3–4 letters, medium 5–6, hard 7+. */
export const WORDS: Record<Lang, Record<Difficulty, string[]>> = {
  en: {
    easy: list(`cat dog sun hat cup bus egg pen box red fox owl bee ant cow pig map toy bed jam
      fish frog milk cake book tree star moon rain snow ball kite duck bird lion bear ship boat door
      hand foot nose king song leaf rose corn farm game`),
    medium: list(`apple bread chair clock plant tiger zebra horse mouse table water smile happy
      pizza lemon mango beach cloud river ocean train plane house juice candy sugar paper pencil
      rabbit monkey garden window yellow orange purple silver dinner summer winter school friend
      bottle circle flower jungle puzzle rocket turtle`),
    hard: list(`elephant dinosaur umbrella giraffe kangaroo sandwich mountain pineapple chocolate
      butterfly rainbow penguin dolphin octopus library hospital computer keyboard blanket
      birthday treasure vacation airplane backpack homework painting dragonfly football
      basketball strawberry watermelon adventure astronaut universe telescope volcano
      waterfall snowflake sunflower lighthouse crocodile tomorrow together kitchen bicycle
      calendar dentist hamburger`),
  },
  id: {
    easy: list(`ibu ayah adik kaki mata buku meja kue nasi roti susu teh air api batu bola kuda
      sapi ayam ikan kucing gigi baju topi tas mobil bus kapal awan hujan pagi siang sore malam
      laut danau pohon daun bunga padi jagung apel duku salak nanas madu gula garam`),
    medium: list(`rumah pintu jendela sekolah teman gunung sungai pantai kereta sepeda pesawat
      jeruk mangga pisang durian rambutan semangka kelinci harimau gajah burung kupu monyet
      kambing bebek kursi lemari kasur bantal selimut piring gelas sendok garpu pensil kertas
      celana sepatu payung jam senang lapar haus pelangi bintang bulan matahari kebun`),
    hard: list(`perpustakaan komputer keluarga sekolahan pemandangan kebersihan persahabatan
      pengalaman petualangan kesehatan pendidikan permainan pertanian perjalanan pelabuhan
      bendungan kendaraan ambulans kupu-kupu jerapah kanguru lumba-lumba gurita penyu
      dinosaurus astronaut kepiting belalang cenderawasih komodo orangutan harimau-sumatra
      matematika ilmuwan pelukis penulis penyanyi pemadam dokter-gigi arsitek bendera
      kemerdekaan persatuan gotong-royong rendang sate-ayam martabak lemper onde-onde`),
  },
}

/** Words usable in the game: letters only (hyphenated words are skipped). */
export const playable = (lang: Lang, diff: Difficulty) => WORDS[lang][diff].filter((w) => /^[a-z]+$/.test(w))
