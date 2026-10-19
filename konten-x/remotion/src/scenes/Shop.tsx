import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G, type Genome } from '../game/species'
import { bettaExtent } from '../render/betta'
import { placeFish } from '../lib/jarScene'
import { Backdrop, Body, Eyebrow, Rise, SceneFade, Title, useIn } from '../lib/ui'

const RARITY: Record<string, string> = { Common: '#9fb3bf', Uncommon: '#5fd39a', Rare: '#5fb6ff', Epic: '#c38bff', Legendary: '#ffc35a' }

const CARDS: { name: string; latin: string; rarity: string; g: Genome; atk: number; def: number; bea: number }[] = [
  { name: 'Crowntail', latin: 'Betta splendens · CT', rarity: 'Common', g: G.crowntail, atk: 46, def: 38, bea: 63 },
  { name: 'Halfmoon', latin: 'Betta splendens · HM', rarity: 'Uncommon', g: G.halfmoon, atk: 40, def: 42, bea: 72 },
  { name: 'Koi Galaxy', latin: 'Betta splendens · PK Koi', rarity: 'Rare', g: G.koi, atk: 57, def: 52, bea: 80 },
  { name: 'Black Samurai', latin: 'Betta splendens · HMPK', rarity: 'Epic', g: G.samurai, atk: 66, def: 74, bea: 70 },
  { name: 'Platinum Halfmoon', latin: 'Betta splendens · HM Platinum', rarity: 'Legendary', g: G.platinum, atk: 55, def: 60, bea: 94 },
]
export const PICK = 1

export function Portrait({ g, w, h, flare = 0.3, phase = 0 }: { g: Genome; w: number; h: number; flare?: number; phase?: number }) {
  return (
    <Canvas
      width={w}
      height={h}
      draw={(ctx, cw, ch, t) => {
        t += phase
        const bg = ctx.createRadialGradient(cw * 0.55, ch * 0.35, 10, cw / 2, ch / 2, Math.max(cw, ch) * 0.75)
        bg.addColorStop(0, '#1d5c6c')
        bg.addColorStop(1, '#061a22')
        ctx.fillStyle = bg
        ctx.fillRect(0, 0, cw, ch)
        const e = bettaExtent(g)
        const s = (Math.min(cw / (e.right - e.left), ch / (e.bottom - e.top)) * 0.84) / g.size
        const cx = cw / 2 - ((e.left + e.right) / 2) * s * g.size
        const cy = ch / 2 - ((e.top + e.bottom) / 2) * s * g.size * 0.5
        placeFish(ctx, g, cx, cy + Math.sin(t * 1.2) * 3, s, 1, Math.sin(t * 0.9) * 0.03, { t, flare: flare + 0.3 * Math.max(0, Math.sin(t * 0.9)), swim: 0.15, health: 100 })
      }}
    />
  )
}

function StatBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: F.mono, fontSize: 17, color: C.dim }}>
      <span style={{ width: 40 }}>{label}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 9, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ width: `${v}%`, height: '100%', borderRadius: 9, background: color }} />
      </div>
      <span style={{ width: 28, textAlign: 'right', color: C.text }}>{v}</span>
    </div>
  )
}

export function ShopScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const pick = interpolate(f, [70, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const pop = useIn(76, 9, 0.6)
  return (
    <SceneFade dur={dur}>
      <Backdrop tealX="40%" />
      <AbsoluteFill style={{ padding: '96px 120px' }}>
        <Rise at={4}>
          <Eyebrow>01 · Adopt</Eyebrow>
        </Rise>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
          <Rise at={8}>
            <Title size={104}>Buy a betta.</Title>
          </Rise>
          <Rise at={14}>
            <Body size={32} style={{ width: 760, textAlign: 'right' }}>
              Ten breeds and their hybrids — from pet-shop Crowntails to the Legendary Platinum Halfmoon.
            </Body>
          </Rise>
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 88, top: 372, display: 'flex', gap: 36 }}>
        {CARDS.map((c, i) => {
          const isPick = i === PICK
          return (
            <Rise key={c.name} at={16 + i * 5} dy={60}>
              <div
                style={{
                  width: 320,
                  borderRadius: 24,
                  overflow: 'hidden',
                  background: `linear-gradient(180deg, ${C.panel}, ${C.deep})`,
                  border: `2px solid ${isPick ? `rgba(242,193,78,${0.25 + 0.75 * pick})` : C.lineSoft}`,
                  boxShadow: isPick ? `0 0 ${60 * pick}px rgba(242,193,78,${0.35 * pick}), 0 40px 60px -30px rgba(0,0,0,0.8)` : '0 30px 60px -30px rgba(0,0,0,0.8)',
                  transform: `scale(${isPick ? 1 + 0.06 * pick : 1 - 0.03 * pick}) translateY(${isPick ? -14 * pick : 0}px)`,
                  opacity: isPick ? 1 : 1 - 0.45 * pick,
                }}
              >
                <Portrait g={c.g} w={320} h={230} phase={i * 1.7} flare={isPick ? 0.3 + 0.6 * pick : 0.3} />
                <div style={{ padding: '18px 22px 22px' }}>
                  <div style={{ fontFamily: F.display, fontSize: c.name.length > 14 ? 26 : 32, lineHeight: '40px', fontWeight: 650, color: '#f6ecd6', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 15, color: C.faint, marginTop: 4 }}>{c.latin}</div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 14,
                      padding: '5px 14px',
                      borderRadius: 99,
                      fontFamily: F.body,
                      fontWeight: 700,
                      fontSize: 17,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: RARITY[c.rarity],
                      background: `${RARITY[c.rarity]}1c`,
                      border: `1px solid ${RARITY[c.rarity]}55`,
                    }}
                  >
                    {c.rarity}
                  </div>
                  <div style={{ display: 'grid', gap: 9, marginTop: 18 }}>
                    <StatBar label="ATK" v={c.atk} color={C.coral} />
                    <StatBar label="DEF" v={c.def} color={C.teal} />
                    <StatBar label="BEA" v={c.bea} color={C.gold} />
                  </div>
                  <div
                    style={{
                      marginTop: 20,
                      height: 50,
                      borderRadius: 99,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: F.body,
                      fontWeight: 700,
                      fontSize: 21,
                      color: isPick && pick > 0.5 ? C.ink : C.text,
                      background: isPick && pick > 0.5 ? C.gold : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isPick && pick > 0.5 ? C.gold : C.line}`,
                      transform: isPick ? `scale(${1 + 0.08 * Math.sin(Math.PI * Math.min(1, pop))})` : undefined,
                    }}
                  >
                    {isPick && pick > 0.5 ? 'Adopted ✓' : 'Adopt'}
                  </div>
                </div>
              </div>
            </Rise>
          )
        })}
      </div>
    </SceneFade>
  )
}
