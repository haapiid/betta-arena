// Breeding: one male + one female, an empty jar as the spawning tank, about two days of
// spawning and hatching, then the keeper picks one of three fry to raise.
// A fry inherits form (or a hybrid), colours, base stats, growth rates and maybe a parent's trait.

import { CARE_SPEED, levelOf, NAMES, newFish, stageOf, growthOf, breedNameOf, type Fish } from './fish'
import { speciesById, type FinForm, type Genome, type Pattern } from './species'
import { traitById } from './traits'
import { hash, mix, mulberry32 } from '../render/color'

export const BREED_MIN_LEVEL = 10
export const BREED_MIN_HEALTH = 70
export const BREED_FEE = 150
export const BREED_BURN = 0.5 // share of the fee that is burned
export const MAX_BREEDS = 3 // per fish, per life
export const BREED_REST = 7 * 86_400_000
export const BREED_HEALTH_COST = 20
export const SPAWN_HOURS = 24
export const HATCH_HOURS = 24
export const FRY_COUNT = 3
export const MUTATION_CHANCE = 0.06
export const INHERIT_TRAIT_CHANCE = 0.25

const HOUR = 3_600_000

export interface Breeding {
  slot: number // the spawning jar
  maleId: string
  femaleId: string
  father: string
  mother: string
  startedAt: number
  fry: Fish[] // rolled at the start, revealed when they hatch
}

export type BreedPhase = 'spawning' | 'eggs' | 'fry'

export const phaseEnds = (b: Breeding) => ({
  spawning: b.startedAt + (SPAWN_HOURS * HOUR) / CARE_SPEED,
  eggs: b.startedAt + ((SPAWN_HOURS + HATCH_HOURS) * HOUR) / CARE_SPEED,
})

export function phaseOf(b: Breeding, now: number): BreedPhase {
  const e = phaseEnds(b)
  return now < e.spawning ? 'spawning' : now < e.eggs ? 'eggs' : 'fry'
}

// why a fish cannot breed right now (null = it can)
export function cannotBreed(f: Fish | null | undefined, now: number, entered: boolean): string | null {
  if (!f || !f.alive) return 'Pick a living fish.'
  if (stageOf(f, now).id === 'juvenile') return `${f.name} is still a juvenile.`
  if (levelOf(f) < BREED_MIN_LEVEL) return `${f.name} needs level ${BREED_MIN_LEVEL}.`
  if (f.sick) return `${f.name} is sick.`
  if (f.health <= BREED_MIN_HEALTH) return `${f.name} needs health above ${BREED_MIN_HEALTH}.`
  if (f.breeds >= MAX_BREEDS) return `${f.name} has bred ${MAX_BREEDS} times already.`
  if (f.restUntil > now) return `${f.name} is resting after the last spawn.`
  if (entered) return `${f.name} is entered in the arena.`
  return null
}

// ---------- genetics: tail form ----------
// The cross table follows real betta lines. Each hybrid is built from two base forms;
// crossing a hybrid with anything else is worked out from its two components.

type Base = 'halfmoon' | 'plakat' | 'crowntail' | 'doubletail' | 'veiltail'
export type Outcome = { form: FinForm; p: number }

export const HYBRIDS: Partial<Record<FinForm, [Base, Base]>> = {
  hmpk: ['halfmoon', 'plakat'],
  halfsun: ['halfmoon', 'crowntail'],
  dthm: ['halfmoon', 'doubletail'],
  ctpk: ['crowntail', 'plakat'],
  dtpk: ['doubletail', 'plakat'],
  doublecrown: ['crowntail', 'doubletail'],
}

// base × base. Keys are the two forms sorted alphabetically.
const CROSS: Record<string, Outcome[]> = {
  'halfmoon|plakat': [{ form: 'hmpk', p: 0.5 }, { form: 'halfmoon', p: 0.25 }, { form: 'plakat', p: 0.25 }],
  'crowntail|halfmoon': [{ form: 'halfsun', p: 0.5 }, { form: 'halfmoon', p: 0.25 }, { form: 'crowntail', p: 0.25 }],
  'doubletail|halfmoon': [{ form: 'dthm', p: 0.5 }, { form: 'halfmoon', p: 0.25 }, { form: 'doubletail', p: 0.25 }],
  'crowntail|plakat': [{ form: 'ctpk', p: 0.5 }, { form: 'crowntail', p: 0.25 }, { form: 'plakat', p: 0.25 }],
  'doubletail|plakat': [{ form: 'dtpk', p: 0.5 }, { form: 'doubletail', p: 0.25 }, { form: 'plakat', p: 0.25 }],
  'crowntail|doubletail': [{ form: 'doublecrown', p: 0.4 }, { form: 'crowntail', p: 0.3 }, { form: 'doubletail', p: 0.3 }],
}

// a giant is a plakat with a giant body; the body is inherited separately (see giantChance)
const norm = (f: FinForm): FinForm => (f === 'giant' ? 'plakat' : f)

function merge(parts: { list: Outcome[]; w: number }[]): Outcome[] {
  const m = new Map<FinForm, number>()
  for (const { list, w } of parts) for (const o of list) m.set(o.form, (m.get(o.form) ?? 0) + o.p * w)
  return [...m.entries()].map(([form, p]) => ({ form, p })).sort((a, b) => b.p - a.p)
}

export function crossOutcomes(a0: FinForm, b0: FinForm): Outcome[] {
  const a = norm(a0)
  const b = norm(b0)
  const ha = HYBRIDS[a]
  const hb = HYBRIDS[b]
  if (a === b) {
    // a hybrid line does not breed fully true: some fry fall back to the original forms
    return ha ? [{ form: a, p: 0.6 }, { form: ha[0], p: 0.2 }, { form: ha[1], p: 0.2 }] : [{ form: a, p: 1 }]
  }
  // the old veiltail line mostly gives way to the other form
  if (a === 'veiltail' || b === 'veiltail') return [{ form: a === 'veiltail' ? b : a, p: 0.6 }, { form: 'veiltail', p: 0.4 }]
  // hybrid × one of its own components
  if (ha && ha.includes(b as Base)) return [{ form: a, p: 0.5 }, { form: b, p: 0.5 }]
  if (hb && hb.includes(a as Base)) return [{ form: b, p: 0.5 }, { form: a, p: 0.5 }]
  // any other hybrid: average the crosses of its components
  if (ha) return merge(ha.map((c) => ({ list: crossOutcomes(c, b), w: 0.5 })))
  if (hb) return merge(hb.map((c) => ({ list: crossOutcomes(a, c), w: 0.5 })))
  return CROSS[[a, b].sort().join('|')] ?? [{ form: a, p: 0.5 }, { form: b, p: 0.5 }]
}

function rollForm(list: Outcome[], r: number): FinForm {
  for (const o of list) {
    r -= o.p
    if (r <= 0) return o.form
  }
  return list[list.length - 1].form
}

const isGiant = (g: Genome) => g.form === 'giant' || g.size >= 1.2
export function giantChance(A: Genome, B: Genome) {
  return isGiant(A) && isGiant(B) ? 0.7 : isGiant(A) || isGiant(B) ? 0.4 : 0
}

export const FORM_NAMES: Record<FinForm, string> = {
  halfmoon: 'Halfmoon',
  plakat: 'Plakat',
  crowntail: 'Crowntail',
  doubletail: 'Double Tail',
  veiltail: 'Veiltail',
  giant: 'Giant Plakat',
  hmpk: 'Halfmoon Plakat (HMPK)',
  halfsun: 'Half-Sun',
  dthm: 'Double Tail Halfmoon',
  ctpk: 'Crowntail Plakat (CTPK)',
  dtpk: 'Double Tail Plakat (DTPK)',
  doublecrown: 'Double Crown',
}

export function formName(form: FinForm, giant: boolean) {
  if (form === 'giant' || !giant) return FORM_NAMES[form]
  return `Giant ${FORM_NAMES[form].replace(/ \(.*\)$/, '')}`
}

interface Mutation {
  name: string
  look: Partial<Genome> & { pattern: Pattern }
}

// colours the shop never sells
export const MUTATIONS: Mutation[] = [
  { name: 'Galaxy', look: { pattern: 'koi', body: '#15204f', belly: '#24357a', fin: '#1a2766', finEdge: '#7fb4ff', irid: '#9fd0ff', spots: ['#f2f6ff', '#0a0d1c', '#3d5bd6'] } },
  { name: 'Mustard Gas', look: { pattern: 'butterfly', body: '#1b3a8c', belly: '#3256b0', fin: '#2a4fb0', finEdge: '#f0b73a', irid: '#6fd8ff', spots: [] } },
  { name: 'Avatar Gold', look: { pattern: 'metallic', body: '#c9a24a', belly: '#f1d98b', fin: '#d7ad4f', finEdge: '#fff1c4', irid: '#ffe08a', spots: [] } },
  { name: 'Black Orchid', look: { pattern: 'butterfly', body: '#120d1c', belly: '#2a1d3d', fin: '#3a1557', finEdge: '#d98bff', irid: '#b07cff', spots: [] } },
  { name: 'Copper Dragon', look: { pattern: 'dragon', body: '#5a2c12', belly: '#8a4a22', fin: '#7a3416', finEdge: '#f2a35a', irid: '#ffd2a6', spots: [] } },
]

const pickOf = <T,>(rnd: () => number, a: T, b: T) => (rnd() < 0.5 ? a : b)

function childGenome(A: Genome, B: Genome, seed: number, female: boolean): { genome: Genome; mutation?: string; giant: boolean } {
  const rnd = mulberry32(seed)
  // each colour comes from one parent, or blends between the two
  const colour = (a: string, b: string) => {
    const r = rnd()
    return r < 0.35 ? a : r < 0.7 ? b : mix(a, b, 0.3 + rnd() * 0.4)
  }
  let form = rollForm(crossOutcomes(A.form, B.form), rnd())
  const giant = rnd() < giantChance(A, B)
  if (giant && form === 'plakat') form = 'giant'
  const pattern = pickOf(rnd, A.pattern, B.pattern)
  const spotsFrom = pattern === A.pattern && A.spots.length ? A.spots : B.spots.length ? B.spots : A.spots
  let genome: Genome = {
    form,
    pattern,
    body: colour(A.body, B.body),
    belly: colour(A.belly, B.belly),
    fin: colour(A.fin, B.fin),
    finEdge: colour(A.finEdge, B.finEdge),
    irid: colour(A.irid, B.irid),
    spots: ['marble', 'koi', 'nemo'].includes(pattern) ? (spotsFrom.length ? spotsFrom : ['#151515', '#f5f1ea']) : [],
    size: giant ? 1.22 + rnd() * 0.08 : Math.max(0.95, Math.min(1.12, (Math.min(A.size, 1.1) + Math.min(B.size, 1.1)) / 2 + (rnd() - 0.5) * 0.06)),
    seed,
    female,
  }
  let mutation: string | undefined
  if (rnd() < MUTATION_CHANCE) {
    const m = MUTATIONS[Math.floor(rnd() * MUTATIONS.length)]
    genome = { ...genome, ...m.look }
    mutation = m.name
  }
  return { genome, mutation, giant }
}

// rarity of a fry = the rarer parent's breed (keeps the rarity tag meaningful)
const RANK = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 }
function rarerSpecies(a: string, b: string) {
  return RANK[speciesById(a).rarity] >= RANK[speciesById(b).rarity] ? a : b
}

export function potentialBonus(male: Fish, female: Fish) {
  return Math.floor((levelOf(male) + levelOf(female)) / 2 / 5) // up to +6
}

export function makeFry(male: Fish, female: Fish, seed: number, now: number): Fish[] {
  const bonus = potentialBonus(male, female)
  const traitsPool = [...new Set([...male.traits, ...female.traits])]
  const ga = growthOf(male)
  const gb = growthOf(female)
  const used = new Set<string>()
  return Array.from({ length: FRY_COUNT }, (_, i) => {
    const s = hash('fry', seed, i) & 0x7fffffff
    const rnd = mulberry32(s)
    const sex = rnd() < 0.5 ? 'male' : 'female'
    const speciesId = rarerSpecies(male.speciesId, female.speciesId)
    const f = newFish(speciesId, now, s, sex)
    const { genome, mutation, giant } = childGenome(male.genome, female.genome, s, sex === 'female')
    const stat = (a: number, b: number) => Math.max(1, Math.min(99, Math.round((a + b) / 2 + (rnd() * 2 - 1) * 5 + bonus)))
    const grow = (a: number, b: number) => Math.round(((a + b) / 2 + (rnd() - 0.5) * 0.2) * 10) / 10
    // never give a fry its parent's or sibling's name
    const taken = [male.name, female.name]
    for (let k = 0; taken.includes(f.name) || used.has(f.name); k++) f.name = NAMES[(hash(s, k) >>> 0) % NAMES.length]
    used.add(f.name)
    f.genome = genome
    f.mutation = mutation
    f.attack = stat(male.attack, female.attack)
    f.defense = stat(male.defense, female.defense)
    f.beauty = stat(male.beauty, female.beauty) + (mutation ? 6 : 0)
    f.growth = { attack: grow(ga.attack, gb.attack), defense: grow(ga.defense, gb.defense), beauty: grow(ga.beauty, gb.beauty) }
    f.gen = Math.max(male.gen ?? 1, female.gen ?? 1) + 1
    f.parents = [male.name, female.name]
    const sameLine = male.speciesId === female.speciesId && genome.form === speciesById(speciesId).genome.form
    f.breedName = sameLine ? undefined : formName(genome.form, giant)
    if (traitsPool.length && rnd() < INHERIT_TRAIT_CHANCE) {
      const t = traitsPool[Math.floor(rnd() * traitsPool.length)]
      if (traitById(t)) {
        f.innate = t
        f.traits = [t]
      }
    }
    return f
  })
}

// what the keeper can expect before paying, shown in the breeding panel
export function forecast(male: Fish, female: Fish) {
  const traits = [...new Set([...male.traits, ...female.traits])]
  return {
    outcomes: crossOutcomes(male.genome.form, female.genome.form).map((o) => ({ name: FORM_NAMES[o.form], form: o.form, p: o.p })),
    giant: giantChance(male.genome, female.genome),
    bonus: potentialBonus(male, female),
    traits,
    lines: `${breedNameOf(male)} × ${breedNameOf(female)}`,
  }
}
