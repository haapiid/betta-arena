// The ring: one glass tank at the fights. A buy drops a challenger in from above, it fights the
// champion on the spot (the same hit / crit / miss playback as the site's ArenaView), the loser sinks.
// Logic time (`tau`) and animation time (`T`) are separate so the GIF can loop seamlessly.

import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import type { Genome } from '../game/species'
import { clamp, lerp, placeFish, prand, scaleFor, smooth } from './jarScene'

export type Ev = { actor: 0 | 1; kind: 'hit' | 'crit' | 'miss'; hp: [number, number] }

export interface Fighter {
  g: Genome
  name: string
  breed: string
  lv: number
}

export interface Bout {
  a: Fighter // challenger: drops in, left corner, faces right
  b: Fighter // champion: right corner, faces left
  events: Ev[]
  drop: number // s: the challenger hits the water
  start: number // s: first strike
  step: number // s per strike
  exit?: number // s: the loser fades out of the ring (GIF loop)
  heal?: number // s: the champion's HP refills (GIF loop)
  seed?: number
}

export function boutState(b: Bout, tau: number) {
  const el = tau - b.start
  const n = b.events.length
  const step = el < 0 ? -1 : Math.min(n, Math.floor(el / b.step))
  const ph = el < 0 ? 0 : (el % b.step) / b.step
  const done = step >= n
  const last = b.events[n - 1].hp
  const loser: 0 | 1 = last[0] <= 0 ? 0 : 1
  const doneAt = b.start + n * b.step
  return { step, ph, done, el, loser, doneAt }
}

export function boutHp(b: Bout, tau: number): [number, number] {
  const { step, ph } = boutState(b, tau)
  let hp: [number, number]
  if (step < 0) hp = [100, 100]
  else if (step >= b.events.length) hp = [...b.events[b.events.length - 1].hp]
  else {
    const cur = b.events[step].hp
    const prev = step === 0 ? [100, 100] : b.events[step - 1].hp
    const k = smooth((ph - 0.3) / 0.25)
    hp = [lerp(prev[0], cur[0], k), lerp(prev[1], cur[1], k)]
  }
  if (b.heal !== undefined) {
    const k = smooth((tau - b.heal) / 0.6)
    hp[1] = lerp(hp[1], 100, k)
  }
  return hp
}

/** 0..1: how far the challenger has dropped in (0 = not yet there) */
export function dropK(b: Bout, tau: number) {
  return clamp((tau - (b.drop - 0.55)) / 0.55)
}

const LOOK = (seed: number) => ({ water: 100, happy: false, seed, plants: true })

export function drawBout(ctx: CanvasRenderingContext2D, w: number, h: number, T: number, tau: number, b: Bout) {
  const seed = b.seed ?? 99
  drawTankBack(ctx, w, h, T, LOOK(seed))
  const { step, ph, done, el, loser } = boutState(b, tau)
  const ev = !done && step >= 0 ? b.events[step] : null
  const gt = gravelTop(h)
  const s = scaleFor(b.b.g, w * 0.3)
  const baseY = Math.min(h * 0.52, gt - h * 0.2)
  const gap = w * 0.17
  const pos = [
    { x: w / 2 - gap, y: baseY, face: 1, tilt: 0, flare: 1, sick: false, alpha: 1 },
    { x: w / 2 + gap, y: baseY, face: -1, tilt: 0, flare: 0.35 + 0.25 * Math.sin(T * Math.PI), sick: false, alpha: 1 },
  ]
  // slow idle bob; periods divide 6 s so the GIF can loop
  pos.forEach((p, i) => {
    p.y += Math.sin((T * Math.PI * 2) / 3 + i * 2) * 4
    p.x += Math.sin((T * Math.PI * 2) / 6 + i) * 3
  })

  // the challenger drops in from above the surface
  const dk = dropK(b, tau)
  const fallStart = b.drop - 0.55
  if (tau < b.drop + 0.6) {
    const k = clamp((tau - fallStart) / 0.55)
    // falls fast, then the water brakes it with a small bounce
    const yIn = -h * 0.35
    const fall = k < 1 ? yIn + (baseY + h * 0.08 - yIn) * k * k : baseY + h * 0.08
    const settle = smooth((tau - b.drop) / 0.6)
    pos[0].y = lerp(fall, pos[0].y, settle)
    pos[0].tilt = 0.75 * (1 - smooth((tau - b.drop + 0.1) / 0.5))
    pos[0].flare = settle
  }
  // champion flares up when the challenger lands
  if (tau > b.drop) pos[1].flare = Math.max(pos[1].flare, smooth((tau - b.drop) / 0.4))

  if (ev) {
    const at = pos[ev.actor]
    const df = pos[1 - ev.actor]
    const lunge = ph < 0.3 ? Math.sin((ph / 0.3) * (Math.PI / 2)) : Math.max(0, 1 - (ph - 0.3) / 0.5)
    at.x += at.face * lunge * gap * 0.42
    at.tilt = at.face * -0.1 * lunge
    if (ev.kind === 'miss') df.y -= Math.sin(Math.min(1, ph / 0.4) * Math.PI) * 26
    else if (ph > 0.25 && ph < 0.75) {
      const k = 1 - (ph - 0.25) / 0.5
      df.x += at.face * 14 * k
      df.tilt = at.face * 0.18 * k
    }
  }
  if (done) {
    const k = smooth((el - b.events.length * b.step) / 0.7)
    const lo = pos[loser]
    lo.y = lerp(lo.y, gt - 22, k)
    lo.flare = 1 - k
    lo.sick = k > 0.3
    lo.tilt = 0.25 * lo.face * k
    const wi = pos[1 - loser]
    wi.flare = 0.6 + 0.4 * Math.max(0, Math.sin(T * Math.PI * 2))
    // the GIF loop: the winner calms back down to its idle display
    if (b.heal !== undefined && loser === 0) wi.flare = lerp(wi.flare, 0.35 + 0.25 * Math.sin(T * Math.PI), smooth((tau - b.heal) / 0.6))
    if (b.exit !== undefined) lo.alpha = 1 - smooth((tau - b.exit) / 0.6)
  }

  // splash where the challenger broke the surface
  const sp = tau - (fallStart + 0.55 * Math.sqrt(-(-h * 0.35) / (baseY + h * 0.08 + h * 0.35)))
  if (sp > 0 && sp < 0.9) {
    const k = sp / 0.9
    const sx = w / 2 - gap
    ctx.strokeStyle = `rgba(235,252,255,${0.75 * (1 - k)})`
    ctx.lineWidth = 1.4
    for (const r of [1, 0.6]) {
      ctx.beginPath()
      ctx.ellipse(sx, 3, (6 + k * 40) * r, (1.5 + k * 5) * r, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let j = 0; j < 9; j++) {
      const a = -Math.PI / 2 + (prand(j, 8) - 0.5) * 1.6
      const v = 40 + prand(j, 9) * 50
      const x = sx + Math.cos(a) * v * sp
      const y = 2 + Math.sin(a) * v * sp + 160 * sp * sp
      if (y > 4) continue
      ctx.fillStyle = `rgba(235,252,255,${0.8 * (1 - k)})`
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // bubbles trailing the challenger as it sinks in
  if (dk > 0 && tau < b.drop + 1.4) {
    for (let j = 0; j < 14; j++) {
      const a = tau - fallStart - prand(j, 11) * 0.5
      if (a < 0) continue
      const life = clamp(1 - a / 1.3)
      if (life <= 0) continue
      const x = w / 2 - gap + (prand(j, 12) - 0.5) * 40 + Math.sin(a * 6 + j) * 3
      const y = baseY + (prand(j, 13) - 0.3) * 40 - a * 70
      if (y < 2) continue
      ctx.strokeStyle = `rgba(230,250,255,${0.7 * life})`
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(x, y, 1 + prand(j, 14) * 2.2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  ;[b.a, b.b].forEach((F_, i) => {
    const p = pos[i]
    if (i === 0 && dk <= 0) return
    if (p.alpha <= 0.01) return
    const hp = boutHp(b, tau)
    ctx.globalAlpha = p.alpha
    placeFish(ctx, F_.g, p.x, p.y, s, p.face, p.tilt, { t: T, flare: p.flare, swim: 0.6, sick: p.sick, health: hp[i] })
    ctx.globalAlpha = 1
  })

  // fin flakes from every hit
  b.events.forEach((e2, i) => {
    if (e2.kind === 'miss') return
    const t0 = b.start + i * b.step + b.step * 0.3
    const a = tau - t0
    if (a < 0 || a > 1.1) return
    const dir = e2.actor === 0 ? 1 : -1
    const hx = w * (e2.actor === 0 ? 0.6 : 0.4)
    const col = e2.actor === 0 ? b.b.g.fin : b.a.g.fin
    const n = e2.kind === 'crit' ? 24 : 13
    for (let j = 0; j < n; j++) {
      const vx = dir * (20 + prand(j + i * 40, 1) * 70)
      const vy = (prand(j + i * 40, 2) - 0.5) * 70
      const x = hx + (vx * (1 - Math.exp(-1.5 * a))) / 1.5
      const y = baseY + (prand(j + i * 40, 3) - 0.5) * 20 + vy * a + 15 * a * a
      ctx.fillStyle = prand(j, 4) < 0.5 ? col : '#e8f6ff'
      ctx.globalAlpha = clamp(1 - 0.9 * a) * 0.85
      ctx.beginPath()
      ctx.ellipse(x, y, 2.2, 1.2, vx * 0.02, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
  if (ev && ev.kind === 'crit' && ph > 0.28 && ph < 0.42) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(0, 0, w, h)
  }
  drawTankFront(ctx, w, h, T, { ...LOOK(seed), leaf: false })
}
