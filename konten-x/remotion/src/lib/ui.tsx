import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F } from './brand'

export const ink = (style?: React.CSSProperties): React.CSSProperties => ({ background: C.ink, ...style })

// fade a whole scene in and out (scenes dip through the ink background)
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

export function Eyebrow({ children, color = C.teal, size = 22 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <div style={{ fontFamily: F.mono, fontSize: size, letterSpacing: '0.22em', color, fontWeight: 600, textTransform: 'uppercase' }}>{children}</div>
}

export function Title({ children, size = 92, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: F.display, fontSize: size, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.02, color: '#f6ecd6', fontVariationSettings: "'opsz' 144, 'SOFT' 30", ...style }}>
      {children}
    </div>
  )
}

export function Body({ children, size = 34, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: F.body, fontSize: size, lineHeight: 1.35, color: C.dim, fontWeight: 450, ...style }}>{children}</div>
}

export function Chip({ children, color = C.teal, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        borderRadius: 999,
        border: `1.5px solid ${color}66`,
        background: `${color}14`,
        color,
        fontFamily: F.body,
        fontWeight: 650,
        fontSize: 26,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Meter({ label, value, color, width = 560, right }: { label: string; value: number; color: string; width?: number; right?: string }) {
  return (
    <div style={{ width }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 20, color: C.dim, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        <span>{label}</span>
        <span style={{ color: C.text, letterSpacing: 0 }}>{right ?? `${Math.round(value)}%`}</span>
      </div>
      <div style={{ height: 14, borderRadius: 99, background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.lineSoft}`, overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${color}aa, ${color})`, boxShadow: `0 0 18px ${color}66` }} />
      </div>
    </div>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${C.panel}, ${C.deep})`,
        border: `1.5px solid ${C.lineSoft}`,
        borderRadius: 24,
        boxShadow: '0 30px 60px -30px rgba(0,0,0,0.8)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// soft ink backdrop with teal + gold glows, shared by most scenes
export function Backdrop({ tealX = '30%', goldX = '80%' }: { tealX?: string; goldX?: string }) {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 700px at ${tealX} 50%, rgba(95,224,208,0.13), transparent 70%), radial-gradient(800px 600px at ${goldX} 20%, rgba(242,193,78,0.08), transparent 70%), linear-gradient(180deg, ${C.deep}, ${C.ink})`,
      }}
    />
  )
}

export function Brandmark({ size = 26 }: { size?: number }) {
  return (
    <div style={{ fontFamily: F.display, fontSize: size, fontWeight: 700, color: '#f6ecd6', letterSpacing: '-0.01em' }}>
      Betta <span style={{ color: C.gold }}>Arena</span>
    </div>
  )
}
