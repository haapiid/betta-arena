// Dry run, read only: replays a token's recent Transfers through the engine's rules and prints which
// would be fights, which are sells, and why the rest are neither. Run it on the server (it needs the
// Robinhood RPC) against any Pons token that already trades, before $BETTA exists, and again after
// the first $BETTA buys. Nothing is signed or sent.
//
//   npx tsx --env-file-if-exists=.env scripts/dryrun.ts 0xTOKEN [blocks=20000] [creator=0x...]

import { getAddress, isAddress, parseEventLogs, parseUnits, zeroAddress, type Address } from 'viem'
import { config, DEAD } from '../src/config.ts'
import { erc20Abi, escrowAbi, pub } from '../src/chain.ts'
import { freshState, isSell, whyNotAFight, enterRing, type Market } from '../src/rules.ts'

const [tokenArg, blocksArg, creatorArg] = process.argv.slice(2)
if (!tokenArg || !isAddress(tokenArg)) {
  console.error('usage: npx tsx --env-file-if-exists=.env scripts/dryrun.ts 0xTOKEN [blocks] [creator]')
  process.exit(1)
}
const token = getAddress(tokenArg)
const lc = (a: string) => a.toLowerCase()

const chainId = await pub.getChainId()
const head = await pub.getBlockNumber()
const curve = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'curve' }).catch(() => null)
const decimals = Number(await pub.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }).catch(() => 18))
console.log(`chain ${chainId}, head ${head}, token ${token}`)
console.log(curve && curve !== zeroAddress ? `Pons curve: ${curve}` : 'No curve() on this token (not a Pons token, or a different version)')

const codes = new Map<string, boolean>()
const isContract = async (a: string) => {
  if (!codes.has(a)) {
    const c = await pub.getCode({ address: a as Address })
    codes.set(a, !!c && c !== '0x')
  }
  return codes.get(a)!
}
const sinks = new Set(config.sellSinks.map(lc))
if (curve && curve !== zeroAddress) sinks.add(lc(curve))
const excluded = new Set([zeroAddress, DEAD, config.ponsEscrow, config.v4Router, token, ...config.exclude].map(lc))
if (curve) excluded.add(lc(curve))
const m: Market = { excluded, sinks, router: lc(config.v4Router), dead: lc(DEAD), isRelay: () => false, isContract }

const span = BigInt(blocksArg ?? '20000')
const from = head > span ? head - span : 0n
const logs = []
for (let a = from; a <= head; a += 5_000n) {
  const b = a + 4_999n < head ? a + 4_999n : head
  logs.push(...(await pub.getLogs({ address: token, event: erc20Abi[0], fromBlock: a, toBlock: b })))
}
const minUnits = parseUnits(config.fightMinTokens || '0', decimals)
const ring = freshState(lc(token)).ring
const reasons = new Map<string, number>()
let fights = 0
let sells = 0
const samples: string[] = []
for (const l of parseEventLogs({ abi: erc20Abi, logs, eventName: 'Transfer' })) {
  const src = lc(l.args.from)
  const dst = lc(l.args.to)
  if (src === lc(zeroAddress)) continue
  if (await isSell(src, dst, m)) {
    sells++
    if (samples.length < 12) samples.push(`SELL  ${src.slice(0, 10)}… → ${dst.slice(0, 10)}…  ${l.transactionHash}`)
    continue
  }
  const why = await whyNotAFight(ring, { src, dst, value: l.args.value, tx: l.transactionHash }, minUnits, m)
  if (why) {
    reasons.set(why, (reasons.get(why) ?? 0) + 1)
    continue
  }
  const f = enterRing(ring, { tx: l.transactionHash, t: 0, buyer: dst, tokens: l.args.value, minUnits })
  fights++
  if (samples.length < 24) samples.push(`FIGHT #${f.n} ${f.challenger.name} Lv${f.challenger.level} → ${f.winner}  ${l.transactionHash}`)
}

console.log(`\n${logs.length} transfers in blocks ${from}-${head}`)
console.log(`  fights: ${fights}`)
console.log(`  sells:  ${sells}`)
for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  not a fight (${n}): ${why}`)
console.log(`\nSamples (open a few on the explorer and check they really are buys / sells):`)
for (const s of samples) console.log('  ' + s)
if (creatorArg && isAddress(creatorArg)) {
  const owed = await pub.readContract({ address: config.ponsEscrow, abi: escrowAbi, functionName: 'balanceOf', args: [getAddress(creatorArg)] })
  console.log(`\nPons fee escrow owes ${creatorArg}: ${Number(owed) / 1e18} ETH`)
}
