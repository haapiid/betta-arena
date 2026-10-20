// Share cards as PNG for link previews (X, Telegram): one per fight and one for the site.
// The drawing lives in src/card/cards.ts so the page draws exactly the same card.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { CARD_H, CARD_W, drawFightCard, drawSiteCard, fightHeadline, type SiteFacts } from '../../src/card/cards.ts'
import type { Fight } from '../../src/game/ring.ts'

const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts')
GlobalFonts.registerFromPath(path.join(fonts, 'Anton.woff2'), 'Anton')
GlobalFonts.registerFromPath(path.join(fonts, 'InterTight.woff2'), 'Inter Tight')
GlobalFonts.registerFromPath(path.join(fonts, 'JetBrainsMono.woff2'), 'JetBrains Mono')

const cache = new Map<string, Buffer>()
function render(key: string, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = createCanvas(CARD_W, CARD_H)
  draw(c.getContext('2d') as unknown as CanvasRenderingContext2D)
  const png = c.toBuffer('image/png')
  cache.set(key, png)
  if (cache.size > 300) cache.delete(cache.keys().next().value!)
  return png
}

export const fightPng = (f: Fight, host: string) => render(`fight:${f.n}`, (ctx) => drawFightCard(ctx, f, host))

let site: { at: number; png: Buffer } | null = null
export function sitePng(s: SiteFacts, host: string) {
  // the site's card changes with every fight: redraw at most every two minutes
  if (!site || Date.now() - site.at > 120_000) {
    const c = createCanvas(CARD_W, CARD_H)
    drawSiteCard(c.getContext('2d') as unknown as CanvasRenderingContext2D, s, host)
    site = { at: Date.now(), png: c.toBuffer('image/png') }
  }
  return site.png
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** /fight/<n>: a page whose preview on X and Telegram is the fight's card; people land on the site. */
export function fightPage(f: Fight, siteUrl: string) {
  const [a, b] = fightHeadline(f)
  const title = esc(`${a} ${b} · Fight #${f.n} · Betta Arena`)
  const img = `${siteUrl}/api/card/fight/${f.n}.png`
  const to = `${siteUrl}/?fight=${f.n}`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<meta name="description" content="Every buy is a fight. $BETTA on Robinhood Chain.">
<meta property="og:type" content="website"><meta property="og:title" content="${title}">
<meta property="og:description" content="Every buy is a fight. $BETTA on Robinhood Chain."><meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${siteUrl}/fight/${f.n}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${img}">
<meta http-equiv="refresh" content="0; url=${to}"></head><body style="background:#040b11;color:#e4f1f4;font-family:sans-serif">
<p><a href="${to}" style="color:#f2c14e">Watch fight #${f.n} on Betta Arena</a></p></body></html>`
}
