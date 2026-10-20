// What the page shows: the engine's live status, or a labelled demo before launch.
// The engine pushes an event the moment something moves, so the page refetches at once instead of
// waiting for its next poll.

import { useEffect, useRef, useState } from 'react'
import { keccak256, toHex, type Hex } from 'viem'
import { enterRing, type Champion, type Fight, type Ring } from '../game/ring'

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export interface ShelfRow {
  rank: number
  addr: string
  balance: number
  firstIn: number
  fights: number
  wins: number
}
export interface RoundRow {
  n: number
  at: number
  stage: string
  route: string
  claimedEth: number
  spentEth: number
  burned: number
  claimTx: string
  buyTx: string
  burnTx: string
  doneAt: number
}
export interface Status {
  standby: boolean
  token: string | null
  chainId: number
  curve: string | null
  engine: string
  fees: { tankEth: number; stepEth: number }
  totals: { claimedEth: number; spentEth: number; burnedByBell: number }
  supply: { total: number; inTheDeep: number }
  ethUsd: number
  price?: { tokenUsd: number; source: string; mcapUsd: number }
  ring: { total: number; champion: Champion | null; best: Champion | null; fights: Fight[] }
  shelf: ShelfRow[]
  jumpers: { addr: string; at: number; tx: string }[]
  jumpedCount: number
  rounds: RoundRow[]
  fightMinTokens: number
  updated: number
}
export interface WalletView {
  addr: string
  balance: number
  firstIn: number
  jumped: boolean
  jumpedTx: string
  fights: number
  wins: number
  rank: number | null
  holdsBelt: boolean
  recent: Fight[]
}

export async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json() as Promise<T>
}

// Which edition the page shows. <meta name="rh-mode" content="demo|live"> in index.html (flip it on the
// server with scripts/site-mode.sh, no rebuild), and ?demo or ?live in the address to preview either one.
function mode(): 'demo' | 'live' {
  const q = new URLSearchParams(window.location.search)
  if (q.has('demo')) return 'demo'
  if (q.has('live')) return 'live'
  return document.querySelector('meta[name="rh-mode"]')?.getAttribute('content') === 'demo' ? 'demo' : 'live'
}
export const MODE = mode()

/** Live status, falling back to the demo while there is no token (or no engine). */
export function useStatus() {
  const [live, setLive] = useState<Status | null>(null)
  const [demo, setDemo] = useState<Status>(() => demoStatus())
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (MODE === 'demo') return
    let alive = true
    const load = () =>
      getJson<Status>('/api/status')
        .then((s) => {
          if (!alive) return
          setLive(s.standby ? null : s)
          setOffline(false)
        })
        .catch(() => alive && setOffline(true))
    load()
    const poll = setInterval(load, 8000)
    let es: EventSource | null = null
    try {
      es = new EventSource(`${BASE}/api/stream`)
      es.addEventListener('update', load)
    } catch {
      /* polling still works */
    }
    return () => {
      alive = false
      clearInterval(poll)
      es?.close()
    }
  }, [])

  // the demo keeps the ring busy: a new buyer every few seconds
  useEffect(() => {
    if (live) return
    const id = setInterval(() => setDemo((d) => demoTick(d)), 6500)
    return () => clearInterval(id)
  }, [live])

  return { status: live ?? demo, isDemo: !live, offline }
}

// ---------- the demo ----------

let demoN = 0
const fakeTx = (): Hex => keccak256(toHex(`betta-demo-${demoN++}-${Math.random()}`))
const fakeAddr = (i: number) => `0x${keccak256(toHex(`keeper-${i}`)).slice(26)}`
const MIN = 10_000n * 10n ** 18n

function demoStatus(): Status {
  const ring: Ring = { total: 0, champion: null, fights: [], seen: [], best: null }
  for (let i = 0; i < 37; i++) enterRing(ring, { tx: fakeTx(), t: Math.floor(Date.now() / 1000) - (37 - i) * 600, buyer: fakeAddr(i % 23), tokens: MIN * BigInt(1 + Math.floor(Math.random() ** 3 * 4000)), minUnits: MIN })
  const shelf = Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, addr: fakeAddr(100 + i), balance: Math.round(48_000_000 / (i + 1.4) ** 1.3), firstIn: 0, fights: 10 - i, wins: Math.max(0, 6 - i) }))
  const rounds: RoundRow[] = Array.from({ length: 4 }, (_, i) => ({
    n: 4 - i, at: Math.floor(Date.now() / 1000) - i * 5400, stage: 'done', route: 'curve', claimedEth: 0.02 + i * 0.001, spentEth: 0.0198 + i * 0.001,
    burned: 1_050_000 - i * 60_000, claimTx: fakeTx(), buyTx: fakeTx(), burnTx: fakeTx(), doneAt: Math.floor(Date.now() / 1000) - i * 5400 + 9,
  }))
  return {
    standby: true, token: null, chainId: 4663, curve: null, engine: 'demo',
    fees: { tankEth: 0.0123, stepEth: 0.02 },
    totals: { claimedEth: 0.086, spentEth: 0.0852, burnedByBell: 4_066_000 },
    supply: { total: 1_000_000_000, inTheDeep: 4_066_000 },
    ethUsd: 3400,
    price: { tokenUsd: 0.000042, source: 'demo', mcapUsd: 41_800 },
    ring: { total: ring.total, champion: ring.champion, best: ring.best, fights: ring.fights.slice(0, 12) },
    shelf,
    jumpers: [3, 9, 14].map((i, k) => ({ addr: fakeAddr(200 + i), at: Math.floor(Date.now() / 1000) - k * 3000, tx: fakeTx() })),
    jumpedCount: 3,
    rounds,
    fightMinTokens: 10_000,
    updated: Date.now(),
  }
}

function demoTick(d: Status): Status {
  const ring: Ring = { total: d.ring.total, champion: d.ring.champion ? { ...d.ring.champion } : null, fights: [...d.ring.fights], seen: [], best: d.ring.best }
  enterRing(ring, { tx: fakeTx(), t: Math.floor(Date.now() / 1000), buyer: fakeAddr(Math.floor(Math.random() * 40)), tokens: MIN * BigInt(1 + Math.floor(Math.random() ** 3 * 4000)), minUnits: MIN })
  const tank = d.fees.tankEth + 0.0009
  const rang = tank >= d.fees.stepEth
  const burned = rang ? 1_000_000 : 0
  return {
    ...d,
    fees: { ...d.fees, tankEth: rang ? 0.0004 : tank },
    totals: rang ? { claimedEth: d.totals.claimedEth + tank, spentEth: d.totals.spentEth + tank - 0.0002, burnedByBell: d.totals.burnedByBell + burned } : d.totals,
    supply: { ...d.supply, inTheDeep: d.supply.inTheDeep + burned },
    rounds: rang
      ? [{ n: d.rounds[0].n + 1, at: Math.floor(Date.now() / 1000), stage: 'done', route: 'curve', claimedEth: tank, spentEth: tank - 0.0002, burned, claimTx: fakeTx(), buyTx: fakeTx(), burnTx: fakeTx(), doneAt: Math.floor(Date.now() / 1000) }, ...d.rounds].slice(0, 12)
      : d.rounds,
    ring: { total: ring.total, champion: ring.champion, best: ring.best, fights: ring.fights.slice(0, 12) },
    updated: Date.now(),
  }
}

/** The newest fight the page has not shown yet (for the toast and the ring replay). */
export function useNewFight(fights: Fight[]) {
  const seen = useRef<number>(fights[0]?.n ?? 0)
  const [fresh, setFresh] = useState<Fight | null>(null)
  useEffect(() => {
    const top = fights[0]
    if (top && top.n > seen.current) {
      seen.current = top.n
      setFresh(top)
    }
  }, [fights])
  return fresh
}

export const short = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
export const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d })
export const compact = (n: number) => (n >= 1e9 ? `${fmt(n / 1e9, 2)}B` : n >= 1e6 ? `${fmt(n / 1e6, 2)}M` : n >= 1e3 ? `${fmt(n / 1e3, 1)}K` : fmt(n))
const EXPLORER = (import.meta.env.VITE_EXPLORER_URL || 'https://robinhoodchain.blockscout.com').replace(/\/$/, '')
export const txUrl = (h: string) => `${EXPLORER}/tx/${h}`
export const addrUrl = (a: string) => `${EXPLORER}/address/${a}`
export const BUY_URL = import.meta.env.VITE_LINK_BUY || ''
