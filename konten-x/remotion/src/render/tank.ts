// Snapshot copied from ../../../src/render (the Betta Arena site) so the launch content renders the real fish.
// Only change vs. the site: tank.ts reads globalThis.__BETTA_DPR so the gravel stays crisp when scaled.
// Inside the jar: water lit from above, gravel, plants, a ketapang leaf, rising bubbles,
// a bubble nest when the fish is healthy, and murky water when it is not changed.

import { mulberry32, rgba } from './color'

interface Pebble {
  x: number
  y: number
  r: number
  c: string
  rot: number
}

const gravelCache = new Map<string, HTMLCanvasElement>()

function gravel(w: number, h: number, seed: number) {
  const k = `${Math.round(w)}x${Math.round(h)}:${seed}`
  let c = gravelCache.get(k)
  if (c) return c
  c = document.createElement('canvas')
  const dpr = (globalThis as { __BETTA_DPR?: number }).__BETTA_DPR ?? Math.min(window.devicePixelRatio || 1, 2)
  const gh = Math.max(18, h * 0.13)
  c.width = Math.ceil(w * dpr)
  c.height = Math.ceil(gh * dpr)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const rnd = mulberry32(seed)
  const cols = ['#6b5b4a', '#8a7a66', '#4a4038', '#a99c88', '#d8cfc0', '#3a332e', '#7d6a55']
  const pebbles: Pebble[] = []
  const n = Math.round((w * gh) / 22)
  for (let i = 0; i < n; i++) {
    const y = gh * (0.15 + rnd() * 0.9)
    pebbles.push({ x: rnd() * w, y, r: 1.6 + rnd() * 3.4 * (0.6 + y / gh), c: cols[Math.floor(rnd() * cols.length)], rot: rnd() * Math.PI })
  }
  pebbles.sort((a, b) => a.y - b.y)
  for (const p of pebbles) {
    const gr = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r * 1.1)
    gr.addColorStop(0, '#f2ece2')
    gr.addColorStop(0.25, p.c)
    gr.addColorStop(1, '#1a1512')
    g.fillStyle = gr
    g.beginPath()
    g.ellipse(p.x, p.y, p.r * 1.25, p.r * 0.85, p.rot, 0, Math.PI * 2)
    g.fill()
  }
  // shadow where water meets gravel
  const sh = g.createLinearGradient(0, 0, 0, gh * 0.5)
  sh.addColorStop(0, 'rgba(4,18,26,0.55)')
  sh.addColorStop(1, 'rgba(4,18,26,0)')
  g.fillStyle = sh
  g.fillRect(0, 0, w, gh * 0.5)
  gravelCache.set(k, c)
  if (gravelCache.size > 40) gravelCache.delete(gravelCache.keys().next().value!)
  return c
}

export interface TankLook {
  water: number // 0..100 kebersihan
  happy: boolean // sarang busa
  seed: number
  plants?: boolean
  leaf?: boolean
  spawn?: 'spawning' | 'eggs' | 'fry' // the breeding jar
}

export function gravelTop(h: number) {
  return h - Math.max(18, h * 0.13) * 0.82
}

export function drawTankBack(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, look: TankLook) {
  const dirt = Math.max(0, 1 - look.water / 70)
  const water = ctx.createLinearGradient(0, 0, 0, h)
  water.addColorStop(0, '#7cc6cf')
  water.addColorStop(0.12, '#3c95a6')
  water.addColorStop(0.6, '#145566')
  water.addColorStop(1, '#0a2d38')
  ctx.fillStyle = water
  ctx.fillRect(0, 0, w, h)

  // light shafts from the surface
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + i * 0.2) + Math.sin(t * 0.35 + i * 1.7) * w * 0.05
    const sw = w * (0.05 + 0.03 * Math.sin(t * 0.5 + i))
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.9)
    g.addColorStop(0, `rgba(220,250,255,${0.16 * (1 - dirt * 0.7)})`)
    g.addColorStop(1, 'rgba(220,250,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - sw * 0.4, 0)
    ctx.lineTo(x + sw * 0.4, 0)
    ctx.lineTo(x + sw * 1.6 + w * 0.06, h * 0.9)
    ctx.lineTo(x - sw * 0.6 + w * 0.06, h * 0.9)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  const rnd = mulberry32(look.seed)
  // swaying vallisneria behind the fish
  if (look.plants !== false) {
    const gt = gravelTop(h)
    const clumps = [rnd() * 0.25, 0.7 + rnd() * 0.25]
    clumps.forEach((cx, ci) => {
      for (let i = 0; i < 6; i++) {
        const bx = w * cx + (i - 3) * 4 + rnd() * 4
        const len = h * (0.35 + rnd() * 0.4)
        const sway = Math.sin(t * 0.8 + i * 0.7 + ci * 2) * 10 + Math.sin(t * 1.9 + i) * 3
        const g = ctx.createLinearGradient(bx, gt, bx, gt - len)
        g.addColorStop(0, '#1d4a24')
        g.addColorStop(0.6, '#3f8a3a')
        g.addColorStop(1, 'rgba(120,190,90,0.7)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.moveTo(bx - 2, gt + 4)
        ctx.quadraticCurveTo(bx - 3 + sway * 0.4, gt - len * 0.5, bx + sway, gt - len)
        ctx.quadraticCurveTo(bx + 3 + sway * 0.4, gt - len * 0.5, bx + 2.4, gt + 4)
        ctx.fill()
      }
    })
  }
}

export function drawTankFront(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, look: TankLook) {
  const dirt = Math.max(0, 1 - look.water / 70)
  const gt = gravelTop(h)
  ctx.drawImage(gravel(w, h, look.seed), 0, gt - 2, w, Math.max(18, h * 0.13))

  // ketapang leaf on the bottom
  if (look.leaf !== false) {
    const lx = w * 0.62
    const ly = gt + 2
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(-0.12)
    const lg = ctx.createLinearGradient(-26, 0, 26, 0)
    lg.addColorStop(0, '#5a2e12')
    lg.addColorStop(0.5, '#8a4a1c')
    lg.addColorStop(1, '#6a3514')
    ctx.fillStyle = lg
    ctx.beginPath()
    ctx.moveTo(-26, 0)
    ctx.quadraticCurveTo(0, -11, 26, 0)
    ctx.quadraticCurveTo(0, 8, -26, 0)
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,18,6,0.7)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-26, 0)
    ctx.lineTo(26, -0.5)
    for (let i = -18; i <= 18; i += 6) {
      ctx.moveTo(i, -0.2)
      ctx.lineTo(i + 5, -6)
      ctx.moveTo(i, -0.2)
      ctx.lineTo(i + 5, 4)
    }
    ctx.stroke()
    ctx.restore()
  }

  // rising bubbles
  for (let i = 0; i < 7; i++) {
    const speed = 0.06 + (i % 3) * 0.03
    const p = (t * speed + i * 0.137) % 1
    const x = w * (0.08 + (i % 2) * 0.03) + Math.sin(t * 3 + i) * 2
    const y = gt - p * (gt - 8)
    const r = 1.2 + (i % 3) * 0.8
    ctx.strokeStyle = `rgba(230,250,255,${0.55 * (1 - p * 0.5)})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }

  // bubble nest: the sign of a healthy male betta
  if (look.happy || look.spawn) {
    const rnd = mulberry32(look.seed + 7)
    for (let i = 0; i < (look.spawn ? 60 : 26); i++) {
      const x = w * 0.68 + (rnd() - 0.5) * w * 0.22
      const y = 5 + rnd() * 5
      const r = 1.5 + rnd() * 2.6
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.arc(x, y + Math.sin(t + i) * 0.4, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
  }

  // eggs hang in the nest; fry dart around under it
  if (look.spawn === 'eggs') {
    const rnd = mulberry32(look.seed + 9)
    for (let i = 0; i < 40; i++) {
      const x = w * 0.68 + (rnd() - 0.5) * w * 0.18
      const y = 9 + rnd() * 6
      ctx.fillStyle = 'rgba(255,248,225,0.9)'
      ctx.beginPath()
      ctx.arc(x, y, 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (look.spawn === 'fry') {
    for (let i = 0; i < 18; i++) {
      const a = t * (0.6 + (i % 5) * 0.15) + i * 1.7
      const x = w * 0.68 + Math.cos(a) * w * (0.08 + (i % 4) * 0.03)
      const y = 16 + (i % 6) * 5 + Math.sin(a * 1.3) * 4
      ctx.fillStyle = 'rgba(40,30,25,0.8)'
      ctx.beginPath()
      ctx.ellipse(x, y, 2, 0.8, Math.cos(a) > 0 ? 0.2 : -0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillRect(x + (Math.cos(a) > 0 ? 1 : -1.5), y - 0.4, 0.6, 0.6)
    }
  }

  // water surface
  const sf = ctx.createLinearGradient(0, 0, 0, 10)
  sf.addColorStop(0, 'rgba(255,255,255,0.35)')
  sf.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sf
  ctx.fillRect(0, 0, w, 10)

  // murky water
  if (dirt > 0) {
    ctx.fillStyle = rgba('#5d6a2a', dirt * 0.42)
    ctx.fillRect(0, 0, w, h)
    const rnd = mulberry32(look.seed + 3)
    ctx.fillStyle = rgba('#d8d2a0', dirt * 0.5)
    for (let i = 0; i < 40 * dirt; i++) {
      const x = (rnd() * w + Math.sin(t * 0.3 + i) * 6) % w
      const y = (rnd() * h + t * 3 * (0.5 + rnd())) % h
      ctx.fillRect(x, y, 1.2, 1.2)
    }
  }

  // glass vignette
  const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,10,16,0.45)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}
