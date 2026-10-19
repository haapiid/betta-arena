// A fish's life: real-time care decay, XP and levels, breed growth, age stages,
// training, temporary buffs and traits.

import { type Item, type Stat } from './items'
import { speciesById, type Genome } from './species'
import { TRAIT_EVERY } from './traits'
import { hash, mulberry32 } from '../render/color'
import { env } from '../config'

export const CARE_SPEED = Number(env('VITE_CARE_SPEED') || 1)
export const LIFESPAN_DAYS = Number(env('VITE_LIFESPAN_DAYS') || 60)
export const MAX_TANKS = 3
export const MIN_ENTRY_HEALTH = 40
export const MAX_LEVEL = 30
export const DAILY_XP_CAP = 120
export const TRAIN_COOLDOWN = 8 * 3_600_000
const HOUR = 3_600_000
const DAY = 86_400_000

export interface Buff {
  stat: Stat
  amount: number
  until: number
}

export interface Fish {
  id: string
  speciesId: string
  name: string
  genome: Genome
  // rolled at birth; effective stats add breed growth per level, age and buffs on top
  attack: number
  defense: number
  beauty: number
  health: number // 0..100
  hunger: number // 0 full .. 100 starving
  water: number // 0 filthy .. 100 clean
  sick: boolean
  bornAt: number
  lastTick: number
  wins: number
  losses: number
  earned: number
  alive: boolean
  diedAt?: number
  cause?: string
  xp: number
  xpDay: number
  xpToday: number
  traits: string[]
  buffs: Buff[]
  lastTrain: number
  // breeding
  sex: Sex
  gen: number // 1 = from the shop, 2+ = bred
  parents?: [string, string] // [father, mother] names
  breedName?: string // hybrid label, e.g. "Halfmoon Plakat (HMPK)"
  mutation?: string // rare colour that only breeding can produce
  growth?: { attack: number; defense: number; beauty: number } // bred fish carry their own growth rates
  innate?: string // trait inherited from a parent (does not use up a level pick)
  breeds: number
  restUntil: number
}

export type Sex = 'male' | 'female'
export const FEMALE_PRICE = 0.6 // females cost 60% of a male of the same breed

export const NAMES = ['Raja', 'Sakura', 'Kaiser', 'Bima', 'Ember', 'General', 'Duchess', 'Garuda', 'Queen', 'Storm', 'Bolt', 'Pearl', 'Ocean', 'Zephyr', 'Blaze', 'Sky', 'Luna', 'Tiger', 'Admiral', 'Baron']

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x))

export function newFish(speciesId: string, now = Date.now(), seed = Math.floor(Math.random() * 2 ** 31), sex: Sex = 'male'): Fish {
  const sp = speciesById(speciesId)
  const rnd = mulberry32(seed)
  const vary = (x: number, d: number) => clamp(Math.round(x + (rnd() * 2 - 1) * d), 1, 99)
  return {
    id: `f${now.toString(36)}${seed.toString(36)}`,
    speciesId,
    name: NAMES[Math.floor(rnd() * NAMES.length)],
    genome: { ...sp.genome, seed, female: sex === 'female' },
    attack: vary(sp.attack, 6),
    defense: vary(sp.defense, 6),
    beauty: vary(sp.beauty, 6),
    health: 100,
    hunger: 20,
    water: 100,
    sick: false,
    bornAt: now,
    lastTick: now,
    wins: 0,
    losses: 0,
    earned: 0,
    alive: true,
    xp: 0,
    xpDay: 0,
    xpToday: 0,
    traits: [],
    buffs: [],
    lastTrain: 0,
    sex,
    gen: 1,
    breeds: 0,
    restUntil: 0,
  }
}

export const growthOf = (f: Pick<Fish, 'speciesId' | 'growth'>) => f.growth ?? speciesById(f.speciesId).growth
export const breedNameOf = (f: Pick<Fish, 'speciesId' | 'breedName'>) => f.breedName ?? speciesById(f.speciesId).name
// shop artwork only fits shop fish; bred fish always use the procedural renderer
export const imageOf = (f: { speciesId: string; gen?: number }) => ((f.gen ?? 1) > 1 ? undefined : speciesById(f.speciesId).image)

// ---------- levels ----------
export const xpToNext = (level: number) => 30 + 15 * level

export function levelInfo(xp: number) {
  let level = 1
  let rest = xp
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level)
    level++
  }
  return { level, into: rest, need: level >= MAX_LEVEL ? 0 : xpToNext(level) }
}

export const levelOf = (f: Pick<Fish, 'xp'>) => levelInfo(f.xp).level

export const pendingTraits = (f: Fish) => Math.floor(levelOf(f) / TRAIT_EVERY) - f.traits.filter((t) => t !== f.innate).length

export const dayIndex = (t: number) => Math.floor(t / DAY)

export function xpLeftToday(f: Fish, now: number) {
  return f.xpDay === dayIndex(now) ? Math.max(0, Math.round(DAILY_XP_CAP - f.xpToday)) : DAILY_XP_CAP
}

// XP only lands on a healthy fish. Care, training and vitamins share the daily cap;
// tournament XP does not.
export function addXp(f: Fish, amount: number, now: number, capped = true): number {
  if (!f.alive || amount <= 0) return 0
  if (capped) {
    if (f.health <= 60 || f.sick) return 0
    const d = dayIndex(now)
    if (f.xpDay !== d) {
      f.xpDay = d
      f.xpToday = 0
    }
    amount = Math.min(amount, DAILY_XP_CAP - f.xpToday)
    if (amount <= 0) return 0
    f.xpToday += amount
  }
  f.xp += amount
  return amount
}

// ---------- age ----------
export interface Stage {
  id: 'juvenile' | 'adult' | 'prime' | 'senior'
  name: string
  mult: number // stat multiplier
  size: number // body size in the jar
}

export const STAGE_BOUNDS = { juvenile: 0.13, adult: 0.37, prime: 0.7 } // share of the lifespan

export const ageDays = (f: Fish, now: number) => (((f.diedAt ?? now) - f.bornAt) / DAY) * CARE_SPEED

export function stageOf(f: Fish, now: number): Stage {
  const x = ageDays(f, now) / LIFESPAN_DAYS
  if (x < STAGE_BOUNDS.juvenile) return { id: 'juvenile', name: 'Juvenile', mult: 0.88, size: 0.8 + 0.12 * (x / STAGE_BOUNDS.juvenile) }
  if (x < STAGE_BOUNDS.adult) return { id: 'adult', name: 'Adult', mult: 1, size: 0.92 + 0.08 * ((x - STAGE_BOUNDS.juvenile) / (STAGE_BOUNDS.adult - STAGE_BOUNDS.juvenile)) }
  if (x < STAGE_BOUNDS.prime) return { id: 'prime', name: 'Prime', mult: 1.1, size: 1 }
  return { id: 'senior', name: 'Senior', mult: 1 - 0.2 * Math.min(1, (x - STAGE_BOUNDS.prime) / (1 - STAGE_BOUNDS.prime)), size: 1 }
}

export const daysLeft = (f: Fish, now: number) => Math.max(0, LIFESPAN_DAYS - ageDays(f, now))

// ---------- stats ----------
export function activeBuffs(f: Fish, now: number) {
  return (f.buffs ?? []).filter((b) => b.until > now)
}

export function effective(f: Fish, now: number) {
  const gr = growthOf(f)
  const lv = levelOf(f) - 1
  const m = stageOf(f, now).mult
  const buff = { attack: 0, defense: 0, beauty: 0 }
  for (const b of activeBuffs(f, now)) buff[b.stat] += b.amount
  const calc = (k: Stat) => Math.round((f[k] + gr[k] * lv) * m) + buff[k]
  return { attack: calc('attack'), defense: calc('defense'), beauty: calc('beauty'), buff }
}

export function power(f: { attack: number; defense: number; beauty: number; health: number; level?: number; traits?: string[] }) {
  return Math.round(f.attack * 1.1 + f.defense + f.beauty * 0.35 + f.health * 0.3 + (f.traits?.length ?? 0) * 6)
}

// ---------- time ----------
// Hunger rises ~4.5/h, water clouds ~2.8/h. Starving, dirty water and sickness drain health.
// A fish in good shape earns a little XP every hour. Old age ends every fish eventually.
export function tickFish(f: Fish, now: number): Fish {
  if (!f.alive) return f
  let hours = ((now - f.lastTick) / HOUR) * CARE_SPEED
  if (hours <= 0) return f
  const x: Fish = { ...f, buffs: activeBuffs(f, now) }
  let t = f.lastTick
  while (hours > 0 && x.alive) {
    const c = Math.min(1, hours)
    hours -= c
    t += (c * HOUR) / CARE_SPEED
    x.hunger = clamp(x.hunger + 4.5 * c)
    x.water = clamp(x.water - 2.8 * c)
    let dh = 0
    if (x.hunger >= 100) dh -= 9 * c
    else if (x.hunger > 75) dh -= 3.5 * c
    if (x.water < 25) dh -= 2.5 * c
    if (x.sick) dh -= 3 * c
    const good = dh === 0 && x.hunger < 60 && x.water > 50
    if (good) dh += 1.5 * c
    if (!x.sick && x.water < 35 && Math.random() < 0.07 * c) x.sick = true
    x.health = clamp(x.health + dh)
    if (good) addXp(x, 2 * c, t)
    if (x.health <= 0) {
      x.alive = false
      x.diedAt = t
      x.cause = x.hunger >= 90 ? 'starvation' : x.sick ? 'sickness (fin rot)' : 'dirty water'
    } else if (ageDays(x, t) >= LIFESPAN_DAYS) {
      x.alive = false
      x.diedAt = t
      x.cause = 'old age'
    }
  }
  x.xp = Math.round(x.xp * 10) / 10
  x.lastTick = now
  return x
}

// ---------- training (free, time-gated: the non-paying way to grow) ----------
export interface Training {
  id: string
  name: string
  xp: number
  hunger?: number
  health?: number
  water?: number
  note: string
  icon: string
}

export const TRAININGS: Training[] = [
  { id: 'mirror', name: 'Mirror Flaring', xp: 25, hunger: 10, health: -2, icon: '🪞', note: 'Show it a rival in the glass. Builds fighting spirit; makes it hungry.' },
  { id: 'sun', name: 'Morning Sun', xp: 18, health: 2, icon: '☀️', note: 'Ten minutes of early sun, the way breeders harden fighters.' },
  { id: 'soak', name: 'Ketapang Soak', xp: 15, water: 10, health: 3, icon: '🍃', note: 'A tannin bath that toughens the skin and calms the fish.' },
]

export function trainReadyIn(f: Fish, now: number) {
  return Math.max(0, f.lastTrain + TRAIN_COOLDOWN / CARE_SPEED - now)
}

export function canTrain(f: Fish, now: number, ignoreCooldown = false): string | null {
  if (!f.alive) return 'This fish is dead.'
  if (f.sick) return `${f.name} is sick. Treat it before training.`
  if (f.health <= 60) return `${f.name} is too weak to train (health 60+).`
  if (f.hunger >= 80) return `${f.name} is too hungry to train. Feed it first.`
  if (!ignoreCooldown && trainReadyIn(f, now) > 0) return `${f.name} is resting after the last session.`
  return null
}

// Rush: pay to skip the rest of the cooldown. Priced per in-game hour left, rounded up,
// so waiting a little first makes it cheaper (a full 8h wait costs 8 × RUSH_PER_HOUR).
export const RUSH_PER_HOUR = 5

export function rushCost(f: Fish, now: number) {
  const left = trainReadyIn(f, now)
  return left > 0 ? Math.ceil((left * CARE_SPEED) / HOUR) * RUSH_PER_HOUR : 0
}

// why a rush would be refused before any coin is spent (null = ok)
export function canRush(f: Fish, now: number): string | null {
  if (trainReadyIn(f, now) <= 0) return 'Training is already ready.'
  const why = canTrain(f, now, true)
  if (why) return why
  if (xpLeftToday(f, now) <= 0) return `${f.name} has hit today's XP cap, so a rushed session would give nothing.`
  return null
}

export function train(f: Fish, tr: Training, now: number): { fish: Fish; text: string } {
  const x: Fish = { ...f }
  const got = addXp(x, tr.xp, now)
  if (tr.hunger) x.hunger = clamp(x.hunger + tr.hunger)
  if (tr.health) x.health = clamp(x.health + tr.health)
  if (tr.water) x.water = clamp(x.water + tr.water)
  x.lastTrain = now
  return { fish: x, text: `${tr.name}: ${f.name} +${got} XP${got < tr.xp ? ' (daily cap)' : ''}` }
}

// ---------- items ----------
export function canUse(f: Fish, item: Item, now: number): string | null {
  if (!f.alive) return 'This fish is dead.'
  const e = item.effect
  if (item.kind === 'food' && f.hunger <= 5) return `${f.name} is full. Overfeeding fouls the water.`
  if (e.cure && !f.sick && (e.health ?? 0) === 0) return `${f.name} is not sick.`
  if (e.xp && xpLeftToday(f, now) <= 0) return `${f.name} has hit today's XP cap.`
  if (e.xp && xpLeftToday(f, now) < e.xp) return `${f.name} can only gain ${Math.floor(xpLeftToday(f, now))} more XP today. Save the ${item.name} for tomorrow.`
  if (e.xp && (f.health <= 60 || f.sick)) return `${f.name} must be healthy (60+) to gain XP.`
  return null
}

export function applyItem(f: Fish, item: Item, now: number): { fish: Fish; text: string } {
  const e = item.effect
  const x: Fish = { ...f, buffs: activeBuffs(f, now) }
  const parts: string[] = []
  if (e.hunger) {
    x.hunger = clamp(x.hunger + e.hunger)
    // leftover food clouds the water
    if (f.hunger + e.hunger < 0) x.water = clamp(x.water - 6)
    parts.push('fed')
  }
  if (e.water) {
    x.water = clamp(e.water >= 100 ? 100 : x.water + e.water)
    parts.push(`water ${Math.round(x.water)}`)
  }
  if (e.cure && x.sick) {
    x.sick = false
    parts.push('cured')
  }
  if (e.health) {
    x.health = clamp(x.health + e.health)
    parts.push(`health ${Math.round(x.health)}`)
  }
  if (e.buff) {
    // same stat: refresh, never stack
    x.buffs = x.buffs.filter((b) => b.stat !== e.buff!.stat)
    x.buffs.push({ stat: e.buff.stat, amount: e.buff.amount, until: now + (e.buff.hours * HOUR) / CARE_SPEED })
    parts.push(`${e.buff.stat} +${e.buff.amount} for ${e.buff.hours}h`)
  }
  if (e.xp) parts.push(`+${addXp(x, e.xp, now)} XP`)
  return { fish: x, text: `${item.name} → ${f.name}: ${parts.join(', ')}` }
}

export function ageLabel(f: Fish, now: number) {
  const d = Math.floor(ageDays(f, now))
  return d < 1 ? 'new arrival' : `${d} day${d > 1 ? 's' : ''} old`
}

export function fishSeed(...p: (string | number)[]) {
  return hash(...p) & 0x7fffffff
}
