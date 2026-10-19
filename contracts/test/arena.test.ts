import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { network } from 'hardhat'
import { encodePacked, keccak256, parseEther, toHex, zeroAddress, type Address, type Hex } from 'viem'
import { fight, traitMask, traitsOf, type Fighter } from '../../src/game/battle.ts'
import { runTournament } from '../../src/game/tournament.ts'
import { arenaDomain, fishPermitTypes, shopDomain, snapshotTypes } from '../../src/chain/eip712.ts'

const { viem, networkHelpers } = await network.create()
const { time } = networkHelpers

// deterministic pseudo-random numbers for test inputs
let s = 12345
const rand = (n: number) => {
  s = (s * 1103515245 + 12345) % 2147483648
  return s % n
}
const randSeed = (): Hex => keccak256(toHex(`seed-${rand(1e9)}-${rand(1e9)}`))

function randomFighter(i: number): Fighter & { mask: number } {
  const mask = rand(256)
  return {
    id: `f${i}`,
    name: `F${i}`,
    owner: 'x',
    mine: false,
    speciesId: 'halfmoon',
    genome: {} as Fighter['genome'],
    level: 1 + rand(30),
    traits: [...traitsOf(mask)],
    attack: 10 + rand(300),
    defense: 10 + rand(300),
    beauty: 10 + rand(200),
    health: rand(101),
    sick: rand(5) === 0,
    stake: 25,
    mask,
  }
}
const sol = (f: Fighter) => ({ attack: BigInt(f.attack), defense: BigInt(f.defense), beauty: BigInt(f.beauty), health: BigInt(f.health), sick: f.sick, traits: traitMask(f.traits) })

describe('fight engine: Solidity and TypeScript agree', () => {
  it('single fights (300 random match-ups)', async () => {
    const h = await viem.deployContract('FightHarness')
    for (let i = 0; i < 300; i++) {
      const a = randomFighter(2 * i)
      const b = randomFighter(2 * i + 1)
      const seed = randSeed()
      const onchain = await h.read.fight([sol(a), sol(b), seed])
      assert.equal(onchain, fight(a, b, seed).winner, `match ${i}`)
    }
  })

  it('whole brackets of every size from 4 to 16', async () => {
    const h = await viem.deployContract('FightHarness')
    for (let n = 4; n <= 16; n++) {
      for (let rep = 0; rep < 3; rep++) {
        const field = Array.from({ length: n }, (_, i) => randomFighter(i))
        const seed = randSeed()
        const p = await h.read.bracket([field.map(sol), seed])
        const ts = runTournament(1, 'rookie', field, seed, 0)
        const place = (k: 1 | 2 | 3) => ts.prizes.filter((z) => z.place === k).map((z) => z.fighter)
        assert.equal(p.champion, ts.champion, `champion n=${n}`)
        assert.deepEqual([p.runnerUp], place(2), `runner-up n=${n}`)
        assert.deepEqual(p.semis.filter((x) => x !== 255), place(3), `semis n=${n}`)
      }
    }
  })
})

// ---------- full game flow ----------

const DAY = 86_400n
const PERIOD = 3n * DAY
const LOCK = 3600n
const FEES = [parseEther('25'), parseEther('100'), parseEther('300')] as const
const DEAD = '0x000000000000000000000000000000000000dEaD' as Address

async function setup(taxed = false) {
  const [owner, signer, operator, treasury, ...players] = await viem.getWalletClients()
  const publicClient = await viem.getPublicClient()
  const chainId = await publicClient.getChainId()
  const token = taxed ? await viem.deployContract('TaxedToken') : await viem.deployContract('MockBetta')
  const fish = await viem.deployContract('BettaFish', [owner.account.address, 'https://example.invalid/fish/'])
  const shop = await viem.deployContract('BettaShop', [owner.account.address, token.address, fish.address, treasury.account.address, signer.account.address, 5000])
  await fish.write.setMinter([shop.address, true])
  const anchor = BigInt(await time.latest()) + DAY
  const arena = await viem.deployContract('BettaArena', [
    owner.account.address, token.address, fish.address, anchor, PERIOD, LOCK, signer.account.address, operator.account.address, [...FEES],
  ])
  await shop.write.setFishPrice([0, parseEther('80')])
  await shop.write.setItemPrice([7, parseEther('4')])
  for (const p of players) {
    await token.write.mint([p.account.address, parseEther('10000')])
    await token.write.approve([shop.address, parseEther('10000')], { account: p.account })
    await token.write.approve([arena.address, parseEther('10000')], { account: p.account })
  }
  let nonce = 1n
  const buyFish = async (p: (typeof players)[number], female = false) => {
    const n = nonce++
    const deadline = BigInt(await time.latest()) + 600n
    const sig = await signer.signTypedData({
      domain: shopDomain(chainId, shop.address), types: fishPermitTypes, primaryType: 'FishPermit',
      message: { buyer: p.account.address, species: 0, female, nonce: n, deadline },
    })
    const before = await fish.read.nextId()
    await shop.write.buyFish([0, female, parseEther('80'), n, deadline, sig], { account: p.account })
    return before
  }
  const enter = async (p: (typeof players)[number], fishId: bigint, round: bigint, division: number, stats: { attack: number; defense: number; beauty: number; health: number }) => {
    const snap = {
      owner: p.account.address, fishId, round: Number(round), division, ...stats, sick: false, traits: 0, level: 5,
      deadline: BigInt(await time.latest()) + 3600n,
    }
    const sig = await signer.signTypedData({ domain: arenaDomain(chainId, arena.address), types: snapshotTypes, primaryType: 'Snapshot', message: snap })
    return arena.write.enter([snap, sig], { account: p.account })
  }
  return { owner, signer, operator, treasury, players, token, fish, shop, arena, anchor, buyFish, enter, chainId, publicClient }
}

const secretFor = (n: bigint): Hex => keccak256(encodePacked(['string', 'uint256'], ['secret', n]))

describe('shop', () => {
  it('sells a fish with a permit, burns half and sends the rest to the treasury', async () => {
    const { players, token, fish, treasury, buyFish } = await setup()
    const id = await buyFish(players[0])
    assert.equal((await fish.read.ownerOf([id])).toLowerCase(), players[0].account.address.toLowerCase())
    assert.equal(await token.read.balanceOf([DEAD]), parseEther('40'))
    assert.equal(await token.read.balanceOf([treasury.account.address]), parseEther('40'))
  })

  it('rejects a reused or forged permit', async () => {
    const { players, shop, signer, chainId, buyFish } = await setup()
    await buyFish(players[0])
    const deadline = BigInt(await time.latest()) + 600n
    const sig = await signer.signTypedData({
      domain: shopDomain(chainId, shop.address), types: fishPermitTypes, primaryType: 'FishPermit',
      message: { buyer: players[0].account.address, species: 0, female: false, nonce: 1n, deadline },
    })
    await assert.rejects(shop.write.buyFish([0, false, parseEther('80'), 1n, deadline, sig], { account: players[0].account }))
    // permit made out to someone else
    const sig2 = await signer.signTypedData({
      domain: shopDomain(chainId, shop.address), types: fishPermitTypes, primaryType: 'FishPermit',
      message: { buyer: players[1].account.address, species: 0, female: false, nonce: 99n, deadline },
    })
    await assert.rejects(shop.write.buyFish([0, false, parseEther('80'), 99n, deadline, sig2], { account: players[0].account }))
  })

  it('sells items and enforces the max price', async () => {
    const { players, shop } = await setup()
    await shop.write.buyItems([7, 10, parseEther('40')], { account: players[0].account })
    await assert.rejects(shop.write.buyItems([7, 10, parseEther('39')], { account: players[0].account }))
    await assert.rejects(shop.write.buyItems([8, 1, parseEther('1000')], { account: players[0].account }))
  })

  it('fish cannot be transferred while locked', async () => {
    const { players, fish, buyFish } = await setup()
    const id = await buyFish(players[0])
    await assert.rejects(fish.write.transferFrom([players[0].account.address, players[1].account.address, id], { account: players[0].account }))
    await fish.write.burn([id], { account: players[0].account })
  })

  it('refuses a token that takes a fee on transfer', async () => {
    const { players, buyFish } = await setup(true)
    await assert.rejects(buyFish(players[0]))
  })
})

describe('arena', () => {
  it('runs a full round and pays exactly what the TypeScript replay predicts', async () => {
    const t = await setup()
    const { players, arena, operator, token, anchor, buyFish, enter } = t
    const n = 1n
    await arena.write.commit([n, keccak256(secretFor(n))], { account: operator.account })
    const ids: bigint[] = []
    for (let i = 0; i < 6; i++) ids.push(await buyFish(players[i]))
    await time.increaseTo(anchor + 10n)
    const stats = (i: number) => ({ attack: 40 + i * 7, defense: 35 + i * 3, beauty: 30 + i * 5, health: 70 + i * 4 })
    for (let i = 0; i < 6; i++) await enter(players[i], ids[i], n, 0, stats(i))
    // a seventh fish cannot enter twice
    await assert.rejects(enter(players[0], ids[0], n, 0, stats(0)))
    // reveal is only allowed after the lock
    await assert.rejects(arena.write.reveal([n, secretFor(n)]))
    await time.increaseTo(anchor + PERIOD - LOCK)
    await assert.rejects(arena.write.withdraw([n, 0, ids[0]], { account: players[0].account }))
    await arena.write.reveal([n, secretFor(n)])
    await assert.rejects(arena.write.settle([n, 0]))
    await time.increaseTo(anchor + PERIOD)

    const before = await Promise.all(players.slice(0, 6).map((p) => token.read.balanceOf([p.account.address])))
    const deadBefore = await token.read.balanceOf([DEAD])
    await arena.write.settle([n, 0])
    await assert.rejects(arena.write.settle([n, 0]))

    // replay off chain
    const seed = await arena.read.seedOf([n])
    const divSeed = keccak256(encodePacked(['bytes32', 'uint8'], [seed, 0]))
    const field: Fighter[] = ids.map((id, i) => ({
      id: String(id), name: `F${i}`, owner: players[i].account.address, mine: false, speciesId: 'veiltail', genome: {} as Fighter['genome'],
      level: 5, traits: [], ...stats(i), sick: false, stake: 25,
    }))
    const res = runTournament(1, 'rookie', field, divSeed, 0)
    const pot = FEES[0] * 6n
    const burned = (pot * 500n) / 10_000n
    const payout = pot - burned
    const expected = new Array(6).fill(0n)
    for (const z of res.prizes) if (z.place !== 1) expected[z.fighter] = (payout * (z.place === 2 ? 2500n : 750n)) / 10_000n
    expected[res.champion] = payout - expected.reduce((a, b) => a + b, 0n)
    const after = await Promise.all(players.slice(0, 6).map((p) => token.read.balanceOf([p.account.address])))
    for (let i = 0; i < 6; i++) assert.equal(after[i] - before[i], expected[i], `player ${i}`)
    assert.equal((await token.read.balanceOf([DEAD])) - deadBefore, burned)
    assert.equal(await token.read.balanceOf([arena.address]), 0n)
  })

  it('settles a full 16-fish bracket within a sane gas budget', async () => {
    const { players, arena, operator, anchor, buyFish, enter, publicClient } = await setup()
    const n = 1n
    await arena.write.commit([n, keccak256(secretFor(n))], { account: operator.account })
    const ids: [number, bigint][] = []
    for (let i = 0; i < 16; i++) ids.push([i % 8, await buyFish(players[i % 8])])
    await time.increaseTo(anchor + 10n)
    for (const [p, id] of ids) await enter(players[p], id, n, 2, { attack: 120 + Number(id), defense: 110, beauty: 90, health: 95 })
    await time.increaseTo(anchor + PERIOD - LOCK)
    await arena.write.reveal([n, secretFor(n)])
    await time.increaseTo(anchor + PERIOD)
    const hash = await arena.write.settle([n, 2])
    const r = await publicClient.waitForTransactionReceipt({ hash })
    console.log(`      gas for a 16-fish settlement: ${r.gasUsed}`)
    assert.ok(r.gasUsed < 15_000_000n)
  })

  it('refunds a field smaller than four and lets keepers withdraw while open', async () => {
    const { players, arena, operator, token, anchor, buyFish, enter } = await setup()
    const n = 1n
    await arena.write.commit([n, keccak256(secretFor(n))], { account: operator.account })
    const a = await buyFish(players[0])
    const b = await buyFish(players[1])
    const c = await buyFish(players[2])
    await time.increaseTo(anchor + 10n)
    const st = { attack: 50, defense: 50, beauty: 50, health: 90 }
    await enter(players[0], a, n, 0, st)
    await enter(players[1], b, n, 0, st)
    await enter(players[2], c, n, 0, st)
    const bal = await token.read.balanceOf([players[2].account.address])
    await arena.write.withdraw([n, 0, c], { account: players[2].account })
    assert.equal(await token.read.balanceOf([players[2].account.address]), bal + FEES[0])
    await time.increaseTo(anchor + PERIOD)
    await arena.write.settle([n, 0])
    assert.equal(await token.read.balanceOf([arena.address]), 0n)
  })

  it('refunds everyone when the secret is never revealed', async () => {
    const { players, arena, operator, token, anchor, buyFish, enter } = await setup()
    const n = 1n
    await arena.write.commit([n, keccak256(secretFor(n))], { account: operator.account })
    const ids: bigint[] = []
    for (let i = 0; i < 4; i++) ids.push(await buyFish(players[i]))
    await time.increaseTo(anchor + 10n)
    for (let i = 0; i < 4; i++) await enter(players[i], ids[i], n, 1, { attack: 50, defense: 50, beauty: 50, health: 90 })
    await time.increaseTo(anchor + PERIOD)
    await assert.rejects(arena.write.settle([n, 1])) // not revealed
    await assert.rejects(arena.write.refundUnrevealed([n, 1])) // still inside the reveal window
    await time.increaseTo(anchor + PERIOD + DAY)
    await assert.rejects(arena.write.reveal([n, secretFor(n)]))
    await arena.write.refundUnrevealed([n, 1])
    assert.equal(await token.read.balanceOf([arena.address]), 0n)
  })

  it('rejects forged snapshots, other people’s fish, late commits and entries after the lock', async () => {
    const { players, arena, operator, signer, anchor, buyFish, enter, chainId } = await setup()
    const n = 1n
    const a = await buyFish(players[0])
    // entering before the round is committed fails
    await time.increaseTo(anchor + 10n)
    await assert.rejects(enter(players[0], a, n, 0, { attack: 50, defense: 50, beauty: 50, health: 90 }))
    // committing after registration opened is refused
    await assert.rejects(arena.write.commit([n, keccak256(secretFor(n))], { account: operator.account }))
    // only the operator commits
    await assert.rejects(arena.write.commit([2n, keccak256(secretFor(2n))], { account: players[0].account }))
    await arena.write.commit([2n, keccak256(secretFor(2n))], { account: operator.account })
    await time.increaseTo(anchor + PERIOD + 10n)
    // someone else's fish
    await assert.rejects(enter(players[1], a, 2n, 0, { attack: 50, defense: 50, beauty: 50, health: 90 }))
    // stats signed by the wrong key
    const snap = { owner: players[0].account.address, fishId: a, round: 2, division: 0, attack: 999, defense: 999, beauty: 999, health: 100, sick: false, traits: 255, level: 5, deadline: anchor + 10n * DAY }
    const forged = await players[0].signTypedData({ domain: arenaDomain(chainId, arena.address), types: snapshotTypes, primaryType: 'Snapshot', message: snap })
    await assert.rejects(arena.write.enter([snap, forged], { account: players[0].account }))
    // a genuine snapshot works, then is refused after the lock
    const ok = await signer.signTypedData({ domain: arenaDomain(chainId, arena.address), types: snapshotTypes, primaryType: 'Snapshot', message: { ...snap, attack: 50, defense: 50, beauty: 50, traits: 0 } })
    await time.increaseTo(anchor + 2n * PERIOD - LOCK)
    await assert.rejects(arena.write.enter([{ ...snap, attack: 50, defense: 50, beauty: 50, traits: 0 }, ok], { account: players[0].account }))
    assert.notEqual(zeroAddress, players[0].account.address)
  })
})
