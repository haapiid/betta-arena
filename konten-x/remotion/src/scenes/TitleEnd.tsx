import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { bettaExtent } from '../render/betta'
import { clamp, placeFish, smooth } from '../lib/jarScene'
import { FightNight } from '../lib/night'
import { Brandmark, Kicker, LaunchPill, Rise, SceneFade, Title, Turn, useIn } from '../lib/ui'

// 1 · Fight night. The lights come up on the ring.
export function TitleScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const lights = smooth((t - 0.15) / 0.7)
  return (
    <SceneFade dur={dur} fadeIn={0} fadeOut={10}>
      <FightNight t={t} spot={lights} crowd={0.2} focusY="55%" />
      {/* two bettas squaring up under the headline */}
      <AbsoluteFill>
      <Canvas
        width={1920}
        height={1080}
        draw={(ctx, w, h, tt) => {
          const glow = ctx.createRadialGradient(w / 2, h * 0.74, 10, w / 2, h * 0.74, 520)
          glow.addColorStop(0, `rgba(255,65,80,${0.2 * lights})`)
          glow.addColorStop(1, 'rgba(255,65,80,0)')
          ctx.fillStyle = glow
          ctx.fillRect(0, 0, w, h)
          const k = smooth((tt - 0.5) / 1.2)
          ;[G.plakat, G.koi].forEach((g, i) => {
            const e = bettaExtent(g)
            const s = 360 / (e.right - e.left)
            const face = i ? -1 : 1
            const x = w / 2 + (i ? 1 : -1) * (250 + (1 - k) * 500)
            const y = h * 0.76 + Math.sin(tt * 2 + i * 2) * 6
            ctx.globalAlpha = k
            placeFish(ctx, g, x, y, s, face, 0, { t: tt, swim: 0.5, flare: smooth((tt - 1.4) / 0.4), health: 100 })
            ctx.globalAlpha = 1
          })
        }}
      />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 170, textAlign: 'center' }}>
        <Rise at={10}>
          <Kicker size={26} color={C.dim}>
            Betta Arena · $BETTA · fight night
          </Kicker>
        </Rise>
        <Rise at={18} style={{ marginTop: 28 }}>
          <Title size={176}>
            Every buy is <Turn>a fight.</Turn>
          </Title>
        </Rise>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 8], [1, 0], { extrapolateRight: 'clamp' }), background: C.night }} />
    </SceneFade>
  )
}

export function LogoBadge({ size }: { size: number }) {
  return (
    <Canvas
      width={size}
      height={size}
      draw={(ctx, w, h, t) => {
        ctx.save()
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2)
        ctx.clip()
        const bg = ctx.createRadialGradient(w * 0.5, h * 0.46, 4, w / 2, h / 2, w * 0.72)
        bg.addColorStop(0, '#11505e')
        bg.addColorStop(0.45, '#0a2d38')
        bg.addColorStop(1, '#03111a')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, w, h)
        ctx.restore()
        ctx.strokeStyle = 'rgba(242,193,78,0.9)'
        ctx.lineWidth = w * 0.015
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2)
        ctx.stroke()
        const g = G.gold
        const e = bettaExtent(g)
        const s = (w * 0.76) / (e.right - e.left)
        const cx = w / 2 - ((e.left + e.right) / 2) * s - w * 0.01
        const cy = h / 2 - ((e.top + e.bottom) / 2) * s
        placeFish(ctx, g, cx, cy + Math.sin(t * 1.4) * 3, s, 1, -0.04, { t, flare: 0.7 + 0.3 * Math.max(0, Math.sin(t * 2.2)), swim: 0.15, health: 100 })
      }}
    />
  )
}

// 9 · Closing time.
export function EndScene({ dur }: { dur: number }) {
  const k = useIn(4, 14)
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <SceneFade dur={dur} fadeIn={12} fadeOut={0}>
      <FightNight t={f / fps} spot={0.55} crowd={0.12} focusY="40%" />
      <AbsoluteFill style={{ background: 'radial-gradient(40% 40% at 50% 70%, rgba(255,190,110,0.10), transparent 70%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * k})`, opacity: clamp(k * 1.4), filter: 'drop-shadow(0 20px 60px rgba(242,193,78,0.25))' }}>
          <LogoBadge size={230} />
        </div>
        <Rise at={10} style={{ marginTop: 26 }}>
          <Brandmark size={64} />
        </Rise>
        <Rise at={18} style={{ marginTop: 22 }}>
          <Title size={128}>
            The deep <Turn>keeps everything.</Turn>
          </Title>
        </Rise>
        <Rise at={28} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: F.display, fontSize: 40, color: C.text, fontVariationSettings: "'opsz' 72" }}>Every buy is a fight.</div>
        </Rise>
        <Rise at={36} style={{ marginTop: 44 }}>
          <LaunchPill size={34} glow={30 + 20 * Math.sin(f / 8)} />
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
