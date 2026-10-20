import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F } from '../lib/brand'
import { clamp, easeOut, prand, smooth } from '../lib/jarScene'
import { Body, Kicker, Rise, SceneFade, Stamp, Ticket, Title, Turn, useIn } from '../lib/ui'

export const STEP_ETH = 0.02
const TRADES = [0.55, 0.9, 1.2, 1.5, 1.78, 2.05, 2.3, 2.55, 2.8, 3.05]
const RING_AT = 3.35

export function BrassRoom() {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(50% 45% at 78% 22%, rgba(242,193,78,0.13), transparent 70%), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 34px), ${C.brass}`,
      }}
    />
  )
}

/** the brass bell; `swing` in radians */
export function BellArt({ size = 260, swing = 0 }: { size?: number; swing?: number }) {
  return (
    <svg width={size} height={size} viewBox="-100 -110 200 200" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="brass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6b4a14" />
          <stop offset="0.3" stopColor="#f2c14e" />
          <stop offset="0.45" stopColor="#ffe8a8" />
          <stop offset="0.7" stopColor="#c8932a" />
          <stop offset="1" stopColor="#5a3c0e" />
        </linearGradient>
      </defs>
      <rect x="-70" y="-108" width="140" height="10" rx="4" fill="#3a2a14" />
      <rect x="-6" y="-100" width="12" height="22" fill="#5a3e18" />
      <g transform={`rotate(${(swing * 180) / Math.PI} 0 -84)`}>
        <circle cx={-Math.sin(swing * 1.8) * 30} cy="62" r="11" fill="#8a5b12" />
        <path d="M0 -86 C 40 -86 52 -60 54 -20 C 56 20 62 40 80 54 L -80 54 C -62 40 -56 20 -54 -20 C -52 -60 -40 -86 0 -86 Z" fill="url(#brass)" stroke="#3a2608" strokeWidth="2" />
        <rect x="-86" y="50" width="172" height="12" rx="6" fill="url(#brass)" stroke="#3a2608" strokeWidth="2" />
        <path d="M-30 -70 C -40 -40 -42 0 -46 40" stroke="rgba(255,250,220,0.55)" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// 5 · Pons pays the creator a fee on every trade; it fills the tank; the bell rings.
export function FeeScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const done = TRADES.filter((x) => t >= x + 0.25).length
  const pour = TRADES.reduce((a, x) => a + smooth((t - x - 0.25) / 0.3), 0)
  const drain = smooth((t - (RING_AT + 1.2)) / 0.8)
  const fill = (pour / TRADES.length) * (1 - drain)
  const eth = STEP_ETH * fill
  const r = t - RING_AT
  const swing = r > 0 ? Math.sin(r * 14) * 0.38 * Math.exp(-r * 1.6) : 0
  const rung = clamp(r / 0.15)
  return (
    <SceneFade dur={dur}>
      <BrassRoom />
      <div style={{ position: 'absolute', left: 120, top: 200, width: 820, color: C.brassText }}>
        <Rise at={4}>
          <Kicker size={24} color={C.brassDim}>
            The bell
          </Kicker>
        </Rise>
        <Rise at={8} style={{ marginTop: 20 }}>
          <Title size={100} color={C.brassText}>
            Fees fill the tank.
            <br />
            <Turn>The bell buys back.</Turn>
          </Title>
        </Rise>
        <Rise at={18} style={{ marginTop: 40 }}>
          <Body size={36} color="#cbbd98" style={{ maxWidth: 720 }}>
            Pons pays the creator a fee on every trade. It collects in the fee tank.
          </Body>
        </Rise>
        <div style={{ marginTop: 40, height: 60, opacity: rung, transform: `scale(${0.9 + 0.1 * rung})`, transformOrigin: '0 50%' }}>
          <Title size={58} color={C.gold}>
            {drain > 0.05 ? 'Claimed. Every wei of it.' : 'Ding. The bell rings.'}
          </Title>
        </div>
      </div>

      {/* the bell and its rings of sound */}
      <div style={{ position: 'absolute', left: 1230, top: 60 }}>
        {r > 0 &&
          [0, 0.18, 0.36].map((d, i) => {
            const k = clamp((r - d) / 0.9)
            if (k <= 0 || k >= 1) return null
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 130 - 60 - k * 220,
                  top: 140 - 40 - k * 160,
                  width: 120 + k * 440,
                  height: 80 + k * 320,
                  borderRadius: '50%',
                  border: `${4 * (1 - k) + 1}px solid rgba(242,193,78,${0.8 * (1 - k)})`,
                }}
              />
            )
          })}
        <BellArt size={260} swing={swing} />
      </div>

      {/* the fee tank */}
      <div style={{ position: 'absolute', left: 1150, top: 420, width: 300, height: 400 }}>
        {TRADES.map((x, i) => {
          const a = t - x
          if (a < 0 || a > 1.1) return null
          const y = -150 + a * 260 - 40 * Math.sin(Math.min(1, a / 0.3) * Math.PI)
          return (
            <div key={i} style={{ position: 'absolute', left: -230 + prand(i, 2) * 40, top: y - 120, fontFamily: F.mono, fontSize: 22, color: '#cbbd98', opacity: clamp(1.2 - a), whiteSpace: 'nowrap' }}>
              trade · fee in
            </div>
          )
        })}
        {TRADES.map((x, i) => {
          const a = t - x
          if (a < 0 || a > 0.3) return null
          return <div key={'d' + i} style={{ position: 'absolute', left: 140 + (prand(i, 3) - 0.5) * 60, top: -40 + a * a * 1600, width: 14, height: 18, borderRadius: '50% 50% 50% 50% / 62% 62% 40% 40%', background: '#7ce8dc', boxShadow: '0 0 12px rgba(124,232,220,0.6)' }} />
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '30px 30px 40px 40px',
            overflow: 'hidden',
            background: 'rgba(10,30,36,0.6)',
            boxShadow: 'inset 0 0 0 3px rgba(220,248,255,0.38), 0 30px 60px -30px rgba(0,0,0,0.9)',
          }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.max(3, fill * 100)}%`, background: 'linear-gradient(180deg, #7ce8dc, #1f8d86 58%, #0d4a4c)' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: -8, height: 16, background: 'radial-gradient(62% 100% at 50% 100%, rgba(220,255,250,0.7), transparent 70%)' }} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: F.mono, fontSize: 24, color: '#d8f5f2' }}>{Math.round(fill * 100)}%</div>
          <div style={{ position: 'absolute', left: 26, top: 40, bottom: 40, width: 10, borderRadius: 8, background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))' }} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 1500, top: 470, fontFamily: F.mono, color: C.brassText, display: 'grid', gap: 30 }}>
        <div>
          <div style={{ fontSize: 20, color: '#9c8a5f' }}>In the tank</div>
          <div style={{ fontSize: 36, marginTop: 6 }}>{eth.toFixed(4)} ETH</div>
        </div>
        <div>
          <div style={{ fontSize: 20, color: '#9c8a5f' }}>Rings at</div>
          <div style={{ fontSize: 36, marginTop: 6 }}>{STEP_ETH} ETH</div>
        </div>
        <div>
          <div style={{ fontSize: 20, color: '#9c8a5f' }}>Trades</div>
          <div style={{ fontSize: 36, marginTop: 6 }}>{done}</div>
        </div>
      </div>
    </SceneFade>
  )
}

// 6 · All of it buys $BETTA, straight to the dead address. The ticket gets stamped.
export function BuybackScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const print = easeOut((t - 0.3) / 1.1)
  const stamp = useIn(58, 9, 0.5)
  const shake = t > 58 / fps && t < 58 / fps + 0.15 ? Math.sin(t * 120) * 4 : 0
  const rows: [string, string, boolean?][] = [
    ['claimed', `${STEP_ETH.toFixed(4)} ETH`],
    ['bought', '1,284,000 $BETTA', true],
    ['sent to', '0x0000…dEaD'],
  ]
  return (
    <SceneFade dur={dur}>
      <BrassRoom />
      <div style={{ position: 'absolute', left: 120, top: 250, width: 860, color: C.brassText }}>
        <Rise at={2}>
          <Kicker size={24} color={C.brassDim}>
            Bell #7 · the buyback
          </Kicker>
        </Rise>
        <Rise at={6} style={{ marginTop: 20 }}>
          <Title size={112} color={C.brassText}>
            All of it <Turn>buys $BETTA.</Turn>
          </Title>
        </Rise>
        <Rise at={16} style={{ marginTop: 40 }}>
          <Body size={36} color="#cbbd98" style={{ maxWidth: 760 }}>
            100% of creator fees buy $BETTA and burn it: it goes straight to the dead address.
          </Body>
        </Rise>
      </div>

      {/* the printer slot and the ticket coming out of it */}
      <div style={{ position: 'absolute', left: 1080, top: 180, width: 720, height: 720, transform: `translateX(${shake}px)` }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 34, borderRadius: 10, background: 'linear-gradient(180deg, #0b0905, #2a2014)', boxShadow: '0 6px 18px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(242,193,78,0.25)', zIndex: 2 }} />
        <div style={{ position: 'absolute', left: 30, right: 30, top: 18, height: 640, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${(print - 1) * 640}px)` }}>
            <Ticket style={{ padding: '56px 56px 50px 66px', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.85)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#7a6d5a' }}>
                <b style={{ color: C.paperInk, fontSize: 32 }}>Bell #7</b>
                <span>20 Oct · 21:40</span>
              </div>
              <div style={{ marginTop: 34, display: 'grid', gap: 22 }}>
                {rows.map(([a, b, hot]) => (
                  <div key={a} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px dashed #d9ccb1', paddingBottom: 16 }}>
                    <span style={{ fontSize: 24, color: '#7a6d5a' }}>{a}</span>
                    <span style={{ fontSize: hot ? 40 : 32, fontWeight: hot ? 800 : 600 }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 34, height: 110 }}>
                <span style={{ fontSize: 20, color: '#7a6d5a', lineHeight: 1.5 }}>
                  claim · buy · burn
                  <br />
                  every tx on the site
                </span>
                {t > 58 / fps && (
                  <Stamp k={stamp} size={64} style={{ marginRight: 20 }}>
                    SUNK
                  </Stamp>
                )}
              </div>
            </Ticket>
          </div>
        </div>
      </div>
    </SceneFade>
  )
}
