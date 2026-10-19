// Traits: one pick every 5 levels, chosen from three offered options.
// They change how a fish fights, so two fish at the same level can play differently.

import { hash, mulberry32 } from '../render/color'

export interface Trait {
  id: string
  name: string
  note: string
  icon: string
}

export const TRAITS: Trait[] = [
  { id: 'thick_scales', name: 'Thick Scales', icon: '🛡️', note: 'Takes 10% less damage.' },
  { id: 'fin_ripper', name: 'Fin Ripper', icon: '🦷', note: '+6% chance of a critical fin tear.' },
  { id: 'iron_will', name: 'Iron Will', icon: '🔥', note: '+10% max HP in the arena.' },
  { id: 'quick_flare', name: 'Quick Flare', icon: '⚡', note: '+5% dodge and usually strikes first.' },
  { id: 'heavy_jaw', name: 'Heavy Jaw', icon: '💥', note: 'Deals 8% more damage.' },
  { id: 'second_wind', name: 'Second Wind', icon: '🌬️', note: 'Once per fight, recovers 18% HP when below a quarter.' },
  { id: 'intimidator', name: 'Intimidator', icon: '👁️', note: "The opponent's attack drops 7%." },
  { id: 'crowd_favourite', name: "Judges' Favourite", icon: '🏅', note: "Wins the judges' call unless clearly behind (10%)." },
]

export const TRAIT_EVERY = 5

export const traitById = (id: string) => TRAITS.find((t) => t.id === id)

export const has = (traits: string[] | undefined, id: string) => !!traits?.includes(id)

// three options, stable for a given fish and pick number (no rerolling by reopening)
export function traitOptions(fishId: string, owned: string[]): Trait[] {
  const rnd = mulberry32(hash('trait', fishId, owned.length))
  const pool = TRAITS.filter((t) => !owned.includes(t.id))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 3)
}
