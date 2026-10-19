// Genome types + a handful of breeds copied from the game's src/game/species.ts,
// so the launch content does not depend on the game's store/state modules.

export type FinForm =
  | 'halfmoon' | 'plakat' | 'crowntail' | 'doubletail' | 'veiltail' | 'giant'
  | 'hmpk' | 'halfsun' | 'dthm' | 'ctpk' | 'dtpk' | 'doublecrown'
export type Pattern = 'solid' | 'butterfly' | 'marble' | 'koi' | 'nemo' | 'dragon' | 'metallic'

export interface Genome {
  form: FinForm
  pattern: Pattern
  body: string
  belly: string
  fin: string
  finEdge: string
  irid: string
  spots: string[]
  size: number
  female?: boolean
  seed: number
}

export const G: Record<string, Genome> = {
  halfmoon: { form: 'halfmoon', pattern: 'butterfly', body: '#253a9c', belly: '#4f7ad8', fin: '#2a46c4', finEdge: '#f2f6ff', irid: '#74e8ff', spots: [], size: 1, seed: 11 },
  crowntail: { form: 'crowntail', pattern: 'solid', body: '#1b2f8f', belly: '#3d64c9', fin: '#1f3ab8', finEdge: '#7fb4ff', irid: '#5fe0ff', spots: [], size: 1, seed: 12 },
  veiltail: { form: 'veiltail', pattern: 'solid', body: '#8a1630', belly: '#c23a4a', fin: '#a3182f', finEdge: '#ff5a5a', irid: '#5a7dff', spots: [], size: 1, seed: 13 },
  plakat: { form: 'plakat', pattern: 'solid', body: '#7a1020', belly: '#b02a32', fin: '#c0162a', finEdge: '#ff3b2f', irid: '#3b6bff', spots: [], size: 1.02, seed: 14 },
  nemo: { form: 'plakat', pattern: 'nemo', body: '#e8621c', belly: '#f59a4a', fin: '#f07a22', finEdge: '#fff1dc', irid: '#ffd27a', spots: ['#16110f', '#fff5ea'], size: 1.02, seed: 15 },
  koi: { form: 'plakat', pattern: 'koi', body: '#f3eee6', belly: '#fffaf2', fin: '#f2ece2', finEdge: '#ffffff', irid: '#8ab6ff', spots: ['#d4232a', '#1d2a7a', '#151515'], size: 1.02, seed: 16 },
  samurai: { form: 'plakat', pattern: 'dragon', body: '#0d0e12', belly: '#1d2028', fin: '#101116', finEdge: '#2a2f3a', irid: '#d8e6ff', spots: [], size: 1.04, seed: 17 },
  platinum: { form: 'halfmoon', pattern: 'metallic', body: '#cfd6df', belly: '#f4f7fb', fin: '#e6ecf3', finEdge: '#ffffff', irid: '#bfe4ff', spots: [], size: 1.02, seed: 18 },
  doubletail: { form: 'doubletail', pattern: 'butterfly', body: '#4a1670', belly: '#7a3fa8', fin: '#7d2bb8', finEdge: '#ffd0f4', irid: '#c08bff', spots: [], size: 1, seed: 19 },
  // brand fish for the logo / banner: a gold halfmoon with a teal sheen
  gold: { form: 'halfmoon', pattern: 'butterfly', body: '#c07a12', belly: '#f2c14e', fin: '#eba21f', finEdge: '#5fe0d0', irid: '#5fe0d0', spots: [], size: 1, seed: 21 },
  red: { form: 'halfmoon', pattern: 'solid', body: '#8a1424', belly: '#c43440', fin: '#c0162a', finEdge: '#ff6b57', irid: '#5a7dff', spots: [], size: 1, seed: 22 },
}
