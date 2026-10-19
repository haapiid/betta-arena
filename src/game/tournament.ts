// Recurring tournaments: every PERIOD days, one single-elimination bracket per division.
// Divisions are set by level, so a new fish never meets a level-30 veteran.
// Every fish pays the same entry fee into the division's pot. After a 5% arena burn the pot is split:
// champion 60%, runner-up 25%, each losing semifinalist 7.5%.
// Registration closes a while before the bell, so nobody can enter or pull out once the field is known.
//
// The arena contract (contracts/contracts/BettaArena.sol) runs the real draw and fights on chain with
// exactly the same rules; this file replays them for the bracket view and recomputes wounds.

import type { Hex } from 'viem'
import { fight, matchSeed, Rng, type Battle, type Fighter } from './battle'
import { env } from '../config'

export const PERIOD_DAYS = Number(env('VITE_TOURNAMENT_DAYS') || 3)
export const PERIOD = PERIOD_DAYS * 86_400_000
// round 1 starts at the season start (VITE_SEASON_START, an ISO date such as 2026-10-25T13:00:00Z);
// each round after that starts PERIOD later
const SEASON_START = Date.parse(env('VITE_SEASON_START') || '')
export const ANCHOR = Number.isFinite(SEASON_START) ? SEASON_START : Date.UTC(2026, 9, 25, 13, 0, 0)
export const BRACKET = 16 // most fish in one bracket
export const MIN_FIELD = 4 // fewer entrants than this and the round is called off, fees refunded
export const FEE_BPS = 500 // 5% arena burn
export const FEE = FEE_BPS / 10_000
export const MAX_PLAYER_ENTRIES = 3
// share of the pot (after the burn) for: champion, runner-up, each losing semifinalist (basis points)
export const PRIZE_BPS = [6000, 2500, 750] as const
export const PRIZE_SPLIT = PRIZE_BPS.map((b) => b / 10_000)
// registration closes this long before the bell (1 hour, or a tenth of a short round)
export const ENTRY_LOCK = Math.floor(Math.min(3600, PERIOD / 10_000)) * 1000 // whole seconds, as on chain

export type DivisionId = 'rookie' | 'pro' | 'elite'
export interface Division {
  id: DivisionId
  index: number // on-chain division number
  name: string
  min: number
  max: number
  fee: number // entry fee in whole $BETTA, the same for every fish
}
export const DIVISIONS: Division[] = [
  { id: 'rookie', index: 0, name: 'Rookie', min: 1, max: 10, fee: 25 },
  { id: 'pro', index: 1, name: 'Pro', min: 11, max: 20, fee: 100 },
  { id: 'elite', index: 2, name: 'Elite', min: 21, max: 30, fee: 300 },
]
export const divisionFor = (level: number) => DIVISIONS.find((d) => level >= d.min && level <= d.max) ?? DIVISIONS[DIVISIONS.length - 1]
export const divisionById = (id: DivisionId) => DIVISIONS.find((d) => d.id === id) ?? DIVISIONS[0]
export const divisionByIndex = (i: number) => DIVISIONS[i] ?? DIVISIONS[0]

export const startsAt = (n: number) => ANCHOR + (n - 1) * PERIOD
export const endsAt = (n: number) => ANCHOR + n * PERIOD
export const roundAt = (now: number) => Math.max(1, Math.floor((now - ANCHOR) / PERIOD) + 1)
export const locksAt = (n: number) => endsAt(n) - ENTRY_LOCK
export const entriesOpen = (n: number, now: number) => now >= startsAt(n) && now < locksAt(n)

export interface MatchResult {
  a: number // index into fighters
  b: number // -1 = bye: `a` goes through without a fight
  winner: number
  seed: Hex
}

export interface Prize {
  fighter: number // index into fighters
  place: 1 | 2 | 3 // 3 = losing semifinalist
  amount: number
}

export interface TournamentResult {
  n: number
  div: DivisionId
  resolvedAt: number
  seed: Hex
  fighters: Fighter[]
  rounds: MatchResult[][]
  champion: number
  pot: number
  fee: number
  payout: number // everything paid out (pot minus the burn)
  prizes: Prize[]
  tx?: Hex // settlement transaction
}

export const prizesOf = (r: TournamentResult): Prize[] => r.prizes
export const isBye = (m: MatchResult) => m.b < 0

// name of a round counted back from the final
export function roundName(r: number, total: number) {
  const left = total - 1 - r
  return left === 0 ? 'Final' : left === 1 ? 'Semifinal' : left === 2 ? 'Quarterfinal' : `Round of ${2 ** (left + 1)}`
}

// Fighters are in entry order. Same draw as BettaArena._bracket: shuffle the field, give byes their own
// first-round pairs, shuffle the pairs, then play every round.
export function runTournament(n: number, div: DivisionId, field: Fighter[], seed: Hex, now: number): TournamentResult {
  const rng = new Rng(seed)
  const shuffle = <T,>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = rng.next(i + 1)
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  let size = 2
  while (size < field.length) size *= 2
  const order = shuffle(field.map((_, i) => i))
  const byes = size - field.length
  const pairs: [number, number][] = []
  for (let i = 0; i < byes; i++) pairs.push([order[i], -1])
  for (let i = byes; i < order.length; i += 2) pairs.push([order[i], order[i + 1]])
  shuffle(pairs)

  const rounds: MatchResult[][] = []
  let alive = pairs.flat()
  let r = 0
  while (alive.length > 1) {
    const ms: MatchResult[] = []
    const next: number[] = []
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i]
      const b = alive[i + 1]
      const s = matchSeed(seed, r, i / 2)
      const w = b < 0 ? a : fight(field[a], field[b], s).winner === 0 ? a : b
      ms.push({ a, b, winner: w, seed: s })
      next.push(w)
    }
    rounds.push(ms)
    alive = next
    r++
  }
  const champion = alive[0]
  const pot = field.reduce((s, f) => s + f.stake, 0)
  const fee = Math.floor((pot * FEE_BPS) / 10_000)
  const payout = pot - fee

  // the final's loser is runner-up, the semifinal losers share third
  const loser = (m: MatchResult) => (m.winner === m.a ? m.b : m.a)
  const final = rounds[rounds.length - 1]?.[0]
  const semis = rounds.length >= 2 ? rounds[rounds.length - 2].filter((m) => !isBye(m)) : []
  const prizes: Prize[] = [{ fighter: champion, place: 1, amount: 0 }]
  if (final && !isBye(final)) prizes.push({ fighter: loser(final), place: 2, amount: 0 })
  for (const m of semis) prizes.push({ fighter: loser(m), place: 3, amount: 0 })
  for (const pz of prizes) pz.amount = Math.floor((payout * PRIZE_BPS[pz.place - 1]) / 10_000)
  // rounding leftovers, and shares of places nobody reached, go to the champion
  prizes[0].amount += payout - prizes.reduce((s, pz) => s + pz.amount, 0)

  return { n, div, resolvedAt: now, seed, fighters: field, rounds, champion, pot, fee, payout, prizes }
}

export function replay(res: TournamentResult, round: number, idx: number): Battle {
  const m = res.rounds[round][idx]
  return fight(res.fighters[m.a], res.fighters[m.b], m.seed)
}

// wounds and record each fish brings home
export function injuries(res: TournamentResult): Map<string, { lost: number; wins: number; losses: number }> {
  const out = new Map<string, { lost: number; wins: number; losses: number }>()
  res.rounds.forEach((ms, r) =>
    ms.forEach((m, i) => {
      if (isBye(m)) return
      const b = replay(res, r, i)
      ;[m.a, m.b].forEach((fi, side) => {
        const f = res.fighters[fi]
        const end = b.events.length ? b.events[b.events.length - 1].hp[side] : b.start[side]
        const frac = Math.max(0, b.start[side] - end) / b.max[side]
        const cur = out.get(f.id) ?? { lost: 0, wins: 0, losses: 0 }
        cur.lost += Math.round(frac * 22) + (m.winner === fi ? 0 : 6)
        if (m.winner === fi) cur.wins++
        else cur.losses++
        out.set(f.id, cur)
      })
    }),
  )
  return out
}

export const XP_WIN = 40
export const XP_LOSS = 15
