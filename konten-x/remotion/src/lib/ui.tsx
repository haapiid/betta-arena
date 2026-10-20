import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F } from './brand'

// fade a whole scene in and out (scenes dip through the night)
export function SceneFade({ children, dur, fadeIn = 10, fadeOut = 10 }: { children: React.ReactNode; dur: number; fadeIn?: number; fadeOut?: number }) {
  const f = useCurrentFrame()
  const o = Math.min(
    fadeIn ? interpolate(f, [0, fadeIn], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1,
    fadeOut ? interpolate(f, [dur - fadeOut, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1,
  )
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

// spring-in helper: 0..1 starting at `at` frames
export function useIn(at: number, damping = 16, mass = 0.7) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: f - at, fps, config: { damping, mass } })
}

export function Rise({ at = 0, children, dy = 26, style }: { at?: number; children: React.ReactNode; dy?: number; style?: React.CSSProperties }) {
  const k = useIn(at)
  return <div style={{ opacity: Math.min(1, k * 1.3), transform: `translateY(${(1 - k) * dy}px)`, ...style }}>{children}</div>
}

/** The site's mono kicker above every headline. */
export function Kicker({ children, color = C.dim, size = 22 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <div style={{ fontFamily: F.mono, fontSize: size, letterSpacing: '0.04em', color, fontWeight: 500 }}>{children}</div>
}

/** Fraunces headline; wrap the turn of the line in <Turn> for the italic betta red. */
export function Title({ children, size = 92, color = C.cream, style }: { children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: F.display, fontSize: size, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 0.98, color, fontVariationSettings: "'opsz' 144, 'SOFT' 30", ...style }}>
      {children}
    </div>
  )
}

export function Turn({ children, color = C.red }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontStyle: 'italic', color, fontWeight: 600 }}>{children}</span>
}

export function Body({ children, size = 34, color = C.dim, style }: { children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: F.body, fontSize: size, lineHeight: 1.35, color, fontWeight: 450, ...style }}>{children}</div>
}

export function Brandmark({ size = 26, color = C.cream }: { size?: number; color?: string }) {
  return (
    <div style={{ fontFamily: F.display, fontSize: size, fontWeight: 650, color, letterSpacing: '-0.01em' }}>
      Betta <span style={{ color: C.gold }}>Arena</span>
    </div>
  )
}

/** "$BETTA · Coming soon on Pons · Robinhood Chain" */
export function LaunchPill({ size = 30, glow = 0 }: { size?: number; glow?: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.45,
        padding: `${size * 0.42}px ${size * 0.95}px`,
        borderRadius: 999,
        border: `2px solid rgba(242,193,78,0.6)`,
        background: 'rgba(4,11,17,0.82)',
        fontFamily: F.mono,
        fontSize: size,
        color: C.text,
        whiteSpace: 'nowrap',
        boxShadow: glow ? `0 0 ${glow}px rgba(242,193,78,0.22)` : undefined,
      }}
    >
      <span style={{ color: C.gold, fontWeight: 700 }}>$BETTA</span>
      <span style={{ color: C.faint }}>·</span>
      <span>Coming soon on Pons</span>
      <span style={{ color: C.faint }}>·</span>
      <span>Robinhood Chain</span>
    </div>
  )
}

/** The gold belt badge from the site (.belt) */
export function BeltBadge({ children, size = 26, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.4,
        padding: `${size * 0.32}px ${size * 0.8}px`,
        borderRadius: 999,
        background: 'linear-gradient(135deg, #f7d77c, #c8932a 58%, #f2c14e)',
        color: '#241707',
        fontFamily: F.body,
        fontWeight: 800,
        fontSize: size,
        whiteSpace: 'nowrap',
        boxShadow: '0 14px 40px -10px rgba(0,0,0,0.8), 0 0 40px rgba(242,193,78,0.25)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** A printed ticket with punched edges (the bell's buyback tickets, the buy slip). */
export function Ticket({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const mask = 'radial-gradient(circle 9px at 9px 50%, transparent 98%, #000) -9px 0 / 100% 30px repeat-y'
  return (
    <div
      style={{
        background: C.ticket,
        color: C.paperInk,
        fontFamily: F.mono,
        borderRadius: 6,
        WebkitMask: mask,
        mask,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Stamp({ children, k = 1, size = 40, style }: { children: React.ReactNode; k?: number; size?: number; style?: React.CSSProperties }) {
  // slams in: big and faint → its size, tilted
  const s = 1 + (1 - k) * 1.6
  return (
    <div
      style={{
        display: 'inline-block',
        border: `${Math.max(3, size * 0.09)}px solid ${C.red}`,
        color: C.red,
        borderRadius: size * 0.18,
        padding: `${size * 0.08}px ${size * 0.32}px`,
        fontFamily: F.mono,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '0.06em',
        transform: `rotate(-8deg) scale(${s})`,
        opacity: Math.min(1, k * 1.6),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
