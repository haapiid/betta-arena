import { useMemo, useState } from 'react'
import { Crown, Medal, Swords, Trophy } from 'lucide-react'
import { Coin, fmt, SectionHead } from './ui'
import { board, ranked, SEASON_ROUNDS, type BoardRow, type BoardSort } from '../game/leaderboard'
import type { Player } from '../game/store'

const TABS: { id: BoardSort; label: string; icon: typeof Trophy }[] = [
  { id: 'earned', label: 'Top earners', icon: Trophy },
  { id: 'titles', label: 'Most titles', icon: Crown },
  { id: 'wins', label: 'Fight wins', icon: Swords },
]

const MEDAL = ['text-gold', 'text-[#d6dde6]', 'text-[#d8935a]']

export function useBoard(p: Player, now: number, you: string) {
  // recompute once a minute, or when the player's results change
  return useMemo(() => board(p, now, you), [p.history, you, Math.floor(now / 60000)])
}

export function Leaderboard({ p, now, you }: { p: Player; now: number; you: string }) {
  const [by, setBy] = useState<BoardSort>('earned')
  const rows = useBoard(p, now, you)
  const list = useMemo(() => ranked(rows, by), [rows, by])
  const myRank = list.findIndex((r) => r.mine)
  const top = list.slice(0, 10)

  return (
    <section id="leaderboard" className="border-t border-line-soft">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-10 lg:px-16">
        <SectionHead eyebrow={`Leaderboard · last ${SEASON_ROUNDS} rounds`} title="The best keepers in the arena.">
          Every finished round in every division counts. Earnings are prize money (champion, runner-up and semifinalists); titles are championships; fight wins count every bracket match won. Keepers tagged NPC are house fish that fill the brackets.
        </SectionHead>

        <div className="mb-6 inline-flex rounded-full border border-line p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={by === t.id}
              onClick={() => setBy(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${by === t.id ? 'bg-text text-ink' : 'text-dim hover:text-text'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[56px_1fr_140px_90px_90px_170px] gap-4 border-b border-line-soft px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-faint md:grid">
            <span>Rank</span>
            <span>Keeper</span>
            <span className="text-right">Earned</span>
            <span className="text-right">Titles</span>
            <span className="text-right">Wins</span>
            <span className="text-right">Best fish</span>
          </div>
          <ol>
            {top.map((r, i) => (
              <Row key={r.owner + i} r={r} rank={i} />
            ))}
          </ol>
          {myRank >= 10 && (
            <div className="border-t border-dashed border-line">
              <Row r={list[myRank]} rank={myRank} />
            </div>
          )}
          {list.length === 0 && <p className="px-5 py-6 text-sm text-dim">The season has just started. The board fills up after the first round's bell.</p>}
          {list.length > 0 && myRank < 0 && <p className="border-t border-line-soft px-5 py-4 text-sm text-dim">You are not on the board yet. Enter a fish in the arena and win a match to get ranked.</p>}
        </div>
      </div>
    </section>
  )
}

function Row({ r, rank }: { r: BoardRow; rank: number }) {
  return (
    <li
      className={`grid grid-cols-[40px_1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line-soft/60 px-5 py-3 last:border-0 md:grid-cols-[56px_1fr_140px_90px_90px_170px] ${r.mine ? 'bg-gold/10' : ''}`}
    >
      <span className={`num flex items-center gap-1 text-sm font-semibold ${MEDAL[rank] ?? 'text-faint'}`}>
        {rank < 3 ? <Medal size={15} /> : null}
        {rank + 1}
      </span>
      <span className={`truncate font-semibold ${r.mine ? 'text-gold' : ''}`}>
        {r.owner}
        {r.mine && <span className="ml-2 rounded bg-gold px-1.5 py-0.5 text-[0.62rem] font-bold text-black">YOU</span>}
      </span>
      <span className="text-right md:order-none">
        <Coin n={r.earned} className="text-sm" />
      </span>
      <span className="num col-span-2 col-start-2 text-xs text-dim md:hidden">
        {r.titles} title{r.titles === 1 ? "" : "s"} · {fmt(r.wins)} wins · {r.bestFish} Lv{r.bestLevel}
      </span>
      <span className="num hidden text-right text-sm md:block">{r.titles}</span>
      <span className="num hidden text-right text-sm md:block">{fmt(r.wins)}</span>
      <span className="hidden truncate text-right text-sm text-dim md:block">
        {r.bestFish} <span className="num text-faint">Lv{r.bestLevel}</span>
      </span>
    </li>
  )
}
