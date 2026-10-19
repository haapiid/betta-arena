// Recurring tournaments: every PERIOD days, one single-elimination bracket per division.
// Divisions are set by level, so a new fish never meets a level-30 veteran.
// Every fish pays the same entry fee into the division's pot. After a 5% arena burn the pot is split:
// champion 60%, runner-up 25%, each losing semifinalist 7.5%.
// Registration closes a while before the bell, so nobody can enter or pull out once the field is known.

import { fight, matchSeed, type Battle, type Fighter } from './battle'
import { SPECIES, type Species } from './species'
import { TRAITS, TRAIT_EVERY } from './traits'
import { hash, mulberry32 } from '../render/color'

export const PERIOD_DAYS = Number(import.meta.env.VITE_TOURNAMENT_DAYS || 3)
export const PERIOD = PERIOD_DAYS * 86_400_000
// round 1 starts at the season start (VITE_SEASON_START, an ISO date such as 2026-10-25T13:00:00Z);
// each round after that starts PERIOD later. No results exist from before the season start.
const SEASON_START = Date.parse(import.meta.env.VITE_SEASON_START || '')
export const ANCHOR = Number.isFinite(SEASON_START) ? SEASON_START : Date.UTC(2026, 9, 1, 13, 0, 0)
export const BRACKET = 16 // most fish in one bracket
export const MIN_FIELD = 4 // fewer entrants than this and the round is called off, fees refunded
export const FEE = 0.05
export const MAX_PLAYER_ENTRIES = 3
// share of the pot (after the burn) for: champion, runner-up, each losing semifinalist
export const PRIZE_SPLIT = [0.6, 0.25, 0.075] as const
// registration closes this long before the bell (1 hour, or a tenth of a short round)
export const ENTRY_LOCK = Math.min(3_600_000, PERIOD * 0.1)
// demo: fill empty bracket slots with NPC fish. At launch every fish belongs to a real wallet.
export const NPC_FILL = import.meta.env.VITE_NPC_FILL !== 'false'

export type DivisionId = 'rookie' | 'pro' | 'elite'
export interface Division {
  id: DivisionId
  name: string
  min: number
  max: number
  fee: number // entry fee, the same for every fish
}
export const DIVISIONS: Division[] = [
  { id: 'rookie', name: 'Rookie', min: 1, max: 10, fee: 25 },
  { id: 'pro', name: 'Pro', min: 11, max: 20, fee: 100 },
  { id: 'elite', name: 'Elite', min: 21, max: 30, fee: 300 },
]
export const divisionFor = (level: number) => DIVISIONS.find((d) => level >= d.min && level <= d.max) ?? DIVISIONS[DIVISIONS.length - 1]
export const divisionById = (id: DivisionId) => DIVISIONS.find((d) => d.id === id) ?? DIVISIONS[0]

export const endsAt = (n: number) => ANCHOR + n * PERIOD
export const roundAt = (now: number) => Math.max(1, Math.floor((now - ANCHOR) / PERIOD) + 1)
export const locksAt = (n: number) => endsAt(n) - ENTRY_LOCK
export const entriesOpen = (n: number, now: number) => now < locksAt(n)

// house keepers that fill the brackets; shown with an NPC tag so nobody mistakes them for players
const HANDLES = [
  'Uncle Betta', 'Pond King', 'Bettaholic', 'HM Breeder', 'Fight Club', 'Plakat Pete', 'Glass Jar', 'Ketapang Queen',
  'Madura Fins', 'Thai Breeder', 'Red Devil', 'Aquascaper', 'Larva Lord', 'Almond Leaf', 'Crowntail Carl', 'Coffee & Fins',
  'Arena Regular', 'Samurai Dojo', 'Bird Market', 'Nemo Hunter',
].map((h) => `${h} (NPC)`)
const FISH_NAMES = ['Thunder', 'Big Shot', 'Hawk', 'Ghost', 'Champ', 'Boss', 'Sultan', 'Brutus', 'Cobra', 'Typhoon', 'Ronin', 'Bandit', 'Old Man', 'Komodo', 'Ninja', 'Fortress']

export interface MatchResult {
  a: number // index into fighters
  b: number // -1 = bye: `a` goes through without a fight
  winner: number
  seed: number
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
  fighters: Fighter[]
  rounds: MatchResult[][]
  champion: number
  pot: number
  fee: number
  payout: number // everything paid out (pot minus the burn)
  prizes: Prize[]
  myStake: number
  myPayout: number
}

// results saved before prizes were split paid everything to the champion
export const prizesOf = (r: TournamentResult): Prize[] => r.prizes ?? [{ fighter: r.champion, place: 1, amount: r.payout }]
export const isBye = (m: MatchResult) => m.b < 0

// name of a round counted back from the final
export function roundName(r: number, total: number) {
  const left = total - 1 - r
  return left === 0 ? 'Final' : left === 1 ? 'Semifinal' : left === 2 ? 'Quarterfinal' : `Round of ${2 ** (left + 1)}`
}

function pickSpecies(rnd: () => number): Species {
  // rarer breeds show up less often
  const w = SPECIES.map((s) => ({ Common: 5, Uncommon: 4, Rare: 2.5, Epic: 1.4, Legendary: 0.6 })[s.rarity])
  let r = rnd() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < SPECIES.length; i++) {
    r -= w[i]
    if (r <= 0) return SPECIES[i]
  }
  return SPECIES[0]
}

export function npcField(n: number, divId: DivisionId): Fighter[] {
  const div = divisionById(divId)
  const rnd = mulberry32(hash('field', n, divId))
  const used = new Set<string>()
  return Array.from({ length: BRACKET }, (_, i) => {
    const sp = pickSpecies(rnd)
    let owner = HANDLES[Math.floor(rnd() * HANDLES.length)]
    while (used.has(owner)) owner = HANDLES[Math.floor(rnd() * HANDLES.length)]
    used.add(owner)
    const level = div.min + Math.floor(rnd() * (div.max - div.min + 1))
    const mult = 0.92 + rnd() * 0.18
    const v = (base: number, g: number) => Math.max(10, Math.round((base + (rnd() * 2 - 1) * 8 + g * (level - 1)) * mult))
    const pool = [...TRAITS]
    const traits: string[] = []
    for (let k = 0; k < Math.floor(level / TRAIT_EVERY); k++) traits.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].id)
    return {
      id: `npc-${divId}-${n}-${i}`,
      name: FISH_NAMES[Math.floor(rnd() * FISH_NAMES.length)],
      owner,
      mine: false,
      speciesId: sp.id,
      genome: { ...sp.genome, seed: hash('npc', n, divId, i) & 0x7fffffff },
      level,
      traits,
      attack: v(sp.attack, sp.growth.attack),
      defense: v(sp.defense, sp.growth.defense),
      beauty: v(sp.beauty, sp.growth.beauty),
      health: Math.round(65 + rnd() * 35),
      sick: rnd() < 0.06,
      stake: div.fee,
    }
  })
}

// player fish take the last NPC slots; without NPC fill the field is only the real entrants
export function buildField(n: number, div: DivisionId, mine: Fighter[]): Fighter[] {
  if (!NPC_FILL) return mine.slice(0, BRACKET)
  return [...npcField(n, div).slice(0, BRACKET - mine.length), ...mine]
}

export function runTournament(n: number, div: DivisionId, field: Fighter[], now: number): TournamentResult {
  const rnd = mulberry32(hash('draw', n, div, field.map((f) => f.id).join(',')))
  const shuffle = <T,>(xs: T[]) => {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[xs[i], xs[j]] = [xs[j], xs[i]]
    }
    return xs
  }
  // pad to a power of two; each bye sits in its own first-round pair
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
      if (b < 0) {
        ms.push({ a, b, winner: a, seed: 0 })
        next.push(a)
        continue
      }
      const seed = matchSeed(r, n, div, field[a].id, field[b].id)
      const w = fight(field[a], field[b], seed).winner === 0 ? a : b
      ms.push({ a, b, winner: w, seed })
      next.push(w)
    }
    rounds.push(ms)
    alive = next
    r++
  }
  const champion = alive[0]
  const pot = field.reduce((s, f) => s + f.stake, 0)
  const fee = Math.round(pot * FEE)
  const payout = pot - fee

  // the final's loser is runner-up, the semifinal losers share third
  const loser = (m: MatchResult) => (m.winner === m.a ? m.b : m.a)
  const final = rounds[rounds.length - 1]?.[0]
  const semis = rounds.length >= 2 ? rounds[rounds.length - 2].filter((m) => !isBye(m)) : []
  const prizes: Prize[] = [{ fighter: champion, place: 1, amount: 0 }]
  if (final && !isBye(final)) prizes.push({ fighter: loser(final), place: 2, amount: 0 })
  for (const m of semis) prizes.push({ fighter: loser(m), place: 3, amount: 0 })
  for (const pz of prizes) pz.amount = Math.floor(payout * PRIZE_SPLIT[pz.place - 1])
  // rounding leftovers, and shares of places nobody reached, go to the champion
  prizes[0].amount += payout - prizes.reduce((s, pz) => s + pz.amount, 0)

  const myStake = field.filter((f) => f.mine).reduce((s, f) => s + f.stake, 0)
  const myPayout = prizes.filter((pz) => field[pz.fighter].mine).reduce((s, pz) => s + pz.amount, 0)
  return { n, div, resolvedAt: now, fighters: field, rounds, champion, pot, fee, payout, prizes, myStake, myPayout }
}

export function replay(res: TournamentResult, round: number, idx: number): Battle {
  const m = res.rounds[round][idx]
  return fight(res.fighters[m.a], res.fighters[m.b], m.seed)
}

// wounds and record each player fish brings home
export function injuries(res: TournamentResult): Map<string, { lost: number; wins: number; losses: number }> {
  const out = new Map<string, { lost: number; wins: number; losses: number }>()
  res.rounds.forEach((ms, r) =>
    ms.forEach((m, i) => {
      if (isBye(m)) return
      const b = replay(res, r, i)
      ;[m.a, m.b].forEach((fi, side) => {
        const f = res.fighters[fi]
        if (!f.mine) return
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
