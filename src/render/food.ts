// Things dropped into the jar: three kinds of food the fish hunts down, plus salt grains and
// medicine drops that just dissolve. Coordinates are water-local (y = 0 at the surface, < 0 in the air).

export type BitKind = 'pellet' | 'daphnia' | 'bloodworm' | 'grain' | 'drop'

export interface Bit {
  kind: BitKind
  x: number
  y: number
  vx: number
  vy: number
  age: number // seconds since it hit the water (−1 = still falling)
  ph: number // random phase for wiggles and hops
  life: number // 1..0, fades out once it starts to dissolve or rot
  color?: string
}

export const edible = (b: Bit) => b.kind === 'pellet' || b.kind === 'daphnia' || b.kind === 'bloodworm'

export function newBit(kind: BitKind, x: number, y: number, color?: string): Bit {
  return { kind, x, y, vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 20, age: -1, ph: Math.random() * 10, life: 1, color }
}

// returns the x of a splash when the bit lands on the water this frame
export function stepBit(b: Bit, dt: number, floor: number, minX: number, maxX: number): number | null {
  let splash: number | null = null
  if (b.age < 0) {
    b.vy += 260 * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y >= 0) {
      b.age = 0
      b.vy = b.kind === 'pellet' ? 0 : b.vy * 0.15
      b.vx *= 0.2
      splash = b.x
    }
    return splash
  }
  b.age += dt
  const t = b.age
  switch (b.kind) {
    case 'pellet':
      // floats for a moment, then sinks slowly
      if (t < 1.4) b.y = Math.sin(t * 6 + b.ph) * 0.6
      else b.y += (9 + (b.ph % 3)) * dt
      break
    case 'daphnia': {
      // jerky hops, drifting down overall
      const hop = (t * 2.2 + b.ph) % 1
      b.vy = hop < 0.12 ? -38 : b.vy + 60 * dt
      b.vy = Math.min(b.vy, 14)
      b.vx += (Math.sin(t * 1.3 + b.ph) * 20 - b.vx) * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      break
    }
    case 'bloodworm':
      b.y += 7 * dt
      b.x += Math.sin(t * 1.5 + b.ph) * 4 * dt
      break
    case 'grain':
      b.y += 22 * dt
      b.life -= dt * 0.7
      break
    case 'drop':
      // a drop of medicine blooms into a cloud
      b.y += Math.max(4, 30 - t * 30) * dt
      b.life -= dt * 0.45
      break
  }
  b.x = Math.max(minX, Math.min(maxX, b.x))
  if (b.y > floor) {
    b.y = floor
    if (edible(b) && b.age > 12) b.life -= dt * 0.3 // uneaten food slowly rots away
  }
  if (b.y < 0 && b.age >= 0) b.y = 0
  return splash
}

export function drawBit(ctx: CanvasRenderingContext2D, b: Bit, t: number) {
  if (b.life <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, b.life)
  ctx.translate(b.x, b.y)
  switch (b.kind) {
    case 'pellet': {
      const g = ctx.createRadialGradient(-0.8, -0.8, 0.2, 0, 0, 2.8)
      g.addColorStop(0, '#d9a066')
      g.addColorStop(0.5, '#8a4e22')
      g.addColorStop(1, '#4a2410')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'daphnia': {
      // tiny water flea: translucent shell, dark eye, flicking antennae
      ctx.rotate(Math.sin(t * 8 + b.ph) * 0.3)
      ctx.fillStyle = 'rgba(232,140,90,0.75)'
      ctx.beginPath()
      ctx.ellipse(0, 0, 2.4, 1.8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,220,180,0.6)'
      ctx.beginPath()
      ctx.ellipse(0.3, 0.3, 1.1, 0.8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a0d08'
      ctx.beginPath()
      ctx.arc(-1.7, -0.7, 0.55, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(232,160,110,0.8)'
      ctx.lineWidth = 0.5
      const fl = Math.sin(t * 14 + b.ph) * 0.8
      ctx.beginPath()
      ctx.moveTo(-1.8, -1.2)
      ctx.lineTo(-3.2, -2.6 + fl)
      ctx.moveTo(-1.6, -1.3)
      ctx.lineTo(-1.2, -3.1 - fl)
      ctx.stroke()
      break
    }
    case 'bloodworm': {
      // thin red segmented larva that curls and uncurls
      ctx.strokeStyle = '#b3122c'
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i <= 8; i++) {
        const u = i / 8
        const x = (u - 0.5) * 11
        const y = Math.sin(u * 5 + t * 6 + b.ph) * 1.8 * Math.sin(t * 2 + b.ph)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,140,150,0.6)'
      ctx.lineWidth = 0.5
      ctx.stroke()
      break
    }
    case 'grain':
      ctx.fillStyle = 'rgba(250,252,255,0.95)'
      ctx.fillRect(-0.9, -0.9, 1.8, 1.8)
      break
    case 'drop': {
      const r = b.age < 0 ? 1.8 : 2 + b.age * 7
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      g.addColorStop(0, b.color ?? '#2f6fd8')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
  ctx.restore()
}
