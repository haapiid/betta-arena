// Keeps the rounds moving: commits each round's secret before its registration opens, reveals it
// once registration closes, and settles every division after the bell. Settling is open to anyone
// on chain; this job just makes sure it happens.

import { encodePacked, keccak256, type Hex } from 'viem'
import { arena, chainNow, publicClient } from './chain.ts'
import { ENV } from './env.ts'

const DIVS = [0, 1, 2] as const

/** Deterministic per-round secret, so a restart can still reveal. Keep OPERATOR_SECRET private. */
export const secretFor = (n: number): Hex => keccak256(encodePacked(['string', 'uint256'], [ENV.operatorSecret, BigInt(n)]))

async function send(label: string, write: () => Promise<Hex>) {
  try {
    const hash = await write()
    const r = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`[operator] ${label}: ${r.status} (${hash})`)
  } catch (e) {
    console.error(`[operator] ${label} failed:`, (e as Error).message.split('\n')[0])
  }
}

export async function operateOnce() {
  // a couple of seconds of margin so a transaction is never mined just before its time
  const now = BigInt(Math.floor((await chainNow()) / 1000)) - 2n
  const cur = Number(await arena.read.roundAt([now]))
  const window = await arena.read.revealWindow()

  // commit the coming rounds (a round must be committed before it opens)
  for (const n of [cur, cur + 1, cur + 2]) {
    const start = await arena.read.startOf([BigInt(n)])
    if (now >= start) continue
    if ((await arena.read.commitment([BigInt(n)])) !== `0x${'0'.repeat(64)}`) continue
    await send(`commit #${n}`, () => arena.write.commit([BigInt(n), keccak256(secretFor(n))]))
  }

  for (let n = Math.max(1, cur - 3); n <= cur; n++) {
    const N = BigInt(n)
    const [lock, bell, commit, seed] = await Promise.all([arena.read.lockOf([N]), arena.read.bellOf([N]), arena.read.commitment([N]), arena.read.seedOf([N])])
    const zero = `0x${'0'.repeat(64)}`
    if (commit === zero) continue
    // reveal once registration has closed
    if (seed === zero && now >= lock && now < bell + window) await send(`reveal #${n}`, () => arena.write.reveal([N, secretFor(n)]))
    if (now < bell) continue
    for (const d of DIVS) {
      if ((await arena.read.status([N, BigInt(d)])) !== 0) continue
      const entries = await arena.read.getEntries([N, BigInt(d)])
      if (!entries.length) continue
      const revealed = (await arena.read.seedOf([N])) !== zero
      if (revealed || entries.length < 4) await send(`settle #${n} div ${d}`, () => arena.write.settle([N, d]))
      else if (now >= bell + window) await send(`refund #${n} div ${d}`, () => arena.write.refundUnrevealed([N, d]))
    }
  }
}

export function startOperator() {
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await operateOnce()
    } catch (e) {
      console.error('[operator]', (e as Error).message.split('\n')[0])
    } finally {
      busy = false
    }
  }
  void tick()
  return setInterval(tick, Math.max(ENV.pollMs, 15_000))
}
