// Ringside: the night around the ring. Spotlights, a crowd in silhouette, camera flashes, and the
// framed ring stage with its fighters' name plates and HP bars (like the site's Ringside).

import { AbsoluteFill } from 'remotion'
import { C, F } from './brand'
import { Canvas } from './Canvas'
import { boutHp, drawBout, dropK, type Bout, type Fighter } from './ring'
import { clamp, prand } from './jarScene'

export function FightNight({ t, crowd = 0.16, spot = 1, focusX = '50%', focusY = '30%' }: { t: number; crowd?: number; spot?: number; focusX?: string; focusY?: string }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 62% at ${focusX} ${focusY}, #0b2230 0%, ${C.night} 70%)`, overflow: 'hidden' }}>
      <Spot side="l" t={t} k={spot} />
      <Spot side="r" t={t} k={spot} />
      <Crowd t={t} h={crowd} />
    </AbsoluteFill>
  )
}

function Spot({ side, t, k }: { side: 'l' | 'r'; t: number; k: number }) {
  const sway = Math.sin((t * Math.PI * 2) / 6 + (side === 'l' ? 0 : 2)) * 2.2
  const rot = (side === 'l' ? -24 : 24) + sway
  return (
    <div
      style={{
        position: 'absolute',
        top: '-12%',
        left: side === 'l' ? '22%' : '78%',
        width: '34%',
        height: '130%',
        transformOrigin: '50% 0%',
        transform: `translateX(-50%) rotate(${rot}deg)`,
        background: 'linear-gradient(180deg, rgba(255,236,200,0.20), rgba(255,236,200,0.05) 58%, rgba(255,236,200,0) 85%)',
        clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)',
        filter: 'blur(14px)',
        opacity: k,
        mixBlendMode: 'screen',
      }}
    />
  )
}

/** a row of heads and shoulders along the bottom, with camera flashes */
export function Crowd({ t, h = 0.16 }: { t: number; h?: number }) {
  if (h <= 0) return null
  const n = 44
  let d = 'M0 140 L0 110 '
  for (let i = 0; i < n; i++) {
    const x = (i * 1200) / n
    const wd = 1200 / n
    const top = 140 - (60 + prand(i, 21) * 35)
    d += `L${x.toFixed(1)} ${top + 24} Q${(x + wd / 2).toFixed(1)} ${top - 12} ${(x + wd).toFixed(1)} ${top + 24} `
  }
  d += 'L1200 140 Z'
  return (
    <svg viewBox="0 0 1200 140" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: `${h * 100}%` }}>
      <path d={d} fill="#020a10" />
      {Array.from({ length: 12 }, (_, i) => {
        // each flash pops once every 3 s (a period that divides 6 s)
        const ph = (((t + prand(i, 33) * 3) % 3) + 3) % 3
        const a = ph < 0.12 ? 1 - ph / 0.12 : 0
        return a > 0 ? <circle key={i} cx={prand(i, 34) * 1200} cy={40 + prand(i, 35) * 40} r={2.4 + 3 * a} fill={`rgba(255,250,235,${a})`} /> : null
      })}
    </svg>
  )
}

export function Plate({ f, side, hp, sub, size = 1, show = 1 }: { f: Fighter; side: 'l' | 'r'; hp: number; sub: string; size?: number; show?: number }) {
  const r = side === 'r'
  return (
    <div style={{ textAlign: r ? 'right' : 'left', opacity: show, transform: `translateY(${(1 - show) * -12}px)` }}>
      <div style={{ display: 'flex', justifyContent: r ? 'flex-end' : 'flex-start', alignItems: 'baseline', gap: 12 * size, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: F.display, fontSize: 40 * size, fontWeight: 600, color: C.cream }}>{f.name}</span>
        <span style={{ fontFamily: F.mono, fontSize: 22 * size, color: C.dim }}>Lv {f.lv}</span>
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 17 * size, color: '#7d9aa5', marginTop: 4 * size, whiteSpace: 'nowrap' }}>{sub}</div>
      <div style={{ marginTop: 10 * size, height: 10 * size, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', justifyContent: r ? 'flex-end' : 'flex-start' }}>
        <div style={{ width: `${clamp(hp / 100) * 100}%`, height: '100%', borderRadius: 99, background: hp > 30 ? C.good : C.red }} />
      </div>
    </div>
  )
}

/** The framed ring (site's .ring-stage) with the bout drawn inside. */
export function RingStage({ width, height, unit, bout, T, tau, radius = 28 }: { width: number; height: number; unit: number; bout: Bout; T: number; tau: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: 'hidden',
        background: '#071820',
        boxShadow: '0 0 0 1.5px rgba(200,240,250,0.18), 0 40px 90px -30px rgba(0,0,0,0.9), 0 0 140px -30px rgba(255,65,80,0.45)',
      }}
    >
      <Canvas width={width} height={height} unit={unit} draw={(ctx, w, h) => drawBout(ctx, w, h, T, tau, bout)} />
    </div>
  )
}

/** Both plates above the ring; the challenger's appears when it drops in. */
export function Plates({ bout, tau, subA, subB, size = 1 }: { bout: Bout; tau: number; subA: string; subB: string; size?: number }) {
  const hp = boutHp(bout, tau)
  const showA = dropK(bout, tau) > 0 ? clamp((tau - bout.drop + 0.3) / 0.4) : 0
  const fadeA = bout.exit !== undefined && hp[0] <= 0 ? 1 - clamp((tau - bout.exit) / 0.6) : 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 * size }}>
      <Plate f={bout.a} side="l" hp={hp[0]} sub={subA} size={size} show={showA * fadeA} />
      <Plate f={bout.b} side="r" hp={hp[1]} sub={subB} size={size} />
    </div>
  )
}
