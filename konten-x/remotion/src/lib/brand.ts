import { staticFile } from 'remotion'
import { loadFont } from '@remotion/fonts'

// A night at the betta fights (matches src/places/places.css): betta red is the one loud colour,
// gold is the belt, each place has its own ground.
export const C = {
  ink: '#03111a',
  night: '#040b11',
  deep: '#020d13',
  panel: '#0a2430',
  lineSoft: '#133544',
  text: '#e4f1f4',
  cream: '#f6ecd6',
  dim: '#8eabb6',
  faint: '#5d7d89',
  red: '#ff4150',
  gold: '#f2c14e',
  goldSoft: '#ffe3a1',
  teal: '#5fe0d0',
  good: '#5fd39a',
  stall: '#2a1c12',
  wood: '#5a3e2a',
  brass: '#17120a',
  brassText: '#f4ead2',
  brassDim: '#b9a77c',
  paper: '#efe6d2',
  ticket: '#fbf6ea',
  paperInk: '#1d1712',
  shelf: '#0a2530',
}

// The site's headline style (src/places/places.css .headline): spread onto any Anton text.
export const DISPLAY = {
  fontFamily: "'Anton', Impact, 'Arial Narrow', sans-serif",
  fontWeight: 400,
  fontStyle: 'normal',
  fontSynthesis: 'none',
  textTransform: 'uppercase',
  letterSpacing: '0.005em',
  lineHeight: 0.92,
} as const

export const F = {
  // Anton: one weight (400), no italic, always uppercase. Never fake bold/italic on it.
  display: "'Anton', Impact, 'Arial Narrow', sans-serif",
  body: "'Inter Tight', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
}

let loaded: Promise<unknown> | null = null
export function loadBrandFonts() {
  if (!loaded)
    loaded = Promise.all([
      loadFont({ family: 'Anton', url: staticFile('fonts/Anton-400.woff2'), weight: '400' }),
      loadFont({ family: 'Inter Tight', url: staticFile('fonts/InterTight-var.woff2'), weight: '100 900' }),
      loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/JetBrainsMono-var.woff2'), weight: '100 800' }),
    ])
  return loaded
}
loadBrandFonts()
