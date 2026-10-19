// What the on-chain shop sells. Species and SKU numbers are part of the contract data: only ever
// append to these lists, never reorder or remove (set a price of 0 on chain to stop selling).

import { BREED_FEE } from './breeding'
import { RUSH_PER_HOUR } from './fish'
import { ITEMS } from './items'
import { SPECIES, speciesById } from './species'
import { FEMALE_PRICE, type Sex } from './fish'

export const speciesIndex = (id: string) => SPECIES.findIndex((s) => s.id === id)
// same rounding as BettaShop.priceOf (whole-token prices stay whole)
export const priceOfSex = (speciesId: string, sex: Sex) => {
  const p = speciesById(speciesId).price
  return sex === 'female' ? Math.floor((p * Math.round(FEMALE_PRICE * 10_000)) / 10_000) : p
}

export interface Sku {
  index: number // on-chain item id
  id: string // e.g. 'pellet-10'
  item: string // inventory key credited
  qty: number // inventory units credited per purchase
  price: number // whole $BETTA
}

const list: Omit<Sku, 'index'>[] = []
for (const it of ITEMS) {
  if (it.packs) for (const pk of it.packs) list.push({ id: `${it.id}-${pk.qty}`, item: it.id, qty: pk.qty, price: pk.price })
  else list.push({ id: it.id, item: it.id, qty: 1, price: it.price })
}
// one hour of training cooldown skipped, and one breeding fee
list.push({ id: 'rush', item: 'rush', qty: 1, price: RUSH_PER_HOUR })
list.push({ id: 'breed', item: 'breed', qty: 1, price: BREED_FEE })

export const SKUS: Sku[] = list.map((s, index) => ({ ...s, index }))
export const skuById = (id: string) => SKUS.find((s) => s.id === id)
export const skuByIndex = (i: number) => SKUS[i]
// the single-unit SKU for an item (packs: the smallest pack)
export const skuForItem = (item: string) => SKUS.filter((s) => s.item === item).sort((a, b) => a.qty - b.qty)[0]

// a keeper's first fish comes with a little food so it can be fed straight away
export const STARTER_PACK: Record<string, number> = { pellet: 10, water: 2 }
