// A glass apothecary jar, plus the props that appear around it during care:
// food tins, a water pitcher, a medicine dropper, the morning sun and the flaring mirror.

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

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)

// in-and-out envelope for a prop that lives `dur` seconds (0..1)
export function presence(el: number, dur: number, fadeIn = 0.6, fadeOut = 0.6) {
  if (el < 0 || el > dur) return 0
  return Math.min(ease(el / fadeIn), ease((dur - el) / fadeOut))
}

export const FOOD_TIN: Record<string, { body: string; label: string }> = {
  pellet: { body: '#c9a24a', label: '#7a3e1a' },
  daphnia: { body: '#cfd8d0', label: '#2f7a4c' },
  bloodworm: { body: '#d9d2c8', label: '#a3162e' },
  salt: { body: '#eef3f7', label: '#3a6ea8' },
}

// a small tin tipping over the jar mouth; `shake` 0..1
export function drawTin(ctx: CanvasRenderingContext2D, mx: number, my: number, k: number, shake: number, tone: { body: string; label: string }, size: number) {
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(mx + (1 - k) * size * 1.5, my - (1 - k) * size * 2)
  ctx.rotate(-0.4 - 1.5 * k + Math.sin(shake * 40) * 0.12 * shake)
  const tw = size * 0.75
  const th = size
  // tin hangs from its mouth (origin), body extends along +y
  const g = ctx.createLinearGradient(-tw / 2, 0, tw / 2, 0)
  g.addColorStop(0, tone.body)
  g.addColorStop(0.45, '#ffffff')
  g.addColorStop(1, tone.body)
  ctx.fillStyle = g
  ctx.fillRect(-tw / 2, 2, tw, th)
  ctx.fillStyle = tone.label
  ctx.fillRect(-tw / 2, 2 + th * 0.3, tw, th * 0.42)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillRect(-tw / 2 + 2, 2 + th * 0.46, tw - 4, 1.4)
  ctx.fillStyle = '#2a2622'
  ctx.beginPath()
  ctx.ellipse(0, 2, tw / 2, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawPitcher(ctx: CanvasRenderingContext2D, mx: number, my: number, k: number, size: number) {
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(mx - (1 - k) * size * 2, my - (1 - k) * size)
  ctx.rotate(0.9 * k)
  const s = size
  // spout at the origin, jug body to the left
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-s * 0.35, -s * 0.1)
  ctx.quadraticCurveTo(-s * 1.15, -s * 0.15, -s * 1.1, s * 0.6)
  ctx.quadraticCurveTo(-s * 1.05, s * 1.05, -s * 0.6, s * 1.05)
  ctx.quadraticCurveTo(-s * 0.2, s * 1.05, -s * 0.25, s * 0.35)
  ctx.closePath()
  const g = ctx.createLinearGradient(-s * 1.1, 0, -s * 0.2, 0)
  g.addColorStop(0, 'rgba(170,215,230,0.75)')
  g.addColorStop(0.5, 'rgba(235,250,255,0.9)')
  g.addColorStop(1, 'rgba(170,215,230,0.7)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(235,250,255,0.85)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  // water inside the jug
  ctx.fillStyle = 'rgba(70,170,195,0.8)'
  ctx.beginPath()
  ctx.moveTo(-s * 1.06, s * 0.45)
  ctx.quadraticCurveTo(-s * 1.03, s * 1.0, -s * 0.6, s * 1.0)
  ctx.quadraticCurveTo(-s * 0.27, s * 1.0, -s * 0.28, s * 0.45)
  ctx.closePath()
  ctx.fill()
  // handle
  ctx.strokeStyle = 'rgba(235,250,255,0.75)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-s * 1.08, s * 0.05)
  ctx.quadraticCurveTo(-s * 1.55, s * 0.35, -s * 1.08, s * 0.75)
  ctx.stroke()
  ctx.restore()
}

export function drawDropper(ctx: CanvasRenderingContext2D, tx: number, ty: number, k: number, squeeze: number, liquid: string, size: number) {
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  ctx.translate(tx, ty - (1 - k) * size * 1.5)
  const s = size
  // glass tube, tip at origin
  ctx.fillStyle = 'rgba(220,245,255,0.35)'
  ctx.strokeStyle = 'rgba(235,250,255,0.85)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-1, 0)
  ctx.lineTo(-s * 0.12, -s * 0.25)
  ctx.lineTo(-s * 0.12, -s * 0.9)
  ctx.lineTo(s * 0.12, -s * 0.9)
  ctx.lineTo(s * 0.12, -s * 0.25)
  ctx.lineTo(1, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = liquid
  ctx.fillRect(-s * 0.1, -s * 0.55, s * 0.2, s * 0.32)
  // rubber bulb
  const bw = s * 0.2 * (1 - squeeze * 0.35)
  ctx.fillStyle = '#b8323a'
  ctx.beginPath()
  ctx.ellipse(0, -s * 1.08, bw, s * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  ctx.ellipse(-bw * 0.35, -s * 1.13, bw * 0.25, s * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, k: number, t: number) {
  if (k <= 0) return
  ctx.save()
  ctx.globalAlpha = k
  const glow = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 3.2)
  glow.addColorStop(0, 'rgba(255,214,120,0.55)')
  glow.addColorStop(1, 'rgba(255,214,120,0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4)
  ctx.strokeStyle = 'rgba(255,220,130,0.85)'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.4
    const l = r * (1.35 + 0.2 * Math.sin(t * 3 + i))
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 1.15)
    ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l)
    ctx.stroke()
  }
  const d = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r)
  d.addColorStop(0, '#fff6d6')
  d.addColorStop(0.6, '#ffd36a')
  d.addColorStop(1, '#f4a63a')
  ctx.fillStyle = d
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// standing mirror beside the jar; `inside` draws whatever it reflects (clipped to the glass)
export function drawMirror(ctx: CanvasRenderingContext2D, x: number, base: number, mw: number, mh: number, t: number, inside: () => void) {
  const y = base - mh - 6
  // stand
  ctx.fillStyle = '#3a2618'
  ctx.fillRect(x + mw * 0.15, base - 7, mw * 0.7, 5)
  ctx.fillRect(x + mw * 0.44, base - 10, mw * 0.12, 6)
  // frame
  const fr = ctx.createLinearGradient(x, 0, x + mw, 0)
  fr.addColorStop(0, '#8a6326')
  fr.addColorStop(0.5, '#e2c06a')
  fr.addColorStop(1, '#7a5520')
  ctx.fillStyle = fr
  roundRect(ctx, x, y, mw, mh, 5)
  ctx.fill()
  // silvered glass
  const gx = x + 3
  const gy = y + 3
  const gw = mw - 6
  const gh = mh - 6
  const sv = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh)
  sv.addColorStop(0, '#9fb6c2')
  sv.addColorStop(0.5, '#d9e6ec')
  sv.addColorStop(1, '#7f97a4')
  ctx.fillStyle = sv
  roundRect(ctx, gx, gy, gw, gh, 3)
  ctx.fill()
  ctx.save()
  roundRect(ctx, gx, gy, gw, gh, 3)
  ctx.clip()
  // the jar water seen in the glass
  ctx.fillStyle = 'rgba(30,110,128,0.55)'
  ctx.fillRect(gx, gy + gh * 0.18, gw, gh)
  inside()
  // sweeping glint
  const sx = gx + ((t * 0.35) % 1.6) * gw * 1.6 - gw * 0.6
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.beginPath()
  ctx.moveTo(sx, gy)
  ctx.lineTo(sx + gw * 0.25, gy)
  ctx.lineTo(sx - gw * 0.35, gy + gh)
  ctx.lineTo(sx - gw * 0.6, gy + gh)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,240,200,0.5)'
  ctx.lineWidth = 0.8
  roundRect(ctx, x + 0.5, y + 0.5, mw - 1, mh - 1, 5)
  ctx.stroke()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// ketapang leaf (also used while it sinks during a soak)
export function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, s: number, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(s, s)
  const lg = ctx.createLinearGradient(-26, 0, 26, 0)
  lg.addColorStop(0, '#6a3514')
  lg.addColorStop(0.5, '#a65a22')
  lg.addColorStop(1, '#7a3c16')
  ctx.fillStyle = lg
  ctx.beginPath()
  ctx.moveTo(-26, 0)
  ctx.quadraticCurveTo(0, -11, 26, 0)
  ctx.quadraticCurveTo(0, 8, -26, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(40,18,6,0.7)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(-30, 0.5)
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
