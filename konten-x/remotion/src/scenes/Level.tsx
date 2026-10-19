import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { bettaExtent } from '../render/betta'
import { clamp, placeFish, prand, smooth } from '../lib/jarScene'
import { Backdrop, Body, Eyebrow, Rise, SceneFade, Title, useIn } from '../lib/ui'

const TRAITS = [
  { name: 'Thick Scales', note: 'Takes 10% less damage' },
  { name: 'Quick Flare', note: '+5% dodge, strikes first' },
  { name: 'Heavy Jaw', note: 'Deals 8% more damage' },
]
const CHOSEN = 1

function Stat({ label, from, to, k, color }: { label: string; from: number; to: number; k: number; color: string }) {
  const v = from + (to - from) * k
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 22, color: C.dim, letterSpacing: '0.1em', marginBottom: 10 }}>
        <span>{label}</span>
        <span style={{ color: C.text, letterSpacing: 0 }}>
          {Math.round(v)} <span style={{ color, opacity: k > 0.05 ? 1 : 0 }}>+{Math.round(v - from)}</span>
        </span>
      </div>
      <div style={{ height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${v}%`, borderRadius: 99, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 16px ${color}77` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${from}%`, borderRadius: 99, background: `${color}88` }} />
      </div>
    </div>
  )
}

export function LevelScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const up = interpolate(f, [26, 56], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const lvlPop = useIn(40, 8, 0.5)
  const pick = smooth((f - 92) / 10)
  return (
    <SceneFade dur={dur}>
      <Backdrop tealX="25%" goldX="25%" />
      <div style={{ position: 'absolute', left: 80, top: 110 }}>
        <Canvas
          width={860}
          height={860}
          draw={(ctx, w, h, t) => {
            const cx = w / 2
            const cy = h / 2
            const R = w * 0.43
            // level ring
            ctx.lineCap = 'round'
            ctx.strokeStyle = 'rgba(255,255,255,0.07)'
            ctx.lineWidth = 16
            ctx.beginPath()
            ctx.arc(cx, cy, R, 0, Math.PI * 2)
            ctx.stroke()
            const prog = up < 0.5 ? 0.62 + 0.38 * smooth(up * 2) : 0.08 * smooth((up - 0.5) * 2)
            const ring = ctx.createLinearGradient(0, 0, w, h)
            ring.addColorStop(0, '#ffe3a1')
            ring.addColorStop(1, '#f2c14e')
            ctx.strokeStyle = ring
            ctx.beginPath()
            ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, prog))
            ctx.stroke()
            // glow burst at level up
            const burst = clamp(1 - Math.abs(up - 0.5) * 3)
            const gl = ctx.createRadialGradient(cx, cy, 10, cx, cy, R)
            gl.addColorStop(0, `rgba(242,193,78,${0.08 + 0.25 * burst})`)
            gl.addColorStop(1, 'rgba(242,193,78,0)')
            ctx.fillStyle = gl
            ctx.fillRect(0, 0, w, h)
            const g = G.halfmoon
            const e = bettaExtent(g)
            const s = (w * 0.66) / (e.right - e.left)
            placeFish(ctx, g, cx - ((e.left + e.right) / 2) * s, cy + Math.sin(t * 1.2) * 6, s, 1, -0.03, { t, flare: 0.5 + 0.5 * burst + 0.2 * Math.max(0, Math.sin(t * 2)), swim: 0.2, health: 100 })
            // sparkles
            for (let i = 0; i < 26; i++) {
              const a0 = (f - 30 - prand(i, 1) * 30) / 30
              if (a0 < 0 || a0 > 1) continue
              const ang = prand(i, 2) * Math.PI * 2
              const r = R * (0.45 + 0.6 * a0)
              const x = cx + Math.cos(ang) * r
              const y = cy + Math.sin(ang) * r
              const sz = (4 + prand(i, 3) * 6) * (1 - a0)
              ctx.fillStyle = `rgba(255,211,106,${1 - a0})`
              ctx.beginPath()
              ctx.moveTo(x, y - sz * 2)
              ctx.lineTo(x + sz * 0.5, y)
              ctx.lineTo(x, y + sz * 2)
              ctx.lineTo(x - sz * 0.5, y)
              ctx.closePath()
              ctx.moveTo(x - sz * 2, y)
              ctx.lineTo(x, y + sz * 0.5)
              ctx.lineTo(x + sz * 2, y)
              ctx.lineTo(x, y - sz * 0.5)
              ctx.fill()
            }
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: -6,
            transform: `translateX(-50%) scale(${1 + 0.25 * Math.sin(Math.PI * clamp(lvlPop))})`,
            padding: '10px 30px',
            borderRadius: 99,
            background: C.gold,
            color: C.ink,
            fontFamily: F.mono,
            fontWeight: 800,
            fontSize: 34,
          }}
        >
          LV {up > 0.5 ? 10 : 9}
        </div>
      </div>
      <AbsoluteFill style={{ left: 1040, top: 120, width: 800 }}>
        <Rise at={4}>
          <Eyebrow color={C.gold}>04 · Grow</Eyebrow>
        </Rise>
        <Rise at={8}>
          <Title size={96} style={{ marginTop: 16 }}>
            Level it up.
          </Title>
        </Rise>
        <Rise at={12}>
          <Body style={{ marginTop: 20, width: 760 }}>Care and training earn XP. Every level grows its stats — and every five levels it learns a trait.</Body>
        </Rise>
        <Rise at={18} style={{ display: 'grid', gap: 26, marginTop: 42, width: 720 }}>
          <Stat label="ATTACK" from={46} to={52} k={up} color={C.coral} />
          <Stat label="DEFENSE" from={48} to={51} k={up} color={C.teal} />
          <Stat label="BEAUTY" from={77} to={84} k={up} color={C.gold} />
        </Rise>
        <div style={{ display: 'flex', gap: 16, marginTop: 46 }}>
          {TRAITS.map((tr, i) => {
            const chosen = i === CHOSEN
            return (
              <Rise key={tr.name} at={62 + i * 5}>
                <div
                  style={{
                    width: 232,
                    padding: '18px 20px',
                    borderRadius: 18,
                    background: chosen ? `rgba(242,193,78,${0.06 + 0.1 * pick})` : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${chosen ? `rgba(242,193,78,${0.3 + 0.7 * pick})` : C.lineSoft}`,
                    opacity: chosen ? 1 : 1 - 0.5 * pick,
                    transform: `scale(${chosen ? 1 + 0.05 * pick : 1})`,
                  }}
                >
                  <div style={{ fontFamily: F.mono, fontSize: 15, letterSpacing: '0.16em', color: chosen && pick > 0.5 ? C.gold : C.faint }}>{chosen && pick > 0.5 ? 'TRAIT LEARNED' : 'NEW TRAIT'}</div>
                  <div style={{ fontFamily: F.display, fontSize: 30, fontWeight: 650, color: '#f6ecd6', marginTop: 6 }}>{tr.name}</div>
                  <div style={{ fontFamily: F.body, fontSize: 19, color: C.dim, marginTop: 6 }}>{tr.note}</div>
                </div>
              </Rise>
            )
          })}
        </div>
      </AbsoluteFill>
    </SceneFade>
  )
}
