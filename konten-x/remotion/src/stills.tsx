import { AbsoluteFill } from 'remotion'
import { Canvas } from './lib/Canvas'
import { C } from './lib/brand'
import { G } from './game/species'
import { bettaExtent } from './render/betta'
import { placeFish } from './lib/jarScene'
import { DEMO_BOUT } from './lib/cast'
import { FightNight, Plates, RingStage } from './lib/night'
import { BeltBadge, Kicker, LaunchPill, Title, Turn } from './lib/ui'

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

// ---------------- header: 1500x500; the avatar covers the bottom-left (0-420 x 300-500) ----------------
// Ringside: the ring with the champion and a challenger squaring up, HP bars, the belt.
export function Banner() {
  const b = DEMO_BOUT
  const tau = b.start + 3 * b.step + 0.62 // between strikes: both fish flaring, both hurt
  return (
    <AbsoluteFill style={{ background: C.night, overflow: 'hidden' }}>
      <FightNight t={1.2} crowd={0.15} focusX="72%" focusY="45%" />
      <div style={{ position: 'absolute', left: 92, top: 30 }}>
        <Kicker size={17}>Fight night on Robinhood Chain</Kicker>
        <Title size={100} style={{ marginTop: 10 }}>
          Betta <span style={{ color: C.gold }}>Arena</span>
        </Title>
        <Title size={48} style={{ marginTop: 12 }}>
          Every buy is <Turn>a fight.</Turn>
        </Title>
      </div>
      <div style={{ position: 'absolute', left: 94, top: 244 }}>
        <LaunchPill size={18} />
      </div>
      <div style={{ position: 'absolute', left: 800, width: 620, top: 22 }}>
        <Plates bout={b} tau={tau} size={0.56} subA={`${b.a.breed} · new`} subB={`${b.b.breed} · champion`} />
      </div>
      <div style={{ position: 'absolute', left: 800, top: 112 }}>
        <RingStage width={620} height={349} unit={1.55} bout={b} T={2.3} tau={tau} radius={22} />
        <div style={{ position: 'absolute', right: 16, top: 14 }}>
          <BeltBadge size={15}>THE BELT · 4 in a row</BeltBadge>
        </div>
      </div>
    </AbsoluteFill>
  )
}
