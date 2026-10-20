import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { keccak256, toHex, type Hex } from 'viem'
import { fight } from '../../src/game/battle.ts'
import { asFighter, enterRing, fishFromTx, freshHolder, freshState, isSell, levelFor, shelf, whyNotAFight, withSlippage, type Market } from './rules.ts'

const tx = (s: string): Hex => keccak256(toHex(s))
const MIN = 10_000n * 10n ** 18n
const CURVE = '0xc0'
const ROUTER = '0xr0'
const DEAD = '0xdead'
const market = (contracts: string[] = []): Market => ({
  excluded: new Set(['0x0', DEAD, CURVE, ROUTER, '0xengine']),
  sinks: new Set([CURVE]),
  router: ROUTER,
  dead: DEAD,
  isRelay: () => false,
  isContract: async (a) => contracts.includes(a) || a === CURVE || a === ROUTER,
})

describe('buys and sells', () => {
  it('a buy off the curve into a wallet throws a betta in', async () => {
    const s = freshState('t')
    assert.equal(await whyNotAFight(s.ring, { src: CURVE, dst: '0xa', value: MIN, tx: tx('1') }, MIN, market()), null)
  })
  it('dust, wallet-to-wallet moves, buys into contracts and buybacks to the dead address do not', async () => {
    const s = freshState('t')
    assert.match((await whyNotAFight(s.ring, { src: CURVE, dst: '0xa', value: MIN - 1n, tx: tx('2') }, MIN, market()))!, /smallest/)
    assert.match((await whyNotAFight(s.ring, { src: '0xb', dst: '0xa', value: MIN, tx: tx('3') }, MIN, market()))!, /wallet-to-wallet/)
    assert.match((await whyNotAFight(s.ring, { src: CURVE, dst: '0xvault', value: MIN, tx: tx('4') }, MIN, market(['0xvault'])))!, /contract/)
    assert.match((await whyNotAFight(s.ring, { src: CURVE, dst: DEAD, value: MIN, tx: tx('5') }, MIN, market()))!, /market or an excluded/)
  })
  it('one fight per transaction', async () => {
    const s = freshState('t')
    enterRing(s.ring, { tx: tx('6'), t: 1, buyer: '0xa', tokens: MIN, minUnits: MIN })
    assert.match((await whyNotAFight(s.ring, { src: CURVE, dst: '0xa', value: MIN, tx: tx('6') }, MIN, market()))!, /already/)
  })
  it('selling to the curve, the router or a pool contract is a sell; a wallet transfer is not', async () => {
    assert.equal(await isSell('0xa', CURVE, market()), true)
    assert.equal(await isSell('0xa', ROUTER, market()), true)
    assert.equal(await isSell('0xa', '0xpool', market(['0xpool'])), true)
    assert.equal(await isSell('0xa', '0xb', market()), false)
    assert.equal(await isSell('0xa', DEAD, market()), false)
  })
})

describe('the fish and the ring', () => {
  it('the same transaction always brings the same fish; bigger buys bring higher levels', () => {
    assert.deepEqual(fishFromTx(tx('x'), MIN, MIN), fishFromTx(tx('x'), MIN, MIN))
    assert.equal(levelFor(MIN, MIN), 1)
    assert.equal(levelFor(MIN * 10n, MIN), 7)
    assert.equal(levelFor(MIN * 100n, MIN), 13)
    assert.equal(levelFor(MIN * 10n ** 9n, MIN), 30)
    const big = fishFromTx(tx('y'), MIN * 1000n, MIN)
    assert.equal(big.level, 19)
    assert.equal(big.traits.length, 3)
  })
  it('the first buy walks in; later buys fight the champion and the record matches a replay', () => {
    const s = freshState('t')
    const first = enterRing(s.ring, { tx: tx('a'), t: 1, buyer: '0xa', tokens: MIN, minUnits: MIN })
    assert.equal(first.winner, 'walkover')
    assert.equal(s.ring.champion?.owner, '0xa')
    for (let i = 0; i < 40; i++) {
      const streakBefore: number = s.ring.champion!.streak
      const f = enterRing(s.ring, { tx: tx(`f${i}`), t: 2 + i, buyer: `0xb${i}`, tokens: MIN * BigInt(1 + (i % 50)), minUnits: MIN })
      const replay = fight(asFighter(f.challenger, f.buyer), asFighter(f.champion!, f.championOwner!), f.tx)
      assert.equal(f.winner, replay.winner === 0 ? 'challenger' : 'champion')
      if (f.winner === 'challenger') assert.equal(s.ring.champion!.owner, f.buyer)
      else assert.equal(s.ring.champion!.streak, streakBefore + 1)
    }
    assert.equal(s.ring.total, 41)
    assert.ok(s.ring.best!.streak >= s.ring.champion!.streak)
  })
})

describe('the shelf', () => {
  it('biggest holders first; sellers, excluded addresses and routers never sit on it', () => {
    const h = (bal: bigint, extra: Partial<ReturnType<typeof freshHolder>> = {}) => ({ ...freshHolder(), balance: bal.toString(), ...extra })
    const rows = shelf({ '0xa': h(5n), '0xb': h(9n), '0xc': h(7n, { jumped: true }), '0xd': h(8n, { relay: true }), [CURVE]: h(100n), '0xe': h(1n) }, new Set([CURVE]), 2, 0n)
    assert.deepEqual(rows.map((r) => r.addr), ['0xb', '0xa'])
  })
  it('slippage', () => {
    assert.equal(withSlippage(10_000n, 300), 9_700n)
  })
})
