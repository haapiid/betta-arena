// Server settings, read once from the environment (see server/.env.example).
import type { Address, Hex } from 'viem'

function need(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing environment variable ${key} (see server/.env.example)`)
  return v
}
const opt = (key: string, fallback: string) => process.env[key] || fallback

export const ENV = {
  port: Number(opt('PORT', '8787')),
  // Postgres in production; without it an embedded Postgres (PGlite) stores data in DATA_DIR
  databaseUrl: process.env.DATABASE_URL,
  dataDir: opt('DATA_DIR', './data'),
  rpcUrl: need('RPC_URL'),
  chainId: Number(need('CHAIN_ID')),
  arena: need('ARENA_ADDRESS') as Address,
  shop: need('SHOP_ADDRESS') as Address,
  fish: need('FISH_ADDRESS') as Address,
  token: need('TOKEN_ADDRESS') as Address,
  startBlock: BigInt(opt('START_BLOCK', '0')),
  // signs fish snapshots and shop permits (must match `signer` in the contracts)
  signerKey: need('SIGNER_KEY') as Hex,
  // commits, reveals and settles rounds; needs a little ETH for gas
  operatorKey: need('OPERATOR_KEY') as Hex,
  // keeps every round's commit-reveal secret recoverable after a restart
  operatorSecret: need('OPERATOR_SECRET'),
  sessionSecret: need('SESSION_SECRET'),
  // web app origins allowed to call the API, comma separated
  allowedOrigins: opt('ALLOWED_ORIGINS', 'http://localhost:3110').split(',').map((s) => s.trim()),
  publicUrl: opt('PUBLIC_URL', 'http://localhost:8787'),
  pollMs: Number(opt('POLL_MS', '4000')),
  runOperator: opt('RUN_OPERATOR', 'true') !== 'false',
}
