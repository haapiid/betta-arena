// Automatic fights. No player input: the result comes from attack, defense, beauty (flare),
// traits and the fish's condition. Seeded RNG, so a replay always matches the recorded result.

import type { Genome } from './species'
import { has } from './traits'
import { hash, mulberry32 } from '../render/color'

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

const HIT = ['bites the flank of', 'rams', 'nips the tail of', 'tears at the dorsal of', 'slams into']
const CRIT = ['rips a fin of', 'lands a full-flare strike on', 'shreds the caudal of']
const MISS = ['flares and dodges', 'slips under', 'turns away from']

export function maxHp(f: Fighter) {
  return Math.round((70 + f.defense * 0.6) * (has(f.traits, 'iron_will') ? 1.1 : 1))
}

export function fight(a: Fighter, b: Fighter, seed: number): Battle {
  const rnd = mulberry32(seed)
  const F = [a, b]
  const max: [number, number] = [maxHp(a), maxHp(b)]
  // a wounded or sick fish enters with less HP
  const hp: [number, number] = [Math.round(max[0] * (0.5 + 0.5 * (a.health / 100))), Math.round(max[1] * (0.5 + 0.5 * (b.health / 100)))]
  const start: [number, number] = [hp[0], hp[1]]
  const atk = F.map((f, i) => f.attack * (f.sick ? 0.75 : 1) * (0.8 + 0.2 * (f.health / 100)) * (has(F[1 - i].traits, 'intimidator') ? 0.93 : 1))
  const init = F.map((f, i) => atk[i] + f.beauty * 0.3 + rnd() * 25 + (has(f.traits, 'quick_flare') ? 18 : 0))
  const winded = [false, false]
  let turn: 0 | 1 = init[0] >= init[1] ? 0 : 1
  const events: BattleEvent[] = []

  for (let round = 0; round < 40 && hp[0] > 0 && hp[1] > 0; round++) {
    const me = F[turn]
    const foe = F[1 - turn]
    const t = turn
    const o = (1 - turn) as 0 | 1
    const evade = Math.min(0.28, Math.max(0.03, 0.05 + (foe.defense - me.attack) * 0.003 + foe.beauty * 0.0006 + (has(foe.traits, 'quick_flare') ? 0.05 : 0)))
    const crit = Math.min(0.28, 0.05 + me.beauty * 0.0013 + (has(me.traits, 'fin_ripper') ? 0.06 : 0))
    if (rnd() < evade) {
      events.push({ actor: t, kind: 'miss', dmg: 0, hp: [hp[0], hp[1]], text: `${foe.name} ${MISS[Math.floor(rnd() * MISS.length)]} ${me.name}` })
    } else {
      const isCrit = rnd() < crit
      let dmg = atk[t] * (0.5 + rnd() * 0.45) * (100 / (100 + foe.defense * 1.2)) * 0.85
      if (isCrit) dmg *= 1.6
      if (has(me.traits, 'heavy_jaw')) dmg *= 1.08
      if (has(foe.traits, 'thick_scales')) dmg *= 0.9
      dmg = Math.max(2, Math.round(dmg))
      hp[o] = Math.max(0, hp[o] - dmg)
      const verb = isCrit ? CRIT[Math.floor(rnd() * CRIT.length)] : HIT[Math.floor(rnd() * HIT.length)]
      events.push({ actor: t, kind: isCrit ? 'crit' : 'hit', dmg, hp: [hp[0], hp[1]], text: `${me.name} ${verb} ${foe.name} (−${dmg})` })
      if (hp[o] > 0 && hp[o] < max[o] * 0.25 && !winded[o] && has(foe.traits, 'second_wind')) {
        winded[o] = true
        const heal = Math.round(max[o] * 0.18)
        hp[o] = Math.min(max[o], hp[o] + heal)
        events.push({ actor: o, kind: 'heal', dmg: -heal, hp: [hp[0], hp[1]], text: `${foe.name} finds a second wind (+${heal})` })
      }
    }
    turn = o
  }

  let winner: 0 | 1
  let decision: Battle['decision'] = 'ko'
  if (hp[0] <= 0) winner = 1
  else if (hp[1] <= 0) winner = 0
  else {
    decision = 'judges'
    const s = [0, 1].map((i) => hp[i] / max[i] + (has(F[i].traits, 'crowd_favourite') ? 0.1 : 0))
    winner = s[0] >= s[1] ? 0 : 1
  }
  return { max, start, events, winner, decision }
}

export function matchSeed(round: number, ...p: (string | number)[]) {
  return hash('match', round, ...p)
}
