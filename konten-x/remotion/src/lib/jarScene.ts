// Stateless drawing helpers: every function takes the time it should draw, so Remotion can
// render any frame in any order.

import { bettaExtent, drawBetta, type BettaPose } from '../render/betta'
import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import { drawGlass, jarFrame, jarPath } from '../render/jar'
import type { Genome } from '../game/species'

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (x: number) => {
  const k = clamp(x)
  return k * k * (3 - 2 * k)
}
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)

// deterministic pseudo-random in [0,1)
export function prand(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function placeFish(ctx: CanvasRenderingContext2D, g: Genome, x: number, y: number, s: number, face: number, tilt: number, pose: BettaPose) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.scale(face * s * g.size, s * g.size * (pose.dead ? -1 : 1))
  drawBetta(ctx, g, pose)
  ctx.restore()
}

/** fish scale so that its full length is `len` px */
export function scaleFor(g: Genome, len: number) {
  const e = bettaExtent(g)
  return len / (e.right - e.left)
}

export interface ShelfJar {
  x: number // canvas px of the jar box
  y: number
  w: number
  h: number
}

/**
 * A keeper's jar on the shelf: water, gravel, a fish wandering slowly, the glass on top.
 * `fish` false draws the jar empty (its fish has jumped).
 */
export function drawShelfJar(ctx: CanvasRenderingContext2D, box: ShelfJar, t: number, g: Genome, fish: boolean, seed: number, ratio = 0.5) {
  ctx.save()
  ctx.translate(box.x, box.y)
  const J = jarFrame(box.w, box.h)
  const w = J.W
  const h = J.H - J.surf
  ctx.save()
  jarPath(ctx, J)
  ctx.clip()
  ctx.translate(J.x, J.y + J.surf)
  drawTankBack(ctx, w, h, t, { water: 100, happy: false, seed, plants: true })
  if (fish) {
    const s = scaleFor(g, w * ratio)
    const u = t * 0.9 + seed
    const x = w * (0.5 + 0.16 * Math.sin(u * 0.42) + 0.04 * Math.sin(u * 1.03))
    const y = h * 0.46 + h * 0.08 * Math.sin(u * 0.61)
    const vx = Math.cos(u * 0.42) * 0.42 * 0.16 + Math.cos(u * 1.03) * 1.03 * 0.04
    const face = Math.abs(Math.tanh(vx * 30)) < 0.15 ? Math.sign(vx || 1) * 0.15 : Math.tanh(vx * 30)
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.beginPath()
    ctx.ellipse(x, gravelTop(h) + 3, w * 0.1, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    placeFish(ctx, g, x, y, s, face, 0, { t, swim: 0.3, flare: 0.15, health: 100 })
  }
  drawTankFront(ctx, w, h, t, { water: 100, happy: false, seed, leaf: false })
  ctx.restore()
  drawGlass(ctx, J)
  ctx.restore()
  return J
}
