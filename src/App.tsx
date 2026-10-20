// The page is one night at the betta fights, walked top to bottom: ringside, the stall's rule board,
// the keepers' shelf, the bell, the deep, your jar, closing time. Every place has its own ground and
// the edges between them are drawn. Before launch it runs on labelled demo fights.

import { Community } from './components/Community'
import { Backdrop, COMMUNITY_STORY } from './components/Backdrop'
import { useNewFight, useStatus } from './lib/feed'
import { useScrollMotion } from './lib/motion'
import { Ringside, Ticker } from './places/Ringside'
import { Bell, Deep, Rules, Shelf } from './places/Places'
import { Closing, FightToast, Journey, TopBar, YourJar } from './places/Frame'
import './places/places.css'

const PAGE: 'home' | 'community' = window.location.pathname.replace(/\/+$/, '') === '/community' ? 'community' : 'home'

export default function App() {
  const { status, isDemo, offline } = useStatus()
  const fresh = useNewFight(status.ring.fights)
  useScrollMotion(true, PAGE === 'home')

  if (PAGE === 'community')
    return (
      <>
        <Backdrop story={COMMUNITY_STORY} />
        <TopBar isDemo={isDemo} />
        <div className="pt-16">
          <Community status={status} />
        </div>
        <Closing status={status} />
      </>
    )

  return (
    <div className="site">
      <TopBar isDemo={isDemo} />
      <span className="progress" aria-hidden="true" />
      <Journey />
      {offline && !isDemo && <p className="num fixed inset-x-0 top-16 z-40 bg-[#3a1418] py-1 text-center text-xs text-[#ffd0d5]">The arena's feed is offline for a moment.</p>}
      <Ringside status={status} isDemo={isDemo} fresh={fresh} />
      <Ticker status={status} />
      <main>
        <Rules status={status} />
        <Shelf status={status} isDemo={isDemo} />
        <Bell status={status} isDemo={isDemo} />
        <Deep status={status} isDemo={isDemo} />
        <YourJar status={status} isDemo={isDemo} />
      </main>
      <Closing status={status} />
      <FightToast fight={fresh} />
    </div>
  )
}
