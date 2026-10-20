// The story behind the page: one scene per section of a keeper's journey, cross-fading as you scroll.
//   surface → the keeper's room at night → the betta market → fight night → the hall of fame → the sea floor
// Scenes are plain CSS and SVG, kept to the edges and low in contrast so the content stays readable.
// Only the scene on screen animates; with reduced motion nothing moves and scenes simply swap.

import { useEffect, useState } from 'react'

export type Scene = 'surface' | 'room' | 'market' | 'arena' | 'hall' | 'seafloor'

// which section tells which part of the story
export const HOME_STORY: [string, Scene][] = [
  ['top', 'surface'],
  ['jars', 'room'],
  ['shop', 'market'],
  ['arena', 'arena'],
  ['leaderboard', 'hall'],
  ['how', 'seafloor'],
]
// the community page: the keepers' room, the market square where people gather, the hall of fame
export const COMMUNITY_STORY: [string, Scene][] = [
  ['c-top', 'room'],
  ['c-channels', 'market'],
  ['c-keepers', 'hall'],
]

// stable pseudo-random numbers, so the scenes look the same on every visit
function rand(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}
const list = (n: number, seed: number) => {
  const r = rand(seed)
  return Array.from({ length: n }, (_, i) => ({ i, a: r(), b: r(), c: r(), d: r() }))
}

export function Backdrop({ story }: { story: [string, Scene][] }) {
  const [scene, setScene] = useState<Scene>(story[0][1])

  useEffect(() => {
    // the section crossing the middle of the screen sets the scene
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue
          const s = story.find(([id]) => id === e.target.id)?.[1]
          if (s) setScene(s)
        }
      },
      { rootMargin: '-48% 0px -48% 0px' },
    )
    for (const [id] of story) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [story])

  const on = (s: Scene) => `scene scene-${s}${scene === s ? ' on' : ''}`
  return (
    <div className="backdrop" aria-hidden="true">
      <Surface cls={on('surface')} />
      <Room cls={on('room')} />
      <Market cls={on('market')} />
      <FightNight cls={on('arena')} />
      <Hall cls={on('hall')} />
      <SeaFloor cls={on('seafloor')} />
    </div>
  )
}

// ---------- 1. the surface: sunlight through moving water, bubbles rising ----------
export function Surface({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className="surface-caustics" />
      <div className="surface-rays" />
      {list(14, 7).map((p) => (
        <span
          key={p.i}
          className="bubble"
          style={{ left: `${p.a < 0.5 ? p.a * 30 : 70 + p.a * 28}%`, width: 4 + p.b * 10, height: 4 + p.b * 10, animationDuration: `${9 + p.c * 10}s`, animationDelay: `${-p.d * 18}s` }}
        />
      ))}
    </div>
  )
}

// ---------- 2. the keeper's room at night: a desk lamp, a window, dust in the light ----------
export function Room({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className="room-lamp" />
      <svg className="room-window" viewBox="0 0 220 260" preserveAspectRatio="xMaxYMin meet">
        <defs>
          <radialGradient id="moon" cx="0.62" cy="0.3" r="0.5">
            <stop offset="0" stopColor="#dff3ff" stopOpacity="0.9" />
            <stop offset="0.18" stopColor="#bfe4ff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#0b2a3a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="10" y="10" width="200" height="240" rx="6" fill="#081d29" stroke="#1e3d4c" strokeWidth="6" />
        <rect x="13" y="13" width="194" height="234" rx="4" fill="url(#moon)" />
        <circle cx="136" cy="80" r="16" fill="#e8f6ff" opacity="0.75" />
        <path d="M110 13v234M13 130h194" stroke="#1e3d4c" strokeWidth="6" />
      </svg>
      <div className="room-shelf" />
      {list(18, 11).map((p) => (
        <span
          key={p.i}
          className="mote"
          style={{ left: `${4 + p.a * 34}%`, top: `${10 + p.b * 60}%`, animationDuration: `${12 + p.c * 14}s`, animationDelay: `${-p.d * 20}s` }}
        />
      ))}
    </div>
  )
}

// ---------- 3. the betta market: string lights over rows of fish in plastic bags ----------
const FISH = ['#c0162a', '#2a46c4', '#7d2bb8', '#f07a22', '#e6ecf3', '#1f3ab8', '#d4232a', '#5fe0d0']
export function Market({ cls }: { cls: string }) {
  const bulbs = 15
  return (
    <div className={cls}>
      <svg className="market-lights" viewBox="0 0 1000 120" preserveAspectRatio="none">
        <path d="M0 18 Q250 92 500 40 T1000 26" fill="none" stroke="#2c2018" strokeWidth="2" />
      </svg>
      <div className="market-bulbs">
        {Array.from({ length: bulbs }, (_, i) => {
          const x = i / (bulbs - 1)
          // follow the wire: two sagging spans
          const y = x < 0.5 ? 18 + Math.sin(x * 2 * Math.PI) * 30 + x * 44 : 40 + Math.sin((x - 0.5) * 2 * Math.PI) * 22 - (x - 0.5) * 28
          return <span key={i} className="bulb" style={{ left: `${x * 100}%`, top: `${y}%`, animationDelay: `${-(i * 0.37) % 3}s` }} />
        })}
      </div>
      {(['left', 'right'] as const).map((side) => (
        <div key={side} className={`market-bags ${side}`}>
          {list(9, side === 'left' ? 3 : 5).map((p) => (
            <svg key={p.i} className="bag" viewBox="0 0 60 90" style={{ animationDelay: `${-p.a * 6}s` }}>
              <path d="M30 4 l-6 10 h12 z" fill="#d8e9ef" opacity="0.5" />
              <path d="M14 18 Q30 12 46 18 L52 70 Q30 90 8 70 Z" fill="rgba(170,225,240,0.10)" stroke="rgba(210,240,250,0.35)" strokeWidth="1.2" />
              <path d="M10 48 Q30 44 50 48 L52 70 Q30 90 8 70 Z" fill="rgba(80,180,200,0.22)" />
              <g transform={`translate(${24 + p.b * 8} ${58 + p.c * 6}) scale(${p.d < 0.5 ? 1 : -1} 1)`}>
                <ellipse cx="0" cy="0" rx="6" ry="3" fill={FISH[p.i % FISH.length]} />
                <path d="M-5 0 L-13 -6 Q-10 0 -13 6 Z" fill={FISH[p.i % FISH.length]} opacity="0.85" />
              </g>
            </svg>
          ))}
        </div>
      ))}
    </div>
  )
}

// ---------- 4. fight night: two spotlights, the crowd, a gold glow on the ring ----------
export function FightNight({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className="spot spot-l" />
      <div className="spot spot-r" />
      <div className="ring-glow" />
      <svg className="crowd" viewBox="0 0 1200 140" preserveAspectRatio="none">
        <path
          d={
            'M0 140 L0 110 ' +
            list(40, 21)
              .map((p, i) => {
                // one head-and-shoulders bump per spectator
                const x = i * 30
                const top = 140 - (60 + p.a * 35)
                return `L${x} ${top + 24} Q${x + 15} ${top - 12} ${x + 30} ${top + 24}`
              })
              .join(' ') +
            ' L1200 140 Z'
          }
          fill="#020a10"
        />
        {list(12, 33).map((p) => (
          <circle key={p.i} className="flash" cx={p.a * 1200} cy={40 + p.b * 40} r="2.2" style={{ animationDelay: `${-p.c * 7}s` }} />
        ))}
      </svg>
    </div>
  )
}

// ---------- 5. the hall of fame: gold light and slow glints ----------
export function Hall({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className="hall-beams" />
      {list(22, 41).map((p) => (
        <span
          key={p.i}
          className="glint"
          style={{ left: `${p.a < 0.5 ? 3 + p.a * 40 : 57 + (p.a - 0.5) * 80}%`, top: `${8 + p.b * 80}%`, animationDuration: `${3 + p.c * 4}s`, animationDelay: `${-p.d * 6}s` }}
        />
      ))}
    </div>
  )
}

// ---------- 6. the sea floor: sand, swaying plants, marine snow ----------
export function SeaFloor({ cls }: { cls: string }) {
  return (
    <div className={cls}>
      <div className="floor-light" />
      <svg className="floor" viewBox="0 0 1200 260" preserveAspectRatio="none">
        <path d="M0 210 Q300 190 600 205 T1200 200 V260 H0 Z" fill="#0c2a33" />
        {list(26, 51).map((p) => {
          const x = p.a < 0.5 ? p.a * 400 : 800 + (p.a - 0.5) * 800
          const h = 90 + p.b * 140
          return (
            <path
              key={p.i}
              className="blade"
              d={`M${x} 214 Q${x - 8 + p.c * 16} ${214 - h / 2} ${x + (p.d - 0.5) * 30} ${214 - h} Q${x + 4} ${214 - h / 2} ${x + 5} 214 Z`}
              fill={p.c < 0.5 ? '#123f2c' : '#0f3326'}
              style={{ animationDelay: `${-p.d * 6}s`, transformOrigin: `${x}px 214px` }}
            />
          )
        })}
      </svg>
      {list(30, 61).map((p) => (
        <span key={p.i} className="snow" style={{ left: `${p.a * 100}%`, animationDuration: `${14 + p.b * 16}s`, animationDelay: `${-p.c * 30}s`, opacity: 0.25 + p.d * 0.4 }} />
      ))}
    </div>
  )
}
