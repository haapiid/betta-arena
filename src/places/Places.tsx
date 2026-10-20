// 2–5 · The stall's rule board, the keepers' shelf, the bell, and the deep.

import { useMemo } from 'react'
import { TankView } from '../components/FishCanvas'
import { Market, Room, SeaFloor } from '../components/Backdrop'
import { SPECIES } from '../game/species'
import { addrUrl, compact, fmt, short, txUrl, type Status } from '../lib/feed'
import { AwningEdge, BellEdge, JarRowEdge, SurfaceEdge } from './Edges'
import { useAccount } from '../lib/account'

// ---------- 2 · the rule board at the stall ----------
export function Rules({ status }: { status: Status }) {
  const rules = [
    ['1 buy, 1 fight', `Every buy of at least ${compact(status.fightMinTokens)} $BETTA throws a betta into the ring. Your transaction picks its breed and name; a bigger buy brings a higher level.`],
    ['Winner keeps the belt', 'Beat the champion and your fish holds the belt until the next buyer beats it. Every fight can be replayed from its transaction.'],
    ['The house buys back', 'Pons pays the creator a fee on every trade. Each time the fee tank fills up, all of it buys $BETTA.'],
    ['Bought back, sunk for good', 'Everything the bell buys goes straight to the dead address. Sell once and your fish jumps the jar: off the shelf, for good.'],
  ]
  return (
    <section id="rules" className="place stall" data-place="rules">
      <AwningEdge />
      <Market cls="scene on" />
      <div className="place-in">
        <p className="kicker mb-3">The rule board</p>
        <h2 className="headline max-w-2xl">
          Four rules, <em>no refunds.</em>
        </h2>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {rules.map(([t, d], i) => (
            <li key={t} className="sign" data-sign style={{ rotate: `${[-1.2, 0.8, -0.6, 1.1][i]}deg` }}>
              <div className="no">No. {i + 1}</div>
              <h3 className="display mt-2 text-2xl font-semibold leading-tight">{t}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-[#4b4032]">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------- 3 · the keepers' shelf ----------
export function Shelf({ status, isDemo }: { status: Status; isDemo: boolean }) {
  const me = useAccount()
  const rows = status.shelf
  const top = rows.slice(0, 3)
  const rest = rows.slice(3)
  const max = rows[0]?.balance || 1
  // each keeper's jar holds a fish of a breed picked from their address
  const look = (addr: string) => SPECIES[parseInt(addr.slice(-4), 16) % SPECIES.length]
  return (
    <section id="shelf" className="place shelf-place" data-place="shelf">
      <JarRowEdge />
      <Room cls="scene on" />
      <div className="place-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker mb-3 text-[#8eabb6]">The shelf</p>
            <h2 className="headline max-w-2xl">
              Ten jars for the ten <em>who never sold.</em>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[#8eabb6]">
            The biggest holders who never sold. No money changes hands here: a jar on the shelf, and the whole market can see it. {status.jumpedCount ? `${status.jumpedCount} keeper${status.jumpedCount === 1 ? '' : 's'} already jumped.` : ''}
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="mt-12 text-[#8eabb6]">The shelf is empty. The first buyers fill it.</p>
        ) : (
          <>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {top.map((r) => {
                const sp = look(r.addr)
                return (
                  <article key={r.addr} data-jar>
                    <div className="jar-glass aspect-square">
                      <TankView glass fish={{ genome: { ...sp.genome, seed: parseInt(r.addr.slice(2, 8), 16) }, health: 100, hunger: 15, water: 100, sick: false, alive: true }} seed={r.rank * 31} sizeRatio={0.42 + 0.18 * (r.balance / max)} />
                      <span className={`absolute left-3 top-3 z-[3] rounded-full px-2.5 py-1 text-xs font-bold ${r.rank === 1 ? 'belt' : 'bg-black/50 text-white'}`}>No. {r.rank}</span>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <a className={`num truncate font-semibold hover:text-[var(--belt)] ${r.addr === me ? 'text-[var(--belt)]' : ''}`} href={isDemo ? undefined : addrUrl(r.addr)} target="_blank" rel="noopener noreferrer">
                        {r.addr === me ? 'you' : short(r.addr)}
                      </a>
                      <span className="num text-sm text-[#a9c3cc]">{compact(r.balance)}</span>
                    </div>
                    <div className="kicker text-[#5d7d89]">
                      {sp.name} · {r.fights} in the ring · {r.wins} win{r.wins === 1 ? '' : 's'}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="plank mt-4" />
            {rest.length > 0 && (
              <>
                <div className="mt-10 grid grid-cols-4 gap-4 sm:grid-cols-7">
                  {rest.map((r) => (
                    <div key={r.addr} className="text-center" data-jar>
                      <div className="mini-jar mx-auto w-full max-w-[90px]">
                        {/* a small betta in the keeper's colours, bigger for bigger bags */}
                        <svg viewBox="-30 -16 60 32" className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2" style={{ width: `${44 + 34 * (r.balance / max)}%` }} aria-hidden="true">
                          <path d="M-6 0 L-26 -13 Q-20 0 -26 13 Z" fill={look(r.addr).genome.fin} opacity="0.9" />
                          <ellipse cx="4" cy="0" rx="15" ry="6.5" fill={look(r.addr).genome.body} />
                          <circle cx="13" cy="-1.5" r="1.4" fill="#0b0b0d" />
                        </svg>
                      </div>
                      <div className="num mt-2 text-xs text-[#a9c3cc]">No. {r.rank}</div>
                      <div className={`num truncate text-[0.7rem] ${r.addr === me ? 'font-bold text-[var(--belt)]' : 'text-[#5d7d89]'}`}>{r.addr === me ? 'you' : short(r.addr)}</div>
                    </div>
                  ))}
                </div>
                <div className="plank mt-3" />
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ---------- 4 · the bell: the fee tank and the buyback tickets ----------
export function Bell({ status, isDemo }: { status: Status; isDemo: boolean }) {
  const { tankEth, stepEth } = status.fees
  const fill = Math.min(1, tankEth / Math.max(stepEth, 1e-9))
  const usd = (eth: number) => (status.ethUsd ? ` ≈ $${fmt(eth * status.ethUsd)}` : '')
  return (
    <section id="bell" className="place bell-place text-[#f4ead2]" data-place="bell">
      <BellEdge />
      <div className="place-in grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="kicker mb-3 text-[#b9a77c]">The bell</p>
          <h2 className="headline text-[clamp(2rem,4vw,3.4rem)]">
            Fees fill the tank. <em>The bell buys back.</em>
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-[#cbbd98]">
            Every trade on Pons pays the creator a small fee in ETH. It collects in the fee tank. When the tank reaches {stepEth} ETH the bell rings: the engine claims it and spends all of it buying $BETTA, which goes straight to the deep.
          </p>
          <div className="mt-8 flex items-end gap-6">
            <div className="tank w-40 sm:w-52" data-tank>
              <div className="tank-fill" style={{ height: `${Math.max(4, fill * 100)}%` }} />
              <span className="num absolute inset-x-0 top-3 text-center text-xs text-[#d8f5f2]">{fmt(fill * 100)}%</span>
            </div>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="kicker text-[#9c8a5f]">In the tank</dt>
                <dd className="num text-lg">{fmt(tankEth, 4)} ETH</dd>
              </div>
              <div>
                <dt className="kicker text-[#9c8a5f]">Rings at</dt>
                <dd className="num text-lg">{stepEth} ETH</dd>
              </div>
              <div>
                <dt className="kicker text-[#9c8a5f]">Spent buying back</dt>
                <dd className="num text-lg text-[var(--belt)]">
                  {fmt(status.totals.spentEth, 4)} ETH<span className="text-xs text-[#9c8a5f]">{usd(status.totals.spentEth)}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div>
          <p className="kicker mb-3 text-[#b9a77c]">Every ring of the bell, with its transactions</p>
          {status.rounds.length === 0 ? (
            <div className="ticket p-6 text-sm">No bell yet. The first one rings when the tank reaches {stepEth} ETH.</div>
          ) : (
            <div className="grid gap-4">
              {status.rounds.slice(0, 5).map((r) => (
                <div key={r.n} className="ticket grid gap-1 p-5 text-sm sm:grid-cols-[1fr_auto]" data-ticket>
                  <div>
                    <div className="flex items-center gap-3">
                      <b className="text-base">Bell #{r.n}</b>
                      <span className="text-xs text-[#7a6d5a]">{new Date(r.at * 1000).toLocaleString()}</span>
                    </div>
                    <div className="mt-1">
                      {fmt(r.spentEth, 4)} ETH → <b>{compact(r.burned)} $BETTA</b> sunk {r.route === 'v4' ? '(Uniswap)' : '(Pons curve)'}
                    </div>
                    {!isDemo && (
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[#7a6d5a]">
                        {r.claimTx && (
                          <a className="underline" href={txUrl(r.claimTx)} target="_blank" rel="noopener noreferrer">
                            claim
                          </a>
                        )}
                        {r.buyTx && (
                          <a className="underline" href={txUrl(r.buyTx)} target="_blank" rel="noopener noreferrer">
                            buy
                          </a>
                        )}
                        {r.burnTx && r.burnTx !== r.buyTx && (
                          <a className="underline" href={txUrl(r.burnTx)} target="_blank" rel="noopener noreferrer">
                            burn
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="self-center">{r.stage === 'done' ? <span className="stamp">SUNK</span> : <span className="text-xs uppercase text-[#7a6d5a]">{r.stage}</span>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ---------- 5 · the deep ----------
export function Deep({ status, isDemo }: { status: Status; isDemo: boolean }) {
  const pct = status.supply.total ? (status.supply.inTheDeep / status.supply.total) * 100 : 0
  const coins = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ left: (i * 61) % 100, dur: 9 + ((i * 7) % 9), delay: -((i * 13) % 17) })), [])
  return (
    <section id="deep" className="place deep-place" data-place="deep">
      <SurfaceEdge />
      <SeaFloor cls="scene on" />
      {coins.map((c, i) => (
        <span key={i} className="coin" style={{ left: `${c.left}%`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }} aria-hidden="true" />
      ))}
      <div className="place-in text-center">
        <p className="kicker mb-3 text-[#6f97a4]">The deep</p>
        <h2 className="headline mx-auto max-w-3xl">
          Everything bought back <em>sinks here.</em>
        </h2>
        <div className="num mt-10 text-[clamp(2.6rem,8vw,6.5rem)] font-semibold leading-none text-[var(--belt)]" data-deep-count data-value={status.supply.inTheDeep}>
          {fmt(status.supply.inTheDeep)}
        </div>
        <p className="mt-3 text-[#8eabb6]">
          $BETTA at the dead address · <b className="text-white">{fmt(pct, 3)}%</b> of the supply, gone for good
          {status.price?.tokenUsd ? <> · about ${compact(status.supply.inTheDeep * status.price.tokenUsd)} at today's price</> : null}
        </p>
        <div className="mx-auto mt-14 max-w-3xl text-left">
          <p className="kicker mb-3 text-[#6f97a4]">Jumped the jar · sold once, off the shelf for good</p>
          {status.jumpers.length === 0 ? (
            <p className="text-sm text-[#5d7d89]">Nobody has jumped yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {status.jumpers.map((j) => (
                <li key={j.addr}>
                  <a className="num rounded-full border border-[#163845] px-3 py-1 text-xs text-[#6f97a4] line-through decoration-[var(--red)] hover:text-white" href={isDemo ? undefined : txUrl(j.tx)} target="_blank" rel="noopener noreferrer">
                    {short(j.addr)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
