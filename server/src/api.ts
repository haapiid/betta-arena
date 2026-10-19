// HTTP API for the web app. Reads are public; anything that changes a keeper's state needs a
// Sign-In With Ethereum session. Money never moves here: the app sends transactions to the
// contracts itself, and this server only signs permits and stat snapshots.

import { randomBytes } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { bodyLimit } from 'hono/body-limit'
import type { Hex } from 'viem'
import {
  abandonSpawn, bury, freeSlot, fryToKeep, pickTrait, rename, rushTrain, startBreeding, trainFish, useItem, type PlayerState, type Result,
} from '../../src/game/engine.ts'
import { effective, levelOf, MIN_ENTRY_HEALTH, power, type Fish } from '../../src/game/fish.ts'
import { DIVISIONS, divisionByIndex, divisionFor, entriesOpen, isBye, locksAt, roundAt, type TournamentResult } from '../../src/game/tournament.ts'
import { traitMask, traitsOf } from '../../src/game/battle.ts'
import { SKUS, speciesIndex } from '../../src/game/catalog.ts'
import { SPECIES } from '../../src/game/species.ts'
import { arenaDomain, bredPermitTypes, fishPermitTypes, shopDomain, snapshotTypes } from '../../src/chain/eip712.ts'
import { sessionAddress, newNonce, verifyLogin } from './auth.ts'
import { arena, signer, toTokens } from './chain.ts'
import { ENV } from './env.ts'
import type { Db } from './db.ts'
import { loadPlayer, norm, withPlayer } from './players.ts'

type Vars = { Variables: { addr: string } }

// a small per-IP limit, enough to stop scripted hammering of one instance
const hits = new Map<string, { n: number; reset: number }>()
function limited(ip: string, max: number) {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    if (hits.size > 100_000) hits.clear()
    return false
  }
  return ++h.n > max
}

const int = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null)
const nonce = () => BigInt(`0x${randomBytes(32).toString('hex')}`)
const fail = (c: Context, msg: string, status: 400 | 401 | 403 | 404 | 409 | 429 = 400) => c.json({ ok: false, msg }, status)

export function api(db: Db) {
  const app = new Hono<Vars>()
  app.use('*', cors({ origin: ENV.allowedOrigins, allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 600 }))
  app.use('*', bodyLimit({ maxSize: 16 * 1024 }))
  app.use('*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local'
    if (limited(ip, 240)) return fail(c, 'Too many requests. Slow down a little.', 429)
    await next()
  })
  const auth = async (c: Context<Vars>, next: () => Promise<void>) => {
    const a = sessionAddress(c.req.header('Authorization'))
    if (!a) return fail(c, 'Sign in with your wallet first.', 401)
    c.set('addr', a)
    await next()
  }

  // ---------- public ----------

  app.get('/api/health', (c) => c.json({ ok: true }))

  app.get('/api/config', async (c) =>
    c.json({
      chainId: ENV.chainId,
      contracts: { arena: ENV.arena, shop: ENV.shop, fish: ENV.fish, token: ENV.token },
      fees: DIVISIONS.map((d) => d.fee),
      skus: SKUS,
      species: SPECIES.map((s, i) => ({ index: i, id: s.id, price: s.price })),
    }),
  )

  app.post('/api/auth/nonce', (c) => c.json({ nonce: newNonce() }))
  app.post('/api/auth/verify', async (c) => {
    const ip = c.req.header('x-forwarded-for') ?? 'local'
    if (limited(`login:${ip}`, 20)) return fail(c, 'Too many sign-in attempts.', 429)
    const b = await c.req.json().catch(() => ({}))
    if (typeof b.message !== 'string' || typeof b.signature !== 'string' || b.message.length > 2000) return fail(c, 'Bad sign-in.')
    const r = await verifyLogin(b.message, b.signature as Hex)
    return 'error' in r ? fail(c, r.error, 401) : c.json(r)
  })

  // who is in a division this round (or any round), straight from the contract
  app.get('/api/arena/field', async (c) => {
    const round = Number(c.req.query('round') ?? roundAt(Date.now()))
    const division = Number(c.req.query('division') ?? 0)
    if (!Number.isInteger(round) || round < 1 || !Number.isInteger(division) || division < 0 || division > 2) return fail(c, 'Bad round or division.')
    const list = await arena.read.getEntries([BigInt(round), BigInt(division)])
    const info = await db.query<{ fish_id: string; fish: { name: string; speciesId: string; genome: unknown; gen: number } }>(
      'select fish_id, fish from entries where round = $1 and division = $2',
      [round, division],
    )
    const byId = new Map(info.map((r) => [String(r.fish_id), r.fish]))
    // an entry the indexer has not caught up with yet: look the fish up at its keeper
    for (const e of list) {
      const id = String(e.fishId)
      if (byId.has(id)) continue
      const { state } = await loadPlayer(db, e.owner)
      const f = state.tanks.find((t) => t?.id === id)
      if (f) byId.set(id, { name: f.name, speciesId: f.speciesId, genome: f.genome, gen: f.gen })
    }
    return c.json({
      round,
      division,
      entries: list.map((e) => {
        const f = byId.get(String(e.fishId))
        const traits = [...traitsOf(e.traits)]
        return {
          fishId: String(e.fishId), owner: e.owner.toLowerCase(), name: f?.name ?? `Fish #${e.fishId}`, speciesId: f?.speciesId ?? 'veiltail', genome: f?.genome, gen: f?.gen ?? 1,
          level: e.level, attack: e.attack, defense: e.defense, beauty: e.beauty, health: e.health, sick: e.sick, traits, fee: toTokens(e.fee),
          power: power({ attack: e.attack, defense: e.defense, beauty: e.beauty, health: e.health, traits }),
        }
      }),
    })
  })

  app.get('/api/results', async (c) => {
    const division = c.req.query('division')
    const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') ?? 8)))
    const rows = division !== undefined
      ? await db.query<{ data: TournamentResult }>('select data from results where division = $1 order by round desc limit $2', [Number(division), limit])
      : await db.query<{ data: TournamentResult }>('select data from results order by round desc, division asc limit $1', [limit])
    return c.json(rows.map((r) => r.data))
  })

  app.get('/api/leaderboard', async (c) => {
    const rows = await db.query<{ data: TournamentResult }>('select data from results where round > (select coalesce(max(round), 0) - 30 from results)')
    const board = new Map<string, { owner: string; earned: number; titles: number; wins: number; bestLevel: number; bestFish: string }>()
    const row = (o: string) => {
      let r = board.get(o)
      if (!r) board.set(o, (r = { owner: o, earned: 0, titles: 0, wins: 0, bestLevel: 0, bestFish: '' }))
      return r
    }
    for (const { data: res } of rows) {
      for (const ms of res.rounds) for (const m of ms) if (!isBye(m)) row(res.fighters[m.winner].owner).wins++
      for (const f of res.fighters) {
        const r = row(f.owner)
        if (f.level > r.bestLevel) (r.bestLevel = f.level), (r.bestFish = f.name)
      }
      row(res.fighters[res.champion].owner).titles++
      for (const pz of res.prizes) row(res.fighters[pz.fighter].owner).earned += pz.amount
    }
    return c.json([...board.values()])
  })

  // NFT metadata (tokenURI = PUBLIC_URL/api/fish/<id>)
  app.get('/api/fish/:id', async (c) => {
    const id = c.req.param('id')
    if (!/^\d{1,18}$/.test(id)) return fail(c, 'Bad id.', 404)
    const own = await db.query<{ address: string }>('select address from fish_owner where fish_id = $1', [id])
    if (!own[0]) return fail(c, 'Unknown fish.', 404)
    const { state } = await loadPlayer(db, own[0].address)
    const f = state.tanks.find((t) => t?.id === id) ?? state.spare.find((t) => t.id === id)
    if (!f) return c.json({ name: `Betta #${id}`, description: 'A Betta Arena fish.' })
    const sp = SPECIES.find((s) => s.id === f.speciesId)
    return c.json({
      name: `${f.name} · Betta #${id}`,
      description: `${sp?.name ?? 'Betta'} from Betta Arena. Raise it. Groom it. Let it fight.`,
      external_url: ENV.allowedOrigins[0],
      attributes: [
        { trait_type: 'Breed', value: f.breedName ?? sp?.name },
        { trait_type: 'Sex', value: f.sex },
        { trait_type: 'Generation', value: f.gen },
        { trait_type: 'Level', value: levelOf(f) },
        { trait_type: 'Alive', value: f.alive ? 'yes' : 'no' },
        { trait_type: 'Wins', value: f.wins },
        ...(f.mutation ? [{ trait_type: 'Mutation', value: f.mutation }] : []),
      ],
    })
  })

  // ---------- signed in ----------

  app.get('/api/me', auth, async (c) => {
    const addr = c.get('addr')
    const { state, msgs } = await loadPlayer(db, addr)
    const entries = await db.query('select round, division, fish_id as "fishId", fee from entries where owner = $1 and active order by round', [addr])
    return c.json({ address: addr, state, msgs, entries })
  })

  app.post('/api/action', auth, async (c) => {
    const addr = c.get('addr')
    const b = await c.req.json().catch(() => ({}))
    const now = Date.now()
    const slot = int(b.slot, 0, 2)
    const r = await withPlayer(db, addr, (d): Result => {
      switch (b.type) {
        case 'useItem':
          return slot === null || typeof b.item !== 'string' ? bad : useItem(d, now, slot, b.item)
        case 'train':
          return slot === null || typeof b.training !== 'string' ? bad : trainFish(d, now, slot, b.training)
        case 'rush':
          return slot === null || typeof b.training !== 'string' || !int(b.quoted, 1, 100) ? bad : rushTrain(d, now, slot, b.training, b.quoted)
        case 'pickTrait':
          return slot === null || typeof b.trait !== 'string' ? bad : pickTrait(d, slot, b.trait, now)
        case 'rename':
          return slot === null || typeof b.name !== 'string' ? bad : rename(d, slot, b.name)
        case 'bury':
          return slot === null ? bad : bury(d, slot, now)
        case 'startBreeding': {
          const m = int(b.maleSlot, 0, 2)
          const f = int(b.femaleSlot, 0, 2)
          return m === null || f === null ? bad : startBreeding(d, now, m, f)
        }
        case 'abandonSpawn':
          return abandonSpawn(d)
        default:
          return bad
      }
    })
    return c.json(r ?? bad, r?.ok ? 200 : 400)
  })

  // permit to buy a fish: only when the keeper has a free jar
  app.post('/api/permit/fish', auth, async (c) => {
    const addr = c.get('addr')
    const b = await c.req.json().catch(() => ({}))
    const species = int(b.species, 0, SPECIES.length - 1)
    if (species === null || typeof b.female !== 'boolean') return fail(c, 'Pick a breed.')
    const { state } = await loadPlayer(db, addr)
    if (freeSlot(state) < 0) return fail(c, 'No free jar. Empty one first.', 409)
    const n = nonce()
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60)
    const sig = await signer.signTypedData({
      domain: shopDomain(ENV.chainId, ENV.shop),
      types: fishPermitTypes,
      primaryType: 'FishPermit',
      message: { buyer: addr as `0x${string}`, species, female: b.female, nonce: n, deadline },
    })
    return c.json({ species, female: b.female, nonce: n.toString(), deadline: deadline.toString(), sig })
  })

  // permit to mint the fry the keeper chose; one per spawn
  app.post('/api/permit/fry', auth, async (c) => {
    const addr = c.get('addr')
    const b = await c.req.json().catch(() => ({}))
    const index = int(b.index, 0, 9)
    if (index === null) return fail(c, 'Pick one of the fry.')
    const now = Date.now()
    const out = await withPlayer(db, addr, async (d: PlayerState, q) => {
      const pick = fryToKeep(d, now, index)
      if ('ok' in pick) return pick
      const cl = d.breeding!.claim
      // an unexpired permit already exists: hand the same one back (and only for the same fry)
      if (cl && cl.deadline * 1000 > now) {
        if (cl.index !== index) return { ok: false, msg: 'You already chose a fry from this spawn. Confirm it in your wallet.' }
        return { ok: true, permit: cl, fish: pick }
      }
      const n = nonce()
      const deadline = Math.floor(now / 1000) + 30 * 60
      const sig = await signer.signTypedData({
        domain: shopDomain(ENV.chainId, ENV.shop),
        types: bredPermitTypes,
        primaryType: 'BredPermit',
        message: {
          to: addr as `0x${string}`, species: Math.max(0, speciesIndex(pick.speciesId)), female: pick.sex === 'female', gen: Math.min(255, pick.gen),
          seed: pick.genome.seed >>> 0, nonce: n, deadline: BigInt(deadline),
        },
      })
      d.breeding!.claim = { index, nonce: n.toString(), deadline, sig }
      await q.query('insert into fry_claims (nonce, address, fish) values ($1, $2, $3::jsonb) on conflict (nonce) do nothing', [n.toString(), addr, JSON.stringify(pick)])
      return { ok: true, permit: d.breeding!.claim, fish: pick }
    })
    if (!out || !('permit' in out)) return c.json(out ?? bad, 400)
    const f = out.fish as Fish
    return c.json({
      species: Math.max(0, speciesIndex(f.speciesId)), female: f.sex === 'female', gen: Math.min(255, f.gen), seed: f.genome.seed >>> 0,
      nonce: out.permit.nonce, deadline: String(out.permit.deadline), sig: out.permit.sig,
    })
  })

  // stats snapshot to enter the arena, valid until registration closes
  app.post('/api/arena/snapshot', auth, async (c) => {
    const addr = c.get('addr')
    const b = await c.req.json().catch(() => ({}))
    const slot = int(b.slot, 0, 2)
    if (slot === null) return fail(c, 'Pick a fish.')
    const now = Date.now()
    const n = roundAt(now)
    if (!entriesOpen(n, now)) return fail(c, `Registration for round #${n} is closed.`, 409)
    const { state } = await loadPlayer(db, addr, now)
    const f = state.tanks[slot]
    if (!f || !f.alive) return fail(c, 'Pick a living fish.')
    if (f.sex !== 'male') return fail(c, 'Females do not fight. They breed.')
    if (f.health < MIN_ENTRY_HEALTH) return fail(c, `${f.name} is too weak (health under ${MIN_ENTRY_HEALTH}). Treat it first.`)
    if (state.entered.includes(f.id)) return fail(c, `${f.name} is already entered.`, 409)
    const lv = levelOf(f)
    const div = divisionFor(lv)
    const e = effective(f, now)
    const clamp16 = (x: number) => Math.max(0, Math.min(65535, Math.round(x)))
    const message = {
      owner: addr as `0x${string}`, fishId: BigInt(f.id), round: n, division: div.index,
      attack: clamp16(e.attack), defense: clamp16(e.defense), beauty: clamp16(e.beauty), health: Math.max(0, Math.min(100, Math.floor(f.health))),
      sick: f.sick, traits: traitMask(f.traits), level: lv, deadline: BigInt(Math.floor(locksAt(n) / 1000)),
    }
    const sig = await signer.signTypedData({ domain: arenaDomain(ENV.chainId, ENV.arena), types: snapshotTypes, primaryType: 'Snapshot', message })
    return c.json({
      snapshot: { ...message, fishId: message.fishId.toString(), deadline: message.deadline.toString() },
      sig, division: div.id, fee: divisionByIndex(div.index).fee,
    })
  })

  app.notFound((c) => fail(c, 'Not found.', 404))
  app.onError((e, c) => {
    console.error('[api]', e)
    return c.json({ ok: false, msg: 'Server error. Try again in a moment.' }, 500)
  })
  return app
}

const bad: Result = { ok: false, msg: 'Bad request.' }
export { norm }
