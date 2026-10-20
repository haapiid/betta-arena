import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { Arena } from './components/Arena'
import { Community } from './components/Community'
import { Leaderboard } from './components/Leaderboard'
import { Jars } from './components/Jars'
import { Footer, Header, Hero, HowItWorks } from './components/Layout'
import { Shop } from './components/Shop'
import { Busy, Toasts, useNow, type Toast } from './components/ui'
import { Backdrop, COMMUNITY_STORY, HOME_STORY } from './components/Backdrop'
import { useGame, type Result } from './game/store'
import { roundAt } from './game/tournament'
import { useRoundPot } from './lib/hooks'
import { useScrollMotion } from './lib/motion'
import { connect, disconnect, onAccountsChanged, readable, short } from './lib/wallet'
import { clearSession, hasSession } from './lib/api'

// two pages: the game ('/') and the community page ('/community')
const PAGE: 'home' | 'community' = window.location.pathname.replace(/\/+$/, '') === '/community' ? 'community' : 'home'
const SAVED = 'betta-arena:wallet'

export default function App() {
  const [addr, setAddr] = useState<Address | null>(() => {
    try {
      const a = localStorage.getItem(SAVED)
      return a && /^0x[0-9a-f]{40}$/.test(a) ? (a as Address) : null
    } catch {
      return null
    }
  })
  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)
  const notify = useCallback((r: Result) => {
    if (!r.msg) return
    const id = ++tid.current
    setToasts((l) => [...l.slice(-3), { id, ok: r.ok, msg: r.msg }])
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 4200)
  }, [])

  const { p, actions, busy, signedIn } = useGame(addr, notify)
  // smooth scrolling on both pages; the dive and the step line only exist on the home page
  useScrollMotion(true)
  const now = useNow(1000)
  const round = roundAt(now)
  const pot = useRoundPot(round)

  const remember = (a: Address | null) => {
    setAddr(a)
    try {
      if (a) localStorage.setItem(SAVED, a)
      else localStorage.removeItem(SAVED)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => onAccountsChanged((a) => remember(a)), [])

  const onConnect = async () => {
    try {
      const a = await connect()
      if (!a) return notify({ ok: false, msg: 'Wallet not connected.' })
      remember(a)
      notify({ ok: true, msg: `Connected ${short(a)}.` })
    } catch (e) {
      notify({ ok: false, msg: readable(e) })
    }
  }
  // right after connecting, ask once for the (free) sign-in signature
  const asked = useRef<string | null>(null)
  useEffect(() => {
    if (!addr || hasSession(addr) || asked.current === addr) return
    asked.current = addr
    void actions.signIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr])

  const onDisconnect = async () => {
    if (addr) clearSession(addr)
    await disconnect()
    remember(null)
  }

  return (
    <>
      {/* one scene per section of the keeper's story, and the water the dive passes through */}
      <Backdrop story={PAGE === 'community' ? COMMUNITY_STORY : HOME_STORY} />
      <div aria-hidden="true" data-dive="wash" className="dive-wash" />
      <Header p={p} addr={addr} signedIn={signedIn} onConnect={onConnect} onSignIn={actions.signIn} onDisconnect={onDisconnect} page={PAGE} />
      {PAGE === 'community' ? (
        <Community me={addr} />
      ) : (
        <main>
          <Hero p={p} now={now} round={round} pot={pot} />
          <Jars p={p} actions={actions} now={now} connected={!!addr} />
          <Shop p={p} buyFish={actions.buyFish} buyPack={actions.buyPack} connected={!!addr} />
          <Arena p={p} actions={actions} now={now} me={addr} />
          <Leaderboard me={addr} />
          <HowItWorks />
        </main>
      )}
      <Footer />
      <Busy text={busy} />
      <Toasts list={toasts} />
    </>
  )
}
