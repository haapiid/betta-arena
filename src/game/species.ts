// Betta breeds: base stats, growth per level, and the look (genome) the canvas renderer uses.
// Want real artwork? Set `image` to a path under /public, e.g. '/fish/halfmoon.png'
// (transparent PNG, fish facing right). Without it the fish is drawn procedurally.

export type FinForm =
  | 'halfmoon'
  | 'plakat'
  | 'crowntail'
  | 'doubletail'
  | 'veiltail'
  | 'giant'
  // hybrids, only from breeding
  | 'hmpk' // Halfmoon Plakat
  | 'halfsun' // Halfmoon × Crowntail
  | 'dthm' // Double Tail Halfmoon
  | 'ctpk' // Crowntail Plakat
  | 'dtpk' // Double Tail Plakat
  | 'doublecrown' // Crowntail × Double Tail
export type Pattern = 'solid' | 'butterfly' | 'marble' | 'koi' | 'nemo' | 'dragon' | 'metallic'
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary'

export interface Genome {
  form: FinForm
  pattern: Pattern
  body: string // body colour
  belly: string // belly colour (lighter)
  fin: string // fin colour
  finEdge: string // fin edge colour
  irid: string // iridescent sheen on the scales
  spots: string[] // patch colours (marble / koi / nemo)
  size: number // body scale
  female?: boolean // females have short fins and an egg spot
  seed: number
}

export interface Species {
  id: string
  name: string
  latin: string
  rarity: Rarity
  price: number
  attack: number
  defense: number
  beauty: number
  // stat points gained per level; this is where breeds differ over a fish's life
  growth: { attack: number; defense: number; beauty: number }
  blurb: string
  genome: Omit<Genome, 'seed'>
  image?: string
}

export const SPECIES: Species[] = [
  {
    id: 'veiltail',
    name: 'Veiltail',
    latin: 'Betta splendens · VT',
    rarity: 'Common',
    price: 80,
    attack: 34,
    defense: 32,
    beauty: 56,
    growth: { attack: 0.9, defense: 0.9, beauty: 1.5 },
    blurb: 'The pet-shop classic. Long drooping tail, gentle temper, cheap to start with.',
    genome: { form: 'veiltail', pattern: 'solid', body: '#8a1630', belly: '#c23a4a', fin: '#a3182f', finEdge: '#ff5a5a', irid: '#5a7dff', spots: [], size: 1 },
  },
  {
    id: 'crowntail',
    name: 'Crowntail',
    latin: 'Betta splendens · CT',
    rarity: 'Common',
    price: 130,
    attack: 46,
    defense: 38,
    beauty: 63,
    growth: { attack: 1.3, defense: 0.8, beauty: 1.2 },
    blurb: 'Rays reach past the webbing like a crown of spikes. Fast and a little reckless.',
    genome: { form: 'crowntail', pattern: 'solid', body: '#1b2f8f', belly: '#3d64c9', fin: '#1f3ab8', finEdge: '#7fb4ff', irid: '#5fe0ff', spots: [], size: 1 },
  },
  {
    id: 'halfmoon',
    name: 'Halfmoon',
    latin: 'Betta splendens · HM',
    rarity: 'Uncommon',
    price: 150,
    attack: 40,
    defense: 42,
    beauty: 72,
    growth: { attack: 0.9, defense: 1.0, beauty: 1.7 },
    blurb: 'A full 180° tail when it flares. The show-bench favourite.',
    genome: { form: 'halfmoon', pattern: 'butterfly', body: '#253a9c', belly: '#4f7ad8', fin: '#2a46c4', finEdge: '#f2f6ff', irid: '#74e8ff', spots: [], size: 1 },
  },
  {
    id: 'plakat',
    name: 'Plakat Fighter',
    latin: 'Betta splendens · PK',
    rarity: 'Uncommon',
    price: 160,
    attack: 63,
    defense: 50,
    beauty: 40,
    growth: { attack: 1.7, defense: 1.1, beauty: 0.5 },
    blurb: 'Short fins, thick body, bred for the fight. What Thai breeders call pla kat.',
    genome: { form: 'plakat', pattern: 'solid', body: '#7a1020', belly: '#b02a32', fin: '#c0162a', finEdge: '#ff3b2f', irid: '#3b6bff', spots: [], size: 1.02 },
  },
  {
    id: 'doubletail',
    name: 'Double Tail',
    latin: 'Betta splendens · DT',
    rarity: 'Uncommon',
    price: 170,
    attack: 42,
    defense: 50,
    beauty: 67,
    growth: { attack: 0.9, defense: 1.5, beauty: 1.2 },
    blurb: 'Split tail, broad dorsal. Holds its ground more than it charges.',
    genome: { form: 'doubletail', pattern: 'butterfly', body: '#4a1670', belly: '#7a3fa8', fin: '#7d2bb8', finEdge: '#ffd0f4', irid: '#c08bff', spots: [], size: 1 },
  },
  {
    id: 'nemo',
    name: 'Nemo Plakat',
    latin: 'Betta splendens · PK Nemo',
    rarity: 'Rare',
    price: 280,
    attack: 58,
    defense: 54,
    beauty: 74,
    growth: { attack: 1.3, defense: 1.2, beauty: 1.2 },
    blurb: 'Orange, black and white patches that shift as it ages. No two look alike.',
    genome: { form: 'plakat', pattern: 'nemo', body: '#e8621c', belly: '#f59a4a', fin: '#f07a22', finEdge: '#fff1dc', irid: '#ffd27a', spots: ['#16110f', '#fff5ea'], size: 1.02 },
  },
  {
    id: 'koi',
    name: 'Koi Galaxy',
    latin: 'Betta splendens · PK Koi',
    rarity: 'Rare',
    price: 320,
    attack: 57,
    defense: 52,
    beauty: 80,
    growth: { attack: 1.2, defense: 1.1, beauty: 1.5 },
    blurb: 'Red, white and blue koi marble with a speckle of metallic galaxy dots.',
    genome: { form: 'plakat', pattern: 'koi', body: '#f3eee6', belly: '#fffaf2', fin: '#f2ece2', finEdge: '#ffffff', irid: '#8ab6ff', spots: ['#d4232a', '#1d2a7a', '#151515'], size: 1.02 },
  },
  {
    id: 'giant',
    name: 'Giant Plakat',
    latin: 'Betta splendens · Giant',
    rarity: 'Epic',
    price: 380,
    attack: 72,
    defense: 68,
    beauty: 42,
    growth: { attack: 1.6, defense: 1.6, beauty: 0.4 },
    blurb: 'Grows almost twice the size of a normal betta. Hits hard, takes hits.',
    genome: { form: 'giant', pattern: 'marble', body: '#2b4fa0', belly: '#5b86d4', fin: '#20357e', finEdge: '#7a1a34', irid: '#69e3ff', spots: ['#8c1a2e', '#121a3a'], size: 1.3 },
  },
  {
    id: 'samurai',
    name: 'Black Samurai',
    latin: 'Betta splendens · HMPK Samurai',
    rarity: 'Epic',
    price: 420,
    attack: 66,
    defense: 74,
    beauty: 70,
    growth: { attack: 1.2, defense: 1.8, beauty: 0.9 },
    blurb: 'Jet black with silver dragon-scale armour across the body. Hard to wound.',
    genome: { form: 'plakat', pattern: 'dragon', body: '#0d0e12', belly: '#1d2028', fin: '#101116', finEdge: '#2a2f3a', irid: '#d8e6ff', spots: [], size: 1.04 },
  },
  {
    id: 'platinum',
    name: 'Platinum Halfmoon',
    latin: 'Betta splendens · HM Platinum',
    rarity: 'Legendary',
    price: 650,
    attack: 55,
    defense: 60,
    beauty: 94,
    growth: { attack: 1.0, defense: 1.2, beauty: 1.9 },
    blurb: 'Solid metallic white from snout to fin edge. The one judges stop walking for.',
    genome: { form: 'halfmoon', pattern: 'metallic', body: '#cfd6df', belly: '#f4f7fb', fin: '#e6ecf3', finEdge: '#ffffff', irid: '#bfe4ff', spots: [], size: 1.02 },
  },
]

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#9fb3bf',
  Uncommon: '#5fd39a',
  Rare: '#5fb6ff',
  Epic: '#c38bff',
  Legendary: '#ffc35a',
}

export function speciesById(id: string): Species {
  return SPECIES.find((s) => s.id === id) ?? SPECIES[0]
}
