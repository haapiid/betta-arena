// Leaderboard built from every finished round: the player's own results where they played,
// the public (NPC-only) result otherwise. Deterministic, so every visitor sees the same board.
// When the game moves on chain, replace this with an indexer over real tournament results.

import { DIVISIONS, endsAt, isBye, npcField, prizesOf, roundAt, runTournament, type TournamentResult } from './tournament'
import type { Player } from './store'

export interface BoardRow {
  owner: string
  mine: boolean
  earned: number
  titles: number
  wins: number
  bestLevel: number
  bestFish: string
}

export const SEASON_ROUNDS = 30 // how many past rounds count

const cache = new Map<string, TournamentResult>()

function publicResult(n: number, div: (typeof DIVISIONS)[number]['id']) {
  const k = `${n}:${div}`
  let r = cache.get(k)
  if (!r) {
    r = runTournament(n, div, npcField(n, div), endsAt(n))
    cache.set(k, r)
  }
  return r
}

export function seasonResults(p: Player, now: number): TournamentResult[] {
  const last = roundAt(now) - 1
  const first = Math.max(1, last - SEASON_ROUNDS + 1)
  const out: TournamentResult[] = []
  const mineKeys = new Set(p.history.map((r) => `${r.n}:${r.div}`))
  for (let n = first; n <= last; n++) for (const d of DIVISIONS) if (!mineKeys.has(`${n}:${d.id}`)) out.push(publicResult(n, d.id))
  // the player's rounds, including ones rung early in demo mode
  return out.concat(p.history.filter((r) => r.n >= first))
}

export function board(p: Player, now: number, you: string): BoardRow[] {
  const rows = new Map<string, BoardRow>()
  const row = (owner: string, mine: boolean) => {
    const k = mine ? '__you' : owner
    let r = rows.get(k)
    if (!r) {
      r = { owner: mine ? you : owner, mine, earned: 0, titles: 0, wins: 0, bestLevel: 0, bestFish: '' }
      rows.set(k, r)
    }
    return r
  }
  for (const res of seasonResults(p, now)) {
    for (const ms of res.rounds)
      for (const m of ms) {
        if (isBye(m)) continue
        const f = res.fighters[m.winner]
        row(f.owner, f.mine).wins++
      }
    for (const f of res.fighters) {
      const r = row(f.owner, f.mine)
      if (f.level > r.bestLevel) {
        r.bestLevel = f.level
        r.bestFish = f.name
      }
    }
    const champ = res.fighters[res.champion]
    row(champ.owner, champ.mine).titles++
    for (const pz of prizesOf(res)) {
      const f = res.fighters[pz.fighter]
      row(f.owner, f.mine).earned += pz.amount
    }
  }
  return [...rows.values()]
}

export type BoardSort = 'earned' | 'titles' | 'wins'

export function ranked(rows: BoardRow[], by: BoardSort) {
  return [...rows].sort((a, b) => b[by] - a[by] || b.earned - a.earned || b.wins - a.wins)
}
