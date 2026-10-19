// Public game data from the server: who is in a bracket, finished rounds, the leaderboard.

import { useEffect, useState } from 'react'
import type { Fighter } from '../game/battle'
import type { Genome } from '../game/species'
import { SPECIES } from '../game/species'
import type { TournamentResult } from '../game/tournament'
import { api } from './api'
import { LIVE } from './net'

export interface FieldEntry {
  fishId: string
  owner: string
  name: string
  speciesId: string
  genome?: Genome
  gen: number
  level: number
  attack: number
  defense: number
  beauty: number
  health: number
  sick: boolean
  traits: string[]
  fee: number
  power: number
}

export interface BoardRow {
  owner: string
  mine: boolean
  earned: number
  titles: number
  wins: number
  bestLevel: number
  bestFish: string
}

function usePoll<T>(path: string | null, initial: T, every = 30_000): T {
  const [v, setV] = useState<T>(initial)
  useEffect(() => {
    setV(initial)
    if (!path || !LIVE) return
    let alive = true
    const load = () =>
      api<T>(path)
        .then((x) => alive && setV(x))
        .catch(() => {})
    load()
    const id = setInterval(load, every)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, every])
  return v
}

export function useField(round: number, division: number) {
  return usePoll<{ entries: FieldEntry[] }>(`/api/arena/field?round=${round}&division=${division}`, { entries: [] }, 15_000).entries
}

/** Pot of every division in a round. */
export function useRoundPot(round: number) {
  const a = useField(round, 0)
  const b = useField(round, 1)
  const c = useField(round, 2)
  return [...a, ...b, ...c].reduce((s, e) => s + e.fee, 0)
}

/** Finished brackets, with the viewer's fish marked. */
export function useResults(division: number, me: string | null) {
  const list = usePoll<TournamentResult[]>(`/api/results?division=${division}&limit=8`, [], 60_000)
  return list.map((r) => ({ ...r, fighters: r.fighters.map((f) => withLooks({ ...f, mine: !!me && f.owner === me })) }))
}

export function useBoard(me: string | null): BoardRow[] {
  const rows = usePoll<Omit<BoardRow, 'mine'>[]>('/api/leaderboard', [], 60_000)
  return rows.map((r) => ({ ...r, mine: !!me && r.owner === me }))
}

// a fighter without a stored genome still gets its breed's look
export function withLooks<T extends Pick<Fighter, 'speciesId' | 'genome'> & { id?: string; fishId?: string }>(f: T): T {
  if (f.genome) return f
  const sp = SPECIES.find((s) => s.id === f.speciesId) ?? SPECIES[0]
  return { ...f, genome: { ...sp.genome, seed: Number(f.id ?? f.fishId ?? 1) } }
}

export const toFighter = (e: FieldEntry, me: string | null): Fighter =>
  withLooks({
    id: e.fishId, name: e.name, owner: e.owner, mine: !!me && e.owner === me, speciesId: e.speciesId, genome: e.genome as Genome, gen: e.gen,
    level: e.level, traits: e.traits, attack: e.attack, defense: e.defense, beauty: e.beauty, health: e.health, sick: e.sick, stake: e.fee,
  })
