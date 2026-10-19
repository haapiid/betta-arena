import { useEffect, useRef } from 'react'
import { bettaExtent, drawBetta } from '../render/betta'
import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import { drawDropper, drawGlass, drawLeaf, drawMirror, drawPitcher, drawSun, drawTin, FOOD_TIN, jarFrame, jarPath, presence } from '../render/jar'
import { drawBit, edible, newBit, stepBit, type Bit, type BitKind } from '../render/food'
import { rgba } from '../render/color'
import { useCanvasLoop } from '../render/useCanvasLoop'
import type { Genome } from '../game/species'
import type { Battle } from '../game/battle'

const imgCache = new Map<string, HTMLImageElement>()
function speciesImage(src?: string) {
  if (!src) return null
  let im = imgCache.get(src)
  if (!im) {
    im = new Image()
    im.src = src
    imgCache.set(src, im)
  }
  return im.complete && im.naturalWidth ? im : null
}

// Draw one fish at (x,y) with scale s; face 1 = right, -1 = left (values between = mid-turn)
function placeFish(
  ctx: CanvasRenderingContext2D,
  g: Genome,
  x: number,
  y: number,
  s: number,
  face: number,
  tilt: number,
  pose: Parameters<typeof drawBetta>[2],
  image?: string,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.scale(face * s * g.size, s * g.size * (pose.dead ? -1 : 1))
  const im = speciesImage(image)
  if (im) {
    const e = bettaExtent(g)
    const ew = e.right - e.left
    const eh = (ew * im.naturalHeight) / im.naturalWidth
    ctx.drawImage(im, e.left, -eh / 2, ew, eh)
  } else drawBetta(ctx, g, pose)
  ctx.restore()
}

// ---------- portrait (shop cards) ----------
export function Portrait({ genome, image, flare = 0.3, className }: { genome: Genome; image?: string; flare?: number; className?: string }) {
  const ref = useCanvasLoop((ctx, w, h, t) => {
    const bg = ctx.createRadialGradient(w * 0.55, h * 0.35, 10, w / 2, h / 2, Math.max(w, h) * 0.75)
    bg.addColorStop(0, '#1d5c6c')
    bg.addColorStop(1, '#061a22')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    const e = bettaExtent(genome)
    const s = Math.min(w / (e.right - e.left), h / (e.bottom - e.top)) * 0.86 / genome.size
    const cx = w / 2 - ((e.left + e.right) / 2) * s * genome.size
    placeFish(ctx, genome, cx, h / 2 + Math.sin(t * 1.2) * 3, s, 1, Math.sin(t * 0.9) * 0.03, { t, flare: flare + 0.3 * Math.max(0, Math.sin(t * 0.5)), swim: 0.15 }, image)
  })
  return <canvas ref={ref} className={className} aria-hidden="true" />
}

// ---------- a jar with a swimming fish ----------
export interface TankFish {
  genome: Genome
  image?: string
  health: number
  hunger: number
  water: number
  sick: boolean
  alive: boolean
  size?: number // growth stage: juveniles are smaller
}

// a care action to play in the jar: `n` bumps every time, `id` is the item or training used
export interface CareAct {
  n: number
  id: string
}

type FxKind = 'feed' | 'pour' | 'leaf' | 'salt' | 'drops' | 'mirror' | 'sun' | 'sparkle'

const FX: Record<string, FxKind> = {
  pellet: 'feed',
  daphnia: 'feed',
  bloodworm: 'feed',
  water: 'pour',
  ketapang: 'leaf',
  soak: 'leaf',
  salt: 'salt',
  methylene: 'drops',
  revive: 'drops',
  mirror: 'mirror',
  sun: 'sun',
}
const FX_DUR: Record<FxKind, number> = { feed: 2, pour: 3.4, leaf: 8, salt: 2, drops: 2.8, mirror: 7.5, sun: 6.5, sparkle: 2.6 }
const DROP_COLOR: Record<string, string> = { methylene: '#2f6fd8', revive: '#e86a8a' }
const TINT: Record<string, [string, number]> = { ketapang: ['#8a4a12', 0.26], soak: ['#8a4a12', 0.3], methylene: ['#1f5fd0', 0.3], revive: ['#e07090', 0.12] }

interface Part {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  kind: 'bubble' | 'crumb' | 'spark'
  c: string
  r: number
}

export function TankView({
  fish,
  seed,
  act,
  className,
  sizeRatio = 0.5,
  spawn,
  glass = false,
}: {
  fish: TankFish | null
  seed: number
  act?: CareAct
  className?: string
  sizeRatio?: number
  spawn?: 'spawning' | 'eggs' | 'fry'
  glass?: boolean // draw a glass jar (with room beside it for props) instead of a full-bleed tank
}) {
  const spawnRef = useRef(spawn)
  spawnRef.current = spawn
  const st = useRef({
    x: -1, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, face: 1, next: 0, gulp: 0, water: -1,
    bits: [] as Bit[],
    parts: [] as Part[],
    splashes: [] as { x: number; t0: number }[],
    fx: null as { id: string; kind: FxKind; t0: number; spawned: number } | null,
    tint: { c: '#8a4a12', a: 0, peak: 0 },
    leaf: null as { x: number; y: number; vx: number; vy: number; rot: number; landed: boolean } | null,
    drawn: null as { x: number; y: number; s: number; face: number; tilt: number; flare: number } | null,
  })
  const fishRef = useRef(fish)
  fishRef.current = fish
  const actRef = useRef(act)
  actRef.current = act
  // an action that happened before this jar was mounted is not replayed
  const lastAct = useRef(act?.n ?? 0)

  const ref = useCanvasLoop((ctx, cw, ch, t, dt) => {
    if (cw < 8 || ch < 8) return // not laid out yet (e.g. a dialog opening or closing)
    const f = fishRef.current
    const s0 = st.current
    const J = glass ? jarFrame(cw, ch) : null
    const w = J ? J.W : cw
    const h = J ? J.H - J.surf : ch
    const ox = J ? J.x : 0
    const oy = J ? J.y + J.surf : 0
    const gt = gravelTop(h)

    // a new care action starts
    const a = actRef.current
    if (a && a.n !== lastAct.current) {
      lastAct.current = a.n
      const kind = FX[a.id] ?? 'sparkle'
      s0.fx = { id: a.id, kind, t0: t, spawned: 0 }
      if (TINT[a.id]) s0.tint = { c: TINT[a.id][0], a: s0.tint.a, peak: TINT[a.id][1] }
      if (kind === 'leaf') s0.leaf = { x: w * 0.42, y: J ? -(J.surf - J.lip) - 6 : -8, vx: 6, vy: 0, rot: 0.4, landed: false }
    }
    const fx = s0.fx
    const el = fx ? t - fx.t0 : -1
    if (fx && el > FX_DUR[fx.kind] + (fx.kind === 'feed' ? 0 : 0.5)) s0.fx = null
    const on = (k: FxKind) => (fx && fx.kind === k ? presence(el, FX_DUR[k], 0.7, 0.7) : 0)

    // where things are poured in, water-local
    const mouthX = w * 0.5
    const mouthY = J ? -(J.surf - J.lip) + 2 : -10
    if (fx && (fx.kind === 'feed' || fx.kind === 'salt' || fx.kind === 'drops')) {
      const total = fx.kind === 'salt' ? 14 : fx.kind === 'drops' ? 3 : fx.id === 'bloodworm' ? 4 : 6
      const want = Math.min(total, Math.floor(((el - 0.6) / 1.0) * total) + 1)
      for (; fx.spawned < want && el > 0.6; fx.spawned++) {
        const kind = fx.kind === 'salt' ? 'grain' : fx.kind === 'drops' ? 'drop' : (fx.id as BitKind)
        s0.bits.push(newBit(kind, mouthX + (Math.random() - 0.5) * w * 0.12, mouthY, DROP_COLOR[fx.id]))
      }
    }

    // smooth the water value so a water change visibly clears the jar
    s0.water = s0.water < 0 ? f?.water ?? 100 : s0.water + ((f?.water ?? 100) - s0.water) * Math.min(1, dt * 0.7)
    // tint (tannins, medicine) builds while the action runs, then slowly clears
    const tn = s0.tint
    if (fx && TINT[fx.id] && el < FX_DUR[fx.kind]) tn.a += (tn.peak - tn.a) * Math.min(1, dt * 0.8)
    else tn.a = Math.max(0, tn.a - dt * 0.012)

    const look = { water: s0.water, happy: !!f && f.alive && !f.sick && f.health > 80 && f.hunger < 50 && f.water > 60 && !f.genome.female, seed, spawn: spawnRef.current }

    const sunK = on('sun')
    const mirK = on('mirror')

    // ---------------- behind the jar ----------------
    if (J) {
      drawSun(ctx, cw * 0.9, ch * 0.1, Math.max(8, cw * 0.04), sunK, t)
      ctx.save()
      jarPath(ctx, J)
      ctx.clip()
      ctx.translate(ox, oy)
    }

    // ---------------- inside the water ----------------
    drawTankBack(ctx, w, h, t, look)

    // splash rings at the surface
    for (const sp of s0.splashes) {
      const k = (t - sp.t0) / 0.7
      ctx.strokeStyle = `rgba(230,250,255,${0.6 * (1 - k)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(sp.x, 1, 3 + k * 16, 1 + k * 3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    s0.splashes = s0.splashes.filter((sp) => t - sp.t0 < 0.7)

    // food and dissolving things
    for (const b of s0.bits) {
      const x = stepBit(b, dt, gt - 2, 4, w - 4)
      if (x !== null) {
        s0.splashes.push({ x, t0: t })
        if (b.kind === 'drop') s0.parts.push({ x, y: 2, vx: 0, vy: -4, life: 0.6, kind: 'bubble', c: '#ffffff', r: 1 })
      }
      if (b.y >= 0) drawBit(ctx, b, t)
    }
    s0.bits = s0.bits.filter((b) => b.life > 0)

    // sinking ketapang leaf
    const lf = s0.leaf
    if (lf) {
      if (lf.y < 0) {
        lf.vy += 140 * dt
        lf.y += lf.vy * dt
        if (lf.y >= 0) {
          lf.vy = 16
          s0.splashes.push({ x: lf.x, t0: t })
        }
      } else if (!lf.landed) {
        lf.y += lf.vy * dt
        lf.x += Math.sin(t * 1.6) * 14 * dt
        lf.rot = 0.3 * Math.sin(t * 1.6)
        if (lf.y >= gt - 3) {
          lf.y = gt - 3
          lf.landed = true
        }
      }
      // it rests on the gravel for a while, then fades into the usual leaf
      const fade = fx?.kind === 'leaf' ? Math.min(1, (FX_DUR.leaf - el) / 1.5) : 0
      if (lf.y >= 0 && fade > 0) drawLeaf(ctx, lf.x, lf.y, lf.rot, 0.55, fade)
      if (fade <= 0) s0.leaf = null
    }

    // warm light from the morning sun
    if (sunK > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      const g = ctx.createLinearGradient(w, 0, w * 0.3, h)
      g.addColorStop(0, `rgba(255,200,110,${0.5 * sunK})`)
      g.addColorStop(1, 'rgba(255,200,110,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(w * 0.55, 0)
      ctx.lineTo(w, 0)
      ctx.lineTo(w * 0.7, h)
      ctx.lineTo(w * 0.05, h)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    if (f) {
      const e = bettaExtent(f.genome)
      const s = ((w * sizeRatio) / (e.right - e.left) / Math.max(1, f.genome.size * 0.9)) * (f.size ?? 1)
      const minX = w * 0.3
      const maxX = w * 0.7
      const minY = h * 0.22
      const maxY = gt - h * 0.14
      if (s0.x < 0) {
        s0.x = w / 2
        s0.y = (minY + maxY) / 2
        s0.tx = s0.x
        s0.ty = s0.y
      }
      let swim = 0.2
      let tilt = 0
      let flare = 0
      s0.gulp = Math.max(0, s0.gulp - dt * 3.5)
      if (!f.alive) {
        // floats belly-up at the surface
        s0.x += (w / 2 - s0.x) * dt * 0.3
        s0.y += (h * 0.16 - s0.y) * dt * 0.5
        placeFish(ctx, f.genome, s0.x, s0.y + Math.sin(t * 0.8) * 1.5, s, s0.face, 0.08 + Math.sin(t * 0.5) * 0.03, { t, dead: true, health: 0, swim: 0 }, f.image)
        s0.drawn = null
      } else {
        const vigor = f.sick ? 0.35 : 0.5 + (f.health / 100) * 0.6
        const mouth = () => s0.x + s0.face * e.right * s * 0.8
        // nearest food in the water
        let food: Bit | null = null
        let best = 1e9
        for (const b of s0.bits) {
          if (!edible(b) || b.y < 0 || b.life <= 0) continue
          const d = Math.hypot(b.x - mouth(), b.y - s0.y)
          if (d < best) {
            best = d
            food = b
          }
        }
        if (food) {
          s0.tx = food.x - s0.face * e.right * s * 0.6
          s0.ty = food.y
          if (best < 11) {
            food.life = 0
            s0.gulp = 1
            for (let i = 0; i < 5; i++)
              s0.parts.push({ x: food.x, y: food.y, vx: (Math.random() - 0.5) * 24, vy: (Math.random() - 0.5) * 24, life: 0.5, kind: 'crumb', c: food.kind === 'bloodworm' ? '#c0283c' : food.kind === 'daphnia' ? '#e88c5a' : '#8a4e22', r: 0.8 })
          }
        } else if (mirK > 0) {
          // swim nose-first up to the glass on the mirror side and display
          s0.tx = w * 0.93 - e.right * s * 1.05 - Math.max(0, Math.sin(t * 2.6)) * w * 0.06
          s0.ty = h * 0.42 + Math.sin(t * 1.3) * 6
          s0.next = t + 2
        } else if (sunK > 0) {
          // bask just under the surface in the warm light
          s0.tx = w * 0.62 + Math.sin(t * 0.7) * w * 0.06
          s0.ty = minY * 0.8
          s0.next = t + 2
        } else if (t > s0.next || Math.hypot(s0.tx - s0.x, s0.ty - s0.y) < 8) {
          s0.tx = minX + Math.random() * (maxX - minX)
          s0.ty = f.sick ? maxY - Math.random() * 20 : minY + Math.random() * (maxY - minY)
          s0.next = t + 3 + Math.random() * 4
        }
        const dx = s0.tx - s0.x
        const dy = s0.ty - s0.y
        const d = Math.hypot(dx, dy) || 1
        const sp = (food ? 70 : mirK > 0 ? 55 : 32) * vigor * Math.min(1, d / 40)
        s0.vx += ((dx / d) * sp - s0.vx) * dt * 1.4
        s0.vy += ((dy / d) * sp * 0.7 - s0.vy) * dt * 1.4
        s0.x += s0.vx * dt
        s0.y += s0.vy * dt
        let want = Math.abs(s0.vx) > 4 ? Math.sign(s0.vx) : s0.face >= 0 ? 1 : -1
        if (mirK > 0.5 && !food) want = 1
        s0.face += (want - s0.face) * Math.min(1, dt * 4)
        if (Math.abs(s0.face) < 0.15) s0.face = want * 0.15
        swim = Math.min(1, Math.hypot(s0.vx, s0.vy) / 45)
        tilt = Math.atan2(s0.vy, Math.abs(s0.vx) + 20) * 0.5 * Math.sign(s0.face)
        // flaring comes in waves: gills out, fins spread, then a breath
        if (mirK > 0) flare = mirK * (0.55 + 0.45 * Math.max(0, Math.sin(t * 2.4)))
        else if (food) flare = 0.25
        else if (sunK > 0) flare = 0.3 * sunK
        // faint shadow on the gravel
        ctx.fillStyle = 'rgba(0,0,0,0.16)'
        ctx.beginPath()
        ctx.ellipse(s0.x, gt + 3, w * 0.12 * (1 - (gt - s0.y) / h), 3, 0, 0, Math.PI * 2)
        ctx.fill()
        const fy = s0.y + Math.sin(t * 1.3) * 1.5
        placeFish(ctx, f.genome, s0.x, fy, s, s0.face, tilt, { t, swim, sick: f.sick, health: f.health, flare, gulp: s0.gulp }, f.image)
        s0.drawn = { x: s0.x, y: fy, s, face: s0.face, tilt, flare }

        // boosters and vitamins: a shimmer of gold around the fish
        if (fx?.kind === 'sparkle' && el < 1.6 && Math.random() < dt * 30)
          s0.parts.push({ x: s0.x + (Math.random() - 0.5) * e.right * s * 2, y: s0.y + (Math.random() - 0.5) * 40, vx: 0, vy: -14, life: 1, kind: 'spark', c: fx.id === 'armor' ? '#9fd8ff' : fx.id === 'tonic' ? '#ff8a6a' : '#ffd36a', r: 1.4 + Math.random() * 1.4 })
      }
    }

    // water rushing in from the pitcher churns up bubbles
    if (fx?.kind === 'pour' && el > 0.7 && el < FX_DUR.pour - 0.6 && Math.random() < dt * 40)
      s0.parts.push({ x: w * 0.45 + (Math.random() - 0.5) * 10, y: 4 + Math.random() * h * 0.35, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 20, life: 1, kind: 'bubble', c: '#ffffff', r: 0.8 + Math.random() * 1.8 })

    for (const q of s0.parts) {
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.life -= dt * (q.kind === 'spark' ? 0.7 : 1)
      if (q.kind === 'crumb') {
        q.vx *= 1 - dt * 3
        q.vy *= 1 - dt * 3
      }
      if (q.kind === 'bubble') {
        if (q.y < 1) q.life = 0
        ctx.strokeStyle = `rgba(230,250,255,${0.7 * q.life})`
        ctx.lineWidth = 0.7
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2)
        ctx.stroke()
      } else if (q.kind === 'spark') {
        const r = q.r * (0.6 + 0.4 * Math.sin(t * 12 + q.x))
        ctx.fillStyle = q.c
        ctx.globalAlpha = Math.max(0, q.life)
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
        ctx.globalAlpha = Math.max(0, q.life * 2)
        ctx.fillRect(q.x, q.y, q.r * 1.6, q.r * 1.6)
        ctx.globalAlpha = 1
      }
    }
    s0.parts = s0.parts.filter((q) => q.life > 0)

    drawTankFront(ctx, w, h, t, { ...look, leaf: !(fx?.kind === 'leaf') })
    if (tn.a > 0.005) {
      ctx.fillStyle = rgba(tn.c, tn.a)
      ctx.fillRect(0, 0, w, h)
    }

    // ---------------- glass, props, things in the air ----------------
    if (J) {
      ctx.restore()
      drawGlass(ctx, J)

      // standing mirror beside the jar, showing the fish its own flaring reflection
      if (mirK > 0) {
        const mw = cw * 0.12
        const mh = ch * 0.44
        const plane = J.x + J.W + cw * 0.015
        const mx = plane + (1 - mirK) * (cw - plane + 4)
        drawMirror(ctx, mx, J.base, mw, mh, t, () => {
          const dr = s0.drawn
          if (!f || !dr) return
          ctx.globalAlpha = 0.75
          placeFish(ctx, f.genome, 2 * mx - (ox + dr.x), oy + dr.y, dr.s, -dr.face, -dr.tilt, { t, swim: 0.4, flare: dr.flare, health: f.health }, f.image)
          ctx.globalAlpha = 1
        })
      }

      // tin, pitcher or dropper over the jar mouth
      const mcx = ox + mouthX
      const mcy = J.y + J.lip
      const size = Math.max(18, cw * 0.09)
      if (fx && (fx.kind === 'feed' || fx.kind === 'salt')) {
        const k = presence(el, 1.9, 0.5, 0.4)
        const shake = el > 0.5 && el < 1.6 ? 1 : 0
        drawTin(ctx, mcx + 4, mcy - 4, k, shake, FOOD_TIN[fx.id] ?? FOOD_TIN.pellet, size)
      }
      if (fx?.kind === 'pour') {
        const k = presence(el, FX_DUR.pour, 0.6, 0.5)
        const sx = mcx - J.W * 0.04
        const sy = mcy - 6
        drawPitcher(ctx, sx, sy, k, size * 1.25)
        const flow = el > 0.6 && el < FX_DUR.pour - 0.5 ? 1 : 0
        if (flow) {
          ctx.strokeStyle = 'rgba(190,238,255,0.75)'
          ctx.lineWidth = 4.5 + Math.sin(t * 20) * 0.8
          ctx.beginPath()
          ctx.moveTo(sx, sy + 2)
          ctx.quadraticCurveTo(sx + 2, (sy + oy) / 2, ox + w * 0.45, oy + 2)
          ctx.stroke()
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'
          ctx.lineWidth = 0.8
          ctx.stroke()
          if (Math.random() < dt * 8) s0.splashes.push({ x: w * 0.45, t0: t })
        }
      }
      if (fx?.kind === 'drops') {
        const k = presence(el, FX_DUR.drops, 0.5, 0.5)
        drawDropper(ctx, mcx, oy - 8, k, el > 0.6 && el < 1.8 ? Math.abs(Math.sin(el * 8)) : 0, DROP_COLOR[fx.id] ?? '#2f6fd8', size * 1.6)
      }

      ctx.save()
      ctx.translate(ox, oy)
    }
    // food and the leaf still falling through the air
    for (const b of s0.bits) if (b.y < 0) drawBit(ctx, b, t)
    if (s0.leaf && s0.leaf.y < 0) drawLeaf(ctx, s0.leaf.x, s0.leaf.y, s0.leaf.rot + t * 2, 0.55)
    if (J) ctx.restore()
  })
  return <canvas ref={ref} className={className} aria-hidden="true" />
}

// ---------- arena: two fish flaring at each other, strikes played back from the battle log ----------
export const STEP = 1.1

export function ArenaView({
  a,
  b,
  battle,
  playing,
  onStep,
  className,
}: {
  a: { genome: Genome; image?: string; size?: number }
  b: { genome: Genome; image?: string; size?: number }
  battle: Battle
  playing: boolean
  onStep: (i: number) => void
  className?: string
}) {
  const t0 = useRef<number | null>(null)
  const last = useRef(-1)
  const parts = useRef<{ x: number; y: number; vx: number; vy: number; life: number; c: string }[]>([])
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep
  const playRef = useRef(playing)
  playRef.current = playing

  useEffect(() => {
    t0.current = null
    last.current = -1
    parts.current = []
  }, [battle])

  const ref = useCanvasLoop((ctx, w, h, t, dt) => {
    drawTankBack(ctx, w, h, t, { water: 100, happy: false, seed: 99, plants: true })
    if (t0.current === null && playRef.current) t0.current = t
    const el = t0.current === null ? -1 : t - t0.current
    const n = battle.events.length
    const step = el < 0 ? -1 : Math.min(n, Math.floor(el / STEP))
    const ph = el < 0 ? 0 : (el % STEP) / STEP
    if (step !== last.current) {
      last.current = step
      onStepRef.current(step)
      const ev = battle.events[step]
      if (ev && (ev.kind === 'hit' || ev.kind === 'crit')) {
        const vx = ev.actor === 0 ? 1 : -1
        const hx = w * (ev.actor === 0 ? 0.62 : 0.38)
        const col = ev.actor === 0 ? b.genome.fin : a.genome.fin
        for (let i = 0; i < (ev.kind === 'crit' ? 22 : 12); i++)
          parts.current.push({ x: hx, y: h * 0.48 + (Math.random() - 0.5) * 20, vx: vx * (20 + Math.random() * 60), vy: (Math.random() - 0.5) * 60, life: 1, c: Math.random() < 0.5 ? col : '#e8f6ff' })
      }
    }
    const done = step >= n
    const ev = !done && step >= 0 ? battle.events[step] : null
    const gt = gravelTop(h)
    const e = bettaExtent(a.genome)
    const s = (w * 0.3) / (e.right - e.left)
    const baseY = Math.min(h * 0.5, gt - h * 0.2)
    const gap = w * 0.17
    const pos = [
      { x: w / 2 - gap, y: baseY, face: 1, tilt: 0, flare: 1, dead: false, sick: false },
      { x: w / 2 + gap, y: baseY, face: -1, tilt: 0, flare: 1, dead: false, sick: false },
    ]
    pos.forEach((p, i) => {
      p.y += Math.sin(t * 1.4 + i * 2) * 4
      p.x += Math.sin(t * 0.9 + i) * 3
    })
    if (ev && ev.kind === 'heal') {
      pos[ev.actor].flare = 1
      pos[ev.actor].y -= Math.sin(ph * Math.PI) * 10
    } else if (ev) {
      const at = pos[ev.actor]
      const df = pos[1 - ev.actor]
      const lunge = ph < 0.3 ? Math.sin((ph / 0.3) * (Math.PI / 2)) : Math.max(0, 1 - (ph - 0.3) / 0.5)
      at.x += at.face * lunge * gap * 0.42
      at.tilt = at.face * -0.1 * lunge
      if (ev.kind === 'miss') {
        df.y -= Math.sin(Math.min(1, ph / 0.4) * Math.PI) * 26
      } else if (ph > 0.25 && ph < 0.75) {
        const k = 1 - (ph - 0.25) / 0.5
        df.x += at.face * 14 * k
        df.tilt = at.face * 0.18 * k
      }
    }
    if (done) {
      const lo = pos[1 - battle.winner]
      const wi = pos[battle.winner]
      lo.y = Math.min(gt - 18, lo.y + 40)
      lo.flare = 0
      lo.sick = true
      lo.tilt = 0.25 * lo.face
      wi.flare = 0.6 + 0.4 * Math.sin(t * 3)
    }
    const hpFrac = (i: 0 | 1) => {
      const hp = step < 0 ? battle.start[i] : battle.events[Math.min(n - 1, step)]?.hp[i] ?? battle.start[i]
      return (hp / battle.max[i]) * 100
    }
    ;[a, b].forEach((f, i) => {
      const p = pos[i]
      placeFish(ctx, f.genome, p.x, p.y, s * (f.size ?? 1), p.face, p.tilt, { t, flare: p.flare, swim: 0.6, sick: p.sick, health: hpFrac(i as 0 | 1) }, f.image)
    })
    // scale and fin flakes
    for (const q of parts.current) {
      q.x += q.vx * dt
      q.y += q.vy * dt
      q.vy += 30 * dt
      q.vx *= 1 - dt * 1.5
      q.life -= dt * 0.9
      ctx.fillStyle = `${q.c}${Math.round(Math.max(0, q.life) * 200).toString(16).padStart(2, '0')}`
      ctx.beginPath()
      ctx.ellipse(q.x, q.y, 2, 1.1, q.vx * 0.02, 0, Math.PI * 2)
      ctx.fill()
    }
    parts.current = parts.current.filter((q) => q.life > 0)
    if (ev && ev.kind === 'crit' && ph > 0.28 && ph < 0.4) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(0, 0, w, h)
    }
    drawTankFront(ctx, w, h, t, { water: 100, happy: false, seed: 99, leaf: false })
  })
  return <canvas ref={ref} className={className} aria-hidden="true" />
}
