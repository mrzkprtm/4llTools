export type Category = 'alkali' | 'alkaline' | 'transition' | 'post-transition' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide' | 'unknown'
export type State = 'solid' | 'liquid' | 'gas' | 'unknown'

export interface Element {
  z: number
  symbol: string
  name: string
  /** Standard atomic weight (or mass number of the most stable isotope). */
  mass: number
  category: Category
  /** 1–18, or null for the lanthanides and actinides (f-block). */
  group: number | null
  period: number
  /** Pauling electronegativity, null where unknown. */
  en: number | null
  /** Atomic radius in pm (calculated, with empirical values where no calculated one exists). */
  radius: number | null
  /** Melting point in kelvin (null where unknown). */
  melt: number | null
  /** State at room temperature (25 °C, 1 atm). */
  state: State
}

// symbol, name, mass, category, electronegativity, radius (pm), melting point (K). "-" = unknown.
const RAW = `H,Hydrogen,1.008,nonmetal,2.20,53,13.99
He,Helium,4.0026,noble,-,31,-
Li,Lithium,6.94,alkali,0.98,167,453.65
Be,Beryllium,9.0122,alkaline,1.57,112,1560
B,Boron,10.81,metalloid,2.04,87,2349
C,Carbon,12.011,nonmetal,2.55,67,3823
N,Nitrogen,14.007,nonmetal,3.04,56,63.15
O,Oxygen,15.999,nonmetal,3.44,48,54.36
F,Fluorine,18.998,halogen,3.98,42,53.48
Ne,Neon,20.180,noble,-,38,24.56
Na,Sodium,22.990,alkali,0.93,190,370.94
Mg,Magnesium,24.305,alkaline,1.31,145,923
Al,Aluminum,26.982,post-transition,1.61,118,933.47
Si,Silicon,28.085,metalloid,1.90,111,1687
P,Phosphorus,30.974,nonmetal,2.19,98,317.3
S,Sulfur,32.06,nonmetal,2.58,88,388.36
Cl,Chlorine,35.45,halogen,3.16,79,171.6
Ar,Argon,39.948,noble,-,71,83.81
K,Potassium,39.098,alkali,0.82,243,336.53
Ca,Calcium,40.078,alkaline,1.00,194,1115
Sc,Scandium,44.956,transition,1.36,184,1814
Ti,Titanium,47.867,transition,1.54,176,1941
V,Vanadium,50.942,transition,1.63,171,2183
Cr,Chromium,51.996,transition,1.66,166,2180
Mn,Manganese,54.938,transition,1.55,161,1519
Fe,Iron,55.845,transition,1.83,156,1811
Co,Cobalt,58.933,transition,1.88,152,1768
Ni,Nickel,58.693,transition,1.91,149,1728
Cu,Copper,63.546,transition,1.90,145,1357.77
Zn,Zinc,65.38,transition,1.65,142,692.68
Ga,Gallium,69.723,post-transition,1.81,136,302.91
Ge,Germanium,72.630,metalloid,2.01,125,1211.4
As,Arsenic,74.922,metalloid,2.18,114,1090
Se,Selenium,78.971,nonmetal,2.55,103,494
Br,Bromine,79.904,halogen,2.96,94,265.8
Kr,Krypton,83.798,noble,3.00,88,115.78
Rb,Rubidium,85.468,alkali,0.82,265,312.46
Sr,Strontium,87.62,alkaline,0.95,219,1050
Y,Yttrium,88.906,transition,1.22,212,1799
Zr,Zirconium,91.224,transition,1.33,206,2128
Nb,Niobium,92.906,transition,1.6,198,2750
Mo,Molybdenum,95.95,transition,2.16,190,2896
Tc,Technetium,98,transition,1.9,183,2430
Ru,Ruthenium,101.07,transition,2.2,178,2607
Rh,Rhodium,102.91,transition,2.28,173,2237
Pd,Palladium,106.42,transition,2.20,169,1828.05
Ag,Silver,107.87,transition,1.93,165,1234.93
Cd,Cadmium,112.41,transition,1.69,161,594.22
In,Indium,114.82,post-transition,1.78,156,429.75
Sn,Tin,118.71,post-transition,1.96,145,505.08
Sb,Antimony,121.76,metalloid,2.05,133,903.78
Te,Tellurium,127.60,metalloid,2.1,123,722.66
I,Iodine,126.90,halogen,2.66,115,386.85
Xe,Xenon,131.29,noble,2.6,108,161.4
Cs,Cesium,132.91,alkali,0.79,298,301.59
Ba,Barium,137.33,alkaline,0.89,253,1000
La,Lanthanum,138.91,lanthanide,1.10,195,1193
Ce,Cerium,140.12,lanthanide,1.12,185,1068
Pr,Praseodymium,140.91,lanthanide,1.13,247,1208
Nd,Neodymium,144.24,lanthanide,1.14,206,1297
Pm,Promethium,145,lanthanide,1.13,205,1315
Sm,Samarium,150.36,lanthanide,1.17,238,1345
Eu,Europium,151.96,lanthanide,1.2,231,1099
Gd,Gadolinium,157.25,lanthanide,1.2,233,1585
Tb,Terbium,158.93,lanthanide,1.1,225,1629
Dy,Dysprosium,162.50,lanthanide,1.22,228,1680
Ho,Holmium,164.93,lanthanide,1.23,226,1734
Er,Erbium,167.26,lanthanide,1.24,226,1802
Tm,Thulium,168.93,lanthanide,1.25,222,1818
Yb,Ytterbium,173.05,lanthanide,1.1,222,1097
Lu,Lutetium,174.97,lanthanide,1.27,217,1925
Hf,Hafnium,178.49,transition,1.3,208,2506
Ta,Tantalum,180.95,transition,1.5,200,3290
W,Tungsten,183.84,transition,2.36,193,3695
Re,Rhenium,186.21,transition,1.9,188,3459
Os,Osmium,190.23,transition,2.2,185,3306
Ir,Iridium,192.22,transition,2.20,180,2719
Pt,Platinum,195.08,transition,2.28,177,2041.4
Au,Gold,196.97,transition,2.54,174,1337.33
Hg,Mercury,200.59,transition,2.00,171,234.32
Tl,Thallium,204.38,post-transition,1.62,156,577
Pb,Lead,207.2,post-transition,2.33,154,600.61
Bi,Bismuth,208.98,post-transition,2.02,143,544.7
Po,Polonium,209,post-transition,2.0,135,527
At,Astatine,210,halogen,2.2,127,575
Rn,Radon,222,noble,2.2,120,202
Fr,Francium,223,alkali,0.79,-,300
Ra,Radium,226,alkaline,0.9,215,973
Ac,Actinium,227,actinide,1.1,195,1323
Th,Thorium,232.04,actinide,1.3,180,2023
Pa,Protactinium,231.04,actinide,1.5,180,1841
U,Uranium,238.03,actinide,1.38,175,1405.3
Np,Neptunium,237,actinide,1.36,175,912
Pu,Plutonium,244,actinide,1.28,175,912.5
Am,Americium,243,actinide,1.13,175,1449
Cm,Curium,247,actinide,1.28,-,1613
Bk,Berkelium,247,actinide,1.3,-,1259
Cf,Californium,251,actinide,1.3,-,1173
Es,Einsteinium,252,actinide,1.3,-,1133
Fm,Fermium,257,actinide,1.3,-,-
Md,Mendelevium,258,actinide,1.3,-,-
No,Nobelium,259,actinide,1.3,-,-
Lr,Lawrencium,266,actinide,1.3,-,-
Rf,Rutherfordium,267,transition,-,-,-
Db,Dubnium,268,transition,-,-,-
Sg,Seaborgium,269,transition,-,-,-
Bh,Bohrium,270,transition,-,-,-
Hs,Hassium,269,transition,-,-,-
Mt,Meitnerium,278,unknown,-,-,-
Ds,Darmstadtium,281,unknown,-,-,-
Rg,Roentgenium,282,unknown,-,-,-
Cn,Copernicium,285,unknown,-,-,-
Nh,Nihonium,286,unknown,-,-,-
Fl,Flerovium,289,unknown,-,-,-
Mc,Moscovium,290,unknown,-,-,-
Lv,Livermorium,293,unknown,-,-,-
Ts,Tennessine,294,unknown,-,-,-
Og,Oganesson,294,unknown,-,-,-`

const PERIOD_START = [1, 3, 11, 19, 37, 55, 87, 119]
const GASES = new Set(['H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn'])
const LIQUIDS = new Set(['Br', 'Hg'])

/** Period and group from the atomic number. Lanthanides and actinides have no group. */
export function periodGroup(z: number): { period: number; group: number | null } {
  const period = PERIOD_START.findIndex((s, i) => z >= s && z < PERIOD_START[i + 1]) + 1
  const i = z - PERIOD_START[period - 1]
  if (period === 1) return { period, group: z === 1 ? 1 : 18 }
  if (period <= 3) return { period, group: i < 2 ? i + 1 : i + 11 }
  if (period <= 5) return { period, group: i + 1 }
  if (i < 2) return { period, group: i + 1 }
  if (i <= 16) return { period, group: null }
  return { period, group: i - 13 }
}

const num = (s: string) => (s === '-' ? null : Number(s))

export const ELEMENTS: Element[] = RAW.split('\n').map((line, idx) => {
  const [symbol, name, mass, category, en, radius, melt] = line.split(',')
  const z = idx + 1
  return {
    z,
    symbol,
    name,
    mass: Number(mass),
    category: category as Category,
    ...periodGroup(z),
    en: num(en),
    radius: num(radius),
    melt: num(melt),
    state: GASES.has(symbol) ? 'gas' : LIQUIDS.has(symbol) ? 'liquid' : z >= 100 ? 'unknown' : 'solid',
  }
})
