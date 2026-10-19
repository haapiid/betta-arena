import { useMemo, useState } from 'react'
import { Crown, Lock, Play, RotateCcw, Swords, Trophy } from 'lucide-react'
import { ArenaView } from './FishCanvas'
import { Coin, countdown, Modal, SectionHead, SYMBOL } from './ui'
import { breedNameOf, effective, imageOf, levelOf, MIN_ENTRY_HEALTH, power } from '../game/fish'
import { speciesById } from '../game/species'
import { traitById } from '../game/traits'
import type { Fighter } from '../game/battle'
import { DEMO, fighterOf, openRound, type Player, type Result } from '../game/store'
import {
  BRACKET, buildField, DIVISIONS, divisionById, divisionFor, endsAt, entriesOpen, FEE, isBye, locksAt, MAX_PLAYER_ENTRIES, MIN_FIELD, NPC_FILL, npcField,
  PERIOD_DAYS, PRIZE_SPLIT, prizesOf, replay, roundAt, roundName, runTournament, type DivisionId, type TournamentResult,
} from '../game/tournament'

interface Actions {
  enter: (slot: number) => Result
  withdraw: (fishId: string) => Result
  runNow: () => Result
}

export function Arena({ p, actions, now, owner }: { p: Player; actions: Actions; now: number; owner: string }) {
  const n = openRound(p, now)
  const firstFish = p.tanks.find((t) => t?.alive)
  const [divId, setDivId] = useState<DivisionId>(firstFish ? divisionFor(levelOf(firstFish)).id : 'rookie')
  const div = divisionById(divId)
  const mineAll = p.entries.filter((e) => e.n === n)
  const mine = mineAll.filter((e) => e.div === divId)

  const field = useMemo(() => {
    const fs: Fighter[] = []
    for (const e of mine) {
      const f = p.tanks.find((t) => t?.id === e.fishId)
      if (f) fs.push(fighterOf(f, owner, e.stake, now))
    }
    return buildField(n, divId, fs)
  }, [n, divId, JSON.stringify(mine), p.tanks, owner, Math.floor(now / 60000)])
  const pot = field.reduce((s, f) => s + f.stake, 0)
  const prizePool = pot - Math.round(pot * FEE)
  const open = entriesOpen(n, now)

  const living = p.tanks.map((f, slot) => ({ f, slot })).filter(({ f }) => f && f.alive && f.sex !== 'female' && !mineAll.some((e) => e.fishId === f.id)) as {
    f: NonNullable<Player['tanks'][number]>
    slot: number
  }[]
  const eligible = living.filter(({ f }) => divisionFor(levelOf(f)).id === divId)
  const elsewhere = living.filter(({ f }) => divisionFor(levelOf(f)).id !== divId)
  const [slot, setSlot] = useState<number | null>(null)
  const chosen = eligible.find((e) => e.slot === slot) ?? eligible[0]

  // results: the player's own, plus the last public round of this division
  const results = useMemo(() => {
    const prev = roundAt(now) - 1
    const list = p.history.filter((r) => r.div === divId)
    if (prev >= 1 && !list.some((r) => r.n === prev)) list.push(runTournament(prev, divId, npcField(prev, divId), endsAt(prev)))
    return list.sort((a, b) => b.n - a.n || b.resolvedAt - a.resolvedAt)
  }, [p.history, divId, Math.floor(now / 60000)])
  const [sel, setSel] = useState(0)
  const res = results[Math.min(sel, results.length - 1)]
  const [watch, setWatch] = useState<{ res: TournamentResult; r: number; i: number } | null>(null)

  return (
    <section id="arena" className="mx-auto max-w-7xl px-4 py-20 sm:px-10 lg:px-16">
      <SectionHead eyebrow={`The arena · every ${PERIOD_DAYS} days`} title={<>Enter your fish. It does the rest.</>}>
        Three divisions by level, up to {BRACKET} fish each, single elimination. Every fish pays the same entry fee and registration closes an hour before the bell. Nobody presses anything: each fight plays out from attack, defense, beauty, traits and how healthy the fish is. After a {Math.round(FEE * 100)}% arena burn the pot pays the top four: {PRIZE_SPLIT[0] * 100}% / {PRIZE_SPLIT[1] * 100}% / {PRIZE_SPLIT[2] * 100}% + {PRIZE_SPLIT[2] * 100}%.
      </SectionHead>

      <div className="mb-6 grid gap-2 sm:grid-cols-3" role="tablist">
        {DIVISIONS.map((d) => {
          const count = mineAll.filter((e) => e.div === d.id).length
          return (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === divId}
              onClick={() => (setDivId(d.id), setSel(0), setSlot(null))}
              className={`rounded-2xl px-5 py-4 text-left ring-1 transition-colors ${d.id === divId ? 'bg-gold/10 ring-gold' : 'ring-line-soft hover:ring-line'}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="display text-xl font-semibold">{d.name}</span>
                {count > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[0.68rem] font-bold text-black">{count} entered</span>}
              </div>
              <div className="text-xs text-dim">
                Level {d.min}–{d.max} · entry fee <span className="num">{d.fee}</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="card relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gold/10 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow">
                Round #{n} · {div.name} · {open ? 'open' : 'locked'}
              </div>
              <div className="display mt-1 text-4xl font-semibold sm:text-5xl">
                <span className="num text-[0.8em]">{countdown(endsAt(n) - now)}</span>
              </div>
              <div className="mt-1 text-sm text-dim">
                until the bell ·{' '}
                {open ? (
                  <>
                    registration closes in <span className="num">{countdown(locksAt(n) - now)}</span>
                  </>
                ) : (
                  'registration closed'
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="eyebrow">{div.name} pot</div>
              <div className="display mt-1 text-3xl font-semibold text-gold">
                <Coin n={pot} />
              </div>
              <div className="mt-1 text-xs text-dim">
                1st <Coin n={Math.floor(prizePool * PRIZE_SPLIT[0])} /> · 2nd <Coin n={Math.floor(prizePool * PRIZE_SPLIT[1])} /> · semis{' '}
                <Coin n={Math.floor(prizePool * PRIZE_SPLIT[2])} />
              </div>
            </div>
          </div>

          <div className="my-6 h-px bg-line-soft" />

          {!open ? (
            <p className="flex items-start gap-2 text-sm text-dim">
              <Lock size={15} className="mt-0.5 shrink-0 text-gold" />
              Registration for round #{n} is closed and the bracket is locked: no new entries, no withdrawals. Round #{n + 1} opens as soon as the bell rings.
            </p>
          ) : eligible.length > 0 && mineAll.length < MAX_PLAYER_ENTRIES ? (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (chosen) actions.enter(chosen.slot)
              }}
            >
              <div>
                <label className="eyebrow mb-2 block">Your fighter</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {eligible.map(({ f, slot: s }) => {
                    const weak = f.health < MIN_ENTRY_HEALTH
                    const on = chosen?.slot === s
                    const eff = effective(f, now)
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => setSlot(s)}
                        className={`rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${on ? 'bg-gold/10 ring-gold' : 'ring-line hover:ring-dim'}`}
                      >
                        <div className="font-semibold">
                          {f.name} <span className="num text-xs text-gold">Lv {levelOf(f)}</span>
                        </div>
                        <div className="text-xs text-dim">
                          {breedNameOf(f)} · power <span className="num">{power({ ...eff, health: f.health, traits: f.traits })}</span>
                        </div>
                        {weak && <div className="mt-1 text-xs text-bad">too weak · heal first</div>}
                        {f.sick && !weak && <div className="mt-1 text-xs text-warn">sick · fights at −25% attack</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-xs text-faint">
                You can withdraw for a full refund until registration closes. After that the entry is locked{!NPC_FILL && `, and a division with fewer than ${MIN_FIELD} fish is called off with fees refunded`}.
              </p>
              <button className="btn btn-coral w-full sm:w-auto sm:justify-self-start" disabled={!chosen || chosen.f.health < MIN_ENTRY_HEALTH || div.fee > p.balance}>
                <Swords size={16} /> Enter {chosen?.f.name ?? ''} · fee <span className="num">{div.fee}</span> ${SYMBOL}
              </button>
            </form>
          ) : (
            <p className="text-sm text-dim">
              {mineAll.length >= MAX_PLAYER_ENTRIES
                ? 'You have the maximum of 3 fish in this round.'
                : elsewhere.length
                  ? `None of your free fish are level ${div.min}–${div.max}. ${elsewhere.map(({ f }) => `${f.name} (Lv ${levelOf(f)}) fights in ${divisionFor(levelOf(f)).name}`).join('; ')}.`
                  : p.tanks.some((t) => t?.alive && t.sex === 'male')
                    ? 'All your males are already entered.'
                    : p.tanks.some((t) => t?.alive)
                    ? 'Only males (♂) fight. Your females stay home to breed.'
                    : 'You need a living betta to enter. Buy one in the shop.'}
            </p>
          )}

          {mineAll.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-2">Your entries this round</div>
              <div className="grid gap-2">
                {mineAll.map((e) => {
                  const f = p.tanks.find((t) => t?.id === e.fishId)
                  return (
                    <div key={e.fishId} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-line-soft">
                      <span>
                        <span className="font-semibold">{f?.name ?? 'Gone'}</span> <span className="text-sm text-dim">· {divisionById(e.div).name} · fee</span>{' '}
                        <Coin n={e.stake} className="text-sm" />
                      </span>
                      {open ? (
                        <button className="text-xs text-faint hover:text-text" onClick={() => actions.withdraw(e.fishId)}>
                          Withdraw
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-faint">
                          <Lock size={11} /> locked
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {DEMO && (
                <button className="btn btn-gold mt-4" onClick={() => actions.runNow()}>
                  <Play size={15} /> Demo: ring the bell now
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card p-5 sm:p-7">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="eyebrow">
              {div.name} field · {field.length} fish{field.length < MIN_FIELD && ` · needs ${MIN_FIELD}`}
            </div>
            <div className="text-xs text-faint">sorted by power</div>
          </div>
          <ol className="grid gap-1">
            {[...field]
              .sort((a, b) => power(b) - power(a))
              .map((f, i) => (
                <li key={f.id} className={`grid grid-cols-[22px_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-sm ${f.mine ? 'bg-gold/10 ring-1 ring-gold/50' : ''}`}>
                  <span className="num text-xs text-faint">{i + 1}</span>
                  <span className="min-w-0 truncate">
                    <span className={f.mine ? 'font-semibold text-gold' : 'font-medium'}>{f.name}</span> <span className="num text-xs text-faint">Lv{f.level}</span>{' '}
                    <span className="text-dim">
                      · {speciesById(f.speciesId).name} · {f.mine ? 'you' : f.owner}
                    </span>
                  </span>
                  <span className="num text-xs text-dim">
                    <span className="text-text">{power(f)}</span> pw
                  </span>
                </li>
              ))}
          </ol>
        </div>
      </div>

      {res && (
        <div className="mt-14">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="eyebrow mr-2">{div.name} results</div>
            {results.slice(0, 8).map((r, i) => (
              <button key={`${r.n}-${r.resolvedAt}`} onClick={() => setSel(i)} className={`btn btn-sm ${i === sel ? 'btn-gold' : 'btn-ghost'}`}>
                #{r.n}
                {r.myStake > 0 && (r.fighters[r.champion].mine ? ' 🏆' : r.myPayout > 0 ? ' 🥈' : ' · you')}
              </button>
            ))}
          </div>
          <ResultView res={res} onWatch={(r, i) => setWatch({ res, r, i })} />
        </div>
      )}

      <Modal open={!!watch} onClose={() => setWatch(null)} title={watch ? `${roundName(watch.r, watch.res.rounds.length)} · ${divisionById(watch.res.div).name} #${watch.res.n}` : ''} wide>
        {watch && <Replay res={watch.res} r={watch.r} i={watch.i} />}
      </Modal>
    </section>
  )
}

const PLACE = ['', '1st', '2nd', 'semifinal']

function ResultView({ res, onWatch }: { res: TournamentResult; onWatch: (r: number, i: number) => void }) {
  const champ = res.fighters[res.champion]
  const sp = speciesById(champ.speciesId)
  const prizes = prizesOf(res)
  const last = res.rounds.length - 1
  return (
    <div>
      <div className={`card mb-6 flex flex-wrap items-center gap-5 p-5 sm:p-6 ${champ.mine ? 'ring-1 ring-gold' : ''}`}>
        <div className="grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
          <Trophy size={26} />
        </div>
        <div className="flex-1">
          <div className="eyebrow">
            Round #{res.n} {divisionById(res.div).name} champion
          </div>
          <div className="display text-3xl font-semibold">
            {champ.name} <span className="text-lg text-dim">· Lv {champ.level} {sp.name}</span>
          </div>
          <div className="text-sm text-dim">owned by {champ.mine ? 'you' : champ.owner}</div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Took home</div>
          <div className="display text-3xl font-semibold text-gold">
            <Coin n={prizes[0].amount} />
          </div>
          <div className="text-xs text-faint">
            pot {res.pot} · burned {res.fee}
            {res.myStake > 0 && <> · your fees {res.myStake}</>}
          </div>
        </div>
      </div>

      {prizes.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {prizes.map((pz) => {
            const f = res.fighters[pz.fighter]
            return (
              <span key={pz.fighter} className={`rounded-full px-3 py-1 text-xs ring-1 ${f.mine ? 'text-gold ring-gold/60' : 'text-dim ring-line-soft'}`}>
                {PLACE[pz.place]} · <span className="font-semibold">{f.name}</span> ({f.mine ? 'you' : f.owner}) · <Coin n={pz.amount} />
              </span>
            )
          })}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${res.rounds.length}, minmax(200px, 1fr))` }}>
          {res.rounds.map((ms, r) => (
            <div key={r} className="flex flex-col">
              <div className="eyebrow mb-3">{roundName(r, res.rounds.length)}</div>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {ms.map((m, i) => {
                  const A = res.fighters[m.a]
                  if (isBye(m))
                    return (
                      <div key={i} className="rounded-xl p-2 text-[0.8rem] ring-1 ring-line-soft">
                        <div className="truncate px-1 py-0.5">
                          <span className={A.mine ? 'font-semibold text-gold' : 'font-medium'}>{A.name}</span>
                          <span className="ml-1 text-[0.7rem] text-faint">
                            Lv{A.level} · {A.mine ? 'you' : A.owner}
                          </span>
                        </div>
                        <div className="px-1 py-0.5 text-faint italic">bye, goes through</div>
                      </div>
                    )
                  const B = res.fighters[m.b]
                  return (
                    <button
                      key={i}
                      onClick={() => onWatch(r, i)}
                      className={`group rounded-xl p-2 text-left text-[0.8rem] ring-1 transition-colors hover:bg-white/[0.04] ${A.mine || B.mine ? 'ring-gold/60' : 'ring-line-soft'}`}
                    >
                      {[A, B].map((f, k) => {
                        const won = (k === 0 ? m.a : m.b) === m.winner
                        return (
                          <div key={k} className={`flex items-center justify-between gap-2 px-1 py-0.5 ${won ? 'text-text' : 'text-faint line-through decoration-faint/40'}`}>
                            <span className="truncate">
                              {won && r === last && <Crown size={11} className="mr-1 inline text-gold" />}
                              <span className={f.mine ? 'font-semibold text-gold' : won ? 'font-medium' : ''}>{f.name}</span>
                              <span className="ml-1 text-[0.7rem] text-faint">
                                Lv{f.level} · {f.mine ? 'you' : f.owner}
                              </span>
                            </span>
                          </div>
                        )
                      })}
                      <div className="mt-1 flex items-center gap-1 px-1 text-[0.68rem] text-faint group-hover:text-dim">
                        <Play size={10} /> watch
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Replay({ res, r, i }: { res: TournamentResult; r: number; i: number }) {
  const battle = useMemo(() => replay(res, r, i), [res, r, i])
  const m = res.rounds[r][i]
  const A = res.fighters[m.a]
  const B = res.fighters[m.b]
  const [step, setStep] = useState(-1)
  const [key, setKey] = useState(0)
  const n = battle.events.length
  const cur = step >= 0 ? battle.events[Math.min(n - 1, step)] : null
  const hp = cur ? cur.hp : battle.start
  const done = step >= n
  const winner = battle.winner === 0 ? A : B

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-4">
        {[A, B].map((f, k) => (
          <div key={k} className={k === 1 ? 'text-right' : ''}>
            <div className={`display truncate text-xl font-semibold ${f.mine ? 'text-gold' : ''}`}>
              {f.name} <span className="num text-sm text-dim">Lv {f.level}</span>
            </div>
            <div className="truncate text-xs text-dim">
              {speciesById(f.speciesId).name} · {f.mine ? 'you' : f.owner} ·{' '}
              <span className="num">
                {f.attack}/{f.defense}/{f.beauty}
              </span>
              {f.sick && <span className="text-warn"> · sick</span>}
            </div>
            <div className="truncate text-xs text-faint">{f.traits.map((t) => traitById(t)?.icon + ' ' + traitById(t)?.name).join(' · ') || 'no traits'}</div>
            <div className={`bar mt-2 !h-2 ${k === 1 ? 'rotate-180' : ''}`}>
              <i style={{ width: `${(hp[k] / battle.max[k]) * 100}%`, background: hp[k] / battle.max[k] > 0.3 ? 'var(--color-good)' : 'var(--color-bad)' }} />
            </div>
            <div className="num mt-1 text-xs text-faint">
              {hp[k]}/{battle.max[k]}
            </div>
          </div>
        ))}
      </div>
      <div className="jar aspect-[16/8] w-full !rounded-2xl">
        <ArenaView
          key={key}
          a={{ genome: A.genome, image: imageOf(A), size: A.size }}
          b={{ genome: B.genome, image: imageOf(B), size: B.size }}
          battle={battle}
          playing
          onStep={setStep}
        />
        {done && (
          <div className="rise absolute inset-x-0 top-4 z-[3] text-center">
            <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-gold backdrop-blur">
              {winner.name} wins {battle.decision === 'ko' ? 'by knockout' : "on the judges' call"}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-h-[2.6em] flex-1 text-sm text-dim">{done ? `${winner.name} advances.` : cur ? cur.text : 'Both fish flare...'}</p>
        <button className="btn btn-ghost btn-sm" onClick={() => (setStep(-1), setKey((k) => k + 1))}>
          <RotateCcw size={13} /> Replay
        </button>
      </div>
    </div>
  )
}
