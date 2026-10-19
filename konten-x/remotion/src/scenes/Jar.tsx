import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { drawJarScene, jarDims, smooth } from '../lib/jarScene'
import { jarAt, PHASE } from '../lib/jarTimeline'
import { Backdrop, Body, Chip, Eyebrow, Meter, SceneFade, Title } from '../lib/ui'

const UNIT = 2.3
const CW = 1100
const CH = 1040

function Phase({ from, to, children }: { from: number; to: number; children: React.ReactNode }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const T = f / fps
  const o = Math.min(smooth((T - from) / 0.4), from === 0 ? 1 : 1, 1 - smooth((T - (to - 0.35)) / 0.35))
  const dy = (1 - smooth((T - from) / 0.5)) * 30
  if (o <= 0) return null
  return <div style={{ position: 'absolute', left: 0, top: 0, opacity: o, transform: `translateY(${dy}px)` }}>{children}</div>
}

export function JarSceneComp({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const T = f / fps
  const d = jarDims(CW / UNIT, CH / UNIT)
  const { hud } = jarAt(T, d, G.halfmoon, 0.5)
  const days = smooth((T - (PHASE.water + 0.05)) / 0.3) * (1 - smooth((T - (PHASE.water + 1.6)) / 0.4))
  return (
    <SceneFade dur={dur}>
      <Backdrop tealX="28%" />
      <div style={{ position: 'absolute', left: 40, top: 30 }}>
        <Canvas
          width={CW}
          height={CH}
          unit={UNIT}
          draw={(ctx, cw, ch, t) => {
            const dd = jarDims(cw, ch)
            // warm shelf under the jar
            const sh = ctx.createRadialGradient(cw * 0.5, dd.J.base + 4, 10, cw * 0.5, dd.J.base + 4, cw * 0.45)
            sh.addColorStop(0, 'rgba(0,0,0,0.55)')
            sh.addColorStop(1, 'rgba(0,0,0,0)')
            ctx.fillStyle = sh
            ctx.fillRect(0, dd.J.base - 20, cw, 60)
            drawJarScene(ctx, cw, ch, t, jarAt(t, dd, G.halfmoon, 0.5).scene)
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 40,
            textAlign: 'center',
            opacity: days,
            fontFamily: F.mono,
            fontSize: 30,
            letterSpacing: '0.2em',
            color: C.goldSoft,
          }}
        >
          THREE DAYS LATER…
        </div>
      </div>

      <AbsoluteFill style={{ left: 1170, top: 150, width: 700 }}>
        <div style={{ position: 'relative', height: 470 }}>
          <Phase from={0} to={PHASE.water}>
            <Eyebrow>02 · Care</Eyebrow>
            <Title size={96} style={{ marginTop: 16 }}>
              Keep it fed.
            </Title>
            <Body style={{ marginTop: 22, width: 660 }}>Tip the tin over the jar and watch it hunt every pellet down. A hungry betta loses health.</Body>
            <div style={{ display: 'flex', gap: 14, marginTop: 30 }}>
              <Chip color={C.gold}>Pellets</Chip>
              <Chip color={C.coral}>Daphnia</Chip>
              <Chip color="#ff5d6c">Bloodworms</Chip>
            </div>
          </Phase>
          <Phase from={PHASE.water} to={PHASE.mirror}>
            <Eyebrow>02 · Care</Eyebrow>
            <Title size={96} style={{ marginTop: 16 }}>
              Keep it clean.
            </Title>
            <Body style={{ marginTop: 22, width: 660 }}>Change the water before it clouds over, then drop in a ketapang leaf to calm it down.</Body>
            <div style={{ display: 'flex', gap: 14, marginTop: 30 }}>
              <Chip color={C.teal}>Water change</Chip>
              <Chip color="#c8823a">Ketapang leaf</Chip>
            </div>
          </Phase>
          <Phase from={PHASE.mirror} to={99}>
            <Eyebrow color={C.gold}>03 · Train</Eyebrow>
            <Title size={96} style={{ marginTop: 16 }}>
              Mirror Flaring.
            </Title>
            <Body style={{ marginTop: 22, width: 660 }}>Stand a mirror beside the jar. It flares at its own reflection — and gets tougher every session.</Body>
            <div style={{ display: 'flex', gap: 14, marginTop: 30 }}>
              <Chip color={C.gold}>Mirror Flaring</Chip>
              <Chip color="#ffd36a">Morning Sun</Chip>
              <Chip color="#c8823a">Ketapang Soak</Chip>
            </div>
          </Phase>
        </div>
        <div style={{ display: 'grid', gap: 30, marginTop: 70 }}>
          <Meter label="Fullness" value={hud.full} color={C.gold} width={640} />
          <Meter label="Water" value={hud.water} color={C.teal} width={640} right={hud.water > 80 ? 'Clear' : hud.water > 45 ? 'Cloudy' : 'Murky'} />
          <Meter label="Attack" value={hud.atk} color={C.coral} width={640} right={`${hud.atk}`} />
        </div>
        {[12.2, 13.5, 14.8].map((at) => {
          const el = T - at
          if (el < 0 || el > 1.1) return null
          return (
            <div
              key={at}
              style={{
                position: 'absolute',
                right: 60,
                top: 430 - el * 60,
                opacity: interpolate(el, [0, 0.15, 0.8, 1.1], [0, 1, 1, 0]),
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: 34,
                color: C.coral,
              }}
            >
              +1 ATK
            </div>
          )
        })}
      </AbsoluteFill>
    </SceneFade>
  )
}
