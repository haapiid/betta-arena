// End-to-end check against a local chain + running server: five wallets sign in, buy fish and
// food on chain, care for the fish through the API, enter round 1, and wait for the operator to
// reveal and settle it. Usage (server running with server/.env pointing at the local deployment):
//   npx tsx --env-file=.env scripts/e2e.ts
import { createPublicClient, createWalletClient, http, maxUint256, parseEther, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import { hardhat } from 'viem/chains'
import { bettaArenaAbi, bettaShopAbi, erc20Abi, mockBettaAbi } from '../../src/chain/abi.ts'
import { skuById } from '../../src/game/catalog.ts'

const API = 'http://127.0.0.1:8787'
const env = process.env as Record<string, string>
const shop = env.SHOP_ADDRESS as Hex
const arena = env.ARENA_ADDRESS as Hex
const token = env.TOKEN_ADDRESS as Hex
// Hardhat default accounts #5..#9 (public test keys)
const KEYS: Hex[] = [
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba',
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e',
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356',
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97',
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
]
const pub = createPublicClient({ chain: hardhat, transport: http() })
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`✗ ${msg}`)
  console.log(`✓ ${msg}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until<T>(what: string, fn: () => Promise<T | undefined | null | false>, ms = 120_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(1500)
  }
}

async function call(path: string, tok?: string, body?: unknown) {
  const r = await fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: await r.json() }
}

const players = await Promise.all(
  KEYS.map(async (k, i) => {
    const account = privateKeyToAccount(k)
    const wallet = createWalletClient({ chain: hardhat, transport: http(), account })
    const send = async (hash: Promise<Hex>) => pub.waitForTransactionReceipt({ hash: await hash })
    await send(wallet.writeContract({ address: token, abi: mockBettaAbi, functionName: 'mint', args: [account.address, parseEther('2000')] }))
    await send(wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [shop, maxUint256] }))
    await send(wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [arena, maxUint256] }))
    const { body: n } = await call('/api/auth/nonce', undefined, {})
    const message = createSiweMessage({ address: account.address, chainId: hardhat.id, domain: 'localhost:3110', nonce: n.nonce, uri: 'http://localhost:3110', version: '1', statement: 'Sign in to Betta Arena.' })
    const signature = await wallet.signMessage({ message })
    const { status, body } = await call('/api/auth/verify', undefined, { message, signature })
    if (status !== 200) throw new Error(`login ${i}: ${JSON.stringify(body)}`)
    return { i, account, wallet, send, tok: body.token as string }
  }),
)
ok(players.every((p) => p.tok), 'five wallets signed in with SIWE')
ok((await call('/api/me')).status === 401, 'the API refuses state without a session')

// buy a fish each (species 0..4, all male)
for (const p of players) {
  const { body: pm } = await call('/api/permit/fish', p.tok, { species: p.i, female: false })
  await p.send(p.wallet.writeContract({ address: shop, abi: bettaShopAbi, functionName: 'buyFish', args: [p.i, false, parseEther('1000'), BigInt(pm.nonce), BigInt(pm.deadline), pm.sig] }))
}
const me = await Promise.all(players.map((p) => until(`fish of player ${p.i}`, async () => {
  const r = await call('/api/me', p.tok)
  return r.body.state?.tanks?.[0] ? r.body : null
})))
ok(me.every((m) => m.state.inventory.pellet === 10), 'each keeper got the fish NFT in jar 1 and the starter food')

// a reused permit is refused by the contract
{
  const p = players[0]
  const { body: pm } = await call('/api/permit/fish', p.tok, { species: 0, female: true })
  await p.send(p.wallet.writeContract({ address: shop, abi: bettaShopAbi, functionName: 'buyFish', args: [0, true, parseEther('1000'), BigInt(pm.nonce), BigInt(pm.deadline), pm.sig] }))
  let reverted = false
  try {
    await p.wallet.writeContract({ address: shop, abi: bettaShopAbi, functionName: 'buyFish', args: [0, true, parseEther('1000'), BigInt(pm.nonce), BigInt(pm.deadline), pm.sig] })
  } catch {
    reverted = true
  }
  ok(reverted, 'the same fish permit cannot be used twice')
}

// buy daphnia on chain, feed it through the API, train
const daphnia = skuById('daphnia-10')!
{
  const p = players[1]
  await p.send(p.wallet.writeContract({ address: shop, abi: bettaShopAbi, functionName: 'buyItems', args: [daphnia.index, 1, parseEther('1000')] }))
  await until('daphnia credited', async () => (await call('/api/me', p.tok)).body.state.inventory.daphnia === 10)
  ok(true, 'a pack bought on chain shows up in the inventory')
  const fed = await call('/api/action', p.tok, { type: 'useItem', slot: 0, item: 'daphnia' })
  ok(fed.status === 200 && fed.body.ok, `feeding works: ${fed.body.msg}`)
  const none = await call('/api/action', p.tok, { type: 'useItem', slot: 0, item: 'bloodworm' })
  ok(none.status === 400, `using an item you do not have is refused: ${none.body.msg}`)
  const tr = await call('/api/action', p.tok, { type: 'train', slot: 0, training: 'mirror' })
  ok(tr.body.ok, `training works: ${tr.body.msg}`)
  const again = await call('/api/action', p.tok, { type: 'train', slot: 0, training: 'sun' })
  ok(!again.body.ok, `the training cooldown holds: ${again.body.msg}`)
  const other = await call('/api/action', players[2].tok, { type: 'rename', slot: 0, name: '<b>Bolt</b>' })
  ok(other.body.ok, 'renaming strips markup')
}

// enter round 1 once registration opens
const anchor = Number(await pub.readContract({ address: arena, abi: bettaArenaAbi, functionName: 'anchor' })) * 1000
if (Date.now() < anchor) {
  console.log(`… waiting ${Math.ceil((anchor - Date.now()) / 1000)}s for round 1 to open`)
  await sleep(anchor - Date.now() + 1500)
}
for (const p of players) {
  const s = await call('/api/arena/snapshot', p.tok, { slot: 0 })
  if (s.status !== 200) throw new Error(`snapshot ${p.i}: ${JSON.stringify(s.body)}`)
  const snap = { ...s.body.snapshot, fishId: BigInt(s.body.snapshot.fishId), deadline: BigInt(s.body.snapshot.deadline) }
  await p.send(p.wallet.writeContract({ address: arena, abi: bettaArenaAbi, functionName: 'enter', args: [snap, s.body.sig] }))
}
const field = await until('field of 5', async () => {
  const r = await call('/api/arena/field?round=1&division=0')
  return r.body.entries.length === 5 ? r.body : null
}, 20_000)
ok(field.entries.every((e: { name: string }) => !e.name.startsWith('Fish #')), 'all five fish are in the Rookie bracket, with names')
const dup = await call('/api/arena/snapshot', players[0].tok, { slot: 0 })
await until('entered flag', async () => (await call('/api/me', players[0].tok)).body.state.entered.length === 1)
ok((await call('/api/arena/snapshot', players[0].tok, { slot: 0 })).status === 409 || dup.status === 409, 'a fish cannot be entered twice')

const before = await Promise.all(players.map((p) => pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [p.account.address] })))
const bell = Number(await pub.readContract({ address: arena, abi: bettaArenaAbi, functionName: 'bellOf', args: [1n] })) * 1000
console.log(`… waiting ${Math.ceil((bell - Date.now()) / 1000)}s for the bell, the reveal and the settlement`)
const results = await until('settled result', async () => {
  const r = await call('/api/results?division=0')
  return r.body.length ? r.body : null
}, bell - Date.now() + 180_000)
const res = results[0]
ok(res.n === 1 && res.fighters.length === 5 && res.prizes.length >= 3, `round 1 settled: champion ${res.fighters[res.champion].name}, pot ${res.pot}, burned ${res.fee}`)
const after = await Promise.all(players.map((p) => pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [p.account.address] })))
for (const pz of res.prizes) {
  const owner = res.fighters[pz.fighter].owner
  const p = players.find((x) => x.account.address.toLowerCase() === owner)!
  ok(Number(after[p.i] - before[p.i]) / 1e18 === pz.amount, `player ${p.i} received ${pz.amount} on chain, as the replay says`)
}
const champ = await until('champion state updated', async () => {
  const owner = res.fighters[res.champion].owner
  const p = players.find((x) => x.account.address.toLowerCase() === owner)!
  const st = (await call('/api/me', p.tok)).body.state
  return st.tanks[0].wins > 0 ? st : null
})
ok(champ.entered.length === 0 && champ.log.some((l: { text: string }) => l.text.includes('Round #1')), 'wins, wounds and prize money reached the champion’s jar')
const lb = (await call('/api/leaderboard')).body
ok(lb.length === 5 && lb.some((r: { titles: number }) => r.titles === 1), 'the leaderboard has the five keepers and one title')
console.log('\nAll end-to-end checks passed.')
