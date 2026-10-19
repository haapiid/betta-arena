import { useState } from 'react'
import { Portrait } from './FishCanvas'
import { Coin, RarityTag, SectionHead } from './ui'
import { LIVE } from '../lib/net'
import { SPECIES } from '../game/species'
import { ITEMS, KIND_LABEL, type ItemKind } from '../game/items'
import { freeSlot, type Player, type Result } from '../game/store'
import { priceOfSex, skuById } from '../game/catalog'
import type { Sex } from '../game/fish'

export function Shop({
  p,
  buyFish,
  buyPack,
  connected,
}: {
  p: Player
  buyFish: (id: string, sex?: Sex) => Promise<Result>
  buyPack: (skuId: string, qty?: number) => Promise<Result>
  connected: boolean
}) {
  const [tab, setTab] = useState<'fish' | 'items'>('fish')
  const free = p.tanks.filter((t, i) => t === null && p.breeding?.slot !== i).length
  // without a wallet the buttons still show prices; clicking explains what to do
  const can = (price: number) => LIVE && (!connected || p.balance >= price)

  return (
    <section id="shop" className="border-y border-line-soft bg-deep/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-10 lg:px-16">
        <SectionHead eyebrow="The fish shop" title="Pick a betta. Stock the cabinet.">
          Paid in $BETTA from your wallet; each fish is an NFT you own. Every fish arrives as a level-1 juvenile. Males (♂) fight and breed; females (♀) cost less, carry short fins, and only breed. Stats roll ±6 around its breed, and each breed grows differently per level: a Plakat gets meaner, a Halfmoon gets prettier.
        </SectionHead>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-line p-1" role="tablist">
            {(
              [
                ['fish', 'Bettas'],
                ['items', 'Food & medicine'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${tab === k ? 'bg-text text-ink' : 'text-dim hover:text-text'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="text-sm text-dim">
            {!connected ? 'Connect your wallet to buy' : free ? `${free} empty jar${free > 1 ? 's' : ''}` : 'All jars full'}
            {connected && (
              <>
                {' '}· balance <Coin n={p.balance} className="text-text" />
              </>
            )}
          </span>
        </div>

        {tab === 'fish' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SPECIES.map((s, i) => (
              <article key={s.id} className="card group flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Portrait genome={{ ...s.genome, seed: 4242 + i * 97 }} image={s.image} className="block h-full w-full" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <RarityTag r={s.rarity} />
                  <h3 className="display mt-1 text-xl font-semibold">{s.name}</h3>
                  <p className="mb-3 text-[0.72rem] italic text-faint">{s.latin}</p>
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-dim">{s.blurb}</p>
                  <div className="mb-4 grid gap-1.5">
                    {(
                      [
                        ['ATK', s.attack, 'var(--color-coral)'],
                        ['DEF', s.defense, 'var(--color-teal)'],
                        ['BEAUTY', s.beauty, 'var(--color-gold)'],
                      ] as const
                    ).map(([k, v, c]) => {
                      const g = s.growth[k === 'ATK' ? 'attack' : k === 'DEF' ? 'defense' : 'beauty']
                      return (
                        <div key={k} className="grid grid-cols-[52px_1fr_24px_52px] items-center gap-2 text-[0.68rem]">
                          <span className="font-semibold tracking-[0.12em] text-faint">{k}</span>
                          <div className="bar">
                            <i style={{ width: `${v}%`, background: c }} />
                          </div>
                          <span className="num text-right text-dim">{v}</span>
                          <span className={`num text-right ${g >= 1.5 ? 'text-good' : 'text-faint'}`} title="Growth per level">
                            +{g.toFixed(1)}/lv
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {free || !connected ? (
                    <div className="grid grid-cols-2 gap-2">
                      {(['male', 'female'] as const).map((sex) => {
                        const price = priceOfSex(s.id, sex)
                        return (
                          <button
                            key={sex}
                            className={`btn btn-sm justify-between !px-3 ${sex === 'male' ? 'btn-gold' : 'btn-ghost'}`}
                            disabled={!can(price) || (connected && freeSlot(p) < 0)}
                            onClick={() => buyFish(s.id, sex)}
                            title={sex === 'male' ? 'Males fight and breed' : 'Females breed only (no arena), short fins'}
                          >
                            <span>
                              Buy <span className={sex === 'male' ? '' : 'text-[#ff9ec7]'}>{sex === 'male' ? '♂' : '♀'}</span>
                            </span>
                            <span className="num">{price}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm w-full" disabled>
                      No free jar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {(['food', 'care', 'medicine', 'boost', 'growth'] as ItemKind[]).map((k) => (
              <div key={k}>
                <div className="eyebrow mb-3">{KIND_LABEL[k]}</div>
                <div className="grid gap-2">
                  {ITEMS.filter((i) => i.kind === k).map((it) => (
                    <div key={it.id} className="card flex items-center gap-3 !rounded-xl px-4 py-3">
                      <span className="text-2xl" aria-hidden="true">
                        {it.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">
                          {it.name}
                          {(p.inventory[it.id] ?? 0) > 0 && (
                            <span className="num ml-2 text-xs text-teal">
                              {it.packs ? `${p.inventory[it.id]} portions left` : `owned ×${p.inventory[it.id]}`}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-dim">{it.note}</div>
                      </div>
                      {it.packs ? (
                        <div className="flex flex-col gap-1.5">
                          {it.packs.map((pk, i) => (
                            <button key={pk.qty} className="btn btn-ghost btn-sm justify-between gap-3 !px-3" onClick={() => buyPack(`${it.id}-${pk.qty}`)} disabled={!can(pk.price) || !skuById(`${it.id}-${pk.qty}`)}>
                              <span>
                                {pk.qty} portions
                                {i > 0 && <span className="ml-1 text-[0.68rem] text-good">−{Math.round((1 - pk.price / pk.qty / (it.packs![0].price / it.packs![0].qty)) * 100)}%</span>}
                              </span>
                              <span className="num">{pk.price}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <Coin n={it.price} className="text-sm" />
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm !px-2.5" onClick={() => buyPack(it.id, 1)} disabled={!can(it.price)}>
                            +1
                          </button>
                          <button className="btn btn-ghost btn-sm !px-2.5" onClick={() => buyPack(it.id, 5)} disabled={!can(it.price * 5)}>
                            +5
                          </button>
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
