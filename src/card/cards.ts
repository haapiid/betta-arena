// Share cards, 1200 × 630, drawn with nothing but the 2D canvas API so the page (Save / Share / Post on X)
// and the engine (link previews on X and Telegram) draw exactly the same picture.

import { bettaExtent, drawBetta } from '../render/betta'
import { SPECIES } from '../game/species'
import type { Fight, Fish } from '../game/ring'

export const CARD_W = 1200
export const CARD_H = 630
type Ctx = CanvasRenderingContext2D

const RED = '#ff4150'
const GOLD = '#f2c14e'
const INK = '#040b11'
const DISPLAY = '"Anton", Impact, sans-serif'
const BODY = '"Inter Tight Variable", "Inter Tight", Arial, sans-serif'
const MONO = '"JetBrains Mono", monospace'

const genomeOf = (f: Fish) => ({ ...(SPECIES.find((s) => s.id === f.speciesId) ?? SPECIES[0]).genome, seed: f.seed })
const breedOf = (f: Fish) => (SPECIES.find((s) => s.id === f.speciesId) ?? SPECIES[0]).name

function ground(ctx: Ctx) {
  const g = ctx.createRadialGradient(CARD_W * 0.62, CARD_H * 0.35, 40, CARD_W * 0.6, CARD_H * 0.5, CARD_W * 0.75)
  g.addColorStop(0, '#0d2a38')
  g.addColorStop(1, INK)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  // two spotlights
  for (const [x, a] of [[CARD_W * 0.42, 0.35], [CARD_W * 0.98, -0.35]] as const) {
    ctx.save()
    ctx.translate(x, -40)
    ctx.rotate(a)
    const s = ctx.createLinearGradient(0, 0, 0, CARD_H * 1.2)
    s.addColorStop(0, 'rgba(255,236,190,0.16)')
    s.addColorStop(1, 'rgba(255,236,190,0)')
    ctx.fillStyle = s
    ctx.beginPath()
    ctx.moveTo(-14, 0)
    ctx.lineTo(14, 0)
    ctx.lineTo(220, CARD_H * 1.2)
    ctx.lineTo(-220, CARD_H * 1.2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // the crowd
  ctx.fillStyle = '#020a10'
  ctx.beginPath()
  ctx.moveTo(0, CARD_H)
  for (let i = 0; i <= 40; i++) {
    const x = i * 30
    const top = CARD_H - 40 - ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) * 14
    ctx.lineTo(x, top + 18)
    ctx.quadraticCurveTo(x + 15, top - 10, x + 30, top + 18)
  }
  ctx.lineTo(CARD_W, CARD_H)
  ctx.fill()
}

function fish(ctx: Ctx, f: Fish, cx: number, cy: number, w: number, face: 1 | -1, glow: boolean) {
  const g = genomeOf(f)
  const e = bettaExtent(g)
  const s = w / (e.right - e.left)
  if (glow) {
    const r = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.75)
    r.addColorStop(0, 'rgba(242,193,78,0.28)')
    r.addColorStop(1, 'rgba(242,193,78,0)')
    ctx.fillStyle = r
    ctx.fillRect(cx - w, cy - w, w * 2, w * 2)
  }
  ctx.save()
  ctx.translate(cx - face * ((e.left + e.right) / 2) * s, cy)
  ctx.scale(face * s, s)
  drawBetta(ctx, g, { t: 1.3, flare: 0.8, swim: 0.3, health: 100 })
  ctx.restore()
}

function pill(ctx: Ctx, x: number, y: number, text: string, bg: string, fg: string, font = `700 22px ${BODY}`) {
  ctx.font = font
  const w = ctx.measureText(text).width + 32
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x, y, w, 42, 21)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + 16, y + 22)
  ctx.textBaseline = 'alphabetic'
  return w
}

function fitText(ctx: Ctx, text: string, font: (px: number) => string, px: number, maxW: number) {
  ctx.font = font(px)
  while (ctx.measureText(text).width > maxW && px > 20) ctx.font = font((px -= 2))
  return px
}

export function fightHeadline(f: Fight): [string, string] {
  if (f.winner === 'walkover') return [`${f.challenger.name} walks in.`, 'The ring was empty.']
  if (f.winner === 'challenger') return [`${f.challenger.name} takes`, 'the belt.']
  return [`${f.champion!.name} keeps`, `the belt · ${f.streak} in a row`]
}

/** One fight: who fought, who holds the belt. */
export function drawFightCard(ctx: Ctx, f: Fight, host: string) {
  ground(ctx)
  const [a, b] = fightHeadline(f)
  ctx.fillStyle = '#8eabb6'
  ctx.font = `500 22px ${MONO}`
  ctx.fillText(`FIGHT #${f.n} · ROBINHOOD CHAIN`, 64, 92)
  const px = Math.min(fitText(ctx, a.toUpperCase(), (p) => `400 ${p}px ${DISPLAY}`, 96, 560), fitText(ctx, b.toUpperCase(), (p) => `400 ${p}px ${DISPLAY}`, 96, 560))
  ctx.font = `400 ${px}px ${DISPLAY}`
  ctx.fillStyle = '#eaf4f6'
  ctx.fillText(a.toUpperCase(), 64, 92 + px * 1.05)
  ctx.fillStyle = RED
  ctx.fillText(b.toUpperCase(), 64, 92 + px * 2.0)

  // the two corners
  const challengerWon = f.winner !== 'champion'
  if (f.champion) {
    fish(ctx, f.challenger, 735, 300, 250, 1, challengerWon)
    fish(ctx, f.champion, 1060, 300, 240, -1, !challengerWon)
  } else fish(ctx, f.challenger, 900, 300, 360, 1, true)
  const label = (x: number, fsh: Fish, tag: string, right = false) => {
    ctx.textAlign = right ? 'right' : 'left'
    ctx.fillStyle = '#eaf4f6'
    ctx.font = `400 34px ${DISPLAY}`
    ctx.fillText(`${fsh.name.toUpperCase()}  LV ${fsh.level}`, x, 460)
    ctx.fillStyle = '#7d9aa5'
    ctx.font = `500 16px ${MONO}`
    ctx.fillText(breedOf(fsh), x, 486)
    ctx.fillStyle = tag === 'champion' ? GOLD : '#7d9aa5'
    ctx.fillText(tag.toUpperCase(), x, 508)
    ctx.textAlign = 'left'
  }
  label(610, f.challenger, f.champion ? 'challenger' : 'new')
  if (f.champion) label(1150, f.champion, 'champion', true)

  // the strap line
  pill(ctx, 64, 520, 'EVERY BUY IS A FIGHT.', RED, '#170405', `400 24px ${DISPLAY}`)
  ctx.fillStyle = GOLD
  ctx.font = `600 22px ${MONO}`
  ctx.fillText('$BETTA', 64, 600)
  ctx.fillStyle = '#5d7d89'
  ctx.fillText(host, 180, 600)
}

export interface SiteFacts {
  fights: number
  champion: Fish | null
  streak: number
  inTheDeep: number
  pct: number
}

/** The whole arena right now: the og:image of the site. */
export function drawSiteCard(ctx: Ctx, s: SiteFacts, host: string) {
  ground(ctx)
  ctx.fillStyle = '#8eabb6'
  ctx.font = `500 22px ${MONO}`
  ctx.fillText('BETTA ARENA · $BETTA · ROBINHOOD CHAIN', 64, 92)
  ctx.font = `400 104px ${DISPLAY}`
  ctx.fillStyle = '#eaf4f6'
  ctx.fillText('EVERY BUY IS', 64, 200)
  ctx.fillStyle = RED
  ctx.fillText('A FIGHT.', 64, 304)
  if (s.champion) fish(ctx, s.champion, 900, 260, 380, -1, true)
  const stat = (x: number, k: string, v: string, c: string) => {
    ctx.fillStyle = '#5d7d89'
    ctx.font = `500 18px ${MONO}`
    ctx.fillText(k, x, 410)
    ctx.fillStyle = c
    ctx.font = `400 46px ${DISPLAY}`
    ctx.fillText(v, x, 460)
  }
  stat(64, 'FIGHTS', s.fights.toLocaleString('en-US'), '#eaf4f6')
  stat(300, 'BELT HELD', s.champion ? `${s.streak} WINS` : '—', GOLD)
  stat(560, 'IN THE DEEP', `${s.pct.toFixed(2)}%`, RED)
  pill(ctx, 64, 520, 'THE DEEP KEEPS EVERYTHING.', RED, '#170405', `400 24px ${DISPLAY}`)
  ctx.fillStyle = '#5d7d89'
  ctx.font = `600 22px ${MONO}`
  ctx.fillText(host, 64, 600)
}

/** The text that goes with a fight posted to X. */
export function postText(f: Fight) {
  const [a, b] = fightHeadline(f)
  return `${a} ${b}\nFight #${f.n} on Betta Arena. Every buy is a fight.\n$BETTA`
}
