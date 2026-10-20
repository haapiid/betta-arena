// Read-only HTTP API for the site, plus a live event stream. Nothing here can move funds.

import http from 'node:http'
import { formatEther, formatUnits, isAddress, parseUnits } from 'viem'
import { config, DEAD } from './config.ts'
import { live } from './buyback.ts'
import { excludedSet, market } from './indexer.ts'
import { shelf } from './rules.ts'
import { state } from './store.ts'
import { price } from './price.ts'
import { fightPage, fightPng, sitePng } from './cards.ts'

export const supply = { total: 0n, dead: 0n }
const units = (raw: string | bigint) => Number(formatUnits(BigInt(raw), market.decimals))
const eth = (wei: string | bigint) => Number(formatEther(BigInt(wei)))

function shelfRows() {
  return shelf(state.holders, excludedSet(), config.shelfSize, parseUnits(config.shelfMinTokens || '0', market.decimals)).map((r) => ({ ...r, balance: units(r.balance) }))
}

const roundRow = (r: (typeof state.rounds)[number]) => ({
  n: r.n, at: r.at, stage: r.stage, route: r.route, claimedEth: eth(r.claimedWei), spentEth: eth(r.spendWei), burned: units(r.boughtUnits || '0'),
  claimTx: r.claimTx, buyTx: r.buyTx, burnTx: r.burnTx, doneAt: r.doneAt,
})

export function status() {
  const ring = state.ring
  const jumpers = Object.entries(state.holders)
    .filter(([, h]) => h.jumped)
    .sort(([, a], [, b]) => b.jumpedAt - a.jumpedAt)
    .slice(0, 12)
    .map(([addr, h]) => ({ addr, at: h.jumpedAt, tx: h.jumpedTx }))
  return {
    standby: !config.token,
    token: config.token,
    chainId: config.chainId,
    curve: market.curve || null,
    engine: live.status,
    fees: { tankEth: eth(live.escrowWei), stepEth: Number(config.buybackStepEth) },
    totals: { claimedEth: eth(state.totals.claimedWei), spentEth: eth(state.totals.spentWei), burnedByBell: units(state.totals.burnedUnits) },
    supply: { total: units(supply.total), inTheDeep: units(supply.dead) },
    ethUsd: price.ethUsd,
    // dollar figures are display only; market cap counts what is not in the deep
    price: { tokenUsd: price.tokenUsd, source: price.source, mcapUsd: price.tokenUsd * (units(supply.total) - units(supply.dead)) },
    ring: { total: ring.total, champion: ring.champion, best: ring.best, fights: ring.fights.slice(0, 12) },
    shelf: shelfRows(),
    jumpers,
    jumpedCount: Object.values(state.holders).filter((h) => h.jumped).length,
    rounds: state.rounds.slice(0, 12).map(roundRow),
    fightMinTokens: Number(config.fightMinTokens),
    updated: Date.now(),
  }
}

// ---------- server ----------

const streams = new Set<http.ServerResponse>()
export function pushUpdate() {
  for (const s of streams) s.write(`event: update\ndata: ${Date.now()}\n\n`)
}
setInterval(() => {
  for (const s of streams) s.write(': ping\n\n')
}, 20_000)

const hits = new Map<string, { n: number; reset: number }>()
function limited(ip: string) {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    if (hits.size > 50_000) hits.clear()
    return false
  }
  return ++h.n > 300
}

const host = () => config.siteUrl.replace(/^https?:\/\//, '')

export function startApi() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin ?? ''
    if (config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (req.method === 'OPTIONS') return void res.writeHead(204).end()
    if (req.method !== 'GET') return void res.writeHead(405).end()
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
    if (limited(ip)) return void res.writeHead(429).end()
    const url = new URL(req.url ?? '/', 'http://x')
    const json = (code: number, body: unknown, cache = 'no-store') => {
      res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': cache })
      res.end(JSON.stringify(body))
    }
    const p = url.pathname
    if (p === '/api/health') return json(200, { ok: true })
    if (p === '/api/status') return json(200, status())
    if (p === '/api/fights') {
      const before = Number(url.searchParams.get('before') ?? Infinity)
      return json(200, state.ring.fights.filter((f) => f.n < before).slice(0, 30))
    }
    if (p === '/api/rounds') return json(200, state.rounds.slice(0, 100).map(roundRow))
    // a single fight, its card, and its shareable page (the preview on X is the card)
    const fightNo = (m: RegExpMatchArray | null) => (m ? state.book?.[Number(m[1]) - 1] ?? null : null)
    let m = p.match(/^\/api\/fight\/(\d{1,7})$/)
    if (m) {
      const f = fightNo(m)
      return f ? json(200, f, 'public, max-age=3600') : json(404, { error: 'No such fight.' })
    }
    m = p.match(/^\/api\/card\/fight\/(\d{1,7})\.png$/)
    if (m) {
      const f = fightNo(m)
      if (!f) return json(404, { error: 'No such fight.' })
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' })
      return void res.end(fightPng(f, host()))
    }
    if (p === '/api/card/site.png') {
      const c = state.ring.champion
      const pct = supply.total ? (Number(supply.dead) / Number(supply.total)) * 100 : 0
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=120' })
      return void res.end(sitePng({ fights: state.ring.total, champion: c?.fish ?? null, streak: c?.streak ?? 0, inTheDeep: units(supply.dead), pct }, host()))
    }
    m = p.match(/^\/fight\/(\d{1,7})$/)
    if (m) {
      const f = fightNo(m)
      res.writeHead(f ? 200 : 302, f ? { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } : { Location: config.siteUrl })
      return void res.end(f ? fightPage(f, config.siteUrl) : '')
    }
    if (p.startsWith('/api/wallet/')) {
      const a = p.slice('/api/wallet/'.length).toLowerCase()
      if (!isAddress(a)) return json(400, { error: 'Not an address.' })
      const h = state.holders[a]
      const rank = shelfRows().find((r) => r.addr === a)?.rank ?? null
      const fights = state.ring.fights.filter((f) => f.buyer === a || f.championOwner === a).slice(0, 20)
      return json(200, {
        addr: a, balance: h ? units(h.balance) : 0, firstIn: h?.firstIn ?? 0, jumped: h?.jumped ?? false, jumpedTx: h?.jumpedTx ?? '',
        fights: h?.fights ?? 0, wins: h?.wins ?? 0, rank, holdsBelt: state.ring.champion?.owner === a, recent: fights,
      })
    }
    if (p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      res.write(': hello\n\n')
      streams.add(res)
      req.on('close', () => streams.delete(res))
      return
    }
    json(404, { error: 'Not found.' })
  })
  server.listen(config.port, '127.0.0.1')
  return server
}

export { DEAD }
