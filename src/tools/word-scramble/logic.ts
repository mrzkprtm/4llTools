export interface Tile {
  id: number
  letter: string
}

function shuffleArr<T>(a: T[], random: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** True when every letter is the same, so no shuffle can differ from the word. */
const allSame = (w: string) => [...w].every((c) => c === w[0])

/** Letter tiles for a word in a shuffled order that never spells the word itself. */
export function scramble(word: string, random: () => number = Math.random): Tile[] {
  const tiles = [...word].map((letter, id) => ({ id, letter }))
  if (word.length < 2 || allSame(word)) return tiles
  for (let i = 0; i < 20; i++) {
    const out = shuffleArr([...tiles], random)
    if (out.map((t) => t.letter).join('') !== word) return out
  }
  // Fallback: rotate by one, which differs from the word unless all letters match.
  return [...tiles.slice(1), tiles[0]]
}

/** Reshuffles tiles (for the Shuffle button), again never spelling `word`. */
export const reshuffle = (tiles: readonly Tile[], word: string, random: () => number = Math.random): Tile[] => {
  const letters = tiles.map((t) => t.letter).join('')
  if (letters.length < 2 || allSame(letters)) return [...tiles]
  for (let i = 0; i < 20; i++) {
    const out = shuffleArr([...tiles], random)
    const s = out.map((t) => t.letter).join('')
    if (s !== word && s !== letters) return out
  }
  return [...tiles.slice(1), tiles[0]]
}

/** Case- and space-insensitive answer check. */
export const checkAnswer = (guess: string, word: string) => guess.trim().toLowerCase().replace(/\s+/g, '') === word.toLowerCase()

/** Index of the first slot that is empty or wrong, or -1 when the guess is already right. */
export function firstWrong(slots: readonly (string | null)[], word: string): number {
  for (let i = 0; i < word.length; i++) if (slots[i] !== word[i]) return i
  return -1
}

/** Points for a solved word: 10 per letter, minus 10 per hint, plus a streak bonus. */
export const wordPoints = (word: string, hints: number, streak: number) => Math.max(5, word.length * 10 - hints * 10) + Math.min(20, streak * 2)
