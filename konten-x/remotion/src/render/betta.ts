// Snapshot copied from ../../../src/render (Betta Arena game) so the launch video renders the real fish.
// Only change vs. the game: tank.ts reads globalThis.__BETTA_DPR so the gravel stays crisp when scaled.
// A betta drawn procedurally on a 2D canvas, as close to a real fish as we can get:
// translucent fins with branching fin rays, scales, iridescent sheen, rippling fin edges,
// gill covers that open when flaring, and fins that clamp when the fish is sick.
// Local coords: fish faces right, snout at x≈57, caudal peduncle at x≈-44. Body length ~100.

import type { FinForm, Genome } from '../game/species'
import { darken, lighten, mulberry32, rgba } from './color'

export interface BettaPose {
  t: number // detik
  flare?: number // 0..1, flaring at a rival / showing off
  swim?: number // 0..1, kecepatan berenang (kibasan ekor)
  sick?: boolean
  dead?: boolean
  health?: number // 0..100
  gulp?: number // 0..1, mouth snapping at food
}

type Pt = [number, number]

interface FinSpec {
  p0: Pt
  p1: Pt
  a0: number
  a1: number
  r: (u: number) => number
  rays: number
}

interface FinLook {
  base: string
  fin: string
  edge: string
  irid: string
  butterfly: boolean
  alpha: number
  crown: number // 0 = no crown; else webbing depth between rays
  center: Pt
  rmax: number
}

const TAU = Math.PI * 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ---------- seeded patches (marble / koi / nemo) ----------
interface Blob {
  x: number
  y: number
  rx: number
  ry: number
  rot: number
  color: string
}
const blobCache = new Map<string, { body: Blob[]; fins: Blob[]; dots: Blob[] }>()

function blobsFor(g: Genome) {
  const key = `${g.seed}:${g.pattern}`
  let b = blobCache.get(key)
  if (b) return b
  const rnd = mulberry32(g.seed)
  const body: Blob[] = []
  const fins: Blob[] = []
  const dots: Blob[] = []
  if (g.pattern === 'koi' || g.pattern === 'nemo' || g.pattern === 'marble') {
    const n = g.pattern === 'marble' ? 7 : 9
    for (let i = 0; i < n; i++) {
      const color = g.spots[Math.floor(rnd() * g.spots.length)] ?? g.fin
      const big = i < 4
      body.push({
        x: lerp(-40, 46, rnd()),
        y: lerp(-18, 16, rnd()),
        rx: big ? lerp(9, 17, rnd()) : lerp(3, 8, rnd()),
        ry: big ? lerp(5, 10, rnd()) : lerp(2, 5, rnd()),
        rot: rnd() * Math.PI,
        color,
      })
    }
    for (let i = 0; i < 10; i++) {
      const color = g.spots[Math.floor(rnd() * g.spots.length)] ?? g.fin
      const side = rnd()
      // tail, dorsal, anal
      const zone = side < 0.5 ? [-90, -45, -45, 45] : side < 0.75 ? [-40, 10, -55, -18] : [-40, 18, 14, 50]
      fins.push({
        x: lerp(zone[0], zone[1], rnd()),
        y: lerp(zone[2], zone[3], rnd()),
        rx: lerp(6, 16, rnd()),
        ry: lerp(4, 10, rnd()),
        rot: rnd() * Math.PI,
        color,
      })
    }
  }
  if (g.pattern === 'koi' || g.pattern === 'metallic' || g.pattern === 'dragon') {
    for (let i = 0; i < 26; i++) {
      dots.push({ x: lerp(-40, 40, rnd()), y: lerp(-16, 15, rnd()), rx: lerp(0.5, 1.2, rnd()), ry: 0, rot: 0, color: '#ffffff' })
    }
  }
  b = { body, fins, dots }
  blobCache.set(key, b)
  return b
}

function drawBlobs(ctx: CanvasRenderingContext2D, blobs: Blob[], alpha: number) {
  for (const b of blobs) {
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(b.rx, b.ry))
    grd.addColorStop(0, rgba(b.color, alpha))
    grd.addColorStop(0.78, rgba(b.color, alpha * 0.9))
    grd.addColorStop(1, rgba(b.color, 0))
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.ellipse(b.x, b.y, b.rx, b.ry, b.rot, 0, TAU)
    ctx.fill()
  }
}

// ---------- fin shape per form ----------
// One row per tail form. Hybrids from breeding are mixes of the base rows:
// e.g. Half-Sun = halfmoon spread + a light crown edge, CTPK = plakat length + crown.
type Profile = 'flat' | 'round' | 'double' | 'veil'
interface FormSpec {
  short: boolean
  spread: number // caudal spread, fraction of PI
  R: number // caudal radius
  profile: Profile
  crown: number // 0 = webbed edge; else how deep the webbing reaches between rays (0.64 = full crowntail)
  dR: number // dorsal length
  aR: number // anal length
}
export const FORM_SPECS: Record<FinForm, FormSpec> = {
  halfmoon: { short: false, spread: 1, R: 58, profile: 'flat', crown: 0, dR: 34, aR: 30 },
  crowntail: { short: false, spread: 0.86, R: 54, profile: 'round', crown: 0.64, dR: 34, aR: 30 },
  doubletail: { short: false, spread: 0.92, R: 54, profile: 'double', crown: 0, dR: 44, aR: 32 },
  veiltail: { short: false, spread: 0.62, R: 52, profile: 'veil', crown: 0, dR: 30, aR: 34 },
  plakat: { short: true, spread: 0.66, R: 27, profile: 'round', crown: 0, dR: 17, aR: 15 },
  giant: { short: true, spread: 0.66, R: 28, profile: 'round', crown: 0, dR: 19, aR: 17 },
  hmpk: { short: true, spread: 0.96, R: 33, profile: 'flat', crown: 0, dR: 21, aR: 18 },
  halfsun: { short: false, spread: 0.95, R: 56, profile: 'flat', crown: 0.82, dR: 34, aR: 30 },
  dthm: { short: false, spread: 1, R: 56, profile: 'double', crown: 0, dR: 44, aR: 32 },
  ctpk: { short: true, spread: 0.78, R: 31, profile: 'round', crown: 0.7, dR: 19, aR: 17 },
  dtpk: { short: true, spread: 0.8, R: 30, profile: 'double', crown: 0, dR: 25, aR: 17 },
  doublecrown: { short: false, spread: 0.92, R: 54, profile: 'double', crown: 0.66, dR: 42, aR: 32 },
}

const PROFILE: Record<Profile, (u: number) => number> = {
  flat: (u) => 0.9 + 0.1 * Math.sin(u * Math.PI),
  round: (u) => 0.8 + 0.2 * Math.sin(u * Math.PI),
  double: (u) => 0.58 + 0.42 * Math.pow(Math.abs(2 * u - 1), 0.55), // notch in the middle: two lobes
  veil: (u) => (52 + 26 * Math.pow(u, 1.2)) / 52, // lower lobe trails long
}

const isShort = (form: FinForm) => (FORM_SPECS[form] ?? FORM_SPECS.halfmoon).short

function thick(form: FinForm) {
  return isShort(form) ? 1.1 : 1
}

function finSpecs(form: FinForm, pose: BettaPose, female = false) {
  const F = FORM_SPECS[form] ?? FORM_SPECS.halfmoon
  const flare = pose.flare ?? 0
  const hp = (pose.health ?? 100) / 100
  // sick = clamped fins; healthy + flaring = fins fully spread
  const clamp = pose.sick || pose.dead ? 0.66 : 0.86 + 0.14 * hp
  // real female bettas carry much shorter fins than males of the same line
  const grow = clamp * (1 + 0.16 * flare) * (female ? (F.short ? 0.85 : 0.5) : 1)
  const open = (pose.sick || pose.dead ? 0.72 : 1) * (0.9 + 0.12 * flare)
  const k = thick(form)
  const long = !F.short
  const veil = F.profile === 'veil'

  const spread = Math.PI * F.spread * open
  const droop = veil ? -0.5 : 0
  const caudal: FinSpec = {
    p0: [-42, -6.5],
    p1: [-42, 6.5],
    a0: Math.PI + spread / 2 - droop,
    a1: Math.PI - spread / 2 - droop,
    r: (u) => F.R * PROFILE[F.profile](u) * grow,
    rays: long ? 22 : 14,
  }
  const dorsal: FinSpec = {
    p0: [6, -19 * k],
    p1: [-37, -9.2],
    a0: -1.62 - 0.1 * flare,
    a1: -2.78 + (long ? 0 : 0.25),
    r: (u) => F.dR * grow * Math.pow(Math.sin((u * Math.PI) / 2), 0.9) * (1 - 0.22 * Math.pow(u, 6)) + 1,
    rays: long ? 14 : 9,
  }
  const anal: FinSpec = {
    p0: [22, 15 * k],
    p1: [-38, 8.6],
    a0: 1.72,
    a1: 2.72 - (veil ? 0.15 : 0),
    r: (u) => F.aR * grow * Math.pow(u, 0.75) * (1 - 0.12 * Math.pow(u, 8)) + 1,
    rays: long ? 18 : 11,
  }
  const ventral = (long ? 36 : 22) * grow
  return { caudal, dorsal, anal, ventral, crown: female ? Math.min(0.9, F.crown + 0.15) * (F.crown ? 1 : 0) : F.crown }
}

// ---------- one fin: translucent fan + rays ----------
function drawFin(ctx: CanvasRenderingContext2D, spec: FinSpec, look: FinLook, t: number, beat: number, amp: number, phase: number, blobs?: Blob[]) {
  const N = look.crown ? spec.rays * 2 : 34
  const mid = (spec.a0 + spec.a1) / 2
  const roots: Pt[] = []
  const edges: Pt[] = []
  const ctrls: Pt[] = []
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const root: Pt = [lerp(spec.p0[0], spec.p1[0], u), lerp(spec.p0[1], spec.p1[1], u)]
    const ang = lerp(spec.a0, spec.a1, u) + Math.sin(t * beat + phase) * 0.06 * amp
    let r = spec.r(u) * (1 + 0.035 * Math.sin(u * 37 + phase * 5) + 0.02 * Math.sin(u * 83 + phase))
    if (look.crown && i % 2 === 1) r *= look.crown
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    // ripple travelling along the fin edge
    const ripple = Math.sin(t * beat * 1.6 - u * 9 + phase) * amp * Math.pow(r / look.rmax, 1.5) * 4.2
    const ripple2 = Math.sin(t * beat * 0.7 + u * 4 + phase * 2) * amp * 1.4
    edges.push([root[0] + dx * r - dy * (ripple + ripple2), root[1] + dy * r + dx * (ripple + ripple2)])
    // outer rays curve toward the middle of the fan so the fin looks like it flows
    const bend = r * 0.16 * Math.pow(Math.abs(2 * u - 1), 2)
    ctrls.push([
      root[0] + dx * r * 0.55 - dy * ripple * 0.35 + Math.cos(mid) * bend,
      root[1] + dy * r * 0.55 + dx * ripple * 0.35 + Math.sin(mid) * bend,
    ])
    roots.push(root)
  }

  ctx.beginPath()
  ctx.moveTo(roots[0][0], roots[0][1])
  ctx.quadraticCurveTo(ctrls[0][0], ctrls[0][1], edges[0][0], edges[0][1])
  if (look.crown) {
    for (let i = 1; i <= N; i++) ctx.lineTo(edges[i][0], edges[i][1])
  } else {
    for (let i = 1; i < N; i++) {
      const mx = (edges[i][0] + edges[i + 1][0]) / 2
      const my = (edges[i][1] + edges[i + 1][1]) / 2
      ctx.quadraticCurveTo(edges[i][0], edges[i][1], mx, my)
    }
    ctx.lineTo(edges[N][0], edges[N][1])
  }
  ctx.quadraticCurveTo(ctrls[N][0], ctrls[N][1], roots[N][0], roots[N][1])
  ctx.closePath()

  const [cx, cy] = look.center
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, look.rmax)
  const a = look.alpha
  g.addColorStop(0, rgba(look.base, 0.96 * a))
  g.addColorStop(0.22, rgba(look.fin, 0.9 * a))
  if (look.butterfly) {
    g.addColorStop(0.6, rgba(look.fin, 0.84 * a))
    g.addColorStop(0.68, rgba(look.edge, 0.8 * a))
    g.addColorStop(1, rgba(look.edge, 0.42 * a))
  } else {
    g.addColorStop(0.72, rgba(look.fin, 0.76 * a))
    g.addColorStop(0.93, rgba(look.edge, 0.5 * a))
    g.addColorStop(1, rgba(look.edge, 0.22 * a))
  }
  ctx.fillStyle = g
  ctx.fill()

  // patches and sheen inside the fin
  ctx.save()
  ctx.clip()
  if (blobs && blobs.length) drawBlobs(ctx, blobs, 0.7 * a)
  const sheen = ctx.createRadialGradient(cx + Math.sin(t * 0.8) * 8, cy, look.rmax * 0.1, cx, cy, look.rmax)
  sheen.addColorStop(0, rgba(look.irid, 0))
  sheen.addColorStop(0.55, rgba(look.irid, 0.16 * a))
  sheen.addColorStop(1, rgba(look.irid, 0))
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = sheen
  ctx.fillRect(cx - look.rmax, cy - look.rmax, look.rmax * 2, look.rmax * 2)
  ctx.restore()

  // fin rays: light line + thin dark shadow, branching near the edge
  const step = look.crown ? 2 : Math.max(1, Math.round(N / spec.rays))
  const light = rgba(lighten(look.fin, 0.45), 0.32 * a)
  const dark = rgba(darken(look.fin, 0.5), 0.22 * a)
  ctx.lineCap = 'round'
  ctx.strokeStyle = rgba(darken(look.fin, 0.6), 0.07 * a)
  ctx.lineWidth = 2.6
  for (let i = Math.floor(step / 2); i <= N; i += step) {
    ctx.beginPath()
    ctx.moveTo(roots[i][0], roots[i][1])
    ctx.quadraticCurveTo(ctrls[i][0], ctrls[i][1], edges[i][0], edges[i][1])
    ctx.stroke()
  }
  for (let i = 0; i <= N; i += step) {
    const [rx, ry] = roots[i]
    const [ex, ey] = edges[i]
    const [qx, qy] = ctrls[i]
    ctx.strokeStyle = dark
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.moveTo(rx, ry + 0.4)
    ctx.quadraticCurveTo(qx, qy + 0.4, ex, ey + 0.4)
    ctx.stroke()
    ctx.strokeStyle = light
    ctx.lineWidth = look.crown ? 0.9 : 0.55
    ctx.beginPath()
    ctx.moveTo(rx, ry)
    ctx.quadraticCurveTo(qx, qy, ex, ey)
    ctx.stroke()
    // branching
    if (!look.crown && i > 0 && i < N) {
      const bx = lerp(qx, ex, 0.45)
      const by = lerp(qy, ey, 0.45)
      const n0 = edges[Math.max(0, i - 1)]
      const n1 = edges[Math.min(N, i + 1)]
      ctx.lineWidth = 0.4
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.lineTo(lerp(ex, n0[0], 0.3), lerp(ey, n0[1], 0.3))
      ctx.moveTo(bx, by)
      ctx.lineTo(lerp(ex, n1[0], 0.3), lerp(ey, n1[1], 0.3))
      ctx.stroke()
    }
  }
}

// ---------- body ----------
function bodyPath(ctx: CanvasRenderingContext2D, k: number) {
  ctx.beginPath()
  ctx.moveTo(57, 1)
  ctx.bezierCurveTo(56.5, -6, 49, -12.5, 38, -15.5 * k)
  ctx.bezierCurveTo(24, -19.5 * k, 4, -20.5 * k, -14, -16 * k)
  ctx.bezierCurveTo(-26, -13 * k, -36, -9.5, -44, -6.5)
  ctx.lineTo(-44, 6.5)
  ctx.bezierCurveTo(-36, 9.5, -24, 13.5 * k, -8, 17 * k)
  ctx.bezierCurveTo(8, 20 * k, 26, 17.5 * k, 40, 12.5 * k)
  ctx.bezierCurveTo(48, 9.5, 55, 6, 57, 1)
  ctx.closePath()
}

function drawVentral(ctx: CanvasRenderingContext2D, len: number, ang: number, color: string, edge: string, alpha: number) {
  const x0 = 26
  const y0 = 14.5
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const tx = x0 + dx * len
  const ty = y0 + dy * len
  const g = ctx.createLinearGradient(x0, y0, tx, ty)
  g.addColorStop(0, rgba(color, 0.95 * alpha))
  g.addColorStop(0.75, rgba(color, 0.8 * alpha))
  g.addColorStop(1, rgba(edge, 0.55 * alpha))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(x0 + 2, y0 - 1)
  ctx.quadraticCurveTo(x0 + dx * len * 0.5 + 3.2, y0 + dy * len * 0.5, tx, ty)
  ctx.quadraticCurveTo(x0 + dx * len * 0.5 - 2.4, y0 + dy * len * 0.5, x0 - 2, y0 + 1)
  ctx.closePath()
  ctx.fill()
}

export function drawBetta(ctx: CanvasRenderingContext2D, g: Genome, pose: BettaPose) {
  const t = pose.t
  const flare = pose.flare ?? 0
  const swim = pose.swim ?? 0.3
  const beat = 2.2 + swim * 5
  const amp = (pose.dead ? 0.15 : 1) * (0.8 + swim * 0.6)
  const k = thick(g.form)
  const specs = finSpecs(g.form, pose, g.female)
  const blobs = blobsFor(g)
  const butterfly = g.pattern === 'butterfly'
  const dragon = g.pattern === 'dragon'
  const metallic = g.pattern === 'metallic'

  ctx.save()
  if (pose.dead) ctx.filter = 'grayscale(0.85) brightness(0.78)'
  else if (pose.sick) ctx.filter = 'saturate(0.5) brightness(0.88)'

  const look = (center: Pt, rmax: number, alpha = 1): FinLook => ({
    base: g.body,
    fin: g.fin,
    edge: g.finEdge,
    irid: g.irid,
    butterfly,
    alpha,
    crown: specs.crown,
    center,
    rmax,
  })

  // far-side ventral fin
  drawVentral(ctx, specs.ventral, 1.98 + Math.sin(t * 2.1 + 1) * 0.1 + 0.18, darken(g.fin, 0.25), g.finEdge, 0.8)

  // caudal fin swings from its base
  const swing = Math.sin(t * beat) * 0.08 * amp
  const caudal = { ...specs.caudal, a0: specs.caudal.a0 + swing, a1: specs.caudal.a1 + swing }
  const cR = caudal.r(0.5)
  drawFin(ctx, specs.anal, look([-10, 12], specs.anal.r(1) + 18, 0.95), t, beat, amp, 1.3, blobs.fins)
  drawFin(ctx, caudal, look([-42, 0], cR + 4), t, beat, amp, 0, blobs.fins)
  drawFin(ctx, specs.dorsal, look([-14, -12], specs.dorsal.r(1) + 18, 0.95), t, beat, amp, 2.1, blobs.fins)

  // body
  bodyPath(ctx, k)
  const bg = ctx.createLinearGradient(0, -20 * k, 0, 19 * k)
  bg.addColorStop(0, darken(g.body, 0.3))
  bg.addColorStop(0.45, g.body)
  bg.addColorStop(0.8, g.belly)
  bg.addColorStop(1, darken(g.belly, 0.15))
  ctx.fillStyle = bg
  ctx.fill()

  ctx.save()
  bodyPath(ctx, k)
  ctx.clip()

  if (blobs.body.length) drawBlobs(ctx, blobs.body, 0.92)

  // scales: trailing edge of each scale, offset rows
  const scaleR = dragon ? 2.9 : 3
  for (let col = 0, x = 34; x > -46; x -= scaleR * 1.55, col++) {
    for (let y = -21 + (col % 2) * scaleR * 0.9; y < 21; y += scaleR * 1.8) {
      if (dragon) {
        const sg = ctx.createRadialGradient(x - 1, y - 0.8, 0.2, x, y, scaleR)
        sg.addColorStop(0, rgba('#ffffff', 0.62))
        sg.addColorStop(0.55, rgba(g.irid, 0.42))
        sg.addColorStop(1, rgba(g.irid, 0.05))
        ctx.fillStyle = sg
        ctx.beginPath()
        ctx.arc(x, y, scaleR, Math.PI * 0.5, Math.PI * 1.5)
        ctx.fill()
      }
      ctx.strokeStyle = dragon ? rgba('#0a0b10', 0.65) : rgba(lighten(g.irid, 0.2), metallic ? 0.35 : 0.2)
      ctx.lineWidth = dragon ? 0.6 : 0.45
      ctx.beginPath()
      ctx.arc(x, y, scaleR, Math.PI * 0.55, Math.PI * 1.45)
      ctx.stroke()
    }
  }

  // slowly drifting iridescent sheen
  ctx.globalCompositeOperation = 'screen'
  const sx = 6 + Math.sin(t * 0.6) * 18
  const ir = ctx.createRadialGradient(sx, -6, 2, sx, -4, 34)
  ir.addColorStop(0, rgba(g.irid, metallic ? 0.55 : 0.42))
  ir.addColorStop(1, rgba(g.irid, 0))
  ctx.fillStyle = ir
  ctx.fillRect(-46, -24, 106, 48)
  for (const d of blobs.dots) {
    ctx.fillStyle = rgba(d.color, 0.55 + 0.35 * Math.sin(t * 2 + d.x))
    ctx.beginPath()
    ctx.arc(d.x, d.y, d.rx, 0, TAU)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // darker face mask, glossy back, shaded belly
  const face = ctx.createRadialGradient(56, -1, 1, 52, 0, 20)
  face.addColorStop(0, rgba(metallic ? '#9aa6b4' : '#000000', metallic ? 0.25 : 0.42))
  face.addColorStop(1, rgba('#000000', 0))
  ctx.fillStyle = face
  ctx.fillRect(30, -20, 30, 40)
  const spec = ctx.createLinearGradient(0, -20 * k, 0, -6)
  spec.addColorStop(0, rgba('#ffffff', 0.0))
  spec.addColorStop(0.35, rgba('#ffffff', 0.18))
  spec.addColorStop(1, rgba('#ffffff', 0))
  ctx.fillStyle = spec
  ctx.fillRect(-46, -22, 104, 18)
  const under = ctx.createLinearGradient(0, 6, 0, 20 * k)
  under.addColorStop(0, rgba('#000000', 0))
  under.addColorStop(1, rgba('#000000', 0.28))
  ctx.fillStyle = under
  ctx.fillRect(-46, 6, 104, 16)
  ctx.restore()

  ctx.strokeStyle = rgba('#000000', 0.28)
  ctx.lineWidth = 0.6
  bodyPath(ctx, k)
  ctx.stroke()

  // gill cover + beard membrane when flaring
  if (flare > 0.05) {
    ctx.fillStyle = rgba(darken(g.fin, 0.35), 0.55 * flare)
    ctx.beginPath()
    ctx.moveTo(40, 10)
    ctx.quadraticCurveTo(35, 12 + 5 * flare, 29, 13)
    ctx.quadraticCurveTo(34, 11, 40, 10)
    ctx.fill()
  }
  const gillOpen = 1.5 * flare
  ctx.strokeStyle = rgba(darken(g.body, 0.55), 0.6)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(36 - gillOpen, -12)
  ctx.bezierCurveTo(31 - gillOpen * 2, -4, 31 - gillOpen * 2, 6, 35 - gillOpen, 12)
  ctx.stroke()
  ctx.strokeStyle = rgba(lighten(g.irid, 0.3), 0.25)
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(37 - gillOpen, -11.5)
  ctx.bezierCurveTo(32.5 - gillOpen * 2, -4, 32.5 - gillOpen * 2, 6, 36 - gillOpen, 11.5)
  ctx.stroke()

  // pectoral fin: small, clear, beating fast
  const flap = Math.sin(t * 9) * 0.35
  drawFin(
    ctx,
    { p0: [31, 1], p1: [30, 6], a0: 2.35 + flap, a1: 2.85 + flap, r: () => 11, rays: 6 },
    { ...look([30, 3.5], 13, 0.5), base: g.fin, butterfly: false, crown: 0 },
    t,
    9,
    0.3,
    0,
  )

  // eye
  ctx.fillStyle = rgba('#000000', 0.5)
  ctx.beginPath()
  ctx.arc(45, -4, 4.4, 0, TAU)
  ctx.fill()
  const eye = ctx.createRadialGradient(45, -4, 0.5, 45, -4, 3.8)
  eye.addColorStop(0, '#050505')
  eye.addColorStop(0.55, '#0b0b0d')
  eye.addColorStop(0.8, metallic ? '#7b8796' : '#7a5a1a')
  eye.addColorStop(1, metallic ? '#c9d3df' : '#d9a640')
  ctx.fillStyle = eye
  ctx.beginPath()
  ctx.arc(45, -4, 3.8, 0, TAU)
  ctx.fill()
  ctx.fillStyle = rgba('#ffffff', pose.dead ? 0.25 : 0.9)
  ctx.beginPath()
  ctx.arc(46.3, -5.4, 1.05, 0, TAU)
  ctx.fill()
  ctx.fillStyle = rgba('#ffffff', 0.35)
  ctx.beginPath()
  ctx.arc(44, -2.6, 0.5, 0, TAU)
  ctx.fill()

  // mouth, slightly upturned like a real betta; it snaps open when eating
  const gulp = pose.gulp ?? 0
  if (gulp > 0.02) {
    ctx.fillStyle = rgba('#1a0606', 0.85)
    ctx.beginPath()
    ctx.ellipse(56.5, 0.8, 1.2 + gulp * 1.6, 0.6 + gulp * 2.4, 0.2, 0, TAU)
    ctx.fill()
  }
  ctx.strokeStyle = rgba('#000000', 0.55)
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(57.2, 0.4)
  ctx.quadraticCurveTo(55, 1.6, 52.5, 1.2)
  ctx.stroke()

  // near-side ventral fin
  drawVentral(ctx, specs.ventral, 1.98 + Math.sin(t * 2.1) * 0.1, g.fin, g.finEdge, 1)

  // egg spot (ovipositor): the small white dot that tells a female apart
  if (g.female) {
    ctx.fillStyle = rgba('#f4f1ea', pose.dead ? 0.4 : 0.9)
    ctx.beginPath()
    ctx.ellipse(16, 16.6 * k, 1.5, 1.1, 0, 0, TAU)
    ctx.fill()
  }

  ctx.restore()
}

// rough bounding box (local units) used to scale the fish to a canvas
export function bettaExtent(g: Genome): { left: number; right: number; top: number; bottom: number } {
  if (g.female) return { left: -82, right: 60, top: -40, bottom: 40 }
  const F = FORM_SPECS[g.form] ?? FORM_SPECS.halfmoon
  if (F.profile === 'veil') return { left: -128, right: 60, top: -50, bottom: 72 }
  const tailUp = F.R * Math.sin((Math.PI * F.spread) / 2) + 2
  return { left: -48 - F.R * 1.03, right: 60, top: -Math.max(24 + F.dR, tailUp), bottom: Math.max(28 + F.aR, tailUp) }
}
