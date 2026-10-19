import { AbsoluteFill } from 'remotion'
import { Canvas } from './lib/Canvas'
import { C, F } from './lib/brand'
import { G } from './game/species'
import { bettaExtent } from './render/betta'
import { drawJarScene, fishScale, jarDims, placeFish } from './lib/jarScene'

// ---------------- profile picture: 400x400, reads as a circle and at 48px ----------------
export function Logo() {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Canvas
        width={400}
        height={400}
        unit={1}
        draw={(ctx, w, h) => {
          const bg = ctx.createRadialGradient(w * 0.5, h * 0.46, 10, w / 2, h / 2, w * 0.72)
          bg.addColorStop(0, '#11505e')
          bg.addColorStop(0.45, '#0a2d38')
          bg.addColorStop(1, '#03111a')
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, w, h)
          // teal glow
          const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.36)
          glow.addColorStop(0, 'rgba(95,224,208,0.22)')
          glow.addColorStop(1, 'rgba(95,224,208,0)')
          ctx.fillStyle = glow
          ctx.fillRect(0, 0, w, h)
          // gold ring, inside the circle crop
          ctx.strokeStyle = 'rgba(242,193,78,0.85)'
          ctx.lineWidth = 6
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, w * 0.43, 0, Math.PI * 2)
          ctx.stroke()
          ctx.strokeStyle = 'rgba(255,227,161,0.25)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, w * 0.405, 0, Math.PI * 2)
          ctx.stroke()
          // the fish, flaring
          const g = G.gold
          const e = bettaExtent(g)
          const s = (w * 0.74) / (e.right - e.left)
          const cx = w / 2 - ((e.left + e.right) / 2) * s - 4
          const cy = h / 2 - ((e.top + e.bottom) / 2) * s
          placeFish(ctx, g, cx, cy, s, 1, -0.04, { t: 1.3, flare: 1, swim: 0.15, health: 100 })
        }}
      />
    </AbsoluteFill>
  )
}

// left half of a 16 → 1 single-elimination bracket, drawn as lines
export function drawBracketLines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, line: string, dot: string) {
  const rounds = 4
  const colW = w / rounds
  let ys = Array.from({ length: 16 }, (_, i) => y + (h / 16) * (i + 0.5))
  ctx.lineWidth = 1.5
  for (let r = 0; r < rounds; r++) {
    const x0 = x + r * colW
    const next: number[] = []
    for (let i = 0; i < ys.length; i += 2) {
      const a = ys[i]
      const b = ys[i + 1]
      const m = (a + b) / 2
      ctx.strokeStyle = line
      ctx.beginPath()
      ctx.moveTo(x0, a)
      ctx.lineTo(x0 + colW * 0.6, a)
      ctx.lineTo(x0 + colW * 0.6, b)
      ctx.lineTo(x0, b)
      ctx.moveTo(x0 + colW * 0.6, m)
      ctx.lineTo(x0 + colW, m)
      ctx.stroke()
      ctx.fillStyle = dot
      for (const yy of [a, b]) {
        ctx.beginPath()
        ctx.arc(x0, yy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      next.push(m)
    }
    ys = next
  }
}

// ---------------- header: 1500x500; the avatar covers the bottom-left (0-420 x 300-500) ----------------
export function Banner() {
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <Canvas
        width={1500}
        height={500}
        draw={(ctx, w, h) => {
          const bg = ctx.createLinearGradient(0, 0, w, 0)
          bg.addColorStop(0, '#03111a')
          bg.addColorStop(0.55, '#061b25')
          bg.addColorStop(1, '#0a2d38')
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, w, h)
          const glow = ctx.createRadialGradient(1130, 250, 20, 1130, 250, 520)
          glow.addColorStop(0, 'rgba(95,224,208,0.20)')
          glow.addColorStop(1, 'rgba(95,224,208,0)')
          ctx.fillStyle = glow
          ctx.fillRect(0, 0, w, h)
          const gold = ctx.createRadialGradient(330, 140, 10, 330, 140, 420)
          gold.addColorStop(0, 'rgba(242,193,78,0.10)')
          gold.addColorStop(1, 'rgba(242,193,78,0)')
          ctx.fillStyle = gold
          ctx.fillRect(0, 0, w, h)
          // shelf line under the jar
          const shelf = ctx.createLinearGradient(820, 0, 1500, 0)
          shelf.addColorStop(0, 'rgba(242,193,78,0)')
          shelf.addColorStop(0.3, 'rgba(242,193,78,0.35)')
          shelf.addColorStop(1, 'rgba(242,193,78,0.1)')
          ctx.fillStyle = shelf
          ctx.fillRect(820, 466, 680, 2)
          // a faint 16-fish bracket fading into the jar: the arena behind the hobby
          drawBracketLines(ctx, 650, 70, 300, 380, 'rgba(242,193,78,0.16)', 'rgba(95,224,208,0.28)')
        }}
      />
      <div style={{ position: 'absolute', left: 860, top: -10 }}>
        <Canvas
          width={620}
          height={500}
          unit={1.35}
          draw={(ctx, cw, ch) => {
            const d = jarDims(cw, ch)
            const g = G.red
            drawJarScene(ctx, cw, ch, 2.2, {
              genome: g,
              sizeRatio: 0.56,
              happy: true,
              mirror: 1,
              fish: { x: d.w * 0.93 - 60 * fishScale(d, g, 0.56) * 1.05, y: d.h * 0.42, face: 1, tilt: -0.02, swim: 0.3, flare: 1, gulp: 0 },
            })
          }}
        />
      </div>
      <div style={{ position: 'absolute', left: 92, top: 40, color: C.text, fontFamily: F.body }}>
        <div style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: '0.24em', color: C.teal, fontWeight: 600 }}>BETTA KEEPING · BETTA FIGHTING</div>
        <div style={{ fontFamily: F.display, fontSize: 106, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.02, marginTop: 10, color: '#f6ecd6', fontVariationSettings: "'opsz' 144, 'SOFT' 30" }}>
          Betta <span style={{ color: C.gold, fontStyle: 'normal' }}>Arena</span>
        </div>
        <div style={{ fontFamily: F.display, fontSize: 36, fontWeight: 400, marginTop: 6, color: C.text, fontVariationSettings: "'opsz' 48" }}>
          Raise it. Groom it. <span style={{ color: C.coral, fontWeight: 600 }}>Let it fight.</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 94,
          top: 236,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '11px 22px',
          borderRadius: 999,
          border: '1.5px solid rgba(242,193,78,0.55)',
          background: 'rgba(10,36,48,0.85)',
          fontFamily: F.mono,
          fontSize: 20,
          color: C.text,
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ color: C.gold, fontWeight: 700 }}>$BETTA</span>
        <span style={{ color: C.faint }}>·</span>
        <span>Coming soon on Robinhood Chain</span>
      </div>
    </AbsoluteFill>
  )
}
