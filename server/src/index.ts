// Betta Arena game server: API + chain indexer + round operator.
//
// The tournament schedule is read from the arena contract first and handed to the shared game
// code (which reads it from the environment), so server and contract can never disagree on when
// a round opens, locks or rings.

import { ENV } from './env.ts'

const { arena, loadDecimals } = await import('./chain.ts')
const [anchor, period, lock] = await Promise.all([arena.read.anchor(), arena.read.period(), arena.read.lockDuration()])
process.env.VITE_SEASON_START = new Date(Number(anchor) * 1000).toISOString()
process.env.VITE_TOURNAMENT_DAYS = String(Number(period) / 86_400)
await loadDecimals()

const { ENTRY_LOCK } = await import('../../src/game/tournament.ts')
if (ENTRY_LOCK !== Number(lock) * 1000) {
  console.error(`Registration lock mismatch: contract ${lock}s, game rules ${ENTRY_LOCK / 1000}s. Redeploy the arena with the deploy script.`)
  process.exit(1)
}

const { serve } = await import('@hono/node-server')
const { openDb } = await import('./db.ts')
const { api } = await import('./api.ts')
const { startIndexer } = await import('./indexer.ts')
const { startOperator } = await import('./operator.ts')

const db = await openDb()
startIndexer(db)
if (ENV.runOperator) startOperator()
serve({ fetch: api(db).fetch, port: ENV.port }, (info) => {
  console.log(`Betta Arena server on :${info.port} · chain ${ENV.chainId} · season starts ${process.env.VITE_SEASON_START} · rounds every ${process.env.VITE_TOURNAMENT_DAYS} days`)
})
