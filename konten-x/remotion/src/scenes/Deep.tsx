import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { clamp, easeOut, prand } from '../lib/jarScene'
import { Kicker, Rise, SceneFade, Title, Turn } from '../lib/ui'

const FROM = 41_870_112
const ADD = 1_284_000

/** the sea floor at night: falling light, marine snow, swaying blades, gold coins sinking */
export function drawDeep(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, coins = 30, pour = 0) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#03141c')
  bg.addColorStop(0.55, '#020d13')
  bg.addColorStop(1, '#010507')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const top = ctx.createRadialGradient(w / 2, -h * 0.1, 10, w / 2, -h * 0.1, h * 0.9)
  top.addColorStop(0, 'rgba(95,180,200,0.16)')
  top.addColorStop(1, 'rgba(95,180,200,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, h)
  // marine snow
  for (let i = 0; i < 70; i++) {
    const y = (((prand(i, 3) * h + t * (8 + prand(i, 2) * 14)) % h) + h) % h
    const x = prand(i, 4) * w + Math.sin(t * 0.6 + i) * 6
    ctx.fillStyle = `rgba(200,235,240,${0.08 + prand(i, 6) * 0.18})`
    ctx.beginPath()
    ctx.arc(x, y, 0.8 + prand(i, 5) * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // coins: each sinks at its own pace, wobbling and flipping; `pour` adds a fresh burst from the top
  const n = coins
  for (let i = 0; i < n; i++) {
    const dur = 6 + prand(i, 7) * 5
    const fresh = i < pour
    const ph = fresh ? (t - prand(i, 13) * 0.9) / dur : ((t / dur + prand(i, 8)) % 1 + 1) % 1
    if (ph < 0 || ph > 1) continue
    const y = -30 + ph * (h * 0.95 + 40)
    const x = w * (0.04 + 0.92 * prand(i, 9)) + Math.sin(t * 1.3 + i) * 18 + ph * 40
    const r = 10 + prand(i, 10) * 9
    const flip = Math.abs(Math.cos(t * (1.5 + prand(i, 11) * 2) + i))
    const a = Math.min(1, ph * 8) * (1 - Math.max(0, ph - 0.8) / 0.25)
    ctx.save()
    ctx.globalAlpha = clamp(a)
    ctx.shadowColor = 'rgba(242,193,78,0.6)'
    ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r)
    g.addColorStop(0, '#fff3c4')
    g.addColorStop(0.55, '#e2a93a')
    g.addColorStop(1, '#8a5b12')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, Math.max(2, r * flip), r, Math.sin(i) * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // the floor: a sand bank with blades, coins resting in it
  const fy = h * 0.88
  for (let i = 0; i < 40; i++) {
    const x = prand(i, 51) < 0.5 ? prand(i, 52) * w * 0.32 : w * 0.68 + prand(i, 52) * w * 0.32
    const bh = h * (0.08 + prand(i, 53) * 0.16)
    const sw = Math.sin(t * 0.9 + i) * 10
    ctx.fillStyle = `rgba(30,${80 + prand(i, 54) * 40},60,0.75)`
    ctx.beginPath()
    ctx.moveTo(x - 4, fy + 10)
    ctx.quadraticCurveTo(x - 6 + sw * 0.5, fy - bh / 2, x + sw, fy - bh)
    ctx.quadraticCurveTo(x + 4 + sw * 0.5, fy - bh / 2, x + 5, fy + 10)
    ctx.fill()
  }
  ctx.fillStyle = '#0c2a33'
  ctx.beginPath()
  ctx.moveTo(0, fy + 6)
  ctx.quadraticCurveTo(w * 0.25, fy - 14, w * 0.5, fy + 2)
  ctx.quadraticCurveTo(w * 0.75, fy + 16, w, fy - 2)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
  for (let i = 0; i < 46; i++) {
    const x = prand(i, 61) * w
    const y = fy + 14 + prand(i, 62) * (h - fy - 20)
    ctx.fillStyle = `rgba(226,169,58,${0.25 + prand(i, 63) * 0.45})`
    ctx.beginPath()
    ctx.ellipse(x, y, 7 + prand(i, 64) * 6, 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 7 · Everything bought back sinks to the deep.
export function DeepScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const k = easeOut((t - 0.6) / 2.4)
  const n = Math.round(FROM + ADD * k)
  return (
    <SceneFade dur={dur}>
      <Canvas width={1920} height={1080} unit={1} draw={(ctx, w, h, tt) => drawDeep(ctx, w, h, tt + 4, 34, 14)} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 170, textAlign: 'center' }}>
        <Rise at={2}>
          <Kicker size={24} color="#6f97a4">
            The deep · 0x0000…dEaD
          </Kicker>
        </Rise>
        <Rise at={6} style={{ marginTop: 20 }}>
          <Title size={112}>
            Everything bought back <Turn>sinks here.</Turn>
          </Title>
        </Rise>
        <Rise at={14} style={{ marginTop: 70 }}>
          <div style={{ fontFamily: F.mono, fontSize: 168, fontWeight: 600, color: C.gold, lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 0 60px rgba(242,193,78,0.35)' }}>{n.toLocaleString('en-US')}</div>
        </Rise>
        <Rise at={20} style={{ marginTop: 28 }}>
          <div style={{ fontFamily: F.body, fontSize: 34, color: C.dim }}>
            $BETTA at the dead address · <b style={{ color: C.text }}>burned, for good</b>
          </div>
        </Rise>
        <div style={{ marginTop: 20, fontFamily: F.mono, fontSize: 26, color: C.red, opacity: clamp((t - 0.8) * 3) * (1 - clamp((t - 3.4) * 2)) }}>+1,284,000 from bell #7</div>
      </AbsoluteFill>
    </SceneFade>
  )
}
