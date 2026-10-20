// 1 · Ringside. The live ring replays the newest fight the moment a buy lands, then keeps the ring busy
// with the last few fights. Every fight is replayed from its transaction hash, exactly as the engine decided it.

import { useEffect, useMemo, useState } from 'react'
import { ArenaView, TankView } from '../components/FishCanvas'
import { fight, type Battle } from '../game/battle'
import { asFighter, type Fight } from '../game/ring'
import { SPECIES } from '../game/species'
import { BUY_URL, compact, fmt, short, txUrl, type Status } from '../lib/feed'
import { FightNight } from '../components/Backdrop'
import { useAccount } from '../lib/account'
import { openShare } from './Share'

const speciesName = (id: string) => SPECIES.find((s) => s.id === id)?.name ?? 'Betta'

export function Ringside({ status, isDemo, fresh }: { status: Status; isDemo: boolean; fresh: Fight | null }) {
  const fights = status.ring.fights
  const me = useAccount()
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState(-1)
  const [round, setRound] = useState(0) // bumps to restart the replay

  // a new buy jumps straight to its fight
  useEffect(() => {
    if (!fresh) return
    setIdx(0)
    setRound((r) => r + 1)
  }, [fresh?.n])

  const f = fights[Math.min(idx, Math.max(0, fights.length - 1))]
  const battle: Battle | null = useMemo(
    () => (f?.champion ? fight(asFighter(f.challenger, f.buyer), asFighter(f.champion, f.championOwner ?? ''), f.tx) : null),
    [f?.tx],
  )
  const done = battle ? step >= battle.events.length : step >= 0
  // when a replay ends, hold the result a moment, then show the fight before it
  useEffect(() => {
    if (!f || !done) return
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % Math.max(1, Math.min(6, fights.length)))
      setRound((r) => r + 1)
    }, battle ? 4200 : 5200)
    return () => clearTimeout(t)
  }, [done, f?.tx])
  // walkovers have no events: count them as played after a short entrance
  useEffect(() => {
    setStep(-1)
    if (f && !f.champion) {
      const t = setTimeout(() => setStep(0), 2200)
      return () => clearTimeout(t)
    }
  }, [f?.tx, round])

  const champ = status.ring.champion
  const cur = battle && step >= 0 ? battle.events[Math.min(battle.events.length - 1, step)] : null
  const hp = cur ? cur.hp : battle?.start ?? [0, 0]
  const pct = status.supply.total ? (status.supply.inTheDeep / status.supply.total) * 100 : 0
  const A = f ? asFighter(f.challenger, f.buyer) : null
  const B = f?.champion ? asFighter(f.champion, f.championOwner ?? '') : null

  return (
    <section id="ring" className="place ringside" data-place="ring">
      <FightNight cls="scene on" />
      <div className="place-in grid items-center gap-10 pt-28 lg:grid-cols-[0.9fr_1.1fr]">
        <div data-ring="copy">
          <p className="kicker mb-4 text-[#8eabb6]">{isDemo ? 'Preview · demo fights until $BETTA launches on Pons' : `Live · Robinhood Chain · fight #${fmt(status.ring.total)}`}</p>
          <h1 className="headline text-[clamp(2.8rem,6.4vw,5.6rem)]">
            Every buy is <em>a&nbsp;fight.</em>
          </h1>
          <p className="mt-5 max-w-md text-[1.05rem] leading-relaxed text-[#a9c3cc]">
            Buy $BETTA and a betta drops into the ring. Its breed and name come from your transaction; a bigger buy brings a stronger fish. It fights the champion on the spot.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {BUY_URL ? (
              <a className="btn btn-gold" href={BUY_URL} target="_blank" rel="noopener noreferrer">
                Buy on Pons
              </a>
            ) : (
              <span className="btn btn-gold pointer-events-none opacity-60">Opens on Pons at launch</span>
            )}
            <a className="btn btn-ghost" href="#bell">
              Where the fees go
            </a>
          </div>
          <dl className="mt-9 grid max-w-lg grid-cols-2 gap-4 border-t border-[#173543] pt-5 sm:grid-cols-4">
            <div>
              <dt className="kicker text-[#5d7d89]">Fights</dt>
              <dd className="num mt-1 text-xl">{fmt(status.ring.total)}</dd>
            </div>
            <div>
              <dt className="kicker text-[#5d7d89]">Belt held</dt>
              <dd className="num mt-1 text-xl text-[var(--belt)]">{champ ? `${champ.streak} win${champ.streak === 1 ? '' : 's'}` : '—'}</dd>
            </div>
            <div>
              <dt className="kicker text-[#5d7d89]">In the deep</dt>
              <dd className="num mt-1 text-xl text-[var(--red)]">{pct ? `${fmt(pct, 2)}%` : '0%'}</dd>
            </div>
            <div>
              <dt className="kicker text-[#5d7d89]">Market cap</dt>
              <dd className="num mt-1 text-xl">{status.price?.mcapUsd ? `$${compact(status.price.mcapUsd)}` : '—'}</dd>
            </div>
          </dl>
        </div>

        <div data-ring="stage">
          {f ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-4">
                {[A, B].map((x, k) =>
                  x ? (
                    <div key={k} className={k ? 'text-right' : ''}>
                      <div className="display truncate text-xl font-semibold">
                        {x.name} <span className="num text-sm text-[#8eabb6]">Lv {x.level}</span>
                      </div>
                      <div className="kicker truncate text-[#7d9aa5]">
                        {speciesName(x.speciesId)} · {k ? 'champion' : 'new'} · {me && x.owner === me ? <b className="text-[var(--belt)]">you</b> : short(x.owner)}
                      </div>
                      {battle && (
                        <div className={`hp mt-2 ${k ? 'rotate-180' : ''}`}>
                          <i style={{ width: `${(hp[k] / battle.max[k]) * 100}%`, background: hp[k] / battle.max[k] > 0.3 ? 'var(--color-good)' : 'var(--red)' }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div key={k} className="text-right">
                      <div className="display text-xl text-[#5d7d89]">empty corner</div>
                      <div className="kicker text-[#5d7d89]">no champion yet</div>
                    </div>
                  ),
                )}
              </div>
              <div className="ring-stage aspect-[16/9]">
                {battle && A && B ? (
                  <ArenaView key={`${f.tx}-${round}`} a={{ genome: A.genome }} b={{ genome: B.genome }} battle={battle} playing onStep={setStep} />
                ) : A ? (
                  <TankView key={`${f.tx}-${round}`} fish={{ genome: A.genome, health: 100, hunger: 20, water: 100, sick: false, alive: true }} seed={7} sizeRatio={0.45} />
                ) : null}
                {done && (
                  <div className="rise absolute inset-x-0 top-4 z-[3] text-center">
                    <span className="belt rounded-full px-4 py-1.5 text-sm font-bold shadow-xl">
                      {f.winner === 'walkover' ? `${f.challenger.name} walks into the empty ring` : f.winner === 'challenger' ? `${f.challenger.name} takes the belt` : `${f.champion!.name} keeps the belt · ${f.streak} in a row`}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between gap-4 text-sm text-[#8eabb6]">
                <p className="min-h-[2.6em] flex-1">{cur ? cur.text : battle ? 'Both fish flare…' : `${f.challenger.name} drops in.`}</p>
                <span className="flex shrink-0 items-center gap-3">
                  <a className="num text-xs hover:text-white" href={isDemo ? undefined : txUrl(f.tx)} target="_blank" rel="noopener noreferrer">
                    #{f.n} · {compact(Number(f.tokens) / 1e18)} $BETTA
                  </a>
                  <button className="text-xs font-semibold text-[var(--belt)] hover:underline" onClick={() => openShare(f)}>
                    Share
                  </button>
                </span>
              </div>
            </>
          ) : (
            <div className="ring-stage grid aspect-[16/9] place-items-center text-center text-[#8eabb6]">
              <p className="display text-2xl">The ring is empty. The first buy walks in.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** The band under ringside: the latest fights, scrolling past. */
export function Ticker({ status }: { status: Status }) {
  const items = status.ring.fights.slice(0, 12).map((f) =>
    f.winner === 'walkover'
      ? `#${f.n} ${f.challenger.name} walks in`
      : f.winner === 'challenger'
        ? `#${f.n} ${f.challenger.name} (Lv ${f.challenger.level}) takes the belt from ${f.champion!.name}`
        : `#${f.n} ${f.champion!.name} beats ${f.challenger.name} · ${f.streak} in a row`,
  )
  const line = [...items, `${fmt(status.supply.inTheDeep)} $BETTA in the deep`]
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {[...line, ...line].map((t, i) => (
          <span key={i}>● {t}</span>
        ))}
      </div>
    </div>
  )
}
