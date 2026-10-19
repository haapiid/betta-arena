// One continuous jar shot, as a pure function of time T (seconds):
//   0.0 – 5.7   feeding: the tin tips, pellets fall, the fish hunts them down one by one
//   5.7 – 10.0  water change: a few days pass, the water clouds, the pitcher pours, a ketapang leaf sinks
//  10.0 – 15.5  Mirror Flaring: the mirror slides in beside the jar and the fish flares at itself

import { bettaExtent } from '../render/betta'
import type { Bit } from '../render/food'
import type { Genome } from '../game/species'
import { clamp, faceFrom, fishScale, foodAt, lerp, prand, smooth, wander, type FishState, type JarDims, type JarScene, type Part } from './jarScene'

export const PHASE = { feed: 0, water: 5.7, mirror: 10.0, end: 15.5 }

const PELLETS = 5

export interface JarHud {
  full: number // 0..100
  water: number
  atk: number
  eaten: number
}

function pelletPlan(d: JarDims) {
  const list = Array.from({ length: PELLETS }, (_, i) => ({
    i,
    t0: 1.0 + 0.16 * i,
    x0: d.mouthX + (prand(i, 3) - 0.5) * d.w * 0.16,
    vx: (prand(i, 4) - 0.5) * 34,
  }))
  // the fish sweeps across them from right to left, staying in open water
  const order = [...list].sort((a, b) => b.x0 + b.vx * 0.3 - (a.x0 + a.vx * 0.3))
  return order.map((p, k) => ({ ...p, eat: 2.9 + 0.62 * k }))
}

function pelletAt(p: { t0: number; x0: number; vx: number; i: number }, T: number, d: JarDims) {
  return foodAt('pellet', T, p.t0, p.x0, d.mouthY, p.vx, d.gt - 2, prand(p.i, 5) * 6)
}

export function jarAt(T: number, d: JarDims, g: Genome, ratio: number, seed = 1.3): { scene: JarScene; hud: JarHud } {
  const s = fishScale(d, g, ratio)
  const e = bettaExtent(g)
  const off = e.right * s * g.size * 0.8 // centre → mouth
  const plan = pelletPlan(d)
  const W = (tt: number) => wander(tt, d, seed, 1.15)

  // ---------- fish ----------
  let fish: FishState
  const start = 2.0
  const lastEat = plan[plan.length - 1].eat
  const mouthTarget = (k: number) => {
    const b = pelletAt(plan[k], plan[k].eat, d)!
    return { x: b.x, y: Math.max(b.y, d.h * 0.17) }
  }
  if (T < start || T > lastEat + 1.6) {
    fish = W(T)
  } else if (T <= lastEat) {
    // chasing: piecewise eased moves between the pellets, mouth first
    let k = 0
    while (k < plan.length && T > plan[k].eat) k++
    const w0 = W(start)
    const A = k === 0 ? { x: w0.x + w0.face * off, y: w0.y } : mouthTarget(k - 1)
    const B = mouthTarget(k)
    const t0 = k === 0 ? start : plan[k - 1].eat
    const t1 = plan[k].eat
    const u = smooth((T - t0) / (t1 - t0))
    const segFace = (pa: { x: number }, pb: { x: number }, fallback: number) => (Math.abs(pb.x - pa.x) < 3 ? fallback : Math.sign(pb.x - pa.x))
    const prevFace = k === 0 ? w0.face : k === 1 ? segFace({ x: w0.x + w0.face * off }, mouthTarget(0), w0.face) : segFace(mouthTarget(k - 2), mouthTarget(k - 1), 1)
    const thisFace = segFace(A, B, prevFace)
    let face = lerp(prevFace, thisFace, smooth((T - t0) / 0.35))
    if (Math.abs(face) < 0.15) face = (thisFace || 1) * 0.15
    const mx = lerp(A.x, B.x, u)
    const my = lerp(A.y, B.y, u)
    const speed = Math.sin(u * Math.PI)
    fish = { x: mx - face * off, y: my, face, tilt: (B.y - A.y) * 0.004 * speed * Math.sign(face), swim: 0.35 + 0.6 * speed, flare: 0.25, gulp: 0 }
  } else {
    // back to cruising
    const b = smooth((T - lastEat) / 1.6)
    const P = mouthTarget(plan.length - 1)
    const w = W(T)
    const n = plan.length
    const lastFace = Math.sign(mouthTarget(n - 1).x - mouthTarget(n - 2).x) || 1
    const face0 = lerp(lastFace, w.face, smooth((T - lastEat) / 0.8))
    const face = Math.abs(face0) < 0.15 ? Math.sign(face0 || 1) * 0.15 : face0
    fish = { ...w, x: lerp(P.x - lastFace * off, w.x, b), y: lerp(P.y, w.y, b), face, swim: 0.3 }
  }
  // gulp right after each bite
  let eaten = 0
  for (const p of plan) {
    if (T >= p.eat) {
      eaten++
      fish.gulp = Math.max(fish.gulp, clamp(1 - (T - p.eat) * 3.5))
    }
  }

  // mirror phase: swim nose-first to the glass on the mirror side and display
  const mirK = smooth((T - (PHASE.mirror + 0.2)) / 0.8)
  if (T > PHASE.mirror + 0.3) {
    const b = smooth((T - (PHASE.mirror + 0.3)) / 1.4)
    const tx = d.w * 0.93 - e.right * s * g.size * 1.05 - Math.max(0, Math.sin(T * Math.PI)) * d.w * 0.05
    const ty = d.h * 0.6 + Math.sin((T * Math.PI) / 3) * 5
    const face0 = lerp(fish.face, 1, smooth((T - (PHASE.mirror + 0.3)) / 0.7))
    fish = {
      ...fish,
      x: lerp(fish.x, tx, b),
      y: lerp(fish.y, ty, b),
      face: Math.abs(face0) < 0.15 ? 0.15 : face0,
      tilt: fish.tilt * (1 - b),
      swim: lerp(fish.swim, 0.6072, b),
      flare: mirK * b * (0.55 + 0.45 * Math.max(0, Math.sin((T * Math.PI * 2) / 3))),
    }
  }

  // ---------- food ----------
  const bits: Bit[] = []
  const splashes: { x: number; k: number }[] = []
  const parts: Part[] = []
  for (const p of plan) {
    if (T < p.eat) {
      const b = pelletAt(p, T, d)
      if (b) bits.push(b)
    }
    const land = p.t0 + 0.2
    const b = pelletAt(p, land + 0.05, d)
    if (b && T > land && T < land + 0.7) splashes.push({ x: b.x, k: (T - land) / 0.7 })
    // crumbs where it bit
    if (T > p.eat && T < p.eat + 0.5) {
      const at = pelletAt(p, p.eat, d)!
      const k = (T - p.eat) / 0.5
      for (let j = 0; j < 6; j++) {
        const a = prand(j + p.i * 9, 7) * Math.PI * 2
        const r = 14 * (1 - Math.pow(1 - k, 2)) * (0.5 + prand(j, 8))
        parts.push({ x: at.x + Math.cos(a) * r, y: Math.max(d.h * 0.17, at.y) + Math.sin(a) * r, life: 0.5 - k * 0.5, kind: 'crumb', c: '#8a4e22', r: 0.8 })
      }
    }
  }
  const tinK = smooth((T - 0.4) / 0.45) * (1 - smooth((T - 2.0) / 0.4))
  const tin = { k: tinK, shake: T > 0.9 && T < 1.9 ? 1 : 0, id: 'pellet' }

  // ---------- water change ----------
  const W0 = PHASE.water
  const murk = smooth((T - (W0 + 0.1)) / 0.6) // a few days without a change
  const clear = smooth((T - (W0 + 1.7)) / 2.2)
  const water = 100 - 95 * murk * (1 - clear)
  const pourEl = T - (W0 + 1.0)
  const pitK = pourEl < 0 || pourEl > 3.4 ? 0 : Math.min(smooth(pourEl / 0.6), smooth((3.4 - pourEl) / 0.5))
  const flow = pourEl > 0.6 && pourEl < 2.9
  if (pourEl > 0.6 && pourEl < 3.6) {
    for (let j = 0; j < 46; j++) {
      const ts = 0.6 + prand(j, 11) * 2.3
      const a = pourEl - ts
      if (a < 0 || a > 1) continue
      parts.push({ x: d.w * 0.45 + (prand(j, 12) - 0.5) * 14 + (prand(j, 13) - 0.5) * 10 * a, y: 4 + prand(j, 14) * d.h * 0.4 - (20 + prand(j, 15) * 20) * a, life: 1 - a, kind: 'bubble', c: '#fff', r: 0.8 + prand(j, 16) * 1.8 })
    }
    if (flow) for (let j = 0; j < 3; j++) splashes.push({ x: d.w * 0.45, k: ((pourEl * 1.6 + j / 3) % 1) })
  }

  // ketapang leaf: dropped in at the end of the water change, it sinks and stays
  let leaf: JarScene['leaf'] = null
  const L0 = W0 + 3.4
  let tint = 0
  if (T > L0) {
    const el = T - L0
    const y0 = d.mouthY - 8
    const tAir = Math.sqrt((-y0 * 2) / 140)
    const x0 = d.w * 0.4
    if (el < tAir) leaf = { x: x0 + el * 6, y: y0 + 70 * el * el, rot: 0.4 + el * 2, alpha: 1 }
    else {
      const a = el - tAir
      const y = Math.min(d.gt - 3, a * 16)
      const landed = y >= d.gt - 3
      leaf = { x: x0 + tAir * 6 - Math.cos(a * 1.6) * 8.75 + 8.75, y, rot: landed ? -0.1 : 0.3 * Math.sin(a * 1.6), alpha: 1 }
      if (a < 0.7) splashes.push({ x: x0 + tAir * 6, k: a / 0.7 })
      tint = 0.2 * smooth(a / 3)
    }
  }

  // ---------- training gains ----------
  let atk = 41
  for (const at of [12.2, 13.5, 14.8]) if (T > at) atk++
  for (const at of [12.2, 13.5, 14.8]) {
    const el = T - at
    if (el > 0 && el < 1.2)
      for (let j = 0; j < 8; j++) {
        parts.push({ x: fish.x + (prand(j + at * 10, 21) - 0.5) * 90, y: fish.y + (prand(j + at * 10, 22) - 0.5) * 50 - el * 16, life: 1 - el / 1.2, kind: 'spark', c: '#ffd36a', r: 1.4 + prand(j, 23) * 1.4 })
      }
  }

  const scene: JarScene = {
    genome: g,
    fish,
    sizeRatio: ratio,
    water,
    happy: water > 80 && T < W0 + 0.2 ? true : water > 95 && T > W0 + 4,
    bits,
    splashes,
    parts,
    tin,
    pitcher: { k: pitK, flow },
    mirror: mirK,
    leaf,
    tint: { c: '#8a4a12', a: tint },
  }
  const full = Math.min(100, 32 + eaten * 13.6)
  return { scene, hud: { full, water, atk, eaten } }
}

export { faceFrom }
