// Shop items. Food, water care and medicine act at once. Boosters are temporary buffs
// (a fish gets permanently stronger by levelling, not by buying). Vitamins give XP.

export type ItemKind = 'food' | 'care' | 'medicine' | 'boost' | 'growth'
export type Stat = 'attack' | 'defense' | 'beauty'

export interface ItemEffect {
  hunger?: number // negative = fills the fish
  health?: number
  water?: number
  cure?: boolean
  buff?: { stat: Stat; amount: number; hours: number }
  xp?: number
}

export interface Pack {
  qty: number // portions inside
  price: number
}

export interface Item {
  id: string
  name: string
  kind: ItemKind
  price: number // price of one unit (non-food items)
  packs?: Pack[] // food is only sold in packs of N portions
  effect: ItemEffect
  note: string
  icon: string
}

export const ITEMS: Item[] = [
  { id: 'pellet', name: 'Betta Pellets', kind: 'food', price: 4, packs: [{ qty: 10, price: 35 }, { qty: 30, price: 90 }], icon: '🟤', effect: { hunger: -30 }, note: 'Everyday food. One portion fills 30.' },
  { id: 'daphnia', name: 'Live Daphnia', kind: 'food', price: 8, packs: [{ qty: 10, price: 70 }, { qty: 25, price: 160 }], icon: '🦐', effect: { hunger: -35, health: 3 }, note: 'One portion fills 35, +3 health. Good for digestion.' },
  { id: 'bloodworm', name: 'Bloodworms', kind: 'food', price: 12, packs: [{ qty: 10, price: 100 }, { qty: 25, price: 225 }], icon: '🪱', effect: { hunger: -55, health: 5 }, note: 'One portion fills 55, +5 health. Bettas go crazy for it.' },

  { id: 'water', name: 'Aged Water Change', kind: 'care', price: 3, icon: '💧', effect: { water: 100 }, note: 'Swap the jar water. Water back to 100.' },
  { id: 'ketapang', name: 'Ketapang Leaf', kind: 'care', price: 14, icon: '🍂', effect: { water: 30, health: 10 }, note: 'Indian almond leaf. Water +30, health +10.' },
  { id: 'salt', name: 'Aquarium Salt', kind: 'care', price: 15, icon: '🧂', effect: { water: 15, health: 12 }, note: 'Light dose. Health +12, water +15.' },

  { id: 'methylene', name: 'Methylene Blue', kind: 'medicine', price: 38, icon: '🧪', effect: { cure: true, health: 15 }, note: 'Cures sickness, health +15.' },
  { id: 'revive', name: 'Betta Revive (antibiotic)', kind: 'medicine', price: 65, icon: '💊', effect: { cure: true, health: 45 }, note: 'Cures sickness, health +45. For after a hard fight.' },

  { id: 'tonic', name: 'Fighter Tonic', kind: 'boost', price: 45, icon: '⚔️', effect: { buff: { stat: 'attack', amount: 10, hours: 24 } }, note: '+10 attack for 24 hours. Give it before the bell.' },
  { id: 'armor', name: 'Scale Armor Serum', kind: 'boost', price: 45, icon: '🛡️', effect: { buff: { stat: 'defense', amount: 10, hours: 24 } }, note: '+10 defense for 24 hours.' },
  { id: 'color', name: 'Color Enhancer', kind: 'boost', price: 35, icon: '✨', effect: { buff: { stat: 'beauty', amount: 10, hours: 24 } }, note: '+10 beauty for 24 hours. More crits, more dodges.' },

  { id: 'vitamin', name: 'Growth Vitamin', kind: 'growth', price: 40, icon: '🧬', effect: { xp: 30 }, note: '+30 XP. Counts toward the daily XP cap.' },
]

export const KIND_LABEL: Record<ItemKind, string> = {
  food: 'Food',
  care: 'Water care',
  medicine: 'Medicine',
  boost: 'Boosters · 24h',
  growth: 'Growth',
}

export function itemById(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id)
}
