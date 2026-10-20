// The frame around the walk: the bar, the progress line, the journey rail, your jar, the toast for a
// new fight, and closing time.

import { useEffect, useState, type FormEvent } from 'react'
import { isAddress } from 'viem'
import { TankView } from '../components/FishCanvas'
import { SPECIES } from '../game/species'
import type { Fight } from '../game/ring'
import { BUY_URL, compact, fmt, getJson, short, txUrl, type Status, type WalletView } from '../lib/feed'
import { LINKS, TOKEN_ADDRESS } from '../lib/links'
import { TornEdge, WeedEdge } from './Edges'
import { openShare } from './Share'
import { connectWallet, disconnectWallet, useAccount } from '../lib/account'

export const STOPS = [
  ['ring', 'Ringside'],
  ['rules', 'The rules'],
  ['shelf', 'The shelf'],
  ['bell', 'The bell'],
  ['deep', 'The deep'],
  ['jar', 'Your jar'],
] as const

export function Logo({ className = '' }: { className?: string }) {
  return <img src="/betta-mark.svg" alt="" className={`size-8 rounded-lg ${className}`} />
}

export function TopBar({ isDemo }: { isDemo: boolean }) {
  const me = useAccount()
  const [err, setErr] = useState('')
  const connect = async () => {
    const e = await connectWallet()
    setErr(e ?? '')
    if (e) setTimeout(() => setErr(''), 5000)
  }
  return (
    <header className="topbar">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-10 lg:px-16">
        <a href="#ring" className="flex items-center gap-2.5">
          <Logo />
          <span className="display text-lg font-semibold">Betta Arena</span>
        </a>
        {isDemo && <span className="num hidden rounded-full border border-[#3a5562] px-2 py-0.5 text-[0.68rem] text-[#8eabb6] sm:inline">preview</span>}
        <nav className="ml-6 hidden items-center gap-6 text-sm text-[#8eabb6] lg:flex">
          {STOPS.slice(1).map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-white">
              {label}
            </a>
          ))}
          <a href="/community" className="hover:text-white">
            Community
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {LINKS.x && (
            <a className="btn btn-ghost btn-sm" href={LINKS.x} target="_blank" rel="noopener noreferrer" aria-label="Betta Arena on X">
              X
            </a>
          )}
          {BUY_URL && (
            <a className="btn btn-coral btn-sm hidden sm:inline-flex" href={BUY_URL} target="_blank" rel="noopener noreferrer">
              Buy $BETTA
            </a>
          )}
          {me ? (
            <span className="flex items-center gap-1">
              <a className="btn btn-ghost btn-sm" href="#jar" title="Your jar">
                <span className="num">{short(me)}</span>
              </a>
              <button className="btn btn-ghost btn-sm !px-2.5" onClick={disconnectWallet} title="Forget this wallet" aria-label="Disconnect wallet">
                ✕
              </button>
            </span>
          ) : (
            <button className="btn btn-gold btn-sm" onClick={connect}>
              Connect wallet
            </button>
          )}
        </div>
      </div>
      {err && <p className="border-t border-[#3a1418] bg-[#2a0f14] px-4 py-1.5 text-center text-xs text-[#ffd0d5]">{err}</p>}
    </header>
  )
}

/** Where you are on the walk (wide screens). */
export function Journey() {
  const [here, setHere] = useState('ring')
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setHere(e.target.id)),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    STOPS.forEach(([id]) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])
  return (
    <nav className="journey" aria-label="The walk">
      {STOPS.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={here === id ? 'here' : ''}>
          <i />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  )
}

// ---------- 6 · your jar ----------
const WALLET = 'betta-arena:wallet-check'

export function YourJar({ status, isDemo }: { status: Status; isDemo: boolean }) {
  const me = useAccount()
  const [addr, setAddr] = useState(() => {
    try {
      return localStorage.getItem(WALLET) ?? ''
    } catch {
      return ''
    }
  })
  const [view, setView] = useState<WalletView | null>(null)
  const [err, setErr] = useState('')

  const check = async (a: string) => {
    setErr('')
    if (!isAddress(a)) return setErr('That is not a wallet address (0x… with 40 characters).')
    try {
      localStorage.setItem(WALLET, a)
    } catch {
      /* fine */
    }
    if (isDemo) return setView(demoWallet(a, status))
    try {
      setView(await getJson<WalletView>(`/api/wallet/${a.toLowerCase()}`))
    } catch {
      setErr('The arena did not answer. Try again in a moment.')
    }
  }
  useEffect(() => {
    if (addr && isAddress(addr)) void check(addr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])
  // a connected wallet fills the jar by itself
  useEffect(() => {
    if (!me) return
    setAddr(me)
    void check(me)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  const connect = async () => {
    const e = await connectWallet()
    if (e) setErr(e)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void check(addr.trim())
  }
  const sp = view ? SPECIES[parseInt(view.addr.slice(-4), 16) % SPECIES.length] : null

  return (
    <section id="jar" className="place paper-place" data-place="jar">
      <TornEdge />
      <div className="place-in grid gap-12 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="kicker mb-3">Your jar</p>
          <h2 className="headline">
            Check a wallet. <em>See its fights.</em>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-[#4b4032]">Paste an address or connect a wallet to read it. Nothing is signed and nothing is sent: this only looks the wallet up.</p>
          <form onSubmit={submit} className="mt-7 flex max-w-lg flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="addr">
              Wallet address
            </label>
            <input id="addr" className="field" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} autoComplete="off" />
            <button className="btn btn-coral shrink-0" type="submit">
              Look it up
            </button>
          </form>
          <button className="mt-3 text-sm text-[#6d5f4e] underline hover:text-black" onClick={connect}>
            or read it from my wallet
          </button>
          {err && <p className="mt-3 text-sm text-[#b3122c]">{err}</p>}
        </div>

        <div>
          {view && sp ? (
            <div className="ticket grid gap-4 p-6 sm:grid-cols-[150px_1fr]">
              <div className="jar-glass aspect-square">
                <TankView glass fish={view.balance > 0 ? { genome: { ...sp.genome, seed: parseInt(view.addr.slice(2, 8), 16) }, health: 100, hunger: 15, water: 100, sick: false, alive: true } : null} seed={5} sizeRatio={0.5} />
              </div>
              <div className="text-sm">
                <div className="num text-base font-bold">{short(view.addr)}</div>
                <p className="mt-2">
                  {view.jumped ? (
                    <>
                      <span className="stamp">JUMPED</span> Sold once: off the shelf for good.
                    </>
                  ) : view.balance > 0 ? (
                    <>
                      Holds <b>{compact(view.balance)} $BETTA</b>
                      {view.rank ? ` · No. ${view.rank} on the shelf` : ''}
                      {view.holdsBelt ? ' · holds the belt' : ''}
                    </>
                  ) : (
                    'No $BETTA in this jar yet.'
                  )}
                </p>
                <p className="mt-1">
                  {view.fights} in the ring · {view.wins} win{view.wins === 1 ? '' : 's'}
                </p>
                <ul className="mt-3 grid gap-1 text-xs text-[#6d5f4e]">
                  {view.recent.slice(0, 5).map((f) => (
                    <li key={f.n} className="flex items-center justify-between gap-2">
                      <a className="hover:underline" href={isDemo ? undefined : txUrl(f.tx)} target="_blank" rel="noopener noreferrer">
                        #{f.n} {fightLine(f)}
                      </a>
                      <button className="shrink-0 font-semibold text-[#b3122c] hover:underline" onClick={() => openShare(f)}>
                        card
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="ticket p-6 text-sm text-[#6d5f4e]">A jar appears here once you look a wallet up.</div>
          )}
        </div>
      </div>
    </section>
  )
}

export const fightLine = (f: Fight) =>
  f.winner === 'walkover'
    ? `${f.challenger.name} walks into the empty ring`
    : f.winner === 'challenger'
      ? `${f.challenger.name} (Lv ${f.challenger.level}) takes the belt from ${f.champion!.name}`
      : `${f.champion!.name} beats ${f.challenger.name} · ${f.streak} in a row`

function demoWallet(addr: string, s: Status): WalletView {
  const row = s.shelf[parseInt(addr.slice(-2), 16) % s.shelf.length]
  return { addr: addr.toLowerCase(), balance: row.balance, firstIn: 0, jumped: false, jumpedTx: '', fights: row.fights, wins: row.wins, rank: row.rank, holdsBelt: false, recent: s.ring.fights.slice(0, 3) }
}

// ---------- the toast for a new fight ----------
export function FightToast({ fight }: { fight: Fight | null }) {
  const me = useAccount()
  const [show, setShow] = useState<Fight | null>(null)
  useEffect(() => {
    if (!fight) return
    setShow(fight)
    const t = setTimeout(() => setShow(null), 5200)
    return () => clearTimeout(t)
  }, [fight?.n])
  if (!show) return null
  const mine = !!me && (show.buyer === me || show.championOwner === me)
  return (
    <div className="rise fixed bottom-5 right-5 z-[70] max-w-xs rounded-2xl border border-[#3a1418] bg-[#12060a]/95 px-4 py-3 text-sm shadow-2xl backdrop-blur" aria-live="polite">
      <div className="kicker text-[var(--red)]">{mine ? 'Your fight' : 'New fight'} #{show.n}</div>
      <a href="#ring" className="mt-0.5 block text-white">
        {fightLine(show)}
      </a>
      <button className="mt-2 text-xs font-semibold text-[var(--belt)] hover:underline" onClick={() => openShare(show)}>
        {mine ? 'Share your card' : 'Share this fight'}
      </button>
    </div>
  )
}

// ---------- closing time ----------
export function Closing({ status }: { status: Status }) {
  return (
    <footer className="place closing">
      <WeedEdge />
      <div className="place-in text-center">
        <h2 className="headline mx-auto max-w-2xl">
          The ring never closes. <em>The deep keeps everything.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[#8eabb6]">
          {fmt(status.ring.total)} fights so far. {compact(status.supply.inTheDeep)} $BETTA in the deep.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {BUY_URL && (
            <a className="btn btn-gold" href={BUY_URL} target="_blank" rel="noopener noreferrer">
              Buy on Pons
            </a>
          )}
          {LINKS.x && (
            <a className="btn btn-ghost" href={LINKS.x} target="_blank" rel="noopener noreferrer">
              Follow on X
            </a>
          )}
          <a className="btn btn-ghost" href="/community">
            Community
          </a>
        </div>
        {TOKEN_ADDRESS && (
          <p className="num mt-8 break-all text-xs text-[#5d7d89]">
            $BETTA · {TOKEN_ADDRESS} · Robinhood Chain
          </p>
        )}
        <p className="mt-8 flex justify-center gap-5 text-xs text-[#8eabb6]">
          <a className="hover:text-white" href="/terms.html">
            Terms
          </a>
          <a className="hover:text-white" href="/privacy.html">
            Privacy
          </a>
        </p>
        <p className="mx-auto mt-6 max-w-2xl text-xs leading-relaxed text-[#5d7d89]">
          $BETTA is a memecoin with no promise of value, no yield and no roadmap of returns. Buybacks spend creator fees only; past buybacks say nothing about future price. Only spend what you can lose, and check that crypto is allowed where you live. No real fish are harmed.
        </p>
      </div>
    </footer>
  )
}
