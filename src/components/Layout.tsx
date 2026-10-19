import { useEffect, useState } from 'react'
import { Coins, LogOut, Wallet } from 'lucide-react'
import { TankView } from './FishCanvas'
import { Coin, countdown, fmt, SYMBOL } from './ui'
import { SPECIES } from '../game/species'
import { hasWallet, short } from '../lib/wallet'
import { DEMO, FAUCET_AMOUNT, FAUCET_COOLDOWN, type Player } from '../game/store'
import { DIVISIONS, endsAt, FEE, PERIOD_DAYS, PRIZE_SPLIT } from '../game/tournament'
import { DAILY_XP_CAP, LIFESPAN_DAYS, STAGE_BOUNDS } from '../game/fish'
import { TRAIT_EVERY } from '../game/traits'

export function Logo({ className = '' }: { className?: string }) {
  return <img src="/betta-mark.svg" alt="" className={`size-8 rounded-lg ${className}`} />
}

export function Header({
  p,
  addr,
  onConnect,
  onDisconnect,
  onFaucet,
  now,
  page = 'home',
}: {
  page?: 'home' | 'community'
  p: Player
  addr: string | null
  onConnect: () => void
  onDisconnect: () => void
  onFaucet: () => void
  now: number
}) {
  const faucetIn = p.lastFaucet + FAUCET_COOLDOWN - now
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-10 lg:px-16">
        <a href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="display text-lg font-semibold">Betta Arena</span>
        </a>
        <nav className="ml-6 hidden items-center gap-6 text-sm text-dim lg:flex">
          {[
            ['/#jars', 'My jars'],
            ['/#shop', 'Shop'],
            ['/#arena', 'Arena'],
            ['/#leaderboard', 'Leaderboard'],
            ['/#how', 'How it works'],
            ['/community', 'Community'],
          ].map(([href, label]) => (
            <a key={href} href={href} className={`hover:text-text ${page === 'community' && href === '/community' ? 'text-gold' : ''}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {DEMO && (
            <button
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
              onClick={onFaucet}
              disabled={faucetIn > 0}
              title={faucetIn > 0 ? `Next claim in ${countdown(faucetIn)}` : `Claim ${FAUCET_AMOUNT} test coins`}
            >
              <Coins size={14} /> {faucetIn > 0 ? countdown(faucetIn) : `+${FAUCET_AMOUNT}`}
            </button>
          )}
          <div className="rounded-full border border-line px-3 py-1.5 text-sm">
            <Coin n={p.balance} className="font-semibold" />
          </div>
          {addr ? (
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect} title="Disconnect">
              <span className="num">{short(addr)}</span> <LogOut size={13} />
            </button>
          ) : (
            <button
              className="btn btn-gold btn-sm"
              onClick={onConnect}
              title={hasWallet() ? 'Your jars are saved per wallet. Without one you play as a guest on this device.' : 'No Ethereum wallet found. Install MetaMask to save your jars.'}
            >
              <Wallet size={14} /> Connect wallet
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

const SHOWCASE = ['platinum', 'crowntail', 'koi', 'halfmoon', 'samurai', 'nemo']

export function Hero({ p, now, round, pot }: { p: Player; now: number; round: number; pot: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % SHOWCASE.length), 9000)
    return () => clearInterval(id)
  }, [])
  const sp = SPECIES.find((s) => s.id === SHOWCASE[i])!
  const living = p.tanks.filter((t) => t?.alive).length
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_40%,rgba(95,224,208,0.12),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-8 pt-6 sm:px-10 md:grid-cols-[1.4fr_1fr] md:pb-10 md:pt-8 lg:px-16">
        <div>
          <div className="eyebrow mb-3">Betta keeping · betta fighting · ${SYMBOL}</div>
          <h1 className="display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1]">
            Raise it. Groom it.
            <br />
            <span className="italic text-gold">Let it fight.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-dim">
            Buy a betta, keep it alive in one of your three jars, train it and watch it level up through its life. Every {PERIOD_DAYS} days the arena opens: pay the entry fee for your fish's division and the fights play out on their own. The top four split the pot.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={living ? '#jars' : '#shop'} className="btn btn-gold">
              {living ? 'Check my jars' : 'Buy your first betta'}
            </a>
            <a href="#arena" className="btn btn-ghost">
              Enter the arena
            </a>
          </div>
          <dl className="mt-6 grid max-w-lg grid-cols-3 gap-4 border-t border-line-soft pt-4">
            <div>
              <dt className="eyebrow">Round #{round}</dt>
              <dd className="num mt-1 text-lg text-text">{countdown(endsAt(round) - now)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Total pot</dt>
              <dd className="num mt-1 text-lg text-gold">{fmt(pot)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Arena burn</dt>
              <dd className="num mt-1 text-lg text-text">{Math.round(FEE * 100)}%</dd>
            </div>
          </dl>
        </div>
        <div className="relative hidden sm:block">
          <div className="jar-glass mx-auto aspect-square w-full max-w-[360px]">
            <TankView glass sizeRatio={0.62} key={sp.id} fish={{ genome: { ...sp.genome, seed: 777 + i }, image: sp.image, health: 100, hunger: 20, water: 100, sick: false, alive: true }} seed={3} />
            <div className="absolute bottom-0 left-1/2 z-[3] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-xs text-white/85 backdrop-blur">
              {sp.name} · <span className="italic">{sp.rarity}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HowItWorks() {
  const steps = [
    ['01', 'Buy a betta', 'Ten breeds, from an 80-coin Veiltail to a 650-coin Platinum Halfmoon. Every fish arrives as a level-1 juvenile with its own rolled stats and pattern. You can keep three at a time.'],
    ['02', 'Keep it alive', 'Hunger climbs about 4.5 an hour and the water clouds about 2.8 an hour. Starving or murky water drains health, and dirty water brings sickness. At zero health the fish dies; the jar is yours to refill or leave empty.'],
    ['03', 'Level it up', `A healthy fish earns XP every hour on its own. Free training sessions (mirror flaring, morning sun, ketapang soak) and vitamins add more, up to ${DAILY_XP_CAP} XP a day. Fights give XP with no cap. Every level grows stats the way the breed grows, and every ${TRAIT_EVERY} levels it learns a trait.`],
    ['04', 'Enter and fight', `Every ${PERIOD_DAYS} days each division runs a bracket of up to 16 fish, each paying the same entry fee. Registration closes an hour before the bell. Fights resolve on their own. After a ${Math.round(FEE * 100)}% burn the pot pays the top four: ${PRIZE_SPLIT[0] * 100}% to the champion, ${PRIZE_SPLIT[1] * 100}% to the runner-up, ${PRIZE_SPLIT[2] * 100}% to each losing semifinalist. Boosters (+10 for 24h) help on the day; fish come home wounded.`],
  ]
  return (
    <section id="how" className="border-t border-line-soft bg-deep/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-10 lg:px-16">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="display mb-12 max-w-2xl text-[clamp(2rem,4.2vw,3.2rem)] font-semibold leading-[1.02]">A betta keeper's life, compressed.</h2>
        <ol className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {steps.map(([n, t, d]) => (
            <li key={n}>
              <div className="num mb-3 text-sm text-gold">{n}</div>
              <h3 className="display mb-2 text-xl font-semibold">{t}</h3>
              <p className="text-sm leading-relaxed text-dim">{d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          <div className="card p-6">
            <h3 className="display mb-3 text-xl font-semibold">A life in four stages</h3>
            <ul className="grid gap-2 text-sm leading-relaxed text-dim">
              {[
                ['Juvenile', 0, STAGE_BOUNDS.juvenile, 'stats ×0.88, still growing'],
                ['Adult', STAGE_BOUNDS.juvenile, STAGE_BOUNDS.adult, 'stats ×1.0'],
                ['Prime', STAGE_BOUNDS.adult, STAGE_BOUNDS.prime, 'stats ×1.1, its best fighting years'],
                ['Senior', STAGE_BOUNDS.prime, 1, 'fades from ×1.0 to ×0.8'],
              ].map(([name, a, b, note]) => (
                <li key={name as string}>
                  <b className="text-text">{name}</b> <span className="num text-faint">day {Math.round((a as number) * LIFESPAN_DAYS)}–{Math.round((b as number) * LIFESPAN_DAYS)}</span> · {note}
                </li>
              ))}
              <li>At day {LIFESPAN_DAYS} it dies of old age, so every keeper eventually buys again.</li>
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="display mb-3 text-xl font-semibold">Divisions</h3>
            <ul className="grid gap-2 text-sm leading-relaxed text-dim">
              {DIVISIONS.map((d) => (
                <li key={d.id}>
                  <b className="text-text">{d.name}</b> · level {d.min}–{d.max} · entry fee <span className="num">{d.fee}</span>
                </li>
              ))}
              <li>A fish fights in the division of its level when you enter it, so a new fish never meets a veteran.</li>
              <li>Up to three of your fish per round. Health must be at least 40 to enter.</li>
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="display mb-3 text-xl font-semibold">How a fight is decided</h3>
            <ul className="grid gap-2 text-sm leading-relaxed text-dim">
              <li><b className="text-text">HP</b> comes from defense; a wounded fish starts with less.</li>
              <li><b className="text-text">Damage</b> is attack against defense. Sickness cuts attack by a quarter.</li>
              <li><b className="text-text">Beauty</b> is the flare: more critical fin tears, more dodges.</li>
              <li><b className="text-text">Traits</b> bend the odds: thicker scales, harder bites, a second wind.</li>
              <li>After 40 exchanges with no knockout, the judges pick the fish with more HP left.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Footer({ onReset }: { onReset: () => void }) {
  return (
    <footer className="border-t border-line-soft">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
        <div className="flex items-center gap-2.5">
          <Logo className="!size-6" />
          <span>Betta Arena · ${SYMBOL}</span>
        </div>
        <p className="max-w-xl leading-relaxed">
          In-game coins, fish and entries are saved in this browser only. They are not ${SYMBOL} tokens, have no cash value and cannot be withdrawn. No real fish are harmed.
        </p>
        {DEMO && (
          <button className="text-left hover:text-dim sm:text-right" onClick={() => window.confirm('Reset all progress for this wallet on this device?') && onReset()}>
            Reset progress
          </button>
        )}
      </div>
    </footer>
  )
}
