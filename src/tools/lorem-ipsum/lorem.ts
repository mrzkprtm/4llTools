const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ' +
  'ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure ' +
  'in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt ' +
  'culpa qui officia deserunt mollit anim id est laborum'
).split(' ')

const pick = (rand: () => number) => WORDS[Math.floor(rand() * WORDS.length)]

export function words(n: number, rand = Math.random): string {
  return Array.from({ length: n }, () => pick(rand)).join(' ')
}

export function sentence(rand = Math.random): string {
  const s = words(8 + Math.floor(rand() * 10), rand)
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

export function paragraph(rand = Math.random): string {
  return Array.from({ length: 4 + Math.floor(rand() * 4) }, () => sentence(rand)).join(' ')
}

export type LoremUnit = 'paragraphs' | 'sentences' | 'words'

export function lorem(count: number, unit: LoremUnit, classicStart: boolean, rand = Math.random): string {
  let out: string
  if (unit === 'words') out = words(count, rand)
  else if (unit === 'sentences') out = Array.from({ length: count }, () => sentence(rand)).join(' ')
  else out = Array.from({ length: count }, () => paragraph(rand)).join('\n\n')
  if (!classicStart || !out) return out
  const start = 'Lorem ipsum dolor sit amet'
  if (unit === 'words') return [...start.split(' '), ...out.split(' ')].slice(0, count).join(' ')
  return start + ', ' + out.charAt(0).toLowerCase() + out.slice(1)
}
