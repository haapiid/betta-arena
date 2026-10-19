import { useState } from 'react'
import { Egg, Heart, Sparkles } from 'lucide-react'
import { Portrait, TankView } from './FishCanvas'
import { Coin, Confirm, countdown, Modal, StatChips } from './ui'
import { breedNameOf, levelOf, type Fish, type Sex } from '../game/fish'
import {
  BREED_BURN, BREED_FEE, BREED_HEALTH_COST, BREED_MIN_HEALTH, BREED_MIN_LEVEL, BREED_REST, cannotBreed, forecast, INHERIT_TRAIT_CHANCE, MAX_BREEDS,
  HYBRIDS, MUTATION_CHANCE, phaseEnds, phaseOf, type Breeding,
} from '../game/breeding'
import { traitById } from '../game/traits'
import { freeSlot, type Player, type Result } from '../game/store'

export function SexMark({ sex, className = '' }: { sex: Sex; className?: string }) {
  return (
    <span className={`text-lg font-semibold ${sex === 'male' ? 'text-[#7fb4ff]' : 'text-[#ff9ec7]'} ${className}`} title={sex === 'male' ? 'Male' : 'Female'}>
      {sex === 'male' ? '♂' : '♀'}
    </span>
  )
}

const HYBRID_FORMS: string[] = Object.keys(HYBRIDS)

const PHASE_TEXT = {
  spawning: { title: 'Spawning', note: 'The male is building a bubble nest and courting the female.' },
  eggs: { title: 'Eggs in the nest', note: 'The male guards the eggs and puts back any that fall.' },
  fry: { title: 'The fry have hatched', note: 'Pick one to raise. The others are released.' },
}

// the jar used as the spawning tank
export function SpawnCard({
  b,
  now,
  onKeep,
  onAbandon,
}: {
  b: Breeding
  now: number
  onKeep: (i: number) => Promise<Result>
  onAbandon: () => Promise<Result>
}) {
  const phase = phaseOf(b, now)
  const ends = phaseEnds(b)
  const [pick, setPick] = useState(false)
  const [keep, setKeep] = useState<number | null>(null)
  const text = PHASE_TEXT[phase]
  const left = phase === 'spawning' ? ends.spawning - now : phase === 'eggs' ? ends.eggs - now : 0

  return (
    <article className="flex flex-col">
      <div className="jar-glass aspect-square w-full">
        <TankView glass fish={null} seed={b.slot * 31 + 7} spawn={phase} />
        <div className="absolute left-3 top-3 z-[3] rounded-full bg-[#ff9ec7]/90 px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.12em] text-black">
          JAR {b.slot + 1} · SPAWNING
        </div>
        {phase === 'fry' && (
          <div className="absolute inset-x-0 bottom-6 z-[3] flex justify-center">
            <button className="btn btn-gold" onClick={() => setPick(true)}>
              <Sparkles size={15} /> Choose your fry
            </button>
          </div>
        )}
      </div>
      <div className="px-1 pt-5">
        <div className="eyebrow mb-1 flex items-center gap-1.5">
          <Egg size={13} /> {text.title}
        </div>
        <h3 className="display text-2xl font-semibold">
          {b.father} <span className="text-[#7fb4ff]">♂</span> × {b.mother} <span className="text-[#ff9ec7]">♀</span>
        </h3>
        <p className="mt-1 text-sm text-dim">{text.note}</p>
        {left > 0 && (
          <p className="mt-3 text-sm">
            {phase === 'spawning' ? 'Eggs in' : 'Hatching in'} <span className="num text-gold">{countdown(left)}</span>
          </p>
        )}
        <div className="mt-4 flex items-center justify-between text-xs text-faint">
          <span />
          <button className="hover:text-dim" onClick={() => window.confirm('Empty the spawning jar? The eggs are lost and the fee is not refunded.') && onAbandon()}>
            Abandon spawn
          </button>
        </div>
      </div>

      <Modal open={pick && phase === 'fry'} onClose={() => setPick(false)} title="Choose one fry to raise" wide>
        <p className="mb-5 text-sm text-dim">
          All three are {b.father} × {b.mother}. The one you keep starts as a level-1 juvenile in jar {b.slot + 1}; the other two are released.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {b.fry.map((f, i) => (
            <FryCard key={i} f={f} onKeep={() => setKeep(i)} />
          ))}
        </div>
      </Modal>

      <Confirm
        open={keep !== null}
        title={`Keep ${keep !== null ? b.fry[keep].name : ''}?`}
        confirmLabel="Yes, keep this one"
        onCancel={() => setKeep(null)}
        onConfirm={async () => {
          const k = keep
          setKeep(null)
          if (k !== null && (await onKeep(k)).ok) setPick(false)
        }}
      >
        The other two fry will be released. Your wallet asks you to confirm the mint of this fry as an NFT (gas only). This cannot be undone.
      </Confirm>
    </article>
  )
}

function FryCard({ f, onKeep }: { f: Fish; onKeep: () => void }) {
  const t = f.innate ? traitById(f.innate) : null
  return (
    <div className={`card flex flex-col overflow-hidden ${f.mutation ? 'ring-1 ring-[#c38bff]' : ''}`}>
      <div className="aspect-[4/3]">
        <Portrait genome={f.genome} flare={0.3} className="block h-full w-full" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="display text-xl font-semibold">{f.name}</span>
          <SexMark sex={f.sex} />
          <span className="num ml-auto text-xs text-dim">Gen {f.gen}</span>
        </div>
        <div className="text-sm text-dim">
          {breedNameOf(f)}
          {f.mutation && <span className="ml-1.5 rounded bg-[#c38bff]/15 px-1.5 py-0.5 text-[0.7rem] font-semibold text-[#d9b8ff]">✦ {f.mutation} mutation</span>}
        </div>
        <StatChips attack={f.attack} defense={f.defense} beauty={f.beauty} />
        {f.growth && (
          <div className="num text-[0.72rem] text-faint">
            growth/lv · ATK +{f.growth.attack} · DEF +{f.growth.defense} · BTY +{f.growth.beauty}
          </div>
        )}
        <div className="text-xs">{t ? <span className="text-gold">Born with {t.icon} {t.name}</span> : <span className="text-faint">No inherited trait</span>}</div>
        <button className="btn btn-gold btn-sm mt-auto" onClick={onKeep}>
          Keep {f.name}
        </button>
      </div>
    </div>
  )
}

// pick a pair and start a spawn
export function BreedPanel({ p, now, onStart }: { p: Player; now: number; onStart: (m: number, f: number) => Promise<Result> }) {
  const fish = p.tanks.map((f, slot) => ({ f, slot })).filter((x): x is { f: Fish; slot: number } => !!x.f && x.f.alive)
  const males = fish.filter((x) => x.f.sex === 'male')
  const females = fish.filter((x) => x.f.sex === 'female')
  const entered = (f: Fish) => p.entries.some((e) => e.fishId === f.id)
  const ok = (f: Fish) => !cannotBreed(f, now, entered(f))
  const [mSlot, setM] = useState<number | null>(null)
  const [fSlot, setF] = useState<number | null>(null)
  const [confirm, setConfirm] = useState(false)
  const male = (males.find((x) => x.slot === mSlot) ?? males.find((x) => ok(x.f)))?.f ?? null
  const female = (females.find((x) => x.slot === fSlot) ?? females.find((x) => ok(x.f)))?.f ?? null
  const maleSlot = fish.find((x) => x.f === male)?.slot
  const femaleSlot = fish.find((x) => x.f === female)?.slot
  const spawnJar = freeSlot(p)
  const why =
    (p.breeding && 'A spawn is already in progress.') ||
    (!male && 'You need a male (♂).') ||
    (!female && 'You need a female (♀). Buy one in the shop; females cost less.') ||
    cannotBreed(male, now, !!male && entered(male)) ||
    cannotBreed(female, now, !!female && entered(female)) ||
    (spawnJar < 0 && 'You need an empty jar to use as the spawning tank.') ||
    (!(p.inventory.breed ?? 0) && p.balance < BREED_FEE && `You need ${BREED_FEE} $BETTA for the breeding fee.`) ||
    null
  const fc = male && female ? forecast(male, female) : null

  const Picker = ({ list, sel, set, sex }: { list: { f: Fish; slot: number }[]; sel: Fish | null; set: (s: number) => void; sex: Sex }) => (
    <div>
      <div className="eyebrow mb-2 flex items-center gap-1.5">
        <SexMark sex={sex} className="!text-sm" /> {sex === 'male' ? 'Father' : 'Mother'}
      </div>
      {list.length ? (
        <div className="grid gap-2">
          {list.map(({ f, slot }) => {
            const r = cannotBreed(f, now, entered(f))
            return (
              <button
                key={f.id}
                onClick={() => set(slot)}
                className={`rounded-xl px-3 py-2 text-left ring-1 transition-colors ${sel === f ? 'bg-gold/10 ring-gold' : 'ring-line hover:ring-dim'}`}
              >
                <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>
                    {f.name} <span className="num text-xs text-gold">Lv {levelOf(f)}</span>
                  </span>
                  <span className="num text-xs text-faint">
                    {f.breeds}/{MAX_BREEDS}
                  </span>
                </div>
                <div className="text-xs text-dim">{breedNameOf(f)}</div>
                {r && <div className="mt-0.5 text-xs text-warn">{r}</div>}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="rounded-xl px-3 py-3 text-sm text-faint ring-1 ring-line-soft">
          No {sex === 'male' ? 'male' : 'female'} on your shelf.{' '}
          <a href="#shop" className="text-dim underline">
            Shop
          </a>
        </p>
      )}
    </div>
  )

  return (
    <div id="breeding" className="card mt-14 p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1 flex items-center gap-1.5">
            <Heart size={13} /> Breeding
          </div>
          <h3 className="display text-3xl font-semibold">Cross two of your fish.</h3>
        </div>
        <p className="max-w-md text-sm text-dim">
          Needs a ♂ and a ♀ at level {BREED_MIN_LEVEL}+, past the juvenile stage, health above {BREED_MIN_HEALTH}, plus one empty jar as the spawning tank. About two days later you pick one of three fry.
        </p>
      </div>

      {p.breeding ? (
        <p className="text-sm text-dim">
          {p.breeding.father} × {p.breeding.mother} are spawning in jar {p.breeding.slot + 1}. One spawn at a time.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1.15fr]">
          <Picker list={males} sel={male} set={setM} sex="male" />
          <Picker list={females} sel={female} set={setF} sex="female" />
          <div className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-line-soft">
            <div className="eyebrow mb-3">What to expect</div>
            {fc ? (
              <ul className="grid gap-1.5 text-sm text-dim">
                <li>
                  <span className="mb-1 block">Tail form, per fry:</span>
                  <span className="grid gap-1">
                    {fc.outcomes.map((o) => (
                      <span key={o.form} className="grid grid-cols-[1fr_auto] items-center gap-3">
                        <span className={HYBRID_FORMS.includes(o.form) ? 'text-gold' : 'text-text'}>
                          {o.name}
                          {HYBRID_FORMS.includes(o.form) && <span className="ml-1 text-[0.68rem] text-faint">hybrid</span>}
                        </span>
                        <span className="num text-xs">{Math.round(o.p * 100)}%</span>
                      </span>
                    ))}
                  </span>
                </li>
                {fc.giant > 0 && (
                  <li>
                    {Math.round(fc.giant * 100)}% chance per fry of a <span className="text-text">giant body</span>
                  </li>
                )}
                <li>
                  Potential bonus: <span className="num text-good">+{fc.bonus}</span> to every base stat
                </li>
                <li>
                  {Math.round(INHERIT_TRAIT_CHANCE * 100)}% chance per fry to be born with a parent trait
                  {fc.traits.length ? ` (${fc.traits.map((t) => traitById(t)?.name).join(', ')})` : ' (parents have none yet)'}
                </li>
                <li>{Math.round(MUTATION_CHANCE * 100)}% chance per fry of a rare colour mutation</li>
                <li>
                  Parents lose {BREED_HEALTH_COST} health and rest {Math.round(BREED_REST / 86_400_000)} days
                </li>
              </ul>
            ) : (
              <p className="text-sm text-faint">Pick a father and a mother.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
              <div className="text-sm">
                Fee <Coin n={BREED_FEE} className="font-semibold" />
                <div className="text-xs text-faint">{Math.round(BREED_BURN * 100)}% is burned</div>
              </div>
              <button className="btn btn-coral" disabled={!!why} title={why ?? ''} onClick={() => setConfirm(true)}>
                <Heart size={15} /> Start breeding
              </button>
            </div>
            {why && <p className="mt-2 text-xs text-warn">{why}</p>}
          </div>
        </div>
      )}

      <Confirm
        open={confirm && !!male && !!female}
        title="Start breeding?"
        confirmLabel={
          <>
            <Heart size={13} /> {p.inventory.breed ? 'Yes, start' : `Yes, pay ${BREED_FEE} $BETTA`}
          </>
        }
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          if (maleSlot !== undefined && femaleSlot !== undefined) onStart(maleSlot, femaleSlot)
          setConfirm(false)
        }}
      >
        Are you sure you want to breed <b className="text-text">{male?.name}</b> ♂ with <b className="text-text">{female?.name}</b> ♀ for{' '}
        <b className="text-gold">
          {BREED_FEE} $BETTA
        </b>
        ? Jar {spawnJar + 1} becomes the spawning tank. Both parents lose {BREED_HEALTH_COST} health and rest for {Math.round(BREED_REST / 86_400_000)} days.
        <span className="mt-3 block text-xs text-faint">
          {p.inventory.breed ? 'You already paid a breeding fee; it is used now.' : <>Paid from your wallet. Balance after: <Coin n={p.balance - BREED_FEE} /></>}
        </span>
      </Confirm>
    </div>
  )
}
