// Follows the contracts and turns their events into game state: fish arriving and leaving,
// items bought, entries, and settled brackets (wounds, XP and prize money).

import { decodeEventLog, zeroAddress, type Address, type Hex, type Log } from 'viem'
import { addFish, applyResult, credit, fishById, fryArrived, log, removeFish, shopFish } from '../../src/game/engine.ts'
import { skuByIndex } from '../../src/game/catalog.ts'
import { divisionByIndex, runTournament, type TournamentResult } from '../../src/game/tournament.ts'
import type { Fish } from '../../src/game/fish.ts'
import { traitsOf, type Fighter } from '../../src/game/battle.ts'
import { bettaArenaAbi, bettaFishAbi, bettaShopAbi } from '../../src/chain/abi.ts'
import { arena, blockTime, publicClient, toTokens } from './chain.ts'
import { ENV } from './env.ts'
import type { Db } from './db.ts'
import { norm, withPlayer, markEvent } from './players.ts'

const SOURCES: { address: Address; abi: readonly unknown[] }[] = [
  { address: ENV.fish, abi: bettaFishAbi },
  { address: ENV.shop, abi: bettaShopAbi },
  { address: ENV.arena, abi: bettaArenaAbi },
]

type Decoded = { eventName: string; args: Record<string, unknown> }

/** Public details of a fish shown in brackets (no care stats). */
export function publicFish(f: Fish) {
  return { name: f.name, speciesId: f.speciesId, genome: f.genome, gen: f.gen, sex: f.sex, breedName: f.breedName, mutation: f.mutation }
}

async function handle(db: Db, l: Log, ev: Decoded) {
  const id = `${l.transactionHash}:${l.logIndex}`
  const at = await blockTime(l.blockNumber!)
  const a = ev.args
  switch (ev.eventName) {
    case 'Born': {
      // shop fish are created here; bred fry arrive with FryClaimed (same transaction)
      const to = norm(a.to as string)
      await db.query('insert into fish_owner (fish_id, address) values ($1, $2) on conflict (fish_id) do update set address = excluded.address', [String(a.id), to])
      if (Number(a.gen) !== 1) return markEvent(db, id)
      const f = shopFish(String(a.id), Number(a.species), Boolean(a.female), Number(a.seed), at)
      return withPlayer(db, to, (d) => addFish(d, f, at), id)
    }
    case 'FryClaimed': {
      const to = norm(a.to as string)
      const nonce = String(a.nonce)
      const rows = await db.query<{ fish: Fish }>('select fish from fry_claims where nonce = $1', [nonce])
      if (!rows[0]) return markEvent(db, id)
      const f: Fish = { ...rows[0].fish, id: String(a.fishId), bornAt: at, lastTick: at }
      await withPlayer(db, to, (d) => fryArrived(d, f, at), id)
      await db.query('delete from fry_claims where nonce = $1', [nonce])
      return
    }
    case 'Transfer': {
      const from = a.from as Address
      const to = a.to as Address
      if (from === zeroAddress) return markEvent(db, id) // mint: handled by Born
      const fishId = String(a.tokenId)
      if (to === zeroAddress) {
        await db.query('delete from fish_owner where fish_id = $1', [fishId])
        return withPlayer(db, from, (d) => removeFish(d, fishId, at, 'released'), `${id}:${norm(from)}`)
      }
      // trading opened: the fish (with its care state) moves to the new keeper
      let moved: Fish | null = null
      await withPlayer(db, from, (d) => (moved = removeFish(d, fishId, at, 'transferred')), `${id}:${norm(from)}`)
      await db.query('update fish_owner set address = $2 where fish_id = $1', [fishId, norm(to)])
      if (moved) await withPlayer(db, to, (d) => addFish(d, moved!, at), `${id}:${norm(to)}`)
      return
    }
    case 'ItemsBought': {
      const sku = skuByIndex(Number(a.item))
      if (!sku) return markEvent(db, id)
      const units = sku.qty * Number(a.qty)
      return withPlayer(
        db,
        a.buyer as string,
        (d) => {
          credit(d, sku.item, units)
          log(d, `Bought ${units} × ${sku.item}.`, at)
        },
        id,
      )
    }
    case 'Entered': {
      const owner = norm(a.owner as string)
      const fishId = String(a.fishId)
      const round = Number(a.round)
      await withPlayer(
        db,
        owner,
        async (d, q) => {
          const f = fishById(d, fishId)
          await q.query(
            `insert into entries (round, division, fish_id, owner, fee, active, fish) values ($1,$2,$3,$4,$5,true,$6::jsonb)
             on conflict (round, fish_id) do update set division = excluded.division, owner = excluded.owner, fee = excluded.fee, active = true, fish = excluded.fish`,
            [round, Number(a.division), fishId, owner, toTokens(a.fee as bigint), JSON.stringify(f ? publicFish(f) : { name: `Fish #${fishId}` })],
          )
          if (!d.entered.includes(fishId)) d.entered.push(fishId)
          log(d, `${f?.name ?? `Fish #${fishId}`} entered round #${round} (${divisionByIndex(Number(a.division)).name}).`, at)
        },
        id,
      )
      return
    }
    case 'Withdrawn': {
      const owner = norm(a.owner as string)
      const fishId = String(a.fishId)
      await withPlayer(
        db,
        owner,
        async (d, q) => {
          await q.query('update entries set active = false where round = $1 and fish_id = $2', [Number(a.round), fishId])
          d.entered = d.entered.filter((x) => x !== fishId)
          log(d, `Entry withdrawn from round #${Number(a.round)}; fee refunded.`, at)
        },
        id,
      )
      return
    }
    case 'Refunded': {
      const round = Number(a.round)
      const division = Number(a.division)
      const rows = await db.query<{ fish_id: string; owner: string }>('select fish_id, owner from entries where round = $1 and division = $2 and active', [round, division])
      for (const r of rows)
        await withPlayer(
          db,
          r.owner,
          (d) => {
            d.entered = d.entered.filter((x) => x !== String(r.fish_id))
            log(d, `Round #${round} ${divisionByIndex(division).name} was called off (${a.reason}). Entry fee refunded.`, at)
          },
          `${id}:${r.owner}:${r.fish_id}`,
        )
      await db.query('update entries set active = false where round = $1 and division = $2', [round, division])
      return markEvent(db, id)
    }
    case 'Settled':
      return settled(db, l, a, at, id)
    default:
      return markEvent(db, id)
  }
}

async function settled(db: Db, l: Log, a: Record<string, unknown>, at: number, id: string) {
  const round = Number(a.round)
  const division = Number(a.division)
  const div = divisionByIndex(division)
  const onchain = await arena.read.getEntries([BigInt(round), BigInt(division)], { blockNumber: l.blockNumber! })
  const info = await db.query<{ fish_id: string; fish: ReturnType<typeof publicFish> }>('select fish_id, fish from entries where round = $1 and division = $2', [round, division])
  const byId = new Map(info.map((r) => [String(r.fish_id), r.fish]))
  const field: Fighter[] = onchain.map((e) => {
    const p = byId.get(String(e.fishId)) ?? { name: `Fish #${e.fishId}`, speciesId: 'veiltail', genome: undefined, gen: 1 }
    return {
      id: String(e.fishId),
      name: p.name,
      owner: norm(e.owner),
      mine: false,
      speciesId: p.speciesId,
      genome: p.genome as Fighter['genome'],
      gen: p.gen,
      level: e.level,
      traits: [...traitsOf(e.traits)],
      attack: e.attack,
      defense: e.defense,
      beauty: e.beauty,
      health: e.health,
      sick: e.sick,
      stake: toTokens(e.fee),
    }
  })
  const res: TournamentResult = runTournament(round, div.id, field, a.seed as Hex, at)
  // money comes from the chain, not from the replay
  const prizes = a.prizes as bigint[]
  res.pot = toTokens(a.pot as bigint)
  res.fee = toTokens(a.burned as bigint)
  res.payout = res.pot - res.fee
  res.prizes = res.prizes.map((pz) => ({ ...pz, amount: toTokens(prizes[pz.fighter] ?? 0n) }))
  res.tx = l.transactionHash!
  await db.query('insert into results (round, division, data) values ($1, $2, $3::jsonb) on conflict (round, division) do update set data = excluded.data', [round, division, JSON.stringify(res)])
  for (const owner of new Set(field.map((f) => f.owner))) await withPlayer(db, owner, (d) => applyResult(d, res, at), `${id}:${owner}`)
  await db.query('update entries set active = false where round = $1 and division = $2', [round, division])
  await markEvent(db, id)
}

// ---------- polling loop ----------

export async function syncOnce(db: Db) {
  const rows = await db.query<{ block: string }>("select block from cursors where name = 'main'")
  let from = rows[0] ? BigInt(rows[0].block) + 1n : ENV.startBlock
  const head = await publicClient.getBlockNumber()
  while (from <= head) {
    const to = from + 1999n < head ? from + 1999n : head
    const logs = await publicClient.getLogs({ address: SOURCES.map((s) => s.address), fromBlock: from, toBlock: to })
    logs.sort((x, y) => (x.blockNumber === y.blockNumber ? x.logIndex! - y.logIndex! : x.blockNumber! < y.blockNumber! ? -1 : 1))
    for (const l of logs) {
      const src = SOURCES.find((s) => s.address.toLowerCase() === l.address.toLowerCase())
      if (!src) continue
      let ev: Decoded
      try {
        ev = decodeEventLog({ abi: src.abi as never, data: l.data, topics: l.topics }) as unknown as Decoded
      } catch {
        continue // an event this server does not care about
      }
      await handle(db, l, ev)
    }
    await db.query("insert into cursors (name, block) values ('main', $1) on conflict (name) do update set block = excluded.block", [String(to)])
    from = to + 1n
  }
}

export function startIndexer(db: Db) {
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await syncOnce(db)
    } catch (e) {
      console.error('[indexer]', e)
    } finally {
      busy = false
    }
  }
  void tick()
  return setInterval(tick, ENV.pollMs)
}

