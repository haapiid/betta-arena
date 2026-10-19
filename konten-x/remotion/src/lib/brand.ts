import { staticFile } from 'remotion'
import { loadFont } from '@remotion/fonts'

export const C = {
  ink: '#03111a',
  ink2: '#04121a',
  deep: '#061b25',
  panel: '#0a2430',
  panel2: '#0e2e3c',
  water: '#0a2d38',
  line: '#1a4152',
  lineSoft: '#133544',
  text: '#e4f1f4',
  dim: '#8eabb6',
  faint: '#5d7d89',
  gold: '#f2c14e',
  goldSoft: '#ffe3a1',
  coral: '#ff6b57',
  teal: '#5fe0d0',
  good: '#5fd39a',
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
      loadFont({ family: 'Hanken Grotesk', url: staticFile('fonts/HankenGrotesk-var.woff2'), weight: '100 900' }),
      loadFont({ family: 'JetBrains Mono', url: staticFile('fonts/JetBrainsMono-var.woff2'), weight: '100 800' }),
    ])
  return loaded
}
loadBrandFonts()
