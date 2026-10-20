// The bell: claim the creator fees from the Pons escrow, buy $BETTA with all of it, and send what
// was bought to the dead address.
//
// Every transaction hash is saved before it is awaited. After a restart a saved hash is checked on
// chain: confirmed means the step is done, reverted or lost means it is sent again. So a round is
// never claimed, bought or burned twice.

import { formatEther, formatUnits, parseEther, parseEventLogs, type Hex } from 'viem'
import { config, DEAD } from './config.ts'
import { account, curveAbi, erc20Abi, escrowAbi, pub, wallet } from './chain.ts'
import { market } from './indexer.ts'
import { log, saveNow, state } from './store.ts'
import { withSlippage, type Round } from './rules.ts'
import { buildUniswapV4Buy } from './uniswap-v4.ts'

const big = (s: string) => BigInt(s || '0')
const add = (a: string, b: bigint) => (big(a) + b).toString()
export const live = { escrowWei: 0n, status: 'standby' as string }

async function txState(hash: Hex): Promise<'ok' | 'reverted' | 'lost'> {
  const r = await pub.getTransactionReceipt({ hash }).catch(() => null)
  if (r) return r.status === 'success' ? 'ok' : 'reverted'
  const t = await pub.getTransaction({ hash }).catch(() => null)
  if (!t) return 'lost'
  const w = await pub.waitForTransactionReceipt({ hash }).catch(() => null)
  return w?.status === 'success' ? 'ok' : 'reverted'
}

/** Send one step of a round at most once; returns the confirmed hash or null if it reverted. */
async function once(get: () => string, set: (h: string) => void, send: () => Promise<Hex>): Promise<Hex | null> {
  const prev = get() as Hex
  if (prev) {
    const st = await txState(prev)
    if (st === 'ok') return prev
    set('')
    saveNow()
  }
  const hash = await send()
  set(hash)
  saveNow()
  const r = await pub.waitForTransactionReceipt({ hash })
  return r.status === 'success' ? hash : null
}

/** Is the token still on its Pons curve? A static quote of a tiny buy answers it. */
async function curveQuote(eth: bigint) {
  if (!market.curve || !account) return null
  try {
    const { result } = await pub.simulateContract({ address: market.curve as Hex, abi: curveAbi, functionName: 'buy', args: [eth, 0n, DEAD], value: eth, account })
    return result
  } catch {
    return null // graduated (or paused): buy on Uniswap instead
  }
}

async function claim(r: Round) {
  const hash = await once(() => r.claimTx, (h) => (r.claimTx = h), () => wallet!.writeContract({ address: config.ponsEscrow, abi: escrowAbi, functionName: 'claim', chain: wallet!.chain, account: account! }))
  if (!hash) {
    r.stage = 'failed'
    r.note = 'claim reverted'
    saveNow()
    log('error', `Bell #${r.n}: the claim reverted. Trying again next time.`)
    return
  }
  totalsOnce(r, 'claim', () => (state.totals.claimedWei = add(state.totals.claimedWei, big(r.claimedWei))))
  // spend what was claimed, never the gas the engine needs to keep working
  const bal = await pub.getBalance({ address: account!.address })
  const buffer = parseEther(config.gasBufferEth)
  const spendable = bal > buffer ? bal - buffer : 0n
  const claimed = big(r.claimedWei)
  r.spendWei = String(claimed < spendable ? claimed : spendable)
  r.stage = 'claimed'
  saveNow()
}

async function buy(r: Round) {
  const eth = big(r.spendWei)
  if (eth === 0n) {
    r.stage = 'done'
    r.note = 'nothing left to spend after gas'
    return
  }
  if (!r.route) {
    const q = await curveQuote(eth)
    r.route = q !== null ? 'curve' : 'v4'
    saveNow()
  }
  r.stage = 'buying'
  if (r.route === 'curve') {
    const quote = (await curveQuote(eth)) ?? 0n
    const minOut = withSlippage(quote, config.slippageBps)
    // the curve sends the tokens straight to the dead address: bought and burned in one transaction
    const hash = await once(() => r.buyTx, (h) => (r.buyTx = h), () =>
      wallet!.writeContract({ address: market.curve as Hex, abi: curveAbi, functionName: 'buy', args: [eth, minOut, DEAD], value: eth, chain: wallet!.chain, account: account! }),
    )
    if (!hash) throw new Error(`Bell #${r.n}: the curve buy reverted (price moved more than ${config.slippageBps / 100}%?)`)
    const rec = await pub.getTransactionReceipt({ hash })
    const burned = parseEventLogs({ abi: erc20Abi, logs: rec.logs, eventName: 'Transfer' })
      .filter((l) => l.address.toLowerCase() === config.token!.toLowerCase() && l.args.to.toLowerCase() === DEAD.toLowerCase())
      .reduce((s, l) => s + l.args.value, 0n)
    r.boughtUnits = String(burned)
    r.burnTx = hash
    r.stage = 'bought'
    totalsOnce(r, 'spent', () => (state.totals.spentWei = add(state.totals.spentWei, eth)))
    totalsOnce(r, 'burned', () => (state.totals.burnedUnits = add(state.totals.burnedUnits, burned)))
    r.stage = 'done'
    return
  }
  // graduated: swap on Uniswap v4 into the engine wallet, then burn exactly what came in
  if (!r.balanceBefore) {
    r.balanceBefore = String(await pub.readContract({ address: config.token!, abi: erc20Abi, functionName: 'balanceOf', args: [account!.address] }))
    saveNow()
  }
  const hash = await once(() => r.buyTx, (h) => (r.buyTx = h), () => wallet!.sendTransaction({ to: config.v4Router, data: buildUniswapV4Buy(config.token!, eth), value: eth, chain: wallet!.chain, account: account! }))
  if (!hash) throw new Error(`Bell #${r.n}: the Uniswap buy reverted`)
  totalsOnce(r, 'spent', () => (state.totals.spentWei = add(state.totals.spentWei, eth)))
  if (!r.boughtUnits || r.boughtUnits === '0') {
    const after = await pub.readContract({ address: config.token!, abi: erc20Abi, functionName: 'balanceOf', args: [account!.address] })
    r.boughtUnits = String(after - big(r.balanceBefore))
  }
  r.stage = 'burning'
  saveNow()
  const amount = big(r.boughtUnits)
  if (amount > 0n) {
    const burn = await once(() => r.burnTx, (h) => (r.burnTx = h), () => wallet!.writeContract({ address: config.token!, abi: erc20Abi, functionName: 'transfer', args: [DEAD, amount], chain: wallet!.chain, account: account! }))
    if (!burn) throw new Error(`Bell #${r.n}: the burn transfer reverted`)
    totalsOnce(r, 'burned', () => (state.totals.burnedUnits = add(state.totals.burnedUnits, amount)))
  }
  r.stage = 'done'
}

// adds a confirmed step to the totals exactly once
function totalsOnce(r: Round & { counted?: Record<string, boolean> }, key: string, apply: () => void) {
  r.counted ||= {}
  if (r.counted[key]) return
  apply()
  r.counted[key] = true
}

export async function runBell() {
  if (!wallet || !account || !config.token) return
  live.escrowWei = await pub.readContract({ address: config.ponsEscrow, abi: escrowAbi, functionName: 'balanceOf', args: [account.address] })
  let r = state.rounds[0]
  if (r && r.stage === 'claiming') await claim(r)
  if (!r || r.stage === 'done' || r.stage === 'failed') {
    const step = parseEther(config.buybackStepEth)
    if (live.escrowWei === 0n || live.escrowWei < step) return
    r = {
      n: (state.rounds[0]?.n ?? 0) + 1, at: Math.floor(Date.now() / 1000), stage: 'claiming', claimTx: '', claimedWei: String(live.escrowWei), spendWei: '0',
      route: '', buyTx: '', balanceBefore: '', boughtUnits: '0', burnTx: '', doneAt: 0,
    }
    state.rounds.unshift(r)
    state.rounds.length = Math.min(state.rounds.length, 500)
    live.status = 'claiming'
    log('info', `Bell #${r.n}: the fee tank holds ${formatEther(live.escrowWei)} ETH. Claiming.`)
    saveNow()
    await claim(r)
  }
  if (r.stage === 'claimed' || r.stage === 'buying' || r.stage === 'bought' || r.stage === 'burning') {
    live.status = 'buying back'
    await buy(r)
    if ((r.stage as Round['stage']) === 'done') {
      r.doneAt = Math.floor(Date.now() / 1000)
      saveNow()
      log('success', `Bell #${r.n}: ${formatEther(big(r.spendWei))} ETH bought ${Math.round(Number(formatUnits(big(r.boughtUnits), market.decimals))).toLocaleString('en-US')} $BETTA, sent to the deep (${r.burnTx}).`)
    }
  }
}
