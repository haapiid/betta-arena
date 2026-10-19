import { useState } from 'react'
import { Droplets, Dumbbell, Pencil, Skull, Sparkles, Swords, Utensils, Zap } from 'lucide-react'
import { TankView, type CareAct } from './FishCanvas'
import { Coin, Confirm, countdown, Meter, meterColor, Modal, RarityTag, SectionHead, StatChips } from './ui'
import {
  activeBuffs, ageLabel, canRush, canTrain, rushCost, DAILY_XP_CAP, daysLeft, effective, levelInfo, MAX_LEVEL, pendingTraits, power, stageOf, trainReadyIn,
  breedNameOf, imageOf, RUSH_PER_HOUR, TRAININGS, xpLeftToday, type Fish,
} from '../game/fish'
import { ITEMS, KIND_LABEL, type ItemKind } from '../game/items'
import { speciesById } from '../game/species'
import { traitById, traitOptions, TRAIT_EVERY } from '../game/traits'
import { MAX_BREEDS } from '../game/breeding'
import { BreedPanel, SexMark, SpawnCard } from './Breeding'
import { divisionFor } from '../game/tournament'
import type { Entry, Player, Result } from '../game/store'

interface Actions {
  useItem: (slot: number, id: string) => Result
  train: (slot: number, id: string) => Result
  rushTrain: (slot: number, id: string, quoted: number) => Result
  buyPack: (id: string, pack: number, feedSlot?: number) => Result
  pickTrait: (slot: number, id: string) => Result
  emptyTank: (slot: number) => Result
  rename: (slot: number, name: string) => Result
  startBreeding: (maleSlot: number, femaleSlot: number) => Result
  keepFry: (index: number) => Result
  abandonSpawn: () => Result
  hatchNow: () => Result
}

const FOODS = ['pellet', 'daphnia', 'bloodworm']

const STAGE_TONE: Record<string, string> = {
  juvenile: 'text-teal',
  adult: 'text-text',
  prime: 'text-gold',
  senior: 'text-dim',
}

export function Jars({ p, actions, now }: { p: Player; actions: Actions; now: number }) {
  const [care, setCare] = useState<number | null>(null)
  const [traitSlot, setTraitSlot] = useState<number | null>(null)
  // the last care action per jar, played as an animation in the glass
  const [acts, setActs] = useState<CareAct[]>([0, 1, 2].map(() => ({ n: 0, id: '' })))
  const play = (slot: number, id: string, r: Result) => {
    if (r.ok) setActs((l) => l.map((a, i) => (i === slot ? { n: a.n + 1, id } : a)))
    return r
  }

  const use = (slot: number, id: string) => play(slot, id, actions.useItem(slot, id))
  const buyPackAndFeed = (slot: number, id: string) => play(slot, id, actions.buyPack(id, 0, slot))
  const foodLeft = FOODS.reduce((s, f) => s + (p.inventory[f] ?? 0), 0)
  const quickFeed = (slot: number) => use(slot, FOODS.find((f) => (p.inventory[f] ?? 0) > 0) ?? 'pellet')
  const careFish = care !== null ? p.tanks[care] : null
  const traitFish = traitSlot !== null ? p.tanks[traitSlot] : null

  return (
    <section id="jars" className="mx-auto max-w-7xl px-4 py-20 sm:px-10 lg:px-16">
      <SectionHead eyebrow="Your shelf · 3 jars max" title={<>Keep them fed. Train them. Breed them.</>}>
        Hunger and dirty water build up in real time, even while you are away. A healthy fish earns XP on its own every hour, and more from training and fights. Every level grows its stats the way its breed grows.
      </SectionHead>

      <div className="grid gap-x-6 gap-y-12 md:grid-cols-3">
        {p.tanks.map((f, slot) =>
          p.breeding && p.breeding.slot === slot ? (
            <SpawnCard key={slot} b={p.breeding} now={now} onKeep={actions.keepFry} onAbandon={actions.abandonSpawn} onHatch={actions.hatchNow} />
          ) : (
          <TankCard
            key={slot}
            slot={slot}
            fish={f}
            entry={f ? p.entries.find((e) => e.fishId === f.id) : undefined}
            now={now}
            act={acts[slot]}
            onFeed={() => quickFeed(slot)}
            onWater={() => use(slot, 'water')}
            onCare={() => setCare(slot)}
            onTrait={() => setTraitSlot(slot)}
            onEmpty={() => {
              if (f?.alive && !window.confirm(`Release ${f.name}? You will not get the coins back.`)) return
              actions.emptyTank(slot)
            }}
            onRename={(n) => actions.rename(slot, n)}
            foodLeft={foodLeft}
          />
          ),
        )}
      </div>

      <BreedPanel p={p} now={now} onStart={actions.startBreeding} />

      {p.graves.length > 0 && (
        <div className="mt-12">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <Skull size={13} /> In memory
          </div>
          <div className="flex flex-wrap gap-2">
            {p.graves.slice(0, 10).map((g, i) => (
              <span key={i} className="rounded-full border border-line-soft px-3 py-1 text-xs text-dim">
                {g.name}{' '}
                <span className="text-faint">
                  · Lv {g.level ?? 1} {speciesById(g.speciesId).name} · {g.cause}
                  {g.wins ? ` · ${g.wins}W` : ''}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!careFish} onClose={() => setCare(null)} title={careFish ? `Care for ${careFish.name}` : ''}>
        {careFish && care !== null && <CarePanel fish={careFish} p={p} now={now} act={acts[care]} onUse={(id) => use(care, id)} onTrain={(id) => play(care, id, actions.train(care, id))} onRush={(id, cost) => play(care, id, actions.rushTrain(care, id, cost))} onPack={(id) => buyPackAndFeed(care, id)} />}
      </Modal>

      <Modal open={!!traitFish && pendingTraits(traitFish) > 0} onClose={() => setTraitSlot(null)} title={traitFish ? `${traitFish.name} learns a trait` : ''}>
        {traitFish && traitSlot !== null && (
          <div>
            <p className="mb-4 text-sm text-dim">Pick one. Traits are permanent and change how the fish fights. A new pick unlocks every {TRAIT_EVERY} levels.</p>
            <div className="grid gap-2">
              {traitOptions(traitFish.id, traitFish.traits).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (actions.pickTrait(traitSlot, t.id).ok) setTraitSlot(null)
                  }}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 text-left ring-1 ring-line transition-colors hover:bg-gold/10 hover:ring-gold"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {t.icon}
                  </span>
                  <span>
                    <span className="display block text-lg font-semibold">{t.name}</span>
                    <span className="text-sm text-dim">{t.note}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function TankCard({
  slot,
  fish,
  entry,
  now,
  act,
  onFeed,
  onWater,
  onCare,
  onTrait,
  onEmpty,
  onRename,
  foodLeft,
}: {
  foodLeft: number
  slot: number
  fish: Fish | null
  entry?: Entry
  now: number
  act: CareAct
  onFeed: () => void
  onWater: () => void
  onCare: () => void
  onTrait: () => void
  onEmpty: () => void
  onRename: (n: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const sp = fish ? speciesById(fish.speciesId) : null
  const stage = fish ? stageOf(fish, now) : null
  const lv = fish ? levelInfo(fish.xp) : null
  const eff = fish ? effective(fish, now) : null
  const pending = fish?.alive ? pendingTraits(fish) : 0

  return (
    <article className="flex flex-col">
      <div className="jar-glass aspect-square w-full">
        <TankView glass sizeRatio={0.55} fish={fish ? { ...fish, image: imageOf(fish), size: stage?.size } : null} seed={slot * 31 + 7} act={act} />
        <div className="absolute left-3 top-3 z-[3] rounded-full bg-black/40 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-white/80 backdrop-blur">
          JAR {slot + 1}
        </div>
        {fish?.alive && fish.sick && (
          <div className="absolute right-3 top-3 z-[3] rounded-full bg-bad/90 px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.1em] text-black">SICK</div>
        )}
        {entry && (
          <div className="absolute bottom-3 left-3 z-[3] flex items-center gap-1.5 rounded-full bg-gold/95 px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-black">
            <Swords size={12} /> #{entry.n} {entry.div.toUpperCase()} · {entry.stake}
          </div>
        )}
        {!fish && (
          <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 pt-[10%] text-center">
            <p className="display text-xl text-white/85">Empty jar</p>
            <a href="#shop" className="btn btn-gold btn-sm">
              Buy a betta
            </a>
          </div>
        )}
        {fish && !fish.alive && (
          <div className="absolute inset-x-0 bottom-0 z-[3] rounded-b-2xl bg-gradient-to-t from-black/85 to-transparent p-4 pt-14 text-center">
            <p className="display text-lg text-white">{fish.name} died</p>
            <p className="mb-3 text-xs text-white/70">
              Cause: {fish.cause} · reached level {lv!.level}
            </p>
            <button className="btn btn-ghost btn-sm !bg-black/40" onClick={onEmpty}>
              Bury &amp; empty the jar
            </button>
          </div>
        )}
      </div>

      {fish && sp && stage && lv && eff && (
        <div className="px-1 pt-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <RarityTag r={sp.rarity} />
            <span className="text-[0.72rem] text-faint">
              <span className={`font-semibold ${STAGE_TONE[stage.id]}`}>{stage.name}</span> · {ageLabel(fish, now)}
            </span>
          </div>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onRename(new FormData(e.currentTarget).get('n') as string)
                setEditing(false)
              }}
            >
              <input name="n" defaultValue={fish.name} maxLength={18} autoFocus onBlur={(e) => (onRename(e.target.value), setEditing(false))} className="input display w-full text-2xl" />
            </form>
          ) : (
            <h3 className="display flex items-center gap-2 text-2xl font-semibold">
              {fish.name}
              <SexMark sex={fish.sex} />
              <span className="num rounded-md bg-gold/15 px-1.5 py-0.5 text-sm font-semibold text-gold">Lv {lv.level}</span>
              {fish.gen > 1 && <span className="num rounded-md bg-white/[0.06] px-1.5 py-0.5 text-sm text-dim">G{fish.gen}</span>}
              {fish.alive && (
                <button onClick={() => setEditing(true)} className="text-faint hover:text-text" aria-label="Rename">
                  <Pencil size={14} />
                </button>
              )}
            </h3>
          )}
          <p className="text-sm text-dim">
            {breedNameOf(fish)}
            {fish.mutation && <span className="ml-1.5 rounded bg-[#c38bff]/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-[#d9b8ff]">✦ {fish.mutation}</span>} ·{' '}
            {fish.sex === 'male' ? (
              <>
                <span className="num">
                  {fish.wins}W {fish.losses}L
                </span>{' '}
                · power <span className="num text-text">{power({ ...eff, health: fish.health, traits: fish.traits })}</span>
              </>
            ) : (
              <span className="text-[#ff9ec7]">breeder, does not fight</span>
            )}
          </p>
          <p className="mb-4 text-xs text-faint">
            {fish.parents ? `${fish.parents[0]} × ${fish.parents[1]} · ` : ''}bred {fish.breeds}/{MAX_BREEDS}
            {fish.restUntil > now && ` · resting ${countdown(fish.restUntil - now)}`}
          </p>

          {fish.alive && (
            <>
              {/* XP */}
              <div className="mb-4">
                <div className="mb-1 flex items-baseline justify-between text-[0.72rem]">
                  <span className="text-dim">
                    XP · <span className="text-text">{divisionFor(lv.level).name}</span> division
                  </span>
                  <span className="num text-text">
                    {lv.need ? `${Math.floor(lv.into)}/${lv.need}` : `max (Lv ${MAX_LEVEL})`}
                    <span className="ml-1.5 text-faint">
                      today {DAILY_XP_CAP - xpLeftToday(fish, now)}/{DAILY_XP_CAP}
                    </span>
                  </span>
                </div>
                <div className="bar">
                  <i style={{ width: `${lv.need ? (lv.into / lv.need) * 100 : 100}%`, background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-soft))' }} />
                </div>
              </div>

              <div className="mb-4 grid gap-2.5">
                <Meter label="Health" value={fish.health} color={meterColor(fish.health)} hint={fish.health <= 60 ? 'no XP' : undefined} />
                <Meter label="Fullness" value={100 - fish.hunger} color={meterColor(100 - fish.hunger)} hint={fish.hunger > 75 ? 'hungry' : undefined} />
                <Meter label="Water" value={fish.water} color={meterColor(fish.water)} hint={fish.water < 35 ? 'murky' : undefined} />
              </div>
              <StatChips attack={eff.attack} defense={eff.defense} beauty={eff.beauty} buff={eff.buff} />

              {(fish.traits.length > 0 || pending > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {fish.traits.map((id) => {
                    const t = traitById(id)
                    return t ? (
                      <span key={id} title={t.note} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[0.72rem] ring-1 ring-line-soft">
                        {t.icon} {t.name}
                      </span>
                    ) : null
                  })}
                  {pending > 0 && (
                    <button onClick={onTrait} className="btn btn-gold btn-sm !py-1 text-[0.72rem]">
                      <Sparkles size={12} /> Pick a trait
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button className="btn btn-ghost btn-sm" onClick={onFeed}>
                  <Utensils size={14} /> Feed
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onWater}>
                  <Droplets size={14} /> Water
                </button>
                <button className="btn btn-gold btn-sm" onClick={onCare}>
                  <Dumbbell size={14} /> Train
                </button>
              </div>
              <div className="mt-3 flex justify-between text-xs text-faint">
                <span>
                  {Math.ceil(daysLeft(fish, now))} days of life left ·{' '}
                  {foodLeft ? (
                    <>{foodLeft} food portions</>
                  ) : (
                    <a href="#shop" className="text-bad hover:underline">
                      out of food
                    </a>
                  )}
                </span>
                <button className="hover:text-dim" onClick={onEmpty}>
                  Release
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

function CarePanel({
  fish,
  p,
  now,
  act,
  onUse,
  onTrain,
  onRush,
  onPack,
}: {
  fish: Fish
  p: Player
  now: number
  act: CareAct
  onUse: (id: string) => Result
  onTrain: (id: string) => Result
  onRush: (id: string, cost: number) => Result
  onPack: (id: string) => Result
}) {
  // the price is locked when the dialog opens, so the player pays what they agreed to
  const [rush, setRush] = useState<{ id: string; cost: number } | null>(null)
  const cost = rushCost(fish, now)
  const rushWhy = canRush(fish, now)
  const rushing = rush ? TRAININGS.find((t) => t.id === rush.id) : null
  const sp = speciesById(fish.speciesId)
  const eff = effective(fish, now)
  const lv = levelInfo(fish.xp)
  const kinds: ItemKind[] = ['food', 'care', 'medicine', 'boost', 'growth']
  const wait = trainReadyIn(fish, now)
  const why = canTrain(fish, now)
  const buffs = activeBuffs(fish, now)
  return (
    <div>
      <div className="mb-5 grid grid-cols-[140px_1fr] gap-4 sm:grid-cols-[210px_1fr]">
        <div className="jar-glass aspect-square self-center">
          <TankView glass sizeRatio={0.55} fish={{ ...fish, image: imageOf(fish), size: stageOf(fish, now).size }} seed={13} act={act} />
        </div>
        <div className="grid content-center gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="display text-lg font-semibold">Lv {lv.level}</span>
            <span className="num text-xs text-dim">{lv.need ? `${Math.floor(lv.into)}/${lv.need} XP` : 'max level'}</span>
          </div>
          <Meter label="Health" value={fish.health} color={meterColor(fish.health)} hint={fish.sick ? 'sick' : undefined} />
          <Meter label="Fullness" value={100 - fish.hunger} color={meterColor(100 - fish.hunger)} />
          <Meter label="Water" value={fish.water} color={meterColor(fish.water)} />
          <div className="mt-1">
            <StatChips attack={eff.attack} defense={eff.defense} beauty={eff.beauty} buff={eff.buff} />
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="eyebrow mb-2 flex justify-between">
          <span>Training · free</span>
          <span className="normal-case tracking-normal">
            XP today {DAILY_XP_CAP - xpLeftToday(fish, now)}/{DAILY_XP_CAP}
          </span>
        </div>
        <div className="grid gap-1.5">
          {TRAININGS.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2 ring-1 ring-line-soft">
              <span className="text-lg" aria-hidden="true">
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {t.name} <span className="num ml-1 text-xs text-gold">+{t.xp} XP</span>
                </div>
                <div className="text-xs text-dim">{t.note}</div>
              </div>
              {wait > 0 ? (
                <div className="flex flex-col items-end gap-1">
                  <button
                    className="btn btn-coral btn-sm"
                    onClick={() => setRush({ id: t.id, cost })}
                    disabled={!!rushWhy || p.balance < cost}
                    title={rushWhy ?? (p.balance < cost ? `Need ${cost} coins` : `Skip the wait for ${cost} coins`)}
                  >
                    <Zap size={13} /> Rush · <span className="num">{cost}</span>
                  </button>
                  <span className="num text-[0.68rem] text-faint">or wait {countdown(wait)}</span>
                </div>
              ) : (
                <button className="btn btn-gold btn-sm" onClick={() => onTrain(t.id)} disabled={!!why} title={why ?? ''}>
                  Train
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          {wait > 0
            ? rushWhy ?? `Resting. Wait it out for free, or rush it for ${RUSH_PER_HOUR} coins per hour left.`
            : why ?? 'One session every 8 hours. XP only counts while health is above 60.'}
        </p>
      </div>

      <Confirm
        open={!!rush && !!rushing}
        title="Boost training with coins?"
        confirmLabel={
          <>
            <Zap size={13} /> Yes, pay {rush?.cost} coins
          </>
        }
        onCancel={() => setRush(null)}
        onConfirm={() => {
          if (rush) onRush(rush.id, rush.cost)
          setRush(null)
        }}
      >
        {rush && rushing && (
          <>
            Are you sure you want to boost <b className="text-text">{fish.name}</b>'s training with{' '}
            <b className="text-gold">
              {rush.cost} coins
            </b>
            ? This skips the remaining <span className="num text-text">{countdown(wait)}</span> and starts{' '}
            <b className="text-text">{rushing.name}</b> now (+{Math.min(rushing.xp, xpLeftToday(fish, now))} XP).
            <span className="mt-3 block text-xs text-faint">
              Balance after: <Coin n={p.balance - rush.cost} />. Waiting is free.
            </span>
          </>
        )}
      </Confirm>

      {kinds.map((k) => (
        <div key={k} className="mb-4">
          <div className="eyebrow mb-2 flex justify-between">
            <span>{KIND_LABEL[k]}</span>
            {k === 'boost' && buffs.length > 0 && (
              <span className="normal-case tracking-normal text-good">
                {buffs.map((b) => `${b.stat} +${b.amount} · ${countdown(b.until - now)}`).join(' · ')}
              </span>
            )}
          </div>
          <div className="grid gap-1.5">
            {ITEMS.filter((i) => i.kind === k).map((it) => {
              const have = p.inventory[it.id] ?? 0
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-xl bg-white/[0.025] px-3 py-2 ring-1 ring-line-soft">
                  <span className="text-lg" aria-hidden="true">
                    {it.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {it.name}{' '}
                      {it.packs ? (
                        <span className={`num ml-1 text-xs ${have ? 'text-teal' : 'text-bad'}`}>{have ? `${have} portions` : 'out'}</span>
                      ) : (
                        have > 0 && <span className="num ml-1 text-xs text-teal">×{have}</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-dim">{it.note}</div>
                  </div>
                  {!have && it.packs ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => onPack(it.id)}>
                      Buy {it.packs[0].qty} &amp; feed · <span className="num">{it.packs[0].price}</span>
                    </button>
                  ) : (
                    <button className={`btn btn-sm ${have ? 'btn-gold' : 'btn-ghost'}`} onClick={() => onUse(it.id)}>
                      {have ? (it.kind === 'food' ? 'Feed' : 'Use') : <>Buy &amp; use · <span className="num">{it.price}</span></>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-faint">
        Balance: <Coin n={p.balance} />
      </p>
    </div>
  )
}
