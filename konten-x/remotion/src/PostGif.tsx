import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from './lib/Canvas'
import { C, F } from './lib/brand'
import { G } from './game/species'
import { drawJarScene, jarDims } from './lib/jarScene'
import { jarAt } from './lib/jarTimeline'
import { Brandmark, Eyebrow, Title } from './lib/ui'

// 6 s seamless loop: the betta flaring at the mirror. The first 0.8 s cross-fade
// from the frame one loop later, so the last frame flows straight into the first.
const LOOP = 6
const XFADE = 0.8
const BASE = 42
export const GIF_FRAMES = LOOP * 30

function JarLayer({ offset, opacity }: { offset: number; opacity: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <Canvas
        width={700}
        height={675}
        unit={1.5}
        draw={(ctx, cw, ch, t) => {
          const d = jarDims(cw, ch)
          const bg = ctx.createRadialGradient(cw * 0.45, ch * 0.5, 20, cw * 0.45, ch * 0.5, cw * 0.75)
          bg.addColorStop(0, '#0b3442')
          bg.addColorStop(1, '#03111a')
          ctx.fillStyle = bg
          ctx.fillRect(0, 0, cw, ch)
          const sh = ctx.createRadialGradient(cw * 0.5, d.J.base + 4, 10, cw * 0.5, d.J.base + 4, cw * 0.45)
          sh.addColorStop(0, 'rgba(0,0,0,0.55)')
          sh.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = sh
          ctx.fillRect(0, d.J.base - 20, cw, 60)
          const sc = jarAt(BASE + t + offset, d, G.red, 0.6).scene
          sc.tint = { c: '#8a4a12', a: 0.07 } // lighter tannin tint than the video, so the GIF stays vivid
          drawJarScene(ctx, cw, ch, BASE + t + offset, sc)
        }}
      />
    </div>
  )
}

export function PostGif() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const blend = t < XFADE ? 1 - t / XFADE : 0
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: 'radial-gradient(700px 500px at 75% 40%, rgba(242,193,78,0.07), transparent 70%), #03111a' }} />
      <div style={{ position: 'absolute', left: 10, top: 0, width: 700, height: 675 }}>
        <JarLayer offset={0} opacity={1} />
        {blend > 0 && <JarLayer offset={LOOP} opacity={blend} />}
      </div>
      <div style={{ position: 'absolute', left: 724, top: 150, width: 440 }}>
        <Eyebrow size={17} color={C.gold}>
          Training · Mirror Flaring
        </Eyebrow>
        <Title size={64} style={{ marginTop: 14 }}>
          It flares at its own reflection.
        </Title>
        <div style={{ fontFamily: F.display, fontSize: 28, color: C.text, marginTop: 22, lineHeight: 1.3 }}>
          Raise it. Groom it. <span style={{ color: C.coral, fontWeight: 600 }}>Let it fight.</span>
        </div>
        <div
          style={{
            marginTop: 34,
            display: 'inline-flex',
            gap: 10,
            padding: '10px 18px',
            borderRadius: 99,
            border: '1.5px solid rgba(242,193,78,0.55)',
            background: 'rgba(10,36,48,0.85)',
            fontFamily: F.mono,
            fontSize: 17,
            color: C.text,
          }}
        >
          <span style={{ color: C.gold, fontWeight: 700 }}>$BETTA</span>
          <span style={{ color: C.faint }}>·</span>
          <span>Coming soon on Robinhood Chain</span>
        </div>
        <div style={{ marginTop: 40 }}>
          <Brandmark size={30} />
        </div>
      </div>
    </AbsoluteFill>
  )
}
