// A stateless version of the game's TankView (src/components/FishCanvas.tsx): everything that
// moves is passed in for the current time, so Remotion can render any frame in any order.

import { bettaExtent, drawBetta, type BettaPose } from '../render/betta'
import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import { drawGlass, drawLeaf, drawMirror, drawPitcher, drawSun, drawTin, FOOD_TIN, jarFrame, jarPath, type JarFrame } from '../render/jar'
import { drawBit, type Bit, type BitKind } from '../render/food'
import { rgba } from '../render/color'
import type { Genome } from '../game/species'

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (x: number) => {
  const k = clamp(x)
  return k * k * (3 - 2 * k)
}
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)

export function placeFish(ctx: CanvasRenderingContext2D, g: Genome, x: number, y: number, s: number, face: number, tilt: number, pose: BettaPose) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.scale(face * s * g.size, s * g.size * (pose.dead ? -1 : 1))
  drawBetta(ctx, g, pose)
  ctx.restore()
}

export interface FishState {
  x: number // water-local, fish centre
  y: number
  face: number // 1 right, -1 left
  tilt: number
  swim: number
  flare: number
  gulp: number
}

export interface Part {
  x: number
  y: number
  life: number
  kind: 'bubble' | 'crumb' | 'spark'
  c: string
  r: number
}

export interface JarScene {
  genome: Genome
  fish: FishState
  sizeRatio?: number
  water?: number // 0..100 clean
  happy?: boolean
  bits?: Bit[]
  splashes?: { x: number; k: number }[]
  parts?: Part[]
  tin?: { k: number; shake: number; id: string }
  pitcher?: { k: number; flow: boolean }
  mirror?: number
  sun?: number
  leaf?: { x: number; y: number; rot: number; alpha: number } | null
  tint?: { c: string; a: number }
  seed?: number
}

export interface JarDims {
  J: JarFrame
  w: number
  h: number
  ox: number
  oy: number
  gt: number
  mouthX: number
  mouthY: number
}

export function jarDims(cw: number, ch: number): JarDims {
  const J = jarFrame(cw, ch)
  const w = J.W
  const h = J.H - J.surf
  return { J, w, h, ox: J.x, oy: J.y + J.surf, gt: gravelTop(h), mouthX: w * 0.5, mouthY: -(J.surf - J.lip) + 2 }
}

export function fishScale(d: JarDims, g: Genome, ratio = 0.5) {
  const e = bettaExtent(g)
  return (d.w * ratio) / (e.right - e.left) / Math.max(1, g.size * 0.9)
}

// a smooth wander inside the jar; face follows the horizontal velocity
export function wander(t: number, d: JarDims, seed = 0, speed = 1): FishState {
  const pos = (tt: number) => {
    const u = tt * speed
    return {
      x: d.w * (0.5 + 0.17 * Math.sin(u * 0.42 + seed) + 0.05 * Math.sin(u * 1.03 + seed * 2.1)),
      y: d.h * 0.48 + d.h * (0.12 * Math.sin(u * 0.61 + seed * 1.7) + 0.04 * Math.sin(u * 1.37 + seed)),
    }
  }
  const p = pos(t)
  const q = pos(t + 0.05)
  const vx = (q.x - p.x) / 0.05
  const vy = (q.y - p.y) / 0.05
  const face = faceFrom(vx)
  return { ...p, face, tilt: Math.atan2(vy, Math.abs(vx) + 20) * 0.5 * Math.sign(face), swim: clamp(Math.hypot(vx, vy) / 45), flare: 0, gulp: 0 }
}

export function faceFrom(vx: number) {
  const f = Math.tanh(vx / 5)
  return Math.abs(f) < 0.15 ? Math.sign(f || 1) * 0.15 : f
}

// food dropped from the tin: deterministic flight, float, sink
export function foodAt(kind: BitKind, t: number, t0: number, x0: number, y0: number, vx: number, floor: number, ph: number): Bit | null {
  const el = t - t0
  if (el < 0) return null
  const vy0 = 15
  const g = 130
  // time to reach y=0
  const tl = (-vy0 + Math.sqrt(vy0 * vy0 - 4 * g * y0)) / (2 * g)
  const b: Bit = { kind, x: x0, y: y0, vx, vy: 0, age: -1, ph, life: 1 }
  if (el < tl) {
    b.x = x0 + vx * el
    b.y = y0 + vy0 * el + g * el * el
    return b
  }
  const a = el - tl
  b.age = a
  b.x = x0 + vx * tl + vx * 0.2 * Math.min(a, 1)
  if (kind === 'pellet') b.y = a < 0.5 ? Math.sin(a * 6 + ph) * 0.6 : Math.min(floor, (a - 0.5) * 30)
  else if (kind === 'bloodworm') b.y = Math.min(floor, 2 + a * 9)
  else b.y = Math.min(floor, 3 + a * 10 + Math.sin(a * 6 + ph) * 3)
  b.x += kind === 'bloodworm' ? Math.sin(a * 1.5 + ph) * 3 : kind === 'daphnia' ? Math.sin(a * 1.3 + ph) * 6 : 0
  return b
}

export function landTime(t0: number, y0: number) {
  const vy0 = 15
  const g = 130
  return t0 + (-vy0 + Math.sqrt(vy0 * vy0 - 4 * g * y0)) / (2 * g)
}

export function drawJarScene(ctx: CanvasRenderingContext2D, cw: number, ch: number, t: number, sc: JarScene) {
  const d = jarDims(cw, ch)
  const { J, w, h, ox, oy, gt } = d
  const look = { water: sc.water ?? 100, happy: !!sc.happy, seed: sc.seed ?? 7 }
  const s = fishScale(d, sc.genome, sc.sizeRatio ?? 0.5)
  const f = sc.fish

  drawSun(ctx, cw * 0.9, ch * 0.1, Math.max(8, cw * 0.04), sc.sun ?? 0, t)

  ctx.save()
  jarPath(ctx, J)
  ctx.clip()
  ctx.translate(ox, oy)
  drawTankBack(ctx, w, h, t, look)

  for (const sp of sc.splashes ?? []) {
    ctx.strokeStyle = `rgba(230,250,255,${0.6 * (1 - sp.k)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(sp.x, 1, 3 + sp.k * 16, 1 + sp.k * 3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const b of sc.bits ?? []) if (b.y >= 0) drawBit(ctx, b, t)
  if (sc.leaf && sc.leaf.y >= 0) drawLeaf(ctx, sc.leaf.x, sc.leaf.y, sc.leaf.rot, 0.55, sc.leaf.alpha)

  const sunK = sc.sun ?? 0
  if (sunK > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const g = ctx.createLinearGradient(w, 0, w * 0.3, h)
    g.addColorStop(0, `rgba(255,200,110,${0.5 * sunK})`)
    g.addColorStop(1, 'rgba(255,200,110,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // shadow + fish
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.beginPath()
  ctx.ellipse(f.x, gt + 3, Math.max(4, w * 0.12 * (1 - (gt - f.y) / h)), 3, 0, 0, Math.PI * 2)
  ctx.fill()
  placeFish(ctx, sc.genome, f.x, f.y, s, f.face, f.tilt, { t, swim: f.swim, flare: f.flare, gulp: f.gulp, health: 100 })

  for (const q of sc.parts ?? []) {
    if (q.life <= 0) continue
    if (q.kind === 'bubble') {
      ctx.strokeStyle = `rgba(230,250,255,${0.7 * q.life})`
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (q.kind === 'spark') {
      const r = q.r * (0.6 + 0.4 * Math.sin(t * 12 + q.x))
      ctx.fillStyle = q.c
      ctx.globalAlpha = clamp(q.life)
      ctx.beginPath()
      ctx.moveTo(q.x, q.y - r * 2)
      ctx.lineTo(q.x + r * 0.5, q.y)
      ctx.lineTo(q.x, q.y + r * 2)
      ctx.lineTo(q.x - r * 0.5, q.y)
      ctx.closePath()
      ctx.moveTo(q.x - r * 2, q.y)
      ctx.lineTo(q.x, q.y + r * 0.5)
      ctx.lineTo(q.x + r * 2, q.y)
      ctx.lineTo(q.x, q.y - r * 0.5)
      ctx.fill()
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = q.c
      ctx.globalAlpha = clamp(q.life * 2)
      ctx.fillRect(q.x, q.y, q.r * 1.6, q.r * 1.6)
      ctx.globalAlpha = 1
    }
  }

  drawTankFront(ctx, w, h, t, { ...look, leaf: !sc.leaf })
  if (sc.tint && sc.tint.a > 0.005) {
    ctx.fillStyle = rgba(sc.tint.c, sc.tint.a)
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()

  drawGlass(ctx, J)

  const mirK = sc.mirror ?? 0
  if (mirK > 0) {
    const mw = cw * 0.155
    const mh = ch * 0.44
    const plane = J.x + J.W + cw * 0.015
    const mx = plane + (1 - easeOut(mirK)) * (cw - plane + 4)
    drawMirror(ctx, mx, J.base, mw, mh, t, () => {
      ctx.globalAlpha = 0.75
      placeFish(ctx, sc.genome, 2 * mx - (ox + f.x), oy + f.y, s, -f.face, -f.tilt, { t, swim: 0.4, flare: f.flare, health: 100 })
      ctx.globalAlpha = 1
    })
  }

  const mcx = ox + d.mouthX
  const mcy = J.y + J.lip
  const size = Math.max(18, cw * 0.09)
  if (sc.tin && sc.tin.k > 0) drawTin(ctx, mcx + 4, mcy - 4, sc.tin.k, sc.tin.shake, FOOD_TIN[sc.tin.id] ?? FOOD_TIN.pellet, size)
  if (sc.pitcher && sc.pitcher.k > 0) {
    const sx = mcx - J.W * 0.04
    const sy = mcy - 6
    drawPitcher(ctx, sx, sy, sc.pitcher.k, size * 1.25)
    if (sc.pitcher.flow) {
      ctx.strokeStyle = 'rgba(190,238,255,0.75)'
      ctx.lineWidth = 4.5 + Math.sin(t * 20) * 0.8
      ctx.beginPath()
      ctx.moveTo(sx, sy + 2)
      ctx.quadraticCurveTo(sx + 2, (sy + oy) / 2, ox + w * 0.45, oy + 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 0.8
      ctx.stroke()
    }
  }

  ctx.save()
  ctx.translate(ox, oy)
  for (const b of sc.bits ?? []) if (b.y < 0) drawBit(ctx, b, t)
  if (sc.leaf && sc.leaf.y < 0) drawLeaf(ctx, sc.leaf.x, sc.leaf.y, sc.leaf.rot, 0.55, sc.leaf.alpha)
  ctx.restore()
  return d
}

// deterministic pseudo-random in [0,1) for particle placement
export function prand(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}
