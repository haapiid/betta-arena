import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from './lib/Canvas'
import { C, F } from './lib/brand'
import { GIF_BOUT, short } from './lib/cast'
import { boutState, drawBout } from './lib/ring'
import { clamp, smooth } from './lib/jarScene'
import { FightNight, Plates } from './lib/night'
import { BeltBadge, Kicker, LaunchPill, Title, Turn } from './lib/ui'

// 6 s seamless loop: a buy lands, a betta drops into the ring, the champion keeps the belt,
// the ring settles back to where it started. Everything outside the tank moves on periods that
// divide 6 s; the tank itself cross-fades from one loop later during the first 0.8 s.
const LOOP = 6
const XFADE = 0.8
export const GIF_FRAMES = LOOP * 30
const RW = 690
const RH = 388
const TX = '0x9d4e1b7ac2f05e83d6a4c19b7e2f8d03a5c6e1f4b9d27c08e3a5f61b4c7d2e90'

export function PostGif() {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const b = GIF_BOUT
  const blend = t < XFADE ? 1 - t / XFADE : 0
  const st = boutState(b, t)
  const res = st.done ? smooth((st.el - b.events.length * b.step - 0.1) / 0.35) * (1 - smooth((t - 5.0) / 0.4)) : 0
  const slip = smooth((t - 0.15) / 0.3) * (1 - smooth((t - 1.1) / 0.3))
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <FightNight t={t} crowd={0.13} focusX="68%" />
      <div style={{ position: 'absolute', left: 56, top: 132, width: 380 }}>
        <Kicker size={16}>Betta Arena · $BETTA</Kicker>
        <Title size={76} style={{ marginTop: 14 }}>
          Every buy is <Turn>a fight.</Turn>
        </Title>
        <div style={{ fontFamily: F.body, fontSize: 21, lineHeight: 1.4, color: '#a9c3cc', marginTop: 22 }}>
          Buy $BETTA and a betta drops into the ring. It fights the champion on the spot.
        </div>
      </div>
      <div style={{ position: 'absolute', left: 56, top: 590 }}>
        <LaunchPill size={17} />
      </div>

      <div style={{ position: 'absolute', left: 470, width: RW, top: 42 }}>
        <Plates bout={b} tau={t} size={0.62} subA={`${b.a.breed} · new`} subB={`${b.b.breed} · champion`} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 140,
          width: RW,
          height: RH,
          borderRadius: 22,
          overflow: 'hidden',
          background: '#071820',
          boxShadow: '0 0 0 1.5px rgba(200,240,250,0.18), 0 30px 70px -26px rgba(0,0,0,0.9), 0 0 110px -26px rgba(255,65,80,0.5)',
        }}
      >
        <Canvas width={RW} height={RH} unit={1.75} draw={(ctx, w, h) => drawBout(ctx, w, h, t, t, b)} />
        {blend > 0 && (
          <div style={{ position: 'absolute', inset: 0, opacity: blend }}>
            <Canvas width={RW} height={RH} unit={1.75} draw={(ctx, w, h) => drawBout(ctx, w, h, t + LOOP, t, b)} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 16, display: 'flex', justifyContent: 'center', opacity: clamp(res * 1.4), transform: `translateY(${(1 - res) * 12}px)` }}>
          <BeltBadge size={19}>{b.b.name} keeps the belt · 5 in a row</BeltBadge>
        </div>
        {/* the buy that starts it */}
        <div style={{ position: 'absolute', left: 18, top: 16, opacity: slip, transform: `translateY(${(1 - slip) * -10}px)` }}>
          <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 999, background: C.red, color: '#170405', fontFamily: F.mono, fontWeight: 700, fontSize: 15 }}>BUY · {short(TX)}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 470, width: RW, top: 540, display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 14, color: '#7d9aa5' }}>
        <span>breed, name and level come from the buy</span>
        <span>every fight replays from its tx</span>
      </div>
    </AbsoluteFill>
  )
}
