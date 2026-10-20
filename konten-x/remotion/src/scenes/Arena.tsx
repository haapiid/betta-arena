import { useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F } from '../lib/brand'
import { BUY, DEMO_BOUT, short } from '../lib/cast'
import { boutState } from '../lib/ring'
import { clamp, smooth } from '../lib/jarScene'
import { FightNight, Plates, RingStage } from '../lib/night'
import { BeltBadge, Body, Kicker, Rise, SceneFade, Title, Turn } from '../lib/ui'

// 3 · The betta drops into the ring and fights the champion on the spot.
const CALLS: Record<string, string> = {
  hit: 'lands a clean bite',
  crit: 'lands a critical hit!',
  miss: 'swings and misses',
}

export function ArenaScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const b = DEMO_BOUT
  const st = boutState(b, t)
  const win = st.done ? smooth((st.el - b.events.length * b.step - 0.15) / 0.45) : 0
  const ev = !st.done && st.step >= 0 ? b.events[st.step] : null
  const call = ev ? `${ev.actor ? b.b.name : b.a.name} ${CALLS[ev.kind]}` : st.done ? `${b.b.name} sinks. ${b.a.name} takes the belt.` : t > b.drop ? 'Both fish flare…' : `A buy lands. ${b.a.name} drops in.`
  return (
    <SceneFade dur={dur}>
      <FightNight t={t} crowd={0.12} />
      <div style={{ position: 'absolute', left: 620, width: 1240, top: 64 }}>
        <Plates bout={b} tau={t} subA={`${b.a.breed} · new · ${short(BUY.buyer)}`} subB={`${b.b.breed} · champion · 4 in a row`} />
      </div>
      <div style={{ position: 'absolute', left: 620, top: 222 }}>
        <RingStage width={1240} height={698} unit={3.1} bout={b} T={t} tau={t} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 26, display: 'flex', justifyContent: 'center', opacity: clamp(win * 1.4), transform: `translateY(${(1 - win) * 18}px) scale(${0.9 + 0.1 * win})` }}>
          <BeltBadge size={34}>{b.a.name} takes the belt</BeltBadge>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 620, width: 1240, top: 944, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: F.body, fontSize: 30, color: C.dim }}>
        <span style={{ color: ev?.kind === 'crit' ? C.text : C.dim }}>{call}</span>
        <span style={{ fontFamily: F.mono, fontSize: 22 }}>
          #{BUY.n} · {BUY.tokens} $BETTA · {short(BUY.tx)}
        </span>
      </div>
      <div style={{ position: 'absolute', left: 80, top: 290, width: 480 }}>
        <Rise at={8}>
          <Kicker size={22}>The ring</Kicker>
        </Rise>
        <Rise at={12} style={{ marginTop: 18 }}>
          <Title size={88}>
            It fights the
            <br />
            champion
            <br />
            <Turn>on the spot.</Turn>
          </Title>
        </Rise>
        <Rise at={20} style={{ marginTop: 34 }}>
          <Body size={28}>Win and it takes the belt. Lose and the champion&rsquo;s streak grows.</Body>
        </Rise>
      </div>
    </SceneFade>
  )
}
