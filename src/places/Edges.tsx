// The edges between places. Each sits on top of a place, in that place's ground colour, and rises
// into the place above it: the stall's awning over ringside, a row of jars over the stall, the bell
// over the shelf, the water's surface over the bell, a torn ticket over the deep, weed over your jar.

const W = 1440
const rnd = (k: number) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** The stall's striped awning, scalloped, with a string of lights. */
export function AwningEdge() {
  const n = 24
  const w = W / n
  // right to left along the bottom: one scallop per stripe
  const scallops = Array.from({ length: n }, (_, i) => `Q${W - i * w - w / 2} 118 ${W - (i + 1) * w} 90`).join(' ')
  return (
    <svg className="edge" viewBox={`0 0 ${W} 120`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="stripes" width={w * 2} height="120" patternUnits="userSpaceOnUse">
          <rect width={w} height="120" fill="#ff4150" />
          <rect x={w} width={w} height="120" fill="#f3e7cf" />
        </pattern>
      </defs>
      <path d={`M0 30 L${W} 30 L${W} 90 ${scallops} Z`} fill="url(#stripes)" />
      <path d={`M0 30 L${W} 30`} stroke="#170405" strokeWidth="6" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={40 + i * 80} cy={14 + Math.sin(i * 0.9) * 6} r="5" fill="#ffd98a" className="edge-bulb" style={{ animationDelay: `${-i * 0.4}s` }} />
      ))}
      <rect y="112" width={W} height="8" fill="var(--stall)" />
    </svg>
  )
}

/** A row of glass jars: the keepers' shelf. */
export function JarRowEdge() {
  const jars = Array.from({ length: 16 }, (_, i) => {
    const x = 20 + i * 90 + rnd(i) * 10
    const w = 54 + rnd(i + 30) * 14
    const h = 54 + rnd(i + 60) * 26
    return { x, w, h }
  })
  return (
    <svg className="edge" viewBox={`0 0 ${W} 120`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ color: 'var(--shelf)' }}>
      {jars.map((j, i) => (
        <path
          key={i}
          fill="currentColor"
          d={`M${j.x} 120 V${120 - j.h + 14} Q${j.x} ${120 - j.h} ${j.x + 12} ${120 - j.h} H${j.x + j.w - 12} Q${j.x + j.w} ${120 - j.h} ${j.x + j.w} ${120 - j.h + 14} V120 Z
             M${j.x + 10} ${120 - j.h - 2} h${j.w - 20} v6 h-${j.w - 20} Z`}
        />
      ))}
      <rect y="110" width={W} height="10" fill="currentColor" />
    </svg>
  )
}

/** The bell that rings each buyback, hanging from its bracket. */
export function BellEdge() {
  return (
    <svg className="edge" viewBox={`0 0 ${W} 140`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ color: 'var(--brass)', height: 'clamp(60px, 9vw, 140px)' }}>
      <path fill="currentColor" d={`M0 140 V112 H560 C600 112 610 96 640 96 H800 C830 96 840 112 880 112 H${W} V140 Z`} />
      <g transform="translate(720 18)">
        <rect x="-60" y="-18" width="120" height="8" rx="3" fill="#8a6a2a" />
        <rect x="-3" y="-12" width="6" height="16" fill="#8a6a2a" />
        <path d="M-34 70 C-34 30 -24 8 0 8 C24 8 34 30 34 70 L42 80 H-42 Z" fill="url(#brass)" stroke="#4a3510" strokeWidth="2" />
        <circle cx="0" cy="86" r="7" fill="#c8932a" />
        <defs>
          <linearGradient id="brass" x1="0" x2="1">
            <stop offset="0" stopColor="#8a6320" />
            <stop offset="0.45" stopColor="#f2c14e" />
            <stop offset="1" stopColor="#7a5418" />
          </linearGradient>
        </defs>
      </g>
    </svg>
  )
}

/** The water's surface: under it is the deep. */
export function SurfaceEdge() {
  const d = Array.from({ length: 13 }, (_, i) => `Q${i * 120 + 60} ${i % 2 ? 70 : 96} ${(i + 1) * 120} 84`).join(' ')
  return (
    <svg className="edge" viewBox={`0 0 ${W} 120`} preserveAspectRatio="none" aria-hidden="true" style={{ color: '#03141c' }}>
      <path fill="rgba(124,198,207,0.35)" d={`M0 78 ${d} V120 H0 Z`} transform="translate(0 -8)" />
      <path fill="currentColor" d={`M0 84 ${d} V120 H0 Z`} />
    </svg>
  )
}

/** A torn edge of ticket paper: your jar. */
export function TornEdge() {
  const pts = Array.from({ length: 73 }, (_, i) => `${i * 20},${92 + rnd(i + 7) * 22}`).join(' L')
  return (
    <svg className="edge" viewBox={`0 0 ${W} 120`} preserveAspectRatio="none" aria-hidden="true" style={{ color: 'var(--paper)' }}>
      <path fill="currentColor" d={`M0 120 L${pts} L${W} 120 Z`} />
    </svg>
  )
}

/** Weed swaying at closing time. */
export function WeedEdge() {
  return (
    <svg className="edge" viewBox={`0 0 ${W} 120`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" style={{ color: 'var(--night)' }}>
      {Array.from({ length: 70 }, (_, i) => {
        const x = i * 21 + rnd(i) * 10
        const h = 30 + rnd(i + 99) * 80
        return <path key={i} fill="currentColor" d={`M${x} 120 Q${x - 8 + rnd(i + 3) * 16} ${120 - h / 2} ${x + (rnd(i + 5) - 0.5) * 26} ${120 - h} Q${x + 5} ${120 - h / 2} ${x + 7} 120 Z`} />
      })}
      <rect y="112" width={W} height="8" fill="currentColor" />
    </svg>
  )
}
