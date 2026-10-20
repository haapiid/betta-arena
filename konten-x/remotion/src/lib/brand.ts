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

export const F = {
  display: "'Fraunces', Georgia, serif",
  body: "'Hanken Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
}

let loaded: Promise<unknown> | null = null
export function loadBrandFonts() {
  if (!loaded)
    loaded = Promise.all([
      loadFont({ family: 'Fraunces', url: staticFile('fonts/Fraunces-var.woff2'), weight: '100 900' }),
      loadFont({ family: 'Fraunces', url: staticFile('fonts/Fraunces-italic-var.woff2'), weight: '100 900', style: 'italic' }),
      loadFont({ family: 'Hanken Grotesk', url: staticFile('fonts/HankenGrotesk-var.woff2'), weight: '100 900' }),
      loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/JetBrainsMono-var.woff2'), weight: '100 800' }),
    ])
  return loaded
}
loadBrandFonts()
