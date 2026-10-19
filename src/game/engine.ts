// The keeper's game state and every care action, as pure functions over a plain object.
// The game server is the only place that runs these (it stores the state per wallet), so a player
// cannot edit hunger, XP or inventory in the browser. Money never lives here: fish, items and
// fees are paid in $BETTA on chain, and the server credits what the contracts report.

import {
  addXp, applyItem, CARE_SPEED, canRush, canTrain, canUse, levelOf, MAX_TANKS, newFish, pendingTraits, rushCost, RUSH_PER_HOUR,
  tickFish, train, TRAININGS, type Fish, type Sex,
} from './fish'
import { itemById } from './items'
import { BREED_HEALTH_COST, BREED_REST, cannotBreed, makeFry, phaseOf, type Breeding } from './breeding'
import { SPECIES, speciesById } from './species'
import { traitById, traitOptions } from './traits'
import { injuries, XP_LOSS, XP_WIN, type TournamentResult } from './tournament'
import { STARTER_PACK } from './catalog'

export interface Grave {
  name: string
  speciesId: string
  cause: string
  diedAt: number
  wins: number
  level: number
}

export interface PlayerState {
  version: 2
  tanks: (Fish | null)[]
  inventory: Record<string, number>
  graves: Grave[]
  log: { t: number; text: string }[]
  breeding: Breeding | null
  starter: boolean // starter food already handed out
  entered: string[] // fish ids in a round that has not been settled yet
  spare: Fish[] // fish minted while every jar was full (rare race); moved in when a jar frees up
}

export type Result = { ok: boolean; msg: string }

export function freshState(): PlayerState {
  return { version: 2, tanks: Array(MAX_TANKS).fill(null), inventory: {}, graves: [], log: [], breeding: null, starter: false, entered: [], spare: [] }
}

export const log = (d: PlayerState, text: string, now = Date.now()) => {
  d.log.unshift({ t: now, text })
  d.log.length = Math.min(d.log.length, 40)
}

// a jar that is empty and not being used as the spawning tank
export const freeSlot = (d: PlayerState) => d.tanks.findIndex((t, i) => t === null && d.breeding?.slot !== i)
export const fishById = (d: PlayerState, id: string) => d.tanks.find((t) => t?.id === id) ?? null
const slotOf = (d: PlayerState, id: string) => d.tanks.findIndex((t) => t?.id === id)

const levelUpNote = (before: number, f: Fish) => {
  const after = levelOf(f)
  if (after <= before) return ''
  return pendingTraits(f) > 0 ? ` Level ${after}! A new trait is ready.` : ` Level ${after}!`
}

// ---------- time ----------

export function tickAll(d: PlayerState, now: number): string[] {
  const msgs: string[] = []
  d.tanks = d.tanks.map((f) => {
    if (!f) return f
    const before = levelOf(f)
    const x = tickFish(f, now)
    if (f.alive && !x.alive) {
      log(d, `${x.name} died of ${x.cause}.`, now)
      msgs.push(`💀 ${x.name} died. Check your jars.`)
    } else if (levelOf(x) > before) log(d, `${x.name} reached level ${levelOf(x)}.`, now)
    return x
  })
  return msgs
}

// ---------- fish arriving and leaving (driven by chain events) ----------

/** A fish NFT was minted to this keeper. `fish.id` is the token id. */
export function addFish(d: PlayerState, f: Fish, now: number): Result {
  const slot = freeSlot(d)
  if (slot < 0) d.spare.push(f)
  else d.tanks[slot] = f
  if (!d.starter) {
    d.starter = true
    for (const [k, v] of Object.entries(STARTER_PACK)) d.inventory[k] = (d.inventory[k] ?? 0) + v
    log(d, 'Starter pack: 10 portions of pellets and 2 water changes.', now)
  }
  const label = `${speciesById(f.speciesId).name} ${f.sex === 'male' ? '♂' : '♀'}`
  log(d, slot < 0 ? `"${f.name}" (${label}) is waiting for a free jar.` : `"${f.name}" (${label}) moved into jar ${slot + 1}.`, now)
  return { ok: true, msg: `"${f.name}" is in jar ${slot + 1}.` }
}

/** Shop fish: stats and looks come from the on-chain seed. */
export function shopFish(tokenId: string, species: number, female: boolean, seed: number, bornAt: number): Fish {
  const sp = SPECIES[species] ?? SPECIES[0]
  const sex: Sex = female ? 'female' : 'male'
  return { ...newFish(sp.id, bornAt, seed, sex), id: tokenId }
}

/** The NFT was burned (released) or moved away. */
export function removeFish(d: PlayerState, id: string, now: number, why: 'released' | 'transferred') {
  const slot = slotOf(d, id)
  const f = slot >= 0 ? d.tanks[slot] : d.spare.find((x) => x.id === id)
  if (!f) return null
  if (slot >= 0) d.tanks[slot] = null
  else d.spare = d.spare.filter((x) => x.id !== id)
  d.entered = d.entered.filter((x) => x !== id)
  log(d, why === 'released' ? `Released ${f.name}.` : `${f.name} left for another keeper.`, now)
  moveSpareIn(d)
  return f
}

function moveSpareIn(d: PlayerState) {
  while (d.spare.length) {
    const slot = freeSlot(d)
    if (slot < 0) return
    d.tanks[slot] = d.spare.shift()!
  }
}

export function credit(d: PlayerState, item: string, qty: number) {
  d.inventory[item] = (d.inventory[item] ?? 0) + qty
}

// ---------- care ----------

export function useItem(d: PlayerState, now: number, slot: number, id: string): Result {
  const it = itemById(id)
  const f0 = d.tanks[slot]
  if (!it || !f0) return { ok: false, msg: 'Nothing to use it on.' }
  if ((d.inventory[id] ?? 0) <= 0) return { ok: false, msg: `Out of ${it.name}. Buy more in the shop.` }
  const f = tickFish(f0, now)
  const why = canUse(f, it, now)
  if (why) return { ok: false, msg: why }
  d.inventory[id]--
  const r = applyItem(f, it, now)
  d.tanks[slot] = r.fish
  log(d, r.text, now)
  return { ok: true, msg: r.text + levelUpNote(levelOf(f), r.fish) }
}

export function trainFish(d: PlayerState, now: number, slot: number, id: string): Result {
  const tr = TRAININGS.find((t) => t.id === id)
  const f0 = d.tanks[slot]
  if (!tr || !f0) return { ok: false, msg: 'Nothing to train.' }
  const f = tickFish(f0, now)
  const why = canTrain(f, now)
  if (why) return { ok: false, msg: why }
  const r = train(f, tr, now)
  d.tanks[slot] = r.fish
  log(d, r.text, now)
  return { ok: true, msg: r.text + levelUpNote(levelOf(f), r.fish) }
}

/** Skip the cooldown with rush hours bought in the shop. `quoted` is the hours the player agreed to. */
export function rushTrain(d: PlayerState, now: number, slot: number, id: string, quoted: number): Result {
  const tr = TRAININGS.find((t) => t.id === id)
  const f0 = d.tanks[slot]
  if (!tr || !f0) return { ok: false, msg: 'Nothing to train.' }
  const f = tickFish(f0, now)
  const why = canRush(f, now)
  if (why) return { ok: false, msg: why }
  const hours = rushCost(f, now) / RUSH_PER_HOUR
  if (hours > quoted) return { ok: false, msg: `The wait grew to ${hours} hour(s). Try again.` }
  if ((d.inventory.rush ?? 0) < hours) return { ok: false, msg: `You need ${hours} rush hour(s); you have ${d.inventory.rush ?? 0}.` }
  d.inventory.rush -= hours
  const r = train(f, tr, now)
  d.tanks[slot] = r.fish
  log(d, `Rushed ${hours}h. ${r.text}`, now)
  return { ok: true, msg: `⚡ ${r.text}${levelUpNote(levelOf(f), r.fish)}` }
}

export function pickTrait(d: PlayerState, slot: number, traitId: string, now: number): Result {
  const f = d.tanks[slot]
  if (!f || !f.alive) return { ok: false, msg: 'No fish.' }
  if (pendingTraits(f) <= 0) return { ok: false, msg: 'No trait to pick yet.' }
  if (!traitOptions(f.id, f.traits).some((t) => t.id === traitId)) return { ok: false, msg: 'That trait is not on offer.' }
  f.traits.push(traitId)
  const t = traitById(traitId)!
  log(d, `${f.name} learned ${t.name}.`, now)
  return { ok: true, msg: `${f.name} learned ${t.name}.` }
}

export function rename(d: PlayerState, slot: number, name: string): Result {
  const f = d.tanks[slot]
  const n = name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18)
  if (!f || !n) return { ok: false, msg: 'Name cannot be empty.' }
  f.name = n
  return { ok: true, msg: '' }
}

/** Dead fish only; a living fish is released by burning its NFT. */
export function bury(d: PlayerState, slot: number, now: number): Result {
  const f = d.tanks[slot]
  if (!f) return { ok: false, msg: 'That jar is empty.' }
  if (f.alive) return { ok: false, msg: 'To release a living fish, confirm it in your wallet.' }
  d.graves.unshift({ name: f.name, speciesId: f.speciesId, cause: f.cause ?? 'unknown', diedAt: f.diedAt ?? now, wins: f.wins, level: levelOf(f) })
  d.graves.length = Math.min(d.graves.length, 30)
  d.tanks[slot] = null
  d.entered = d.entered.filter((x) => x !== f.id)
  log(d, `Buried ${f.name}. Jar ${slot + 1} is empty.`, now)
  moveSpareIn(d)
  return { ok: true, msg: `Rest well, ${f.name}.` }
}

// ---------- breeding ----------

export function startBreeding(d: PlayerState, now: number, maleSlot: number, femaleSlot: number): Result {
  if (d.breeding) return { ok: false, msg: 'A spawn is already in progress.' }
  const m0 = d.tanks[maleSlot]
  const f0 = d.tanks[femaleSlot]
  if (!m0 || !f0 || m0.sex !== 'male' || f0.sex !== 'female') return { ok: false, msg: 'Pick one male and one female.' }
  const m = tickFish(m0, now)
  const f = tickFish(f0, now)
  const why = cannotBreed(m, now, d.entered.includes(m.id)) ?? cannotBreed(f, now, d.entered.includes(f.id))
  if (why) return { ok: false, msg: why }
  const slot = freeSlot(d)
  if (slot < 0) return { ok: false, msg: 'You need an empty jar as the spawning tank.' }
  if ((d.inventory.breed ?? 0) < 1) return { ok: false, msg: 'Pay the breeding fee in the shop first.' }
  d.inventory.breed--
  const seed = Math.floor(Math.random() * 2 ** 31)
  const fry = makeFry(m, f, seed, now)
  for (const [x, s] of [[m, maleSlot], [f, femaleSlot]] as const) {
    x.health = Math.max(1, x.health - BREED_HEALTH_COST)
    x.breeds += 1
    x.restUntil = now + BREED_REST / CARE_SPEED
    d.tanks[s] = x
  }
  d.breeding = { slot, maleId: m.id, femaleId: f.id, father: m.name, mother: f.name, startedAt: now, fry }
  log(d, `${m.name} × ${f.name}: spawning in jar ${slot + 1}.`, now)
  return { ok: true, msg: `${m.name} is building a bubble nest for ${f.name} in jar ${slot + 1}.` }
}

/** The fry the keeper picked; the server turns it into a mint permit. */
export function fryToKeep(d: PlayerState, now: number, index: number): Fish | Result {
  const b = d.breeding
  if (!b) return { ok: false, msg: 'No spawn in progress.' }
  if (phaseOf(b, now) !== 'fry') return { ok: false, msg: 'The eggs have not hatched yet.' }
  const pick = b.fry[index]
  if (!pick) return { ok: false, msg: 'Pick one of the fry.' }
  return pick
}

/** The fry NFT was minted: it moves into the spawning jar and the spawn ends. */
export function fryArrived(d: PlayerState, f: Fish, now: number): Result {
  const b = d.breeding
  const slot = b && d.tanks[b.slot] === null ? b.slot : -1
  d.breeding = null
  if (slot >= 0) d.tanks[slot] = f
  else return addFish(d, f, now)
  log(d, `Kept "${f.name}" (Gen ${f.gen}${f.mutation ? `, ${f.mutation}` : ''}).`, now)
  return { ok: true, msg: `"${f.name}" moves into jar ${slot + 1}.` }
}

export function abandonSpawn(d: PlayerState): Result {
  if (!d.breeding) return { ok: false, msg: 'No spawn in progress.' }
  d.breeding = null
  return { ok: true, msg: 'The spawning jar was emptied. The fee is not refunded.' }
}

// ---------- tournaments ----------

/** Bring home wounds, XP, record and prize money from a settled bracket. */
export function applyResult(d: PlayerState, res: TournamentResult, now: number) {
  const hurt = injuries(res)
  const won = new Map(res.prizes.map((pz) => [res.fighters[pz.fighter].id, pz.amount]))
  d.tanks = d.tanks.map((f) => {
    if (!f) return f
    const h = hurt.get(f.id)
    if (!h) return f
    d.entered = d.entered.filter((x) => x !== f.id)
    const x: Fish = { ...tickFish(f, now) }
    if (!x.alive) return x
    x.wins += h.wins
    x.losses += h.losses
    x.health = Math.max(0, x.health - h.lost)
    x.earned += won.get(f.id) ?? 0
    addXp(x, h.wins * XP_WIN + h.losses * XP_LOSS, now, false)
    if (x.health <= 0) {
      x.alive = false
      x.diedAt = now
      x.cause = 'battle wounds'
    }
    const prize = won.get(f.id)
    log(d, `Round #${res.n}: ${x.name} ${h.wins}W ${h.losses}L${prize ? `, won ${prize} $BETTA` : ''}.`, now)
    return x
  })
}

export function itemLabel(id: string) {
  return itemById(id)?.name ?? (id === 'rush' ? 'Rush hour' : id === 'breed' ? 'Breeding fee' : id)
}
