// Per-wallet game state. Every change for one address runs one at a time (an in-process lock plus
// a transaction), and a chain event is applied at most once (its id is stored in the same transaction).
// Run a single server instance: the lock lives in memory.

import { freshState, tickAll, type PlayerState } from '../../src/game/engine.ts'
import type { Db, Q } from './db.ts'

const chains = new Map<string, Promise<unknown>>()

export const norm = (a: string) => a.toLowerCase()

export async function withPlayer<T>(
  db: Db,
  address: string,
  fn: (d: PlayerState, q: Q) => T | Promise<T>,
  eventId?: string,
): Promise<T | undefined> {
  const addr = norm(address)
  const prev = chains.get(addr) ?? Promise.resolve()
  const run = prev.catch(() => {}).then(() =>
    db.tx(async (q) => {
      if (eventId) {
        const ins = await q.query('insert into events (id) values ($1) on conflict do nothing returning id', [eventId])
        if (!ins.length) return undefined // already applied
      }
      const rows = await q.query<{ state: PlayerState }>('select state from players where address = $1', [addr])
      const d: PlayerState = rows[0]?.state ? { ...freshState(), ...rows[0].state } : freshState()
      const out = await fn(d, q)
      await q.query(
        'insert into players (address, state, updated_at) values ($1, $2::jsonb, now()) on conflict (address) do update set state = excluded.state, updated_at = now()',
        [addr, JSON.stringify(d)],
      )
      return out
    }),
  )
  chains.set(addr, run)
  try {
    return await run
  } finally {
    if (chains.get(addr) === run) chains.delete(addr)
  }
}

/** Current state with the clock applied (deaths, hunger) and saved. */
export async function loadPlayer(db: Db, address: string, now = Date.now()) {
  let msgs: string[] = []
  const d = await withPlayer(db, address, (d) => {
    msgs = tickAll(d, now)
    return structuredClone(d)
  })
  return { state: d!, msgs }
}

/** Mark a chain event as handled when it touches no player (e.g. a refund of an empty bracket). */
export async function markEvent(db: Db, id: string) {
  const r = await db.query('insert into events (id) values ($1) on conflict do nothing returning id', [id])
  return r.length > 0
}
