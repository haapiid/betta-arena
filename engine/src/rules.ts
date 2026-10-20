// The engine's rules, kept free of the chain so they can be tested. Nothing here moves funds.
//  · which Transfer is a buy (a betta enters the ring) and which is a sell (the holder jumps the jar)
//  · the fish a buy brings, worked out from its transaction hash
//  · the fight against the champion, with the same fight engine the site replays
//  · the shelf: the biggest holders who never sold

import type { Fight, Ring } from '../../src/game/ring.ts'
export { asFighter, enterRing, fishFromTx, levelFor, type Champion, type Fight, type Fish, type Ring } from '../../src/game/ring.ts'

// ---------- state ----------

export interface Holder {
  balance: string // raw units
  firstIn: number // unix seconds of the first buy
  jumped: boolean // sold once: off the shelf for good
  jumpedAt: number
  jumpedTx: string
  lastInTx?: string
  relay?: boolean // a contract that forwards what it receives (a router), never a holder
  fights: number
  wins: number
}

export type RoundStage = 'claiming' | 'claimed' | 'buying' | 'bought' | 'burning' | 'done' | 'failed'
export interface Round {
  n: number
  at: number
  stage: RoundStage
  claimTx: string
  claimedWei: string
  spendWei: string
  route: 'curve' | 'v4' | ''
  buyTx: string
  balanceBefore: string // engine's token balance before a v4 buy
  boughtUnits: string
  burnTx: string // same as buyTx when the curve sent the tokens straight to the dead address
  doneAt: number
  note?: string
}

export interface State {
  version: 1
  token: string // the state belongs to this token; a new token starts fresh
  lastBlock: string // last indexed block
  holders: Record<string, Holder>
  isContract: Record<string, boolean>
  ring: Ring
  // every fight, oldest first (fight n at index n - 1), so any fight can get its card and its page
  book: Fight[]
  rounds: Round[]
  totals: { claimedWei: string; spentWei: string; burnedUnits: string }
}

export const freshState = (token: string): State => ({
  version: 1,
  token,
  lastBlock: '0',
  holders: {},
  isContract: {},
  ring: { total: 0, champion: null, fights: [], seen: [], best: null },
  book: [],
  rounds: [],
  totals: { claimedWei: '0', spentWei: '0', burnedUnits: '0' },
})

export const freshHolder = (): Holder => ({ balance: '0', firstIn: 0, jumped: false, jumpedAt: 0, jumpedTx: '', fights: 0, wins: 0 })

// ---------- buys and sells ----------

export interface Market {
  excluded: Set<string> // never holders: zero, dead, escrow, router, curve, engine wallet, token, EXCLUDE
  sinks: Set<string> // where selling happens: the curve and any pools
  router: string
  dead: string
  isRelay: (a: string) => boolean
  isContract: (a: string) => Promise<boolean>
}

/** Why a transfer is not a buy that throws a betta in, or null when it is one. */
export async function whyNotAFight(ring: Ring, t: { src: string; dst: string; value: bigint; tx: string }, minUnits: bigint, m: Market) {
  if (ring.seen.includes(t.tx)) return 'this transaction already threw a betta in'
  if (m.excluded.has(t.dst) || m.sinks.has(t.dst) || t.dst === m.dead) return 'tokens went to the market or an excluded address'
  if (t.value < minUnits) return 'smaller than the smallest buy'
  const fromMarket = m.sinks.has(t.src) || t.src === m.router || m.isRelay(t.src) || (await m.isContract(t.src))
  if (!fromMarket) return 'a wallet-to-wallet transfer, not a buy'
  if (await m.isContract(t.dst)) return 'tokens landed in a contract'
  return null
}

/** A holder sending to the market (or a contract that is not excluded) has sold. */
export async function isSell(src: string, dst: string, m: Market) {
  if (m.excluded.has(src) && !m.sinks.has(src)) return false
  if (m.sinks.has(dst) || dst === m.router) return true
  return !m.excluded.has(dst) && dst !== m.dead && (await m.isContract(dst))
}

// ---------- the shelf ----------

const big = (s: string) => BigInt(s || '0')

export function shelf(holders: Record<string, Holder>, excluded: Set<string>, size: number, minUnits: bigint) {
  return Object.entries(holders)
    .filter(([a, h]) => !excluded.has(a) && !h.relay && !h.jumped && big(h.balance) > 0n && big(h.balance) >= minUnits)
    .sort(([, a], [, b]) => (big(b.balance) > big(a.balance) ? 1 : big(b.balance) < big(a.balance) ? -1 : a.firstIn - b.firstIn))
    .slice(0, size)
    .map(([addr, h], i) => ({ rank: i + 1, addr, balance: h.balance, firstIn: h.firstIn, fights: h.fights, wins: h.wins }))
}

/** Minimum tokens out for a quote, after slippage. */
export const withSlippage = (quote: bigint, bps: number) => (quote * BigInt(10_000 - bps)) / 10_000n
