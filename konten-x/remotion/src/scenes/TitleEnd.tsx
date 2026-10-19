import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { bettaExtent } from '../render/betta'
import { clamp, easeOut, placeFish, prand, smooth } from '../lib/jarScene'
import { Eyebrow, Rise, SceneFade, Title, useIn } from '../lib/ui'

// dark water: light shafts and drifting motes, used behind the title and end cards
export function drawDeepWater(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#0a2d38')
  bg.addColorStop(0.55, '#061b25')
  bg.addColorStop(1, '#03111a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 6; i++) {
    const x = w * (0.08 + i * 0.17) + Math.sin(t * 0.35 + i * 1.7) * w * 0.03
    const sw = w * (0.03 + 0.015 * Math.sin(t * 0.5 + i))
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.95)
    g.addColorStop(0, 'rgba(160,240,235,0.09)')
    g.addColorStop(1, 'rgba(160,240,235,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - sw * 0.4, 0)
    ctx.lineTo(x + sw * 0.4, 0)
    ctx.lineTo(x + sw * 1.8 + w * 0.05, h)
    ctx.lineTo(x - sw * 0.6 + w * 0.05, h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  for (let i = 0; i < 46; i++) {
    const sp = 14 + prand(i, 2) * 26
    const y = (((prand(i, 3) * h - t * sp) % h) + h) % h
    const x = prand(i, 4) * w + Math.sin(t * 0.8 + i) * 8
    const r = 1 + prand(i, 5) * 2.4
    ctx.strokeStyle = `rgba(220,250,255,${0.1 + prand(i, 6) * 0.25})`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  const v = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7)
  v.addColorStop(0, 'rgba(3,17,26,0)')
  v.addColorStop(1, 'rgba(3,17,26,0.75)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

export function TitleScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  return (
    <SceneFade dur={dur} fadeIn={0} fadeOut={10}>
      <Canvas
        width={1920}
        height={1080}
        draw={(ctx, w, h, t) => {
          drawDeepWater(ctx, w, h, t + 3)
          const g = G.gold
          const e = bettaExtent(g)
          const s = 820 / (e.right - e.left)
          const k = easeOut(t / 1.8)
          const x = lerpN(-500, 1440, k)
          const y = 560 + Math.sin(t * 1.3) * 10
          const flare = smooth((t - 1.3) / 0.6) * (0.6 + 0.4 * Math.max(0, Math.sin(t * 2.4 - 3)))
          // gold glow behind the fish
          const gl = ctx.createRadialGradient(x - 60, y, 20, x - 60, y, 520)
          gl.addColorStop(0, `rgba(242,193,78,${0.16 * k})`)
          gl.addColorStop(1, 'rgba(242,193,78,0)')
          ctx.fillStyle = gl
          ctx.fillRect(0, 0, w, h)
          placeFish(ctx, g, x, y, s, 1, -0.03 + (1 - k) * 0.05, { t, swim: 0.2 + (1 - k) * 0.8, flare, health: 100 })
        }}
      />
      <AbsoluteFill style={{ padding: '0 0 0 130px', justifyContent: 'center' }}>
        <Rise at={14}>
          <Eyebrow size={26}>$BETTA · A betta keeping & fighting game</Eyebrow>
        </Rise>
        <Rise at={20} style={{ marginTop: 22 }}>
          <Title size={190}>
            Betta
            <br />
            <span style={{ color: C.gold }}>Arena</span>
          </Title>
        </Rise>
        <Rise at={34} style={{ marginTop: 30 }}>
          <div style={{ fontFamily: F.display, fontSize: 56, color: C.text, fontVariationSettings: "'opsz' 72" }}>
            Raise it. Groom it. <span style={{ color: C.coral, fontWeight: 600 }}>Let it fight.</span>
          </div>
        </Rise>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(f, [0, 8], [1, 0], { extrapolateRight: 'clamp' }), background: C.ink }} />
    </SceneFade>
  )
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t

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

export function EndScene({ dur }: { dur: number }) {
  const k = useIn(4, 14)
  const f = useCurrentFrame()
  return (
    <SceneFade dur={dur} fadeIn={12} fadeOut={0}>
      <Canvas width={1920} height={1080} draw={(ctx, w, h, t) => drawDeepWater(ctx, w, h, t + 20)} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * k})`, opacity: clamp(k * 1.4), filter: 'drop-shadow(0 20px 60px rgba(95,224,208,0.25))' }}>
          <LogoBadge size={300} />
        </div>
        <Rise at={12} style={{ marginTop: 34 }}>
          <Title size={150}>
            Betta <span style={{ color: C.gold }}>Arena</span>
          </Title>
        </Rise>
        <Rise at={20} style={{ marginTop: 18 }}>
          <div style={{ fontFamily: F.display, fontSize: 52, color: C.text, fontVariationSettings: "'opsz' 72" }}>
            Raise it. Groom it. <span style={{ color: C.coral, fontWeight: 600 }}>Let it fight.</span>
          </div>
        </Rise>
        <Rise at={30} style={{ marginTop: 46 }}>
          <div
            style={{
              display: 'inline-flex',
              gap: 18,
              alignItems: 'center',
              padding: '18px 36px',
              borderRadius: 999,
              border: '2px solid rgba(242,193,78,0.6)',
              background: 'rgba(10,36,48,0.8)',
              fontFamily: F.mono,
              fontSize: 34,
              color: C.text,
              boxShadow: `0 0 ${30 + 20 * Math.sin(f / 8)}px rgba(242,193,78,0.18)`,
            }}
          >
            <span>Coming soon on Robinhood Chain</span>
            <span style={{ color: C.faint }}>·</span>
            <span style={{ color: C.gold, fontWeight: 700 }}>$BETTA</span>
          </div>
        </Rise>
      </AbsoluteFill>
    </SceneFade>
  )
}
