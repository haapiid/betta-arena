// Follows every $BETTA Transfer: balances, first buy, sells (the holder jumps the jar), and every
// buy big enough throws a betta into the ring.

import { getAddress, parseEventLogs, parseUnits, zeroAddress, type Address, type Hex, type Log } from 'viem'
import { config, DEAD, ZERO } from './config.ts'
import { account, erc20Abi, pub } from './chain.ts'
import { state, saveSoon, log } from './store.ts'
import { enterRing, freshHolder, isSell, whyNotAFight, type Market } from './rules.ts'

const lc = (a: string) => a.toLowerCase()
const big = (s: string) => BigInt(s || '0')

export const market = { curve: '' as string, decimals: 18 }
export let moved = false
export const takeMoved = () => {
  const m = moved
  moved = false
  return m
}

export function excludedSet(): Set<string> {
  const s = new Set<string>([ZERO, DEAD, config.ponsEscrow, config.v4Router, ...config.exclude, ...config.sellSinks].map(lc))
  if (config.token) s.add(lc(config.token))
  if (market.curve) s.add(market.curve)
  if (account) s.add(lc(account.address))
  return s
}

async function isContract(a: string) {
  if (state.isContract[a] === undefined) {
    const code = await pub.getCode({ address: a as Address })
    state.isContract[a] = !!code && code !== '0x'
  }
  return state.isContract[a]
}

function marketRules(): Market {
  const sinks = new Set(config.sellSinks.map(lc))
  if (market.curve) sinks.add(market.curve)
  return { excluded: excludedSet(), sinks, router: lc(config.v4Router), dead: lc(DEAD), isRelay: (a) => !!state.holders[a]?.relay, isContract }
}

const times = new Map<bigint, number>()
async function timeOf(n: bigint) {
  let t = times.get(n)
  if (t === undefined) {
    t = Number((await pub.getBlock({ blockNumber: n })).timestamp)
    times.set(n, t)
    if (times.size > 5000) times.delete(times.keys().next().value!)
  }
  return t
}

/** Pons mints the whole supply once at launch: the first Transfer from 0x0 marks where to start. */
async function deployBlock(token: Address) {
  const latest = await pub.getBlockNumber()
  const WINDOW = 5_000_000n
  for (let to = latest; to >= 0n; to -= WINDOW) {
    const from = to >= WINDOW ? to - WINDOW + 1n : 0n
    const found = await pub.getLogs({ address: token, event: erc20Abi[0], args: { from: zeroAddress }, fromBlock: from, toBlock: to })
    if (found.length) return found[0].blockNumber!
    if (from === 0n) break
  }
  return latest
}

let span = 50_000n
export async function indexTransfers() {
  const token = config.token
  if (!token) return
  if (big(state.lastBlock) === 0n) {
    const start = config.startBlock ?? (await deployBlock(token))
    state.lastBlock = String(start - 1n)
    log('info', `Indexing from block ${start}`)
  }
  const latest = await pub.getBlockNumber()
  const minUnits = parseUnits(config.fightMinTokens || '0', market.decimals)
  const m = marketRules()

  while (big(state.lastBlock) < latest) {
    const from = big(state.lastBlock) + 1n
    const to = from + span - 1n < latest ? from + span - 1n : latest
    let found: Log[]
    try {
      found = await pub.getLogs({ address: token, event: erc20Abi[0], fromBlock: from, toBlock: to })
      if (span < 500_000n) span *= 2n
    } catch (e) {
      span = span > 4_000n ? span / 4n : 1_000n
      log('warn', `getLogs ${from}-${to} failed (${(e as Error).message.split('\n')[0]}); trying smaller ranges`)
      return
    }
    for (const l of parseEventLogs({ abi: erc20Abi, logs: found, eventName: 'Transfer' })) {
      moved = true
      const src = lc(getAddress(l.args.from))
      const dst = lc(getAddress(l.args.to))
      const value = l.args.value
      const tx = l.transactionHash as Hex
      const t = await timeOf(l.blockNumber!)
      if (src !== ZERO) {
        const h = (state.holders[src] ||= freshHolder())
        h.balance = (big(h.balance) - value).toString()
        // a contract passing on what it just received is a router, not a holder
        if (!h.relay && h.lastInTx === tx && (await isContract(src))) h.relay = true
        if (!h.jumped && !h.relay && (await isSell(src, dst, m))) {
          h.jumped = true
          h.jumpedAt = t
          h.jumpedTx = tx
          log('info', `${src.slice(0, 8)}… sold and jumped the jar`)
        }
      }
      if (dst !== ZERO) {
        const h = (state.holders[dst] ||= freshHolder())
        if (big(h.balance) === 0n && !h.firstIn) h.firstIn = t
        h.balance = (big(h.balance) + value).toString()
        h.lastInTx = tx
        if (src !== ZERO && !(await whyNotAFight(state.ring, { src, dst, value, tx }, minUnits, m))) {
          const f = enterRing(state.ring, { tx, t, buyer: dst, tokens: value, minUnits })
          ;(state.book ||= []).push(f)
          if (state.book.length > 50_000) state.book.splice(0, state.book.length - 50_000)
          h.fights++
          if (f.winner !== 'champion') h.wins++
          if (f.championOwner && f.winner === 'champion') {
            const c = state.holders[f.championOwner]
            if (c) c.wins++
          }
          log('info', `Fight #${f.n}: ${f.challenger.name} (Lv ${f.challenger.level}) ${f.winner === 'walkover' ? 'walks into the empty ring' : f.winner === 'challenger' ? `takes the belt from ${f.champion!.name}` : `loses to ${f.champion!.name} (streak ${f.streak})`}`)
        }
      }
    }
    state.lastBlock = String(to)
    saveSoon()
  }
}
