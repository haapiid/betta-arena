// The ring: every buy brings a betta (worked out from its transaction hash) that fights the champion.
// Shared by the engine (which decides) and the site (which replays): change it in one place only.

import { encodePacked, keccak256, type Hex } from 'viem'
import { fight, TRAIT_BITS, type Fighter } from './battle'
import { SPECIES, type Species } from './species'

/** What the site needs to draw and replay a fish. */
export interface Fish {
  name: string
  speciesId: string
  seed: number // looks
  level: number
  attack: number
  defense: number
  beauty: number
  traits: string[]
}

export interface Fight {
  n: number
  tx: Hex
  t: number
  buyer: string
  tokens: string // raw units bought
  challenger: Fish
  champion: Fish | null // null: the ring was empty, the challenger walked in
  championOwner: string | null
  winner: 'challenger' | 'champion' | 'walkover'
  streak: number // the belt holder's streak after this fight
}

export interface Champion {
  fish: Fish
  owner: string
  since: number // fight number that won the belt
  streak: number
}

export interface Ring {
  total: number
  champion: Champion | null
  fights: Fight[]
  seen: string[]
  best: Champion | null
}

// ---------- the fish a buy brings ----------

const RARITY_WEIGHT = { Common: 5, Uncommon: 4, Rare: 2.5, Epic: 1.4, Legendary: 0.6 } as const
const NAMES = ['Raja', 'Sakura', 'Kaiser', 'Bima', 'Ember', 'General', 'Duchess', 'Garuda', 'Queen', 'Storm', 'Bolt', 'Pearl', 'Ocean', 'Zephyr', 'Blaze', 'Sky', 'Luna', 'Tiger', 'Admiral', 'Baron', 'Komodo', 'Ronin', 'Sultan', 'Cobra', 'Typhoon', 'Bandit', 'Hawk', 'Ghost', 'Brutus', 'Ninja']

/** Bigger buys bring stronger fish: level 1 at the minimum, +6 levels per 10× more, at most 30. */
export function levelFor(tokens: bigint, minUnits: bigint) {
  if (minUnits <= 0n || tokens <= minUnits) return 1
  const ratio = Number((tokens * 1000n) / minUnits) / 1000
  return Math.max(1, Math.min(30, 1 + Math.floor(Math.log10(ratio) * 6)))
}

export function fishFromTx(tx: Hex, tokens: bigint, minUnits: bigint): Fish {
  const h = BigInt(keccak256(encodePacked(['bytes32', 'string'], [tx, 'betta'])))
  let k = 0
  const r = () => Number((h >> BigInt(16 * k++)) & 0xffffn) / 65536 // sixteen draws from one hash
  const total = SPECIES.reduce((s, x) => s + RARITY_WEIGHT[x.rarity], 0)
  let pick = r() * total
  let sp: Species = SPECIES[0]
  for (const x of SPECIES) {
    pick -= RARITY_WEIGHT[x.rarity]
    if (pick <= 0) {
      sp = x
      break
    }
  }
  const level = levelFor(tokens, minUnits)
  const stat = (base: number, grow: number) => Math.max(5, Math.round(base + (r() * 2 - 1) * 6 + grow * (level - 1)))
  const pool = [...TRAIT_BITS] as string[]
  const traits: string[] = []
  for (let i = 0; i < Math.floor(level / 5); i++) traits.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return {
    name: NAMES[Math.floor(r() * NAMES.length)],
    speciesId: sp.id,
    seed: Number(h & 0x7fffffffn),
    level,
    attack: stat(sp.attack, sp.growth.attack),
    defense: stat(sp.defense, sp.growth.defense),
    beauty: stat(sp.beauty, sp.growth.beauty),
    traits,
  }
}

/** The fighter the fight engine needs (always at full health: a fresh fish against a rested champion). */
export function asFighter(f: Fish, owner: string): Fighter {
  const sp = SPECIES.find((s) => s.id === f.speciesId) ?? SPECIES[0]
  return {
    id: `${f.seed}`, name: f.name, owner, mine: false, speciesId: f.speciesId, genome: { ...sp.genome, seed: f.seed },
    level: f.level, traits: f.traits, attack: f.attack, defense: f.defense, beauty: f.beauty, health: 100, sick: false, stake: 0,
  }
}

/** Throw a buy's betta into the ring: it fights the champion (seeded by the tx hash) and the record is kept. */
export function enterRing(ring: Ring, b: { tx: Hex; t: number; buyer: string; tokens: bigint; minUnits: bigint }): Fight {
  const challenger = fishFromTx(b.tx, b.tokens, b.minUnits)
  const n = ++ring.total
  const champ = ring.champion
  let f: Fight
  if (!champ) {
    ring.champion = { fish: challenger, owner: b.buyer, since: n, streak: 0 }
    f = { n, tx: b.tx, t: b.t, buyer: b.buyer, tokens: b.tokens.toString(), challenger, champion: null, championOwner: null, winner: 'walkover', streak: 0 }
  } else {
    // the challenger is side 0, the champion side 1
    const res = fight(asFighter(challenger, b.buyer), asFighter(champ.fish, champ.owner), b.tx)
    if (res.winner === 0) ring.champion = { fish: challenger, owner: b.buyer, since: n, streak: 1 }
    else champ.streak++
    f = {
      n, tx: b.tx, t: b.t, buyer: b.buyer, tokens: b.tokens.toString(), challenger, champion: champ.fish, championOwner: champ.owner,
      winner: res.winner === 0 ? 'challenger' : 'champion', streak: ring.champion!.streak,
    }
  }
  const cur = ring.champion!
  if (!ring.best || cur.streak > ring.best.streak) ring.best = { ...cur }
  ring.seen.unshift(b.tx)
  ring.seen.length = Math.min(ring.seen.length, 400)
  ring.fights.unshift(f)
  ring.fights.length = Math.min(ring.fights.length, 120)
  return f
}

