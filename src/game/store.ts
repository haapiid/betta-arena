// The keeper's game, as seen from the browser. State lives on the game server (care) and on
// Robinhood Chain (fish NFTs, $BETTA, tournament entries). Every action either calls the server
// or sends a transaction, then refreshes from the server once the indexer has caught up.

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatUnits, parseUnits, type Address, type Hex } from 'viem'
import { bettaArenaAbi, bettaFishAbi, bettaShopAbi, erc20Abi } from '../chain/abi'
import { api, ApiError, hasSession, signIn as siwe } from '../lib/api'
import { chain, LIVE, NET } from '../lib/net'
import { ensureAllowance, publicClient, readable, send } from '../lib/wallet'
import { freshState, freeSlot, type PlayerState, type Result } from './engine'
import { priceOfSex, skuById, skuForItem, speciesIndex } from './catalog'
import { divisionByIndex, type DivisionId } from './tournament'
import type { Sex } from './fish'

export type { Result } from './engine'
export { freeSlot } from './engine'

export interface Entry {
  n: number
  div: DivisionId
  fishId: string
  stake: number
}

export interface Player extends PlayerState {
  balance: number // $BETTA in the wallet
  entries: Entry[]
}

const empty = (): Player => ({ ...freshState(), balance: 0, entries: [] })
const no = (msg: string): Result => ({ ok: false, msg })

export function useGame(addr: Address | null, notify: (r: Result) => void) {
  const [p, setP] = useState<Player>(empty)
  const [signedIn, setSignedIn] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const pRef = useRef(p)
  pRef.current = p
  const decimals = useRef(18)
  const notifyRef = useRef(notify)
  notifyRef.current = notify

  const units = (x: number) => parseUnits(String(x), decimals.current)

  const refresh = useCallback(async (): Promise<Player | null> => {
    if (!addr || !LIVE) return null
    const bal = await publicClient
      .readContract({ address: NET.contracts.token!, abi: erc20Abi, functionName: 'balanceOf', args: [addr] })
      .catch(() => 0n)
    let next: Player = { ...pRef.current, balance: Number(formatUnits(bal, decimals.current)) }
    if (hasSession(addr)) {
      try {
        const me = await api<{ state: PlayerState; msgs: string[]; entries: { round: number; division: number; fishId: string; fee: string }[] }>('/api/me', { as: addr })
        next = {
          ...me.state,
          balance: next.balance,
          entries: me.entries.map((e) => ({ n: e.round, div: divisionByIndex(e.division).id, fishId: String(e.fishId), stake: Number(e.fee) })),
        }
        setSignedIn(true)
        for (const m of me.msgs) notifyRef.current({ ok: true, msg: m })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setSignedIn(false)
      }
    } else setSignedIn(false)
    setP(next)
    pRef.current = next
    return next
  }, [addr])

  // a new wallet: start from an empty shelf, then load it
  useEffect(() => {
    setP(empty())
    pRef.current = empty()
    setSignedIn(false)
    if (!addr || !LIVE) return
    publicClient
      .readContract({ address: NET.contracts.token!, abi: erc20Abi, functionName: 'decimals' })
      .then((d) => (decimals.current = Number(d)))
      .catch(() => {})
    void refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [addr, refresh])

  /** Poll the server until the chain event shows up in the keeper's state. */
  const waitFor = useCallback(
    async (done: (x: Player) => boolean, label = 'Waiting for the chain…') => {
      setBusy(label)
      const end = Date.now() + 90_000
      while (Date.now() < end) {
        const x = await refresh()
        if (x && done(x)) return true
        await new Promise((r) => setTimeout(r, 2000))
      }
      return false
    },
    [refresh],
  )

  /** One action at a time, with a busy label, errors turned into toasts. */
  const run = useCallback(
    async (label: string, fn: (a: Address) => Promise<Result | void>): Promise<Result> => {
      if (!LIVE) return no('The game is not live yet.')
      if (!addr) return no('Connect your wallet first.')
      if (busy) return no('One moment, the last action is still finishing.')
      setBusy(label)
      let r: Result
      try {
        if (!hasSession(addr)) {
          setBusy('Sign the message in your wallet to log in…')
          await siwe(addr)
          setSignedIn(true)
          setBusy(label)
        }
        r = (await fn(addr)) ?? { ok: true, msg: '' }
      } catch (e) {
        r = no(e instanceof ApiError ? e.message : readable(e))
      } finally {
        setBusy(null)
      }
      void refresh()
      if (r.msg) notifyRef.current(r)
      return r
    },
    [addr, busy, refresh],
  )

  const action = (label: string, body: Record<string, unknown>) =>
    run(label, async (a) => {
      const r = await api<Result>('/api/action', { body, as: a }).catch((e) => no(e instanceof ApiError ? e.message : readable(e)))
      await refresh()
      return r
    })

  /** Buy `qty` of a shop SKU on chain and wait until the server credits it. */
  const buySku = async (a: Address, skuId: string, qty = 1) => {
    const sku = skuById(skuId)
    if (!sku) throw new Error('Unknown item.')
    const total = units(sku.price * qty)
    const have = pRef.current.inventory[sku.item] ?? 0
    setBusy(`Approve and pay ${sku.price * qty} $${SYMBOL} in your wallet…`)
    await ensureAllowance(a, NET.contracts.shop!, total)
    await send(a, { address: NET.contracts.shop!, abi: bettaShopAbi, functionName: 'buyItems', args: [sku.index, qty, total], chain, account: a })
    const ok = await waitFor((x) => (x.inventory[sku.item] ?? 0) >= have + sku.qty * qty, 'Paid. Stocking the cabinet…')
    if (!ok) throw new Error('Paid on chain; the cabinet will update in a moment.')
  }

  const actions = {
    signIn: () =>
      run('Sign the message in your wallet to log in…', async (a) => {
        await siwe(a)
        setSignedIn(true)
        return { ok: true, msg: 'Signed in. Your jars are loaded.' }
      }),

    buyFish: (speciesId: string, sex: Sex = 'male') =>
      run('Getting a purchase pass…', async (a) => {
        if (freeSlot(pRef.current) < 0) return no('No free jar. Empty one first.')
        const species = speciesIndex(speciesId)
        const pm = await api<{ nonce: string; deadline: string; sig: Hex }>('/api/permit/fish', { body: { species, female: sex === 'female' }, as: a })
        const price = units(priceOfSex(speciesId, sex))
        setBusy('Approve and pay in your wallet…')
        await ensureAllowance(a, NET.contracts.shop!, price)
        const count = pRef.current.tanks.filter(Boolean).length
        await send(a, { address: NET.contracts.shop!, abi: bettaShopAbi, functionName: 'buyFish', args: [species, sex === 'female', price, BigInt(pm.nonce), BigInt(pm.deadline), pm.sig], chain, account: a })
        await waitFor((x) => x.tanks.filter(Boolean).length > count, 'Paid. Your betta is on its way…')
        return { ok: true, msg: 'Your new betta is in its jar.' }
      }),

    buyPack: (skuId: string, qty = 1) =>
      run('Buying…', async (a) => {
        await buySku(a, skuId, qty)
        return { ok: true, msg: 'Added to your cabinet.' }
      }),

    /** Use an item; if none are left, buy the smallest pack first. */
    useItem: (slot: number, item: string) =>
      run('Using…', async (a) => {
        if ((pRef.current.inventory[item] ?? 0) <= 0) {
          const sku = skuForItem(item)
          if (!sku) return no('That item is not sold.')
          await buySku(a, sku.id)
        }
        return api<Result>('/api/action', { body: { type: 'useItem', slot, item }, as: a })
      }),

    train: (slot: number, training: string) => action('Training…', { type: 'train', slot, training }),

    /** Skip the cooldown: buys the missing rush hours, then trains. */
    rushTrain: (slot: number, training: string, hours: number) =>
      run('Rushing…', async (a) => {
        const missing = hours - (pRef.current.inventory.rush ?? 0)
        if (missing > 0) await buySku(a, 'rush', missing)
        return api<Result>('/api/action', { body: { type: 'rush', slot, training, quoted: hours }, as: a })
      }),

    pickTrait: (slot: number, trait: string) => action('Learning…', { type: 'pickTrait', slot, trait }),
    rename: (slot: number, name: string) => action('Renaming…', { type: 'rename', slot, name }),
    bury: (slot: number) => action('Burying…', { type: 'bury', slot }),

    /** Release a living fish: burns its NFT. */
    release: (slot: number) =>
      run('Confirm the release in your wallet…', async (a) => {
        const f = pRef.current.tanks[slot]
        if (!f) return no('That jar is empty.')
        await send(a, { address: NET.contracts.fish!, abi: bettaFishAbi, functionName: 'burn', args: [BigInt(f.id)], chain, account: a })
        await waitFor((x) => !x.tanks.some((t) => t?.id === f.id), 'Releasing…')
        return { ok: true, msg: `${f.name} was released.` }
      }),

    startBreeding: (maleSlot: number, femaleSlot: number) =>
      run('Preparing the spawn…', async (a) => {
        if ((pRef.current.inventory.breed ?? 0) < 1) await buySku(a, 'breed')
        return api<Result>('/api/action', { body: { type: 'startBreeding', maleSlot, femaleSlot }, as: a })
      }),

    keepFry: (index: number) =>
      run('Getting the fry pass…', async (a) => {
        const pm = await api<{ species: number; female: boolean; gen: number; seed: number; nonce: string; deadline: string; sig: Hex }>('/api/permit/fry', { body: { index }, as: a })
        setBusy('Confirm in your wallet to keep this fry…')
        await send(a, { address: NET.contracts.shop!, abi: bettaShopAbi, functionName: 'claimFry', args: [pm.species, pm.female, pm.gen, pm.seed, BigInt(pm.nonce), BigInt(pm.deadline), pm.sig], chain, account: a })
        await waitFor((x) => !x.breeding, 'Moving the fry into its jar…')
        return { ok: true, msg: 'Your fry moved into its jar.' }
      }),

    abandonSpawn: () => action('Emptying…', { type: 'abandonSpawn' }),

    enter: (slot: number) =>
      run('Getting an entry pass…', async (a) => {
        const s = await api<{ snapshot: Record<string, string | number | boolean>; sig: Hex; fee: number; division: DivisionId }>('/api/arena/snapshot', { body: { slot }, as: a })
        const fee = units(s.fee)
        setBusy(`Approve and pay the ${s.fee} $${SYMBOL} entry fee in your wallet…`)
        await ensureAllowance(a, NET.contracts.arena!, fee)
        const snap = { ...s.snapshot, fishId: BigInt(s.snapshot.fishId as string), deadline: BigInt(s.snapshot.deadline as string) } as never
        await send(a, { address: NET.contracts.arena!, abi: bettaArenaAbi, functionName: 'enter', args: [snap, s.sig], chain, account: a })
        const id = String(s.snapshot.fishId)
        await waitFor((x) => x.entries.some((e) => e.fishId === id), 'Entered. Updating the bracket…')
        return { ok: true, msg: `Entered in the ${divisionByIndex(Number(s.snapshot.division)).name} division.` }
      }),

    withdraw: (e: Entry) =>
      run('Confirm the withdrawal in your wallet…', async (a) => {
        const div = ['rookie', 'pro', 'elite'].indexOf(e.div)
        await send(a, { address: NET.contracts.arena!, abi: bettaArenaAbi, functionName: 'withdraw', args: [BigInt(e.n), div, BigInt(e.fishId)], chain, account: a })
        await waitFor((x) => !x.entries.some((y) => y.fishId === e.fishId), 'Refunding…')
        return { ok: true, msg: `Entry withdrawn, ${e.stake} $${SYMBOL} refunded.` }
      }),
  }

  return { p, actions, signedIn, busy, refresh }
}

const SYMBOL = import.meta.env.VITE_TOKEN_SYMBOL || 'BETTA'
