// Betta Arena engine: follows $BETTA on Robinhood Chain, throws a betta into the ring for every buy,
// and rings the bell (buyback & burn) whenever the Pons fee escrow is full enough.

import { zeroAddress, type Address } from 'viem'
import { config, DEAD } from './config.ts'
import { account, erc20Abi, pub } from './chain.ts'
import { indexTransfers, market, takeMoved } from './indexer.ts'
import { live, runBell } from './buyback.ts'
import { pushUpdate, startApi, supply } from './api.ts'
import { log, saveNow, state } from './store.ts'

if (!config.token) log('warn', 'STANDBY: no TOKEN_ADDRESS yet. The site shows the pre-launch page.')
if (!account) log('warn', 'No ENGINE_KEY: fights are followed, but the bell (buyback & burn) cannot ring.')
else log('info', `Creator wallet: ${account.address}`)

async function tokenInfo() {
  const token = config.token as Address
  if (!market.curve) {
    const c = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'curve' }).catch(() => null)
    if (c && c !== zeroAddress) {
      market.curve = c.toLowerCase()
      log('info', `Pons curve: ${c}`)
    }
  }
  market.decimals = Number(await pub.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18))
  const [total, dead] = await Promise.all([
    pub.readContract({ address: token, abi: erc20Abi, functionName: 'totalSupply' }),
    pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [DEAD] }),
  ])
  supply.total = total
  supply.dead = dead
}

let busy = false
async function tick() {
  if (busy || !config.token) return
  busy = true
  try {
    await tokenInfo()
    live.status = 'indexing'
    await indexTransfers()
    await runBell()
    live.status = 'watching'
    if (takeMoved() || state.rounds[0]?.stage === 'done') pushUpdate()
  } catch (e) {
    live.status = 'error'
    log('error', (e as Error).message.split('\n')[0])
  } finally {
    busy = false
  }
}

async function ethPrice() {
  try {
    const r = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', { signal: AbortSignal.timeout(8000) })
    const j = (await r.json()) as { data?: { amount?: string } }
    supply.ethUsd = parseFloat(j?.data?.amount ?? '0') || supply.ethUsd
  } catch {
    /* display only */
  }
}

startApi()
log('info', `API on 127.0.0.1:${config.port}`)
setInterval(tick, config.pollSeconds * 1000)
void tick()
setInterval(ethPrice, 60_000)
void ethPrice()
process.on('SIGINT', () => {
  saveNow()
  process.exit(0)
})
process.on('SIGTERM', () => {
  saveNow()
  process.exit(0)
})
