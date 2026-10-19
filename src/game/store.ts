// Player state and every game action. Saved to localStorage per wallet address.
// Note: this is the demo / off-chain build. For real money, balances, purchases, stakes and
// payouts must move to a smart contract or server (see README).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addXp, applyItem, CARE_SPEED, FEMALE_PRICE, type Sex, canRush, canTrain, canUse, rushCost, effective, levelOf, MAX_TANKS, MIN_ENTRY_HEALTH, newFish, pendingTraits, stageOf, tickFish, train,
  TRAININGS, type Fish,
} from './fish'
import { itemById } from './items'
import { BREED_BURN, BREED_FEE, BREED_HEALTH_COST, BREED_REST, cannotBreed, makeFry, phaseOf, type Breeding } from './breeding'
import { speciesById } from './species'
import { traitById, traitOptions } from './traits'
import {
  buildField, DIVISIONS, divisionFor, endsAt, entriesOpen, injuries, MAX_PLAYER_ENTRIES, MIN_FIELD, prizesOf, roundAt, runTournament, XP_LOSS, XP_WIN,
  type DivisionId, type TournamentResult,
} from './tournament'
import type { Fighter } from './battle'

export const START_BALANCE = 1000
export const FAUCET_AMOUNT = 500
export const FAUCET_COOLDOWN = 6 * 3_600_000
export const DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export interface Entry {
  n: number
  div: DivisionId
  fishId: string
  stake: number
}

export interface Grave {
  name: string
  speciesId: string
  cause: string
  diedAt: number
  wins: number
  level: number
}

export interface Player {
  version: 1
  balance: number
  tanks: (Fish | null)[]
  inventory: Record<string, number>
  entries: Entry[]
  resolved: number[]
  history: TournamentResult[]
  graves: Grave[]
  lastFaucet: number
  log: { t: number; text: string }[]
  breeding: Breeding | null
  burned: number // coins this player has burned (arena fee share is not tracked here)
}

export type Result = { ok: boolean; msg: string }

function fresh(): Player {
  return {
    version: 1,
    balance: START_BALANCE,
    tanks: Array(MAX_TANKS).fill(null),
    inventory: { pellet: 10, water: 2 }, // a starter pack of pellets
    entries: [],
    resolved: [],
    history: [],
    graves: [],
    lastFaucet: 0,
    breeding: null,
    burned: 0,
    log: [{ t: Date.now(), text: `Welcome. ${START_BALANCE} coins and three empty jars.` }],
  }
}

const key = (addr: string | null) => `betta-arena:v1:${addr ?? 'guest'}`

// the save on disk, or null when there is none (or storage is blocked)
function loadSaved(addr: string | null): Player | null {
  try {
    const raw = localStorage.getItem(key(addr))
    if (raw) {
      const p = JSON.parse(raw) as Player
      if (p.version === 1) {
        // fill fields added after a save was written
        p.tanks = p.tanks.map((f) => (f ? ({ xp: 0, xpDay: 0, xpToday: 0, traits: [], buffs: [], lastTrain: 0, sex: 'male', gen: 1, breeds: 0, restUntil: 0, ...(f as object) } as unknown as Fish) : f))
        p.breeding ??= null
        p.burned ??= 0
        return p
      }
    }
  } catch {
    /* corrupt data or blocked storage */
  }
  return null
}

const load = (addr: string | null): Player => loadSaved(addr) ?? fresh()

export const priceOf = (price: number, sex: Sex) => (sex === 'female' ? Math.round(price * FEMALE_PRICE) : price)

// a jar that is empty and not being used as the spawning tank
export const freeSlot = (p: Player) => p.tanks.findIndex((t, i) => t === null && p.breeding?.slot !== i)

export function openRound(p: Player, now: number) {
  let n = roundAt(now)
  while (p.resolved.includes(n)) n++
  return n
}

export function fighterOf(f: Fish, owner: string, stake: number, now: number): Fighter {
  const e = effective(f, now)
  return {
    id: f.id,
    name: f.name,
    owner,
    mine: true,
    speciesId: f.speciesId,
    genome: f.genome,
    level: levelOf(f),
    traits: [...f.traits],
    attack: e.attack,
    defense: e.defense,
    beauty: e.beauty,
    health: Math.round(f.health),
    sick: f.sick,
    stake,
    size: stageOf(f, now).size,
    gen: f.gen,
  }
}

const log = (p: Player, text: string) => {
  p.log.unshift({ t: Date.now(), text })
  p.log.length = Math.min(p.log.length, 60)
}

export function useGame(addr: string | null, ownerLabel: string, notify: (r: Result) => void) {
  const [p, setP] = useState<Player>(() => load(addr))
  const ref = useRef(p)
  ref.current = p
  // whose save `ref.current` holds; differs from `addr` for one render after switching wallets
  const owner = useRef(addr)
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  useEffect(() => {
    const d = load(addr)
    ref.current = d
    owner.current = addr
    setP(d)
    // another tab saved this wallet: pick up its state instead of overwriting it later
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key(addr)) return
      const s = loadSaved(addr)
      if (s) {
        ref.current = s
        setP(s)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [addr])

  // single door for every change: read the latest save → clone → mutate → save.
  // Starting from disk (not memory) stops a stale tab or a just-switched wallet from
  // writing one save over another.
  const commit = useCallback(
    (fn: (d: Player, now: number) => Result | void) => {
      const base = loadSaved(addr) ?? (owner.current === addr ? ref.current : fresh())
      const d = structuredClone(base)
      const r = fn(d, Date.now())
      if (r && !r.ok) {
        notifyRef.current(r)
        return r
      }
      ref.current = d
      setP(d)
      try {
        localStorage.setItem(key(addr), JSON.stringify(d))
      } catch {
        /* storage full or blocked */
      }
      if (r) notifyRef.current(r)
      return r ?? { ok: true, msg: '' }
    },
    [addr],
  )

  const resolveRound = (d: Player, n: number, now: number): TournamentResult[] => {
    const out: TournamentResult[] = []
    for (const div of DIVISIONS) {
      const mine = d.entries.filter((e) => e.n === n && e.div === div.id)
      const fighters: Fighter[] = []
      for (const e of mine) {
        const f = d.tanks.find((t) => t?.id === e.fishId)
        if (!f || !f.alive) {
          // registration is closed by now, so the fee stays in the pot (same rule as releasing the fish)
          log(d, `Entry fee ${e.stake} forfeited: ${f ? `${f.name} died before the bell` : 'the fish was no longer in the jar'}.`)
        } else if (divisionFor(levelOf(f)).id !== e.div) {
          // it levelled out of the division it entered: it may not fight weaker fish for their prizes
          d.balance += e.stake
          log(d, `${f.name} reached level ${levelOf(f)} and outgrew ${div.name}. Entry fee ${e.stake} refunded.`)
        } else fighters.push(fighterOf(f, ownerLabel, e.stake, now))
      }
      if (!fighters.length) continue
      const field = buildField(n, div.id, fighters)
      if (field.length < MIN_FIELD) {
        // not enough fish signed up: the round is called off and every fee goes back
        for (const f of fighters) d.balance += f.stake
        log(d, `Round #${n} ${div.name} called off: only ${field.length} entrant${field.length === 1 ? '' : 's'} (min ${MIN_FIELD}). Fees refunded.`)
        continue
      }
      const res = runTournament(n, div.id, field, now)
      const won = new Map(prizesOf(res).map((pz) => [res.fighters[pz.fighter].id, pz.amount]))
      const hurt = injuries(res)
      d.tanks = d.tanks.map((f) => {
        if (!f) return f
        const h = hurt.get(f.id)
        if (!h) return f
        const x: Fish = { ...f, wins: f.wins + h.wins, losses: f.losses + h.losses, health: Math.max(0, f.health - h.lost) }
        addXp(x, h.wins * XP_WIN + h.losses * XP_LOSS, now, false)
        x.earned += won.get(f.id) ?? 0
        if (x.health <= 0) {
          x.alive = false
          x.diedAt = now
          x.cause = 'battle wounds'
        }
        return x
      })
      d.balance += res.myPayout
      d.history.unshift(res)
      const champ = res.fighters[res.champion]
      log(
        d,
        res.myPayout
          ? `Round #${n} ${div.name}: ${champ.mine ? `${champ.name} WON` : 'prize money'}. +${res.myPayout} coins.`
          : `Round #${n} ${div.name}: champion was ${champ.name} (${champ.owner}).`,
      )
      out.push(res)
    }
    d.history.length = Math.min(d.history.length, 60) // enough for a leaderboard season
    d.entries = d.entries.filter((e) => e.n !== n)
    if (!d.resolved.includes(n)) d.resolved.push(n)
    d.resolved = d.resolved.filter((x) => x >= Math.min(n, roundAt(now)) - 20)
    return out
  }

  const summary = (n: number, rs: TournamentResult[]) => {
    const won = rs.reduce((s, r) => s + r.myPayout, 0)
    return won ? `🏆 You won round #${n}! +${won}` : `Round #${n} is over. Check the results.`
  }

  // game clock: fish condition, plus any tournament whose bell has rung
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      const cur = ref.current
      const needs = cur.tanks.some((f) => f?.alive && now - f.lastTick > 20_000) || cur.entries.some((e) => endsAt(e.n) <= now)
      if (!needs) return
      commit((d) => {
        const died: string[] = []
        d.tanks = d.tanks.map((f) => {
          if (!f) return f
          const before = levelOf(f)
          const x = tickFish(f, now)
          if (f.alive && !x.alive) {
            died.push(x.name)
            log(d, `${x.name} died of ${x.cause}.`)
          } else if (levelOf(x) > before) log(d, `${x.name} reached level ${levelOf(x)}.`)
          return x
        })
        const msgs: string[] = []
        for (const n of [...new Set(d.entries.filter((e) => endsAt(e.n) <= now).map((e) => e.n))].sort((a, b) => a - b))
          msgs.push(summary(n, resolveRound(d, n, now)))
        if (died.length) msgs.push(`💀 ${died.join(', ')} died. Check your jars.`)
        if (msgs.length) return { ok: true, msg: msgs.join(' ') }
      })
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [commit])

  const levelUpNote = (before: number, f: Fish) => {
    const after = levelOf(f)
    if (after <= before) return ''
    return pendingTraits(f) > 0 ? ` Level ${after}! A new trait is ready.` : ` Level ${after}!`
  }

  const actions = {
    buyFish: (speciesId: string, sex: Sex = 'male') =>
      commit((d) => {
        const sp = speciesById(speciesId)
        const price = priceOf(sp.price, sex)
        const slot = freeSlot(d)
        if (slot < 0) return { ok: false, msg: 'No free jar. Empty one first.' }
        if (d.balance < price) return { ok: false, msg: `Not enough coins (need ${price}).` }
        d.balance -= price
        const f = newFish(speciesId, Date.now(), undefined, sex)
        d.tanks[slot] = f
        const label = `${sp.name} ${sex === 'male' ? '♂' : '♀'}`
        log(d, `Bought ${label} "${f.name}" for ${price}. Jar ${slot + 1}.`)
        return { ok: true, msg: `${label} "${f.name}" is in jar ${slot + 1}.` }
      }),
    startBreeding: (maleSlot: number, femaleSlot: number) =>
      commit((d, now) => {
        if (d.breeding) return { ok: false, msg: 'A spawn is already in progress.' }
        const m0 = d.tanks[maleSlot]
        const f0 = d.tanks[femaleSlot]
        if (!m0 || !f0 || m0.sex !== 'male' || f0.sex !== 'female') return { ok: false, msg: 'Pick one male and one female.' }
        const m = tickFish(m0, now)
        const f = tickFish(f0, now)
        const entered = (x: Fish) => d.entries.some((e) => e.fishId === x.id)
        const why = cannotBreed(m, now, entered(m)) ?? cannotBreed(f, now, entered(f))
        if (why) return { ok: false, msg: why }
        const slot = freeSlot(d)
        if (slot < 0) return { ok: false, msg: 'You need an empty jar as the spawning tank.' }
        if (d.balance < BREED_FEE) return { ok: false, msg: `Not enough coins (need ${BREED_FEE}).` }
        d.balance -= BREED_FEE
        d.burned += Math.round(BREED_FEE * BREED_BURN)
        const seed = Math.floor(Math.random() * 2 ** 31)
        const fry = makeFry(m, f, seed, now)
        for (const [x, s] of [[m, maleSlot], [f, femaleSlot]] as const) {
          x.health = Math.max(1, x.health - BREED_HEALTH_COST)
          x.breeds += 1
          x.restUntil = now + BREED_REST / CARE_SPEED
          d.tanks[s] = x
        }
        d.breeding = { slot, maleId: m.id, femaleId: f.id, father: m.name, mother: f.name, startedAt: now, fry }
        log(d, `${m.name} × ${f.name}: spawning in jar ${slot + 1}.`)
        return { ok: true, msg: `${m.name} is building a bubble nest for ${f.name} in jar ${slot + 1}.` }
      }),
    keepFry: (index: number) =>
      commit((d, now) => {
        const b = d.breeding
        if (!b) return { ok: false, msg: 'No spawn in progress.' }
        if (phaseOf(b, now) !== 'fry') return { ok: false, msg: 'The eggs have not hatched yet.' }
        const pick = b.fry[index]
        if (!pick) return { ok: false, msg: 'Pick one of the fry.' }
        const f: Fish = { ...pick, id: `f${now.toString(36)}${pick.genome.seed.toString(36)}`, bornAt: now, lastTick: now }
        d.tanks[b.slot] = f
        d.breeding = null
        log(d, `Kept "${f.name}" (Gen ${f.gen}${f.mutation ? `, ${f.mutation}` : ''}) from ${b.father} × ${b.mother}.`)
        return { ok: true, msg: `"${f.name}" moves into jar ${b.slot + 1}.${f.mutation ? ` A ${f.mutation} mutation!` : ''}` }
      }),
    abandonSpawn: () =>
      commit((d) => {
        if (!d.breeding) return
        d.breeding = null
        return { ok: true, msg: 'The spawning jar was emptied. The fee is not refunded.' }
      }),
    hatchNow: () =>
      commit((d, now) => {
        if (!d.breeding) return
        d.breeding.startedAt = Math.min(d.breeding.startedAt, now - (48 * 3_600_000) / CARE_SPEED - 1000)
        return { ok: true, msg: 'Demo: the eggs hatched.' }
      }),
    emptyTank: (slot: number) =>
      commit((d, now) => {
        const f = d.tanks[slot]
        if (!f) return
        // after registration closes the fee stays in the pot
        for (const e of d.entries.filter((e) => e.fishId === f.id)) if (entriesOpen(e.n, now)) d.balance += e.stake
        d.entries = d.entries.filter((e) => e.fishId !== f.id)
        if (!f.alive) d.graves.unshift({ name: f.name, speciesId: f.speciesId, cause: f.cause ?? 'unknown', diedAt: f.diedAt ?? now, wins: f.wins, level: levelOf(f) })
        d.graves.length = Math.min(d.graves.length, 30)
        d.tanks[slot] = null
        log(d, f.alive ? `Released ${f.name}. Jar ${slot + 1} is empty.` : `Buried ${f.name}. Jar ${slot + 1} is empty.`)
        return { ok: true, msg: f.alive ? `${f.name} was released.` : `Rest well, ${f.name}.` }
      }),
    rename: (slot: number, name: string) =>
      commit((d) => {
        const f = d.tanks[slot]
        const n = name.trim().slice(0, 18)
        if (!f || !n) return { ok: false, msg: 'Name cannot be empty.' }
        f.name = n
      }),
    buyItem: (id: string, qty = 1) =>
      commit((d) => {
        const it = itemById(id)
        if (!it) return { ok: false, msg: 'Unknown item.' }
        if (it.packs) return { ok: false, msg: `${it.name} is sold in packs.` }
        const cost = it.price * qty
        if (d.balance < cost) return { ok: false, msg: `Not enough coins (need ${cost}).` }
        d.balance -= cost
        d.inventory[id] = (d.inventory[id] ?? 0) + qty
        return { ok: true, msg: `+${qty} ${it.name}` }
      }),
    // food comes in packs: `pack` is the index into item.packs; `feedSlot` also feeds one portion right away
    buyPack: (id: string, pack: number, feedSlot?: number) =>
      commit((d, now) => {
        const it = itemById(id)
        const pk = it?.packs?.[pack]
        if (!it || !pk) return { ok: false, msg: 'Unknown pack.' }
        if (d.balance < pk.price) return { ok: false, msg: `Not enough coins (need ${pk.price}).` }
        let fed = ''
        if (feedSlot !== undefined) {
          const f0 = d.tanks[feedSlot]
          if (!f0) return { ok: false, msg: 'No fish in that jar.' }
          const f = tickFish(f0, now)
          const why = canUse(f, it, now)
          if (why) return { ok: false, msg: why }
          const r = applyItem(f, it, now)
          d.tanks[feedSlot] = r.fish
          log(d, r.text)
          fed = ` ${r.text}`
        }
        d.balance -= pk.price
        d.inventory[id] = (d.inventory[id] ?? 0) + pk.qty - (feedSlot !== undefined ? 1 : 0)
        return { ok: true, msg: `+${pk.qty} ${it.name} portions.${fed}` }
      }),
    useItem: (slot: number, id: string) =>
      commit((d, now) => {
        const it = itemById(id)
        const f0 = d.tanks[slot]
        if (!it || !f0) return { ok: false, msg: 'Nothing to use it on.' }
        const f = tickFish(f0, now)
        const why = canUse(f, it, now)
        if (why) return { ok: false, msg: why }
        if ((d.inventory[id] ?? 0) > 0) d.inventory[id]--
        else if (it.packs) return { ok: false, msg: `Out of ${it.name}. Buy a pack in the shop.` }
        else if (d.balance >= it.price) d.balance -= it.price
        else return { ok: false, msg: `Not enough coins for ${it.name} (${it.price}).` }
        const r = applyItem(f, it, now)
        d.tanks[slot] = r.fish
        log(d, r.text)
        return { ok: true, msg: r.text + levelUpNote(levelOf(f), r.fish) }
      }),
    train: (slot: number, id: string) =>
      commit((d, now) => {
        const tr = TRAININGS.find((t) => t.id === id)
        const f0 = d.tanks[slot]
        if (!tr || !f0) return { ok: false, msg: 'Nothing to train.' }
        const f = tickFish(f0, now)
        const why = canTrain(f, now)
        if (why) return { ok: false, msg: why }
        const r = train(f, tr, now)
        d.tanks[slot] = r.fish
        log(d, r.text)
        return { ok: true, msg: r.text + levelUpNote(levelOf(f), r.fish) }
      }),
    // pay coins to skip the cooldown and train at once; `quoted` is the price the player confirmed
    rushTrain: (slot: number, id: string, quoted: number) =>
      commit((d, now) => {
        const tr = TRAININGS.find((t) => t.id === id)
        const f0 = d.tanks[slot]
        if (!tr || !f0) return { ok: false, msg: 'Nothing to train.' }
        const f = tickFish(f0, now)
        const why = canRush(f, now)
        if (why) return { ok: false, msg: why }
        const cost = rushCost(f, now)
        if (cost > quoted) return { ok: false, msg: `The price changed to ${cost}. Try again.` }
        if (d.balance < cost) return { ok: false, msg: `Not enough coins (need ${cost}).` }
        d.balance -= cost
        const r = train(f, tr, now)
        d.tanks[slot] = r.fish
        log(d, `Rushed for ${cost}. ${r.text}`)
        return { ok: true, msg: `⚡ Paid ${cost}. ${r.text}${levelUpNote(levelOf(f), r.fish)}` }
      }),
    pickTrait: (slot: number, traitId: string) =>
      commit((d) => {
        const f = d.tanks[slot]
        if (!f || !f.alive) return { ok: false, msg: 'No fish.' }
        if (pendingTraits(f) <= 0) return { ok: false, msg: 'No trait to pick yet.' }
        if (!traitOptions(f.id, f.traits).some((t) => t.id === traitId)) return { ok: false, msg: 'That trait is not on offer.' }
        f.traits.push(traitId)
        const t = traitById(traitId)!
        log(d, `${f.name} learned ${t.name}.`)
        return { ok: true, msg: `${f.name} learned ${t.name}.` }
      }),
    enter: (slot: number) =>
      commit((d, now) => {
        const f = d.tanks[slot]
        const n = openRound(d, now)
        if (!entriesOpen(n, now)) return { ok: false, msg: `Registration for round #${n} is closed. The bell rings soon; the next round opens right after.` }
        if (!f || !f.alive) return { ok: false, msg: 'Pick a living fish.' }
        if (f.sex === 'female') return { ok: false, msg: 'Females do not fight. They breed.' }
        const div = divisionFor(levelOf(f))
        if (f.health < MIN_ENTRY_HEALTH) return { ok: false, msg: `${f.name} is too weak (health under ${MIN_ENTRY_HEALTH}). Treat it first.` }
        if (d.entries.some((e) => e.fishId === f.id && e.n === n)) return { ok: false, msg: `${f.name} is already entered.` }
        if (d.entries.filter((e) => e.n === n).length >= MAX_PLAYER_ENTRIES) return { ok: false, msg: 'Max 3 entries per round.' }
        const fee = div.fee
        if (d.balance < fee) return { ok: false, msg: `Not enough coins for the ${fee} entry fee.` }
        d.balance -= fee
        d.entries.push({ n, div: div.id, fishId: f.id, stake: fee })
        log(d, `${f.name} entered round #${n} (${div.name}), entry fee ${fee}.`)
        return { ok: true, msg: `${f.name} is in round #${n}, ${div.name} division. Entry fee: ${fee}.` }
      }),
    withdraw: (fishId: string) =>
      commit((d, now) => {
        const e = d.entries.find((e) => e.fishId === fishId)
        if (!e) return
        if (!entriesOpen(e.n, now)) return { ok: false, msg: 'Registration is closed. Entries are locked until the bell.' }
        d.balance += e.stake
        d.entries = d.entries.filter((x) => x !== e)
        return { ok: true, msg: `Entry withdrawn, ${e.stake} refunded.` }
      }),
    runNow: () =>
      commit((d, now) => {
        const n = openRound(d, now)
        if (!d.entries.some((e) => e.n === n)) return { ok: false, msg: 'Enter at least one fish first.' }
        const rs = resolveRound(d, n, now)
        if (!rs.length) return { ok: false, msg: 'No valid entries.' }
        return { ok: true, msg: summary(n, rs) }
      }),
    faucet: () =>
      commit((d, now) => {
        if (now - d.lastFaucet < FAUCET_COOLDOWN) return { ok: false, msg: 'Faucet is cooling down.' }
        d.balance += FAUCET_AMOUNT
        d.lastFaucet = now
        return { ok: true, msg: `+${FAUCET_AMOUNT} test coins` }
      }),
    reset: () =>
      commit((d) => {
        // outside the demo a reset must not hand out a fresh 1000 coins
        if (!DEMO) return { ok: false, msg: 'Reset is only available in the demo.' }
        Object.assign(d, fresh())
        return { ok: true, msg: 'Progress reset.' }
      }),
  }

  return { p, actions }
}

