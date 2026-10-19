// Storage: Postgres when DATABASE_URL is set, otherwise an embedded Postgres (PGlite) on disk.
// Both speak the same SQL, so the schema and queries below work on either.

import { ENV } from './env.ts'

export interface Q {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}
export interface Db extends Q {
  tx<T>(fn: (q: Q) => Promise<T>): Promise<T>
}

const SCHEMA = `
create table if not exists players (
  address text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists events (id text primary key);
create table if not exists cursors (name text primary key, block bigint not null);
create table if not exists entries (
  round int not null,
  division int not null,
  fish_id bigint not null,
  owner text not null,
  fee numeric not null,
  active boolean not null default true,
  fish jsonb not null,
  primary key (round, fish_id)
);
create table if not exists results (
  round int not null,
  division int not null,
  data jsonb not null,
  primary key (round, division)
);
create table if not exists fry_claims (
  nonce text primary key,
  address text not null,
  fish jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists fish_owner (fish_id bigint primary key, address text not null);
`

export async function openDb(): Promise<Db> {
  if (ENV.databaseUrl) {
    const { default: postgres } = await import('postgres')
    const sql = postgres(ENV.databaseUrl, { max: 5, onnotice: () => {} })
    const wrap = (s: { unsafe: (q: string, p?: never[]) => Promise<unknown> }): Q => ({
      query: async <T,>(q: string, p: unknown[] = []) => (await s.unsafe(q, p as never[])) as T[],
    })
    const db: Db = {
      ...wrap(sql),
      tx: (fn) => sql.begin((t) => fn(wrap(t as never))) as never,
    }
    await sql.unsafe(SCHEMA)
    return db
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite(ENV.dataDir)
  const wrap = (s: { query: (q: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Q => ({
    query: async <T,>(q: string, p: unknown[] = []) => (await s.query(q, p)).rows as T[],
  })
  await pg.exec(SCHEMA)
  return { ...wrap(pg), tx: (fn) => pg.transaction((t) => fn(wrap(t))) }
}
