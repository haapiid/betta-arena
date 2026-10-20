// Prices for the page's dollar figures. Display only: no buyback depends on them.
//  · ETH in USD from Coinbase (CoinGecko as a fallback)
//  · $BETTA from its largest DexScreener pair, or, while still on the Pons curve, a quote of a tiny buy

import { formatUnits, parseEther, type Hex } from 'viem'
import { config, DEAD } from './config.ts'
import { account, curveAbi, pub } from './chain.ts'
import { market } from './indexer.ts'
import { log } from './store.ts'

export const price = { ethUsd: 0, tokenUsd: 0, source: '', at: 0 }

async function json(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${url} ${r.status}`)
  return r.json()
}

export async function refreshPrice() {
  try {
    const cb = (await json('https://api.coinbase.com/v2/prices/ETH-USD/spot').catch(() => null)) as { data?: { amount?: string } } | null
    let eth = parseFloat(cb?.data?.amount ?? '0')
    if (!eth) {
      const cg = (await json('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd').catch(() => null)) as { ethereum?: { usd?: number } } | null
      eth = cg?.ethereum?.usd ?? 0
    }
    if (eth > 0) price.ethUsd = eth
    if (!config.token) return
    const dex = (await json(`https://api.dexscreener.com/latest/dex/tokens/${config.token}`).catch(() => null)) as { pairs?: { priceUsd?: string; liquidity?: { usd?: number } }[] } | null
    const pair = (dex?.pairs ?? []).filter((p) => parseFloat(p.priceUsd ?? '0') > 0).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
    if (pair) return Object.assign(price, { tokenUsd: parseFloat(pair.priceUsd!), source: 'dexscreener', at: Date.now() })
    if (market.curve && price.ethUsd > 0) {
      const q = parseEther('0.0001')
      // a read-only quote of a tiny buy, simulated from an address that holds ETH; never sent
      const from = account?.address ?? config.ponsEscrow
      const { result } = await pub.simulateContract({ address: market.curve as Hex, abi: curveAbi, functionName: 'buy', args: [q, 0n, DEAD], value: q, account: from })
      const tokens = Number(formatUnits(result, market.decimals))
      if (tokens > 0) Object.assign(price, { tokenUsd: (0.0001 / tokens) * price.ethUsd, source: 'pons-curve', at: Date.now() })
    }
  } catch (e) {
    log('warn', `Price check failed: ${(e as Error).message.split('\n')[0]}`)
  }
}
