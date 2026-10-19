// Automatic fights. No player input: the result comes from attack, defense, beauty (flare),
// traits and the fish's condition.
//
// This is a line-for-line twin of contracts/contracts/BettaFight.sol. Both use integer maths and
// the same keccak-based random draws, so the contract decides every fight on chain and the
// browser replays exactly the same fight. Change one, change the other (the contract tests
// compare them).

import { encodePacked, keccak256, type Hex } from 'viem'
import type { Genome } from './species'

export interface Fighter {
  id: string
  name: string
  owner: string
  mine: boolean
  speciesId: string
  genome: Genome
  level: number
  traits: string[]
  attack: number
  defense: number
  beauty: number
  health: number
  sick: boolean
  stake: number
  size?: number
  gen?: number
}

export interface BattleEvent {
  actor: 0 | 1
  kind: 'hit' | 'crit' | 'miss' | 'heal'
  dmg: number
  hp: [number, number]
  text: string
}

export interface Battle {
  max: [number, number]
  start: [number, number]
  events: BattleEvent[]
  winner: 0 | 1
  decision: 'ko' | 'judges'
}

// trait bit order is part of the on-chain format
export const TRAIT_BITS = ['thick_scales', 'fin_ripper', 'iron_will', 'quick_flare', 'heavy_jaw', 'second_wind', 'intimidator', 'crowd_favourite'] as const
export const traitMask = (ids: readonly string[]) => ids.reduce((m, id) => (TRAIT_BITS.indexOf(id as never) < 0 ? m : m | (1 << TRAIT_BITS.indexOf(id as never))), 0)
export const traitsOf = (mask: number) => TRAIT_BITS.filter((_, i) => mask & (1 << i))
const THICK = 1, RIPPER = 2, IRON = 4, QUICK = 8, JAW = 16, WIND = 32, INTIM = 64, CROWD = 128

// one random draw in [0, n): keccak256(seed ‖ uint32 counter) mod n
export class Rng {
  private i = 0
  constructor(private seed: Hex) {}
  next(n: number): number {
    const h = keccak256(encodePacked(['bytes32', 'uint32'], [this.seed, this.i++]))
    return Number(BigInt(h) % BigInt(n))
  }
}

const HIT = ['bites the flank of', 'rams', 'nips the tail of', 'tears at the dorsal of', 'slams into']
const CRIT = ['rips a fin of', 'lands a full-flare strike on', 'shreds the caudal of']
const MISS = ['flares and dodges', 'slips under', 'turns away from']

export function maxHp(f: { defense: number; traits: readonly string[] }) {
  const base = Math.floor((700 + f.defense * 6) / 10)
  return traitMask(f.traits) & IRON ? Math.floor((base * 110) / 100) : base
}

export function fight(a: Fighter, b: Fighter, seed: Hex): Battle {
  const rng = new Rng(seed)
  const F = [a, b]
  const T = [traitMask(a.traits), traitMask(b.traits)]
  const max: [number, number] = [maxHp(a), maxHp(b)]
  // a wounded fish enters with less HP
  const hp: [number, number] = [Math.floor((max[0] * (100 + a.health)) / 200), Math.floor((max[1] * (100 + b.health)) / 200)]
  const start: [number, number] = [hp[0], hp[1]]
  // attack in thousandths: sickness −25%, condition 80–100%, a foe's Intimidator −7%
  const atk = F.map((f, i) => Math.floor((f.attack * (f.sick ? 750 : 1000) * (800 + 2 * f.health) * (T[1 - i] & INTIM ? 930 : 1000)) / 1_000_000))
  const init = F.map((f, i) => atk[i] + f.beauty * 300 + rng.next(25_000) + (T[i] & QUICK ? 18_000 : 0))
  const winded = [false, false]
  let turn: 0 | 1 = init[0] >= init[1] ? 0 : 1
  const events: BattleEvent[] = []

  for (let round = 0; round < 40 && hp[0] > 0 && hp[1] > 0; round++) {
    const t = turn
    const o = (1 - turn) as 0 | 1
    const me = F[t]
    const foe = F[o]
    // chances in basis points (1/10000)
    const evade = Math.min(2800, Math.max(300, 500 + (foe.defense - me.attack) * 30 + foe.beauty * 6 + (T[o] & QUICK ? 500 : 0)))
    const crit = Math.min(2800, 500 + me.beauty * 13 + (T[t] & RIPPER ? 600 : 0))
    if (rng.next(10_000) < evade) {
      events.push({ actor: t, kind: 'miss', dmg: 0, hp: [hp[0], hp[1]], text: `${foe.name} ${MISS[round % MISS.length]} ${me.name}` })
    } else {
      const isCrit = rng.next(10_000) < crit
      let d = Math.floor((atk[t] * (500 + rng.next(450))) / 1000)
      d = Math.floor((d * 100_000) / (100_000 + foe.defense * 1200))
      d = Math.floor((d * 85) / 100)
      if (isCrit) d = Math.floor((d * 16) / 10)
      if (T[t] & JAW) d = Math.floor((d * 108) / 100)
      if (T[o] & THICK) d = Math.floor((d * 90) / 100)
      const dmg = Math.max(2, Math.floor((d + 500) / 1000))
      hp[o] = Math.max(0, hp[o] - dmg)
      const verb = isCrit ? CRIT[dmg % CRIT.length] : HIT[dmg % HIT.length]
      events.push({ actor: t, kind: isCrit ? 'crit' : 'hit', dmg, hp: [hp[0], hp[1]], text: `${me.name} ${verb} ${foe.name} (−${dmg})` })
      if (hp[o] > 0 && hp[o] * 4 < max[o] && !winded[o] && T[o] & WIND) {
        winded[o] = true
        const heal = Math.floor((max[o] * 18 + 50) / 100)
        hp[o] = Math.min(max[o], hp[o] + heal)
        events.push({ actor: o, kind: 'heal', dmg: -heal, hp: [hp[0], hp[1]], text: `${foe.name} finds a second wind (+${heal})` })
      }
    }
    turn = o
  }

  let winner: 0 | 1
  let decision: Battle['decision'] = 'ko'
  if (hp[0] === 0) winner = 1
  else if (hp[1] === 0) winner = 0
  else {
    decision = 'judges'
    const s = [0, 1].map((i) => Math.floor((hp[i] * 10_000) / max[i]) + (T[i] & CROWD ? 1000 : 0))
    winner = s[0] >= s[1] ? 0 : 1
  }
  return { max, start, events, winner, decision }
}

// seed of match k in bracket round r
export function matchSeed(seed: Hex, r: number, k: number): Hex {
  return keccak256(encodePacked(['bytes32', 'uint8', 'uint8'], [seed, r, k]))
}
