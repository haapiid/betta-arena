import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { C, F } from '../lib/brand'
import { smooth } from '../lib/jarScene'
import { Backdrop, Body, Eyebrow, Rise, SceneFade, Title } from '../lib/ui'

const FIELD = [
  ['Blue Moon', '#2a46c4'], ['Red Dagger', '#c0162a'], ['Nemo', '#f07a22'], ['Ghost', '#e6ecf3'],
  ['Samurai', '#5a6070'], ['Ember', '#ff5a3c'], ['Jade', '#3fbf8a'], ['Violet', '#7d2bb8'],
  ['Koi Galaxy', '#d4232a'], ['Saphir', '#1f3ab8'], ['Mango', '#f2a33a'], ['Onyx', '#2a2f3a'],
  ['Platinum', '#cfd6df'], ['Tiger', '#e8621c'], ['Comet', '#74e8ff'], ['Ruby', '#a3182f'],
] as const
// index of the winner of each match, round by round (16 → 8 → 4 → 2 → 1)
const ROUNDS: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [0, 2, 5, 6, 8, 11, 12, 14],
  [0, 5, 8, 12],
  [0, 12],
  [0],
]

const PW = 168
const PH = 46
const BH = 560
const BW = 1700
const colX = (side: 0 | 1, r: number) => (side === 0 ? r * 200 : BW - PW - r * 200)

function Plate({ x, y, name, color, k, lost, gold }: { x: number; y: number; name: string; color: string; k: number; lost: boolean; gold?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y - PH / 2,
        width: PW,
        height: PH,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        background: gold ? 'rgba(242,193,78,0.16)' : 'rgba(10,36,48,0.95)',
        border: `1.5px solid ${gold ? C.gold : C.line}`,
        opacity: k * (lost ? 0.38 : 1),
        transform: `scale(${0.85 + 0.15 * k})`,
        fontFamily: F.body,
        fontWeight: 650,
        fontSize: 20,
        color: C.text,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 99, background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
      {name}
    </div>
  )
}

export function BracketScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  // round r becomes visible at reveal(r)
  const reveal = (r: number) => smooth((f - (14 + r * 13)) / 9)
  const lines: React.ReactNode[] = []
  const plates: React.ReactNode[] = []
  for (let r = 0; r < 4; r++) {
    const per = 8 >> r
    const rows = ROUNDS[r]
    for (let side = 0 as 0 | 1; side <= 1; side = (side + 1) as 0 | 1) {
      for (let i = 0; i < per; i++) {
        const idx = rows[side * per + i]
        const y = (BH / per) * (i + 0.5)
        const x = colX(side, r)
        const nextWin = ROUNDS[r + 1]?.includes(idx)
        const k = reveal(r)
        const decided = reveal(r + 1) > 0.5
        plates.push(<Plate key={`${r}-${side}-${i}`} x={x} y={y} name={FIELD[idx][0]} color={FIELD[idx][1]} k={k} lost={decided && !nextWin} gold={idx === 0 && r > 0} />)
        if (i % 2 === 0 && r < 3) {
          const y2 = (BH / per) * (i + 1.5)
          const xe = side === 0 ? x + PW : x
          const xm = side === 0 ? x + PW + 16 : x - 16
          const xn = side === 0 ? colX(0, r + 1) : colX(1, r + 1) + PW
          const ym = (y + y2) / 2
          const win = ROUNDS[r + 1][side * (per / 2) + i / 2] === 0
          lines.push(
            <path
              key={`l${r}-${side}-${i}`}
              d={`M${xe} ${y} H${xm} V${y2} H${xe} M${xm} ${ym} H${xn}`}
              fill="none"
              stroke={win && reveal(r + 1) > 0.5 ? C.gold : C.line}
              strokeWidth={win ? 2.5 : 2}
              opacity={reveal(r) * 0.9}
            />,
          )
        }
      }
    }
  }
  const fy = BH / 2
  const champ = smooth((f - 70) / 12)
  lines.push(<path key="final" d={`M${colX(0, 3) + PW} ${fy} H${BW / 2 - 70} M${colX(1, 3)} ${fy} H${BW / 2 + 70}`} stroke={champ > 0.5 ? C.gold : C.line} strokeWidth={2.5} opacity={reveal(3)} fill="none" />)

  const divs = [
    ['Rookie', 'Lv 1–10'],
    ['Pro', 'Lv 11–20'],
    ['Elite', 'Lv 21–30'],
  ]
  return (
    <SceneFade dur={dur}>
      <Backdrop tealX="50%" goldX="50%" />
      <AbsoluteFill style={{ padding: '80px 110px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <Rise at={2}>
              <Eyebrow color={C.gold}>06 · Tournaments</Eyebrow>
            </Rise>
            <Rise at={6}>
              <Title size={86} style={{ marginTop: 14 }}>
                A bracket of 16, every few days.
              </Title>
            </Rise>
          </div>
        </div>
        <Rise at={10} style={{ display: 'flex', gap: 16, marginTop: 30, alignItems: 'center' }}>
          {divs.map(([n, l], i) => (
            <div
              key={n}
              style={{
                padding: '12px 26px',
                borderRadius: 99,
                border: `1.5px solid ${i === 1 ? C.gold : C.line}`,
                background: i === 1 ? 'rgba(242,193,78,0.14)' : 'rgba(255,255,255,0.03)',
                fontFamily: F.body,
                fontWeight: 700,
                fontSize: 26,
                color: i === 1 ? C.gold : C.dim,
              }}
            >
              {n} <span style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 19, opacity: 0.8, marginLeft: 8 }}>{l}</span>
            </div>
          ))}
          <Body size={27} style={{ marginLeft: 22 }}>
            Single elimination · same entry fee for every fish in a division
          </Body>
        </Rise>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 110, top: 400, width: BW, height: BH }}>
        <svg width={BW} height={BH} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {lines}
        </svg>
        {plates}
        <div
          style={{
            position: 'absolute',
            left: BW / 2 - 150,
            width: 300,
            top: fy - 240,
            textAlign: 'center',
            opacity: champ,
            transform: `scale(${0.7 + 0.3 * champ})`,
          }}
        >
          <svg width={86} height={86} viewBox="0 0 64 64">
            <path d="M18 8h28v10c0 10-6 17-14 18-8-1-14-8-14-18z" fill={C.gold} />
            <path d="M18 12H8c0 9 5 14 12 15M46 12h10c0 9-5 14-12 15" stroke={C.gold} strokeWidth={4} fill="none" />
            <rect x={28} y={36} width={8} height={10} fill={C.gold} />
            <rect x={20} y={46} width={24} height={7} rx={2} fill={C.goldSoft} />
          </svg>
          <div style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: '0.2em', color: C.dim, marginTop: 6 }}>CHAMPION</div>
          <div style={{ fontFamily: F.display, fontSize: 40, fontWeight: 700, color: C.gold }}>Blue Moon</div>
        </div>
      </div>
    </SceneFade>
  )
}

const SPLIT = [
  { p: '1st', v: 60, c: C.gold },
  { p: '2nd', v: 25, c: '#cfd6df' },
  { p: '3rd', v: 7.5, c: '#c8823a' },
  { p: '4th', v: 7.5, c: '#9a6a3a' },
]

export function PrizeScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const BAR = 1640
  const burn = smooth((f - 18) / 14)
  const split = smooth((f - 38) / 22)
  const gapPx = 14 * split
  const rest = BAR * 0.95
  return (
    <SceneFade dur={dur}>
      <Backdrop tealX="50%" goldX="50%" />
      <AbsoluteFill style={{ padding: '96px 140px' }}>
        <Rise at={2}>
          <Eyebrow color={C.gold}>07 · Prizes</Eyebrow>
        </Rise>
        <Rise at={6}>
          <Title size={96} style={{ marginTop: 14 }}>
            The top four split the pot.
          </Title>
        </Rise>
        <Rise at={10}>
          <Body style={{ marginTop: 18 }}>Every entry fee goes into the division pot. 5% is burned, the rest is shared.</Body>
        </Rise>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 140, top: 620, width: BAR, height: 120 }}>
        {/* pot segments */}
        {(() => {
          let x = 0
          return SPLIT.map((s, i) => {
            const wFull = rest / 4
            const wSplit = (rest - gapPx * 3) * (s.v / 100)
            const width = (1 - split) * wFull + split * wSplit
            const left = x
            x += width + gapPx
            const col = split > 0.02 ? s.c : C.teal
            return (
              <div key={s.p} style={{ position: 'absolute', left, top: 0, width, height: 120 }}>
                <div
                  style={{
                    height: 120,
                    borderRadius: i === 0 && split < 0.1 ? '22px 0 0 22px' : 18,
                    background: split > 0.02 ? `linear-gradient(180deg, ${col}, ${col}bb)` : `linear-gradient(180deg, ${C.teal}cc, ${C.teal}88)`,
                    opacity: interpolate(f, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
                  }}
                />
                <div style={{ opacity: split, marginTop: 22, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div style={{ fontFamily: F.mono, fontSize: i < 2 ? 54 : 40, fontWeight: 800, color: s.c }}>{s.v}%</div>
                  <div style={{ fontFamily: F.body, fontSize: 26, color: C.dim, fontWeight: 650, marginTop: 2 }}>{s.p}</div>
                </div>
              </div>
            )
          })
        })()}
        {/* the 5% burn slice */}
        <div
          style={{
            position: 'absolute',
            left: rest + 12 * burn,
            top: -60 * burn,
            width: BAR * 0.05,
            height: 120,
            borderRadius: 18,
            background: burn > 0.05 ? `linear-gradient(180deg, ${C.coral}, #c0162a)` : `linear-gradient(180deg, ${C.teal}cc, ${C.teal}88)`,
            opacity: interpolate(f, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (1 - 0.35 * split),
            boxShadow: burn > 0.05 ? `0 0 ${40 * burn}px rgba(255,107,87,0.6)` : undefined,
          }}
        />
        <div style={{ position: 'absolute', left: rest - 150, width: 300 + BAR * 0.05, top: -140, textAlign: 'center', opacity: burn, fontFamily: F.mono, fontSize: 30, fontWeight: 700, color: C.coral }}>
          5% burned
        </div>
        <div style={{ position: 'absolute', left: 0, top: -54, opacity: 1 - split, fontFamily: F.mono, fontSize: 24, color: C.dim, letterSpacing: '0.16em' }}>DIVISION POT</div>
      </div>
    </SceneFade>
  )
}
