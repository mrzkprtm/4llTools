/** Rally-scoring rules for badminton, table tennis and volleyball. Pure and immutable. */

export type Sport = 'badminton' | 'tabletennis' | 'volleyball'
export type Side = 0 | 1

export interface Rules {
  name: string
  points: number
  /** Points in the deciding game (volleyball's 5th set is to 15). */
  decidingPoints: number
  winBy: number
  /** First to this score wins outright (badminton 30). Infinity when there is no cap. */
  cap: number
  gamesToWin: number
  serve: 'rally' | 'alternate2'
  /** Score at which players change ends in the deciding game. */
  switchAt: number
}

export const RULES: Record<Sport, Rules> = {
  badminton: { name: 'Badminton', points: 21, decidingPoints: 21, winBy: 2, cap: 30, gamesToWin: 2, serve: 'rally', switchAt: 11 },
  tabletennis: { name: 'Table tennis', points: 11, decidingPoints: 11, winBy: 2, cap: Infinity, gamesToWin: 3, serve: 'alternate2', switchAt: 5 },
  volleyball: { name: 'Volleyball', points: 25, decidingPoints: 15, winBy: 2, cap: Infinity, gamesToWin: 3, serve: 'rally', switchAt: 8 },
}

export interface Match {
  sport: Sport
  score: [number, number]
  games: [number, number][]
  won: [number, number]
  server: Side
  /** Who served first in the current game (table tennis rotation). */
  firstServer: Side
  winner: Side | null
  /** Set when a rule says the players change ends; the UI shows it and swaps sides. */
  changeEnds: boolean
  switchedThisGame: boolean
}

export function newMatch(sport: Sport, firstServer: Side = 0, gamesToWin?: number): Match & { gamesToWin: number } {
  return { sport, score: [0, 0], games: [], won: [0, 0], server: firstServer, firstServer, winner: null, changeEnds: false, switchedThisGame: false, gamesToWin: gamesToWin ?? RULES[sport].gamesToWin }
}

export type MatchState = ReturnType<typeof newMatch>

export function isDeciding(m: MatchState): boolean {
  return m.won[0] === m.gamesToWin - 1 && m.won[1] === m.gamesToWin - 1
}

/** Points needed to win the current game. */
export function target(m: MatchState): number {
  return isDeciding(m) ? RULES[m.sport].decidingPoints : RULES[m.sport].points
}

/** Whether a score wins the game under the rules. */
export function gameWon(a: number, b: number, points: number, winBy: number, cap: number): boolean {
  return (a >= points && a - b >= winBy) || a >= cap
}

/** Table tennis: service changes every 2 points, and every point from 10–10. */
export function ttServer(first: Side, a: number, b: number): Side {
  const p = a + b
  const flips = a >= 10 && b >= 10 ? 10 + (p - 20) : Math.floor(p / 2)
  return (flips % 2 === 0 ? first : 1 - first) as Side
}

export function point(m: MatchState, side: Side): MatchState {
  if (m.winner !== null) return m
  const r = RULES[m.sport]
  const score: [number, number] = [m.score[0], m.score[1]]
  score[side]++
  const other = (1 - side) as Side
  if (gameWon(score[side], score[other], target(m), r.winBy, r.cap)) {
    const won: [number, number] = [m.won[0], m.won[1]]
    won[side]++
    const games = [...m.games, score]
    const winner = won[side] >= m.gamesToWin ? side : null
    // Next game: badminton winner serves; table tennis and volleyball alternate the first server.
    const firstServer = (r.serve === 'rally' && m.sport === 'badminton' ? side : 1 - m.firstServer) as Side
    return { ...m, score: winner === null ? [0, 0] : score, games, won, winner, firstServer, server: firstServer, changeEnds: winner === null, switchedThisGame: false }
  }
  const server = r.serve === 'rally' ? side : ttServer(m.firstServer, score[0], score[1])
  let changeEnds = false
  let switched = m.switchedThisGame
  if (isDeciding(m) && !switched && Math.max(score[0], score[1]) >= r.switchAt) {
    changeEnds = true
    switched = true
  }
  return { ...m, score, server, changeEnds, switchedThisGame: switched }
}

/** Game point / match point labels for the scoreboard. */
export function situation(m: MatchState): string {
  if (m.winner !== null) return 'Match over'
  const r = RULES[m.sport]
  const [a, b] = m.score
  const t = target(m)
  for (const s of [0, 1] as Side[]) {
    const mine = s ? b : a
    const theirs = s ? a : b
    if (gameWon(mine + 1, theirs, t, r.winBy, r.cap)) return m.won[s] === m.gamesToWin - 1 ? 'Match point' : 'Game point'
  }
  if (a === b && a >= t - 1) return 'Deuce'
  return ''
}

/** Badminton: the server serves from the right court on an even score, left on odd. */
export function serveCourt(m: MatchState): 'right' | 'left' {
  return m.score[m.server] % 2 === 0 ? 'right' : 'left'
}
