import { useState } from 'react'
import { ArrowUpRight, BookOpen, CalendarDays, Check, Copy, LineChart, MessagesSquare, Send, ShoppingCart, Sparkles, Trophy } from 'lucide-react'
import { TankView } from './FishCanvas'
import { Coin, SYMBOL } from './ui'
import { useBoard } from './Leaderboard'
import { ranked } from '../game/leaderboard'
import { SPECIES } from '../game/species'
import { LINKS, TOKEN_ADDRESS } from '../lib/links'
import type { Player } from '../game/store'

function XLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

const CHANNELS = [
  { key: 'x', name: 'X (Twitter)', icon: <XLogo />, note: 'Announcements, round results and fish of the week.' },
  { key: 'telegram', name: 'Telegram', icon: <Send size={18} />, note: 'The main chat. Keepers trade tips, brag and complain about bad luck.' },
  { key: 'discord', name: 'Discord', icon: <MessagesSquare size={18} />, note: 'Breeding talk, bug reports and events.' },
  { key: 'dexscreener', name: 'DexScreener', icon: <LineChart size={18} />, note: `The live ${'$'}${SYMBOL} chart.` },
  { key: 'buy', name: `Buy ${'$'}${SYMBOL}`, icon: <ShoppingCart size={18} />, note: 'Get coins for fish, food and stakes.' },
  { key: 'docs', name: 'Docs', icon: <BookOpen size={18} />, note: 'Game rules, tokenomics and roadmap.' },
] as const

const EVENTS = [
  { title: 'Weekly Show Bench', note: 'A beauty-only contest judged on flare and colour. No fighting, no wounds.', icon: Sparkles },
  { title: 'Keeper of the Month', note: 'The top earner of the month gets a featured spot and a rare juvenile.', icon: Trophy },
  { title: 'Community AMA', note: 'Regular voice chats with the team about what ships next.', icon: CalendarDays },
]

export function Community({ p, now, you }: { p: Player; now: number; you: string }) {
  const [copied, setCopied] = useState(false)
  const top = ranked(useBoard(p, now, you), 'earned').slice(0, 5)
  const live = CHANNELS.filter((c) => LINKS[c.key]).length

  const copy = async () => {
    if (!TOKEN_ADDRESS) return
    try {
      await navigator.clipboard.writeText(TOKEN_ADDRESS)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line-soft">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_75%_40%,rgba(242,193,78,0.10),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-10 md:grid-cols-[1.2fr_1fr] lg:px-16">
          <div>
            <div className="eyebrow mb-4">Community</div>
            <h1 className="display text-[clamp(2.6rem,6vw,4.8rem)] font-semibold leading-[0.98]">
              The keepers' <span className="italic text-gold">room.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[1.05rem] leading-relaxed text-dim">
              Where Betta Arena keepers meet: show off a prime Halfmoon, mourn a Plakat lost in the semifinal, and find out first when the next round, breed or event drops.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {LINKS.telegram ? (
                <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer" className="btn btn-gold">
                  <Send size={15} /> Join the Telegram
                </a>
              ) : (
                <span className="btn btn-gold pointer-events-none opacity-60">Channels opening soon</span>
              )}
              <a href="/#leaderboard" className="btn btn-ghost">
                See the leaderboard
              </a>
            </div>
          </div>
          <div className="jar mx-auto aspect-[5/4] w-full max-w-[440px]">
            <TankView fish={{ genome: { ...SPECIES[8].genome, seed: 51 }, health: 100, hunger: 10, water: 100, sick: false, alive: true }} seed={11} sizeRatio={0.55} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-10 lg:px-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow mb-2">Channels</div>
            <h2 className="display text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">Find us here.</h2>
          </div>
          <span className="text-sm text-faint">{live ? `${live} of ${CHANNELS.length} live` : 'Links go live at launch'}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.map((c) => {
            const href = LINKS[c.key]
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-text ring-1 ring-line-soft">{c.icon}</span>
                  {href ? (
                    <ArrowUpRight size={18} className="text-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold" />
                  ) : (
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint">Coming soon</span>
                  )}
                </div>
                <div className="display mt-4 text-xl font-semibold">{c.name}</div>
                <p className="mt-1 text-sm leading-relaxed text-dim">{c.note}</p>
              </>
            )
            return href ? (
              <a key={c.key} href={href} target="_blank" rel="noopener noreferrer" className="card group p-5 transition-colors hover:border-gold/50">
                {inner}
              </a>
            ) : (
              <div key={c.key} className="card p-5 opacity-75" aria-disabled="true">
                {inner}
              </div>
            )
          })}
        </div>

        <div className="card mt-6 flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1">${SYMBOL} contract address</div>
            <div className="num truncate text-sm text-text">{TOKEN_ADDRESS || 'Announced at launch. Only trust the address posted here and on our official X.'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={copy} disabled={!TOKEN_ADDRESS}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </section>

      <section className="border-t border-line-soft bg-deep/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:px-16">
          <div>
            <div className="eyebrow mb-2">Top keepers</div>
            <h2 className="display mb-6 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">This season's earners.</h2>
            <ol className="card divide-y divide-line-soft/60">
              {top.map((r, i) => (
                <li key={r.owner + i} className={`flex items-center gap-4 px-5 py-3 ${r.mine ? 'bg-gold/10' : ''}`}>
                  <span className={`num w-5 text-sm font-semibold ${i === 0 ? 'text-gold' : 'text-faint'}`}>{i + 1}</span>
                  <span className={`flex-1 truncate font-semibold ${r.mine ? 'text-gold' : ''}`}>{r.owner}</span>
                  <span className="text-xs text-dim">{r.titles} title{r.titles === 1 ? "" : "s"}</span>
                  <Coin n={r.earned} className="text-sm" />
                </li>
              ))}
            </ol>
            <a href="/#leaderboard" className="mt-4 inline-block text-sm text-dim hover:text-text">
              Full leaderboard →
            </a>
          </div>
          <div>
            <div className="eyebrow mb-2">Events</div>
            <h2 className="display mb-6 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold">Coming up.</h2>
            <div className="grid gap-3">
              {EVENTS.map((e) => (
                <div key={e.title} className="card flex gap-4 p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
                    <e.icon size={18} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="display text-lg font-semibold">{e.title}</span>
                      <span className="rounded-full border border-line px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-faint">Soon</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-dim">{e.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
