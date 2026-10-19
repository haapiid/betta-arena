import { useCallback, useMemo, useRef, useState } from 'react'
import { Arena } from './components/Arena'
import { Community } from './components/Community'
import { Leaderboard } from './components/Leaderboard'
import { Jars } from './components/Jars'
import { Footer, Header, Hero, HowItWorks } from './components/Layout'
import { Shop } from './components/Shop'
import { Toasts, useNow, type Toast } from './components/ui'
import { fighterOf, openRound, useGame, type Result } from './game/store'
import { buildField, DIVISIONS } from './game/tournament'
import { connect, disconnect, short } from './lib/wallet'

// two pages: the game ('/') and the community page ('/community')
const PAGE: 'home' | 'community' = window.location.pathname.replace(/\/+$/, '') === '/community' ? 'community' : 'home'

export default function App() {
  const [addr, setAddr] = useState<string | null>(() => {
    try {
      const a = localStorage.getItem('betta-arena:wallet')
      return a?.startsWith('0x') ? a : null
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
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 3600)
  }, [])

  const owner = addr ? short(addr) : 'guest'
  const { p, actions } = useGame(addr, owner, notify)
  const now = useNow(1000)

  const round = openRound(p, now)
  // total pot across all three divisions of the open round
  const pot = useMemo(
    () =>
      DIVISIONS.reduce((sum, d) => {
        const mine = p.entries
          .filter((e) => e.n === round && e.div === d.id)
          .flatMap((e) => {
            const f = p.tanks.find((t) => t?.id === e.fishId)
            return f ? [fighterOf(f, owner, e.stake, now)] : []
          })
        return sum + buildField(round, d.id, mine).reduce((s, f) => s + f.stake, 0)
      }, 0),
    [round, p.entries, p.tanks, owner],
  )

  const onConnect = async () => {
    const a = await connect()
    if (!a) return notify({ ok: false, msg: 'Wallet not connected.' })
    setAddr(a)
    try {
      localStorage.setItem('betta-arena:wallet', a)
    } catch {
      /* ignore */
    }
    notify({ ok: true, msg: `Connected ${short(a)}. Your jars are saved to this wallet.` })
  }
  const onDisconnect = async () => {
    await disconnect()
    setAddr(null)
    try {
      localStorage.removeItem('betta-arena:wallet')
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Header p={p} addr={addr} onConnect={onConnect} onDisconnect={onDisconnect} onFaucet={actions.faucet} now={now} page={PAGE} />
      {PAGE === 'community' ? (
        <Community p={p} now={now} you={owner} />
      ) : (
        <main>
          <Hero p={p} now={now} round={round} pot={pot} />
          <Jars p={p} actions={actions} now={now} />
          <Shop p={p} buyFish={actions.buyFish} buyItem={actions.buyItem} buyPack={actions.buyPack} />
          <Arena p={p} actions={actions} now={now} owner={owner} />
          <Leaderboard p={p} now={now} you={owner} />
          <HowItWorks />
        </main>
      )}
      <Footer onReset={actions.reset} />
      <Toasts list={toasts} />
    </>
  )
}
