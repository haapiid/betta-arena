import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { clamp, drawShelfJar, placeFish, prand, scaleFor, smooth } from '../lib/jarScene'
import { Kicker, Rise, SceneFade, Title, Turn } from '../lib/ui'

const KEEPERS = [
  { g: G.gold, a: '0x3f9a…a1c2' },
  { g: G.halfmoon, a: '0x8c21…07fe' },
  { g: G.koi, a: '0x51c2…3a4b' },
  { g: G.nemo, a: '0xd04e…9b13' },
  { g: G.platinum, a: '0x2be7…c645' },
  { g: G.doubletail, a: '0x96fa…12d8' },
  { g: G.red, a: '0x7e03…b59a' },
  { g: G.veiltail, a: '0x0ac9…e4f1' },
  { g: G.samurai, a: '0xc718…5d20' },
  { g: G.crowntail, a: '0x4d5b…8e67' },
]
const JUMPER = 6 // No. 7 sells
const JW = 260
const JH = 290
const ROWS = [318, 668]
const CX = [360, 660, 960, 1260, 1560]
const JUMP = 3.0
const SELL = 2.0

const box = (i: number) => ({ x: CX[i % 5] - JW / 2, y: ROWS[Math.floor(i / 5)], w: JW, h: JH })

function leap(t: number) {
  const b = box(JUMPER)
  const a = t - JUMP
  const vx = 380
  const vy = -900
  const g = 1700
  return { x: CX[JUMPER % 5] + vx * a, y: b.y + 118 + vy * a + g * a * a, rot: Math.atan2(vy + 2 * g * a, vx), a }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  // planks under each row
  ROWS.forEach((y) => {
    const py = y + JH * 0.92 + 2
    const g = ctx.createLinearGradient(0, py, 0, py + 18)
    g.addColorStop(0, '#7a5638')
    g.addColorStop(0.4, '#5a3e2a')
    g.addColorStop(1, '#2b1d12')
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(150, py + 14, w - 300, 16)
    ctx.fillStyle = g
    ctx.fillRect(150, py, w - 300, 18)
  })
  KEEPERS.forEach((k, i) => {
    const gone = i === JUMPER && t >= JUMP
    drawShelfJar(ctx, box(i), t + i * 1.7, k.g, !gone, 30 + i * 7, 0.64 - i * 0.008)
  })
  // the jump: out of the water, over the rim, gone
  const L = leap(t)
  if (L.a >= 0 && L.a < 1.4) {
    const b = box(JUMPER)
    const g = KEEPERS[JUMPER].g
    const s = scaleFor(g, 130)
    ctx.globalAlpha = 1 - clamp((L.a - 0.75) / 0.35)
    placeFish(ctx, g, L.x, L.y, s, 1, L.rot, { t, swim: 1, flare: 0.6, health: 100 })
    ctx.globalAlpha = 1
    // splash at the jar's mouth
    const sp = L.a / 0.7
    if (sp < 1) {
      const mx = CX[JUMPER % 5]
      const my = b.y + 34.8 + 46.4 + 4
      ctx.strokeStyle = `rgba(230,250,255,${0.8 * (1 - sp)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(mx, my, 20 + sp * 40, 4 + sp * 6, 0, 0, Math.PI * 2)
      ctx.stroke()
      for (let j = 0; j < 12; j++) {
        const ang = -Math.PI / 2 + (prand(j, 3) - 0.5) * 2
        const v = 160 + prand(j, 4) * 220
        const tt = L.a
        const x = mx + Math.cos(ang) * v * tt
        const y = my + Math.sin(ang) * v * tt + 900 * tt * tt
        ctx.fillStyle = `rgba(220,248,255,${0.85 * (1 - sp)})`
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// 8 · The shelf: ten jars for the ten biggest holders who never sold. One sells; its fish jumps the jar.
export function ShelfScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const sold = clamp((t - SELL) / 0.25)
  const strike = clamp((t - JUMP - 0.6) / 0.35)
  const cap = smooth((t - JUMP - 0.3) / 0.5)
  return (
    <SceneFade dur={dur}>
      <AbsoluteFill style={{ background: `radial-gradient(62% 50% at 12% 10%, rgba(255,190,110,0.14), transparent 70%), ${C.shelf}` }} />
      <div style={{ position: 'absolute', left: 150, top: 70, width: 860 }}>
        <Rise at={2}>
          <Kicker size={24}>The shelf · top 10 holders</Kicker>
        </Rise>
        <Rise at={6} style={{ marginTop: 18 }}>
          <Title size={84}>
            Ten jars for the ten
            <br />
            <Turn>who never sold.</Turn>
          </Title>
        </Rise>
      </div>
      <div style={{ position: 'absolute', left: 1080, top: 120, width: 700, opacity: cap, transform: `translateY(${(1 - cap) * 20}px)` }}>
        <Title size={66}>
          Sell once and your fish
          <br />
          <Turn>jumps the jar.</Turn>
        </Title>
        <div style={{ marginTop: 18, fontFamily: F.mono, fontSize: 24, color: C.dim }}>Off the shelf, for good. No money, just the jar.</div>
      </div>
      <AbsoluteFill>
        <Canvas width={1920} height={1080} unit={1} draw={draw} />
      </AbsoluteFill>
      {KEEPERS.map((k, i) => {
        const b = box(i)
        const out = i === JUMPER
        return (
          <div key={i} style={{ position: 'absolute', left: b.x - 20, width: JW + 40, top: b.y + JH * 0.92 + 30, textAlign: 'center', fontFamily: F.mono, opacity: out ? 1 - 0.45 * strike : 1 }}>
            <span style={{ position: 'relative', fontSize: 22, color: i === 0 ? C.gold : C.text }}>
              No. {i + 1} · {k.a}
              {out && <span style={{ position: 'absolute', left: -4, right: -4, top: '52%', height: 3, background: C.red, transform: `scaleX(${strike})`, transformOrigin: '0 50%' }} />}
            </span>
          </div>
        )
      })}
      {/* the sell that does it */}
      <div style={{ position: 'absolute', left: box(JUMPER).x + 40, top: box(JUMPER).y - 6, opacity: sold * (1 - clamp((t - JUMP + 0.05) / 0.15)), transform: `translateY(${(1 - sold) * 10}px)` }}>
        <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: C.red, color: '#170405', fontFamily: F.mono, fontWeight: 700, fontSize: 22 }}>SELL · {KEEPERS[JUMPER].a}</span>
      </div>
    </SceneFade>
  )
}
