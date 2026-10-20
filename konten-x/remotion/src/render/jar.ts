// Snapshot copied from ../../../src/render (the Betta Arena site) so the launch content renders the real fish.
// Only change vs. the site: tank.ts reads globalThis.__BETTA_DPR so the gravel stays crisp when scaled.
// The glass apothecary jar (trimmed to what the keepers' shelf needs).

export interface JarFrame {
  x: number // jar box, canvas px
  y: number
  W: number
  H: number
  lip: number // rim height inside the box
  neckL: number
  neckR: number
  surf: number // water surface inside the box
  half: number // half-width of the water surface
  base: number // canvas y of the jar's bottom
}

export function jarFrame(w: number, h: number): JarFrame {
  const W = w * 0.64
  const H = h * 0.8
  const x = (w - W) / 2
  const y = h * 0.12
  const f: JarFrame = { x, y, W, H, lip: H * 0.035, neckL: W * 0.17, neckR: W * 0.83, surf: H * 0.2, half: 0, base: y + H }
  // width of the jar where the shoulder meets the water line
  let best = 1e9
  for (let i = 0; i <= 40; i++) {
    const [px, py] = cubic(i / 40, [f.neckL, H * 0.08], [f.neckL, H * 0.15], [0, H * 0.17], [0, H * 0.3])
    if (Math.abs(py - f.surf) < best) {
      best = Math.abs(py - f.surf)
      f.half = W / 2 - px
    }
  }
  return f
}

function cubic(t: number, a: number[], b: number[], c: number[], d: number[]): [number, number] {
  const u = 1 - t
  const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  return [k[0] * a[0] + k[1] * b[0] + k[2] * c[0] + k[3] * d[0], k[0] * a[1] + k[1] * b[1] + k[2] * c[1] + k[3] * d[1]]
}

// outline of the jar body, canvas coords
export function jarPath(ctx: CanvasRenderingContext2D, f: JarFrame, inset = 0) {
  const { x, y, W, H } = f
  const L = x + inset
  const R = x + W - inset
  const nL = x + f.neckL + inset
  const nR = x + f.neckR - inset
  const B = y + H - inset
  ctx.beginPath()
  ctx.moveTo(nL, y + f.lip)
  ctx.lineTo(nL, y + H * 0.08)
  ctx.bezierCurveTo(nL, y + H * 0.15, L, y + H * 0.17, L, y + H * 0.3)
  ctx.lineTo(L, y + H * 0.84)
  ctx.bezierCurveTo(L, y + H * 0.95, L + W * 0.04, B, L + W * 0.16, B)
  ctx.lineTo(R - W * 0.16, B)
  ctx.bezierCurveTo(R - W * 0.04, B, R, y + H * 0.95, R, y + H * 0.84)
  ctx.lineTo(R, y + H * 0.3)
  ctx.bezierCurveTo(R, y + H * 0.17, nR, y + H * 0.15, nR, y + H * 0.08)
  ctx.lineTo(nR, y + f.lip)
  ctx.closePath()
}

// glass over the water: thickness at the edges, rim, base and highlights
export function drawGlass(ctx: CanvasRenderingContext2D, f: JarFrame) {
  const { x, y, W, H } = f
  // empty air above the water
  ctx.save()
  jarPath(ctx, f)
  ctx.clip()
  ctx.fillStyle = 'rgba(200,235,245,0.05)'
  ctx.fillRect(x, y, W, f.surf)
  const edge = ctx.createLinearGradient(x, 0, x + W, 0)
  edge.addColorStop(0, 'rgba(210,245,255,0.24)')
  edge.addColorStop(0.1, 'rgba(210,245,255,0.04)')
  edge.addColorStop(0.9, 'rgba(210,245,255,0.03)')
  edge.addColorStop(1, 'rgba(210,245,255,0.2)')
  ctx.fillStyle = edge
  ctx.fillRect(x, y, W, H)
  // thick glass bottom
  const bot = ctx.createLinearGradient(0, y + H - H * 0.05, 0, y + H)
  bot.addColorStop(0, 'rgba(220,250,255,0)')
  bot.addColorStop(0.4, 'rgba(220,250,255,0.18)')
  bot.addColorStop(1, 'rgba(220,250,255,0.32)')
  ctx.fillStyle = bot
  ctx.fillRect(x, y + H * 0.95, W, H * 0.05)
  ctx.restore()

  // water surface seen slightly from above
  const sy = y + f.surf
  ctx.fillStyle = 'rgba(170,235,245,0.16)'
  ctx.strokeStyle = 'rgba(230,252,255,0.55)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(x + W / 2, sy, f.half - 1, H * 0.018, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // outline: outer and inner wall
  ctx.strokeStyle = 'rgba(220,248,255,0.55)'
  ctx.lineWidth = 1.6
  jarPath(ctx, f)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(220,248,255,0.16)'
  ctx.lineWidth = 1
  jarPath(ctx, f, 4)
  ctx.stroke()

  // highlights
  ctx.lineCap = 'round'
  const hl = ctx.createLinearGradient(0, y + H * 0.3, 0, y + H * 0.85)
  hl.addColorStop(0, 'rgba(255,255,255,0.42)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.strokeStyle = hl
  ctx.lineWidth = Math.max(3, W * 0.045)
  ctx.beginPath()
  ctx.moveTo(x + W * 0.09, y + H * 0.34)
  ctx.quadraticCurveTo(x + W * 0.07, y + H * 0.58, x + W * 0.09, y + H * 0.82)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = Math.max(2, W * 0.02)
  ctx.beginPath()
  ctx.moveTo(x + W * 0.16, y + H * 0.2)
  ctx.quadraticCurveTo(x + W * 0.1, y + H * 0.23, x + W * 0.09, y + H * 0.28)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'
  ctx.lineWidth = Math.max(2, W * 0.018)
  ctx.beginPath()
  ctx.moveTo(x + W * 0.93, y + H * 0.4)
  ctx.lineTo(x + W * 0.93, y + H * 0.7)
  ctx.stroke()
  ctx.lineCap = 'butt'

  // rolled rim
  const rx = (f.neckR - f.neckL) / 2 + 3
  const ry = Math.max(3, H * 0.022)
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(225,250,255,0.6)'
  ctx.beginPath()
  ctx.ellipse(x + W / 2, y + f.lip, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(x + W / 2, y + f.lip, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.6)
  ctx.stroke()
}
