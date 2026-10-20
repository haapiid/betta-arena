import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { BUY, KAISER, RONIN, short } from '../lib/cast'
import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import { clamp, placeFish, prand, scaleFor, smooth } from '../lib/jarScene'
import { FightNight } from '../lib/night'
import { BeltBadge, Body, Kicker, Rise, SceneFade, Ticket, Title, Turn, useIn } from '../lib/ui'

const HEX = '0123456789abcdef'

/** the tx hash, resolving left to right out of noise */
function Hash({ text, k, f }: { text: string; k: number; f: number }) {
  const n = text.length
  const shown = Math.floor(k * n)
  return (
    <>
      {text.split('').map((ch, i) => {
        if (i < 2) return <span key={i}>{ch}</span>
        if (i < shown) return <span key={i} style={{ color: '#7a5a12' }}>{ch}</span>
        return (
          <span key={i} style={{ color: '#b9ad97' }}>
            {HEX[Math.floor(prand(i + f * 3, 5) * 16)]}
          </span>
        )
      })}
    </>
  )
}

function Row({ label, value, from, at, dot }: { label: string; value: string; from: string; at: number; dot: string }) {
  const k = useIn(at)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', alignItems: 'baseline', gap: 18, padding: '14px 0', borderTop: `1px solid ${C.lineSoft}`, opacity: clamp(k * 1.3), transform: `translateX(${(1 - k) * 20}px)` }}>
      <span style={{ fontFamily: F.mono, fontSize: 20, color: C.faint }}>{label}</span>
      <span style={{ fontFamily: F.display, fontSize: 36, fontWeight: 600, color: C.cream }}>{value}</span>
      <span style={{ fontFamily: F.mono, fontSize: 19, color: dot, whiteSpace: 'nowrap' }}>← {from}</span>
    </div>
  )
}

// 2 · A buy lands. Its transaction hash picks the fish; its size picks the level.
export function BuyScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const slip = useIn(6)
  const hk = clamp((t - 0.45) / 0.9)
  const amt = useIn(44)
  const card = useIn(52)
  const half = BUY.tx.length / 2
  return (
    <SceneFade dur={dur}>
      <FightNight t={t + 2} crowd={0.1} spot={0.45} focusX="30%" />
      <div style={{ position: 'absolute', left: 120, top: 96 }}>
        <Rise at={2}>
          <Kicker size={24}>A buy lands · Robinhood Chain</Kicker>
        </Rise>
        <Rise at={6} style={{ marginTop: 18 }}>
          <Title size={100}>
            Your transaction <Turn>picks the fish.</Turn>
          </Title>
        </Rise>
      </div>

      {/* the buy slip */}
      <div style={{ position: 'absolute', left: 120, top: 360, width: 780, opacity: clamp(slip * 1.4), transform: `translateY(${(1 - slip) * 60}px) rotate(-1.2deg)` }}>
        <Ticket style={{ padding: '34px 44px 38px 52px', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.85)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#7a6d5a' }}>
            <span>BUY · $BETTA</span>
            <span>fight #{BUY.n}</span>
          </div>
          <div style={{ marginTop: 26, fontSize: 18, color: '#7a6d5a' }}>tx hash</div>
          <div style={{ marginTop: 6, fontSize: 31, fontWeight: 600, lineHeight: 1.3, letterSpacing: '0.01em' }}>
            <Hash text={BUY.tx.slice(0, half)} k={clamp(hk * 2)} f={f} />
            <br />
            <Hash text={'  ' + BUY.tx.slice(half)} k={clamp(hk * 2 - 1)} f={f + 7} />
          </div>
          <div style={{ display: 'flex', gap: 60, marginTop: 30 }}>
            <div>
              <div style={{ fontSize: 18, color: '#7a6d5a' }}>buyer</div>
              <div style={{ fontSize: 28, marginTop: 6 }}>{short(BUY.buyer)}</div>
            </div>
            <div style={{ opacity: clamp(amt * 1.3), transform: `scale(${0.9 + 0.1 * amt})`, transformOrigin: '0 50%' }}>
              <div style={{ fontSize: 18, color: '#7a6d5a' }}>bought</div>
              <div style={{ fontSize: 36, marginTop: 4, fontWeight: 800, color: '#c4202f' }}>{BUY.tokens} $BETTA</div>
            </div>
          </div>
        </Ticket>
      </div>

      {/* the fish it brings */}
      <div style={{ position: 'absolute', left: 1010, top: 330, width: 800, opacity: clamp(card * 1.3), transform: `translateX(${(1 - card) * 60}px)` }}>
        <div style={{ borderRadius: 26, overflow: 'hidden', boxShadow: '0 0 0 1.5px rgba(200,240,250,0.16), 0 40px 80px -30px rgba(0,0,0,0.9), 0 0 120px -40px rgba(255,65,80,0.4)' }}>
          <Canvas
            width={800}
            height={330}
            unit={2}
            draw={(ctx, w, h, tt) => {
              drawTankBack(ctx, w, h, tt, { water: 100, happy: false, seed: 41, plants: true })
              const g = RONIN.g
              const s = scaleFor(g, w * 0.42)
              const enter = smooth((tt - 1.7) / 0.7)
              const x = w * 0.5 + Math.sin(tt * 1.1) * 8 - (1 - enter) * w * 0.6
              const y = Math.min(h * 0.5, gravelTop(h) - h * 0.24) + Math.sin(tt * 1.7) * 4
              placeFish(ctx, g, x, y, s, 1, 0, { t: tt, swim: 0.4 + (1 - enter) * 0.6, flare: smooth((tt - 2.4) / 0.5) * 0.8, health: 100 })
              drawTankFront(ctx, w, h, tt, { water: 100, happy: false, seed: 41, leaf: false })
            }}
          />
        </div>
        <div style={{ marginTop: 18 }}>
          <Row label="breed" value={RONIN.breed} from="from the tx hash" at={62} dot={C.gold} />
          <Row label="name" value={RONIN.name} from="from the tx hash" at={70} dot={C.gold} />
          <Row label="level" value={`Lv ${RONIN.lv}`} from="bigger buy, higher level" at={78} dot={C.red} />
        </div>
      </div>
    </SceneFade>
  )
}

const TICKS = [
  `#${BUY.n} ${RONIN.name} (Lv ${RONIN.lv}) takes the belt from ${KAISER.name}`,
  `#211 ${KAISER.name} beats Pearl · 4 in a row`,
  `#210 ${KAISER.name} beats Sky · 3 in a row`,
  `#209 ${KAISER.name} beats Bolt · 2 in a row`,
  `#208 ${KAISER.name} (Lv 14) takes the belt from Luna`,
  `#207 Luna beats Ghost · 6 in a row`,
]

// 4 · The belt changes hands; the streak resets; every fight can be replayed.
export function BeltScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const belt = useIn(4, 12)
  const strike = clamp((t - 1.0) / 0.4)
  const line = [...TICKS, ...TICKS].map((s) => `● ${s}`)
  return (
    <SceneFade dur={dur}>
      <FightNight t={t + 9} crowd={0.16} spot={0.9} focusY="40%" />
      <AbsoluteFill style={{ background: 'radial-gradient(36% 34% at 50% 38%, rgba(242,193,78,0.16), transparent 70%)' }} />
      {/* the new champion, flaring under the lights */}
      <AbsoluteFill>
        <Canvas
          width={1920}
          height={1080}
          draw={(ctx, w, h, tt) => {
            const k = smooth((tt - 0.4) / 0.8)
            const gl = ctx.createRadialGradient(w / 2, h * 0.79, 10, w / 2, h * 0.79, 420)
            gl.addColorStop(0, `rgba(242,193,78,${0.22 * k})`)
            gl.addColorStop(1, 'rgba(242,193,78,0)')
            ctx.fillStyle = gl
            ctx.fillRect(0, 0, w, h)
            const g = RONIN.g
            ctx.globalAlpha = k
            placeFish(ctx, g, w / 2 + 20 + (1 - k) * -200, h * 0.79 + Math.sin(tt * 2) * 6, scaleFor(g, 380), 1, -0.03, { t: tt, swim: 0.3, flare: 0.7 + 0.3 * Math.max(0, Math.sin(tt * 3)), health: 100 })
            ctx.globalAlpha = 1
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110, textAlign: 'center' }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * belt})`, opacity: clamp(belt * 1.4) }}>
          <BeltBadge size={44}>THE BELT · {RONIN.name}</BeltBadge>
        </div>
        <Rise at={10} style={{ marginTop: 34 }}>
          <Title size={116}>
            {RONIN.name} <Turn>takes the belt.</Turn>
          </Title>
        </Rise>
        <Rise at={18} style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', gap: 90, justifyContent: 'center', fontFamily: F.mono }}>
            <div>
              <div style={{ fontSize: 22, color: C.faint }}>old champion</div>
              <div style={{ position: 'relative', fontSize: 40, marginTop: 8, color: C.dim }}>
                {KAISER.name} · 4 in a row
                <div style={{ position: 'absolute', left: 0, top: '52%', height: 4, width: `${strike * 100}%`, background: C.red, borderRadius: 2 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, color: C.faint }}>belt held</div>
              <div style={{ fontSize: 40, marginTop: 8, color: C.gold }}>{RONIN.name} · 1 win</div>
            </div>
          </div>
        </Rise>
        <Rise at={26} style={{ marginTop: 34 }}>
          <Body size={30}>Next buy, next fight. Every fight replays from its transaction.</Body>
        </Rise>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, background: C.red, color: '#170405', overflow: 'hidden', borderTop: '1px solid #3a1418' }}>
        <div style={{ display: 'flex', gap: 60, whiteSpace: 'nowrap', fontFamily: F.mono, fontSize: 24, fontWeight: 700, lineHeight: '64px', transform: `translateX(${-t * 160}px)`, paddingLeft: 40 }}>
          {line.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>
    </SceneFade>
  )
}
