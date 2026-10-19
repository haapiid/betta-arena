import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Canvas } from '../lib/Canvas'
import { C, F } from '../lib/brand'
import { G } from '../game/species'
import { bettaExtent } from '../render/betta'
import { drawTankBack, drawTankFront, gravelTop } from '../render/tank'
import { clamp, lerp, placeFish, prand, smooth } from '../lib/jarScene'
import { Eyebrow, Rise, SceneFade, Title } from '../lib/ui'

// a scripted bout, played back exactly like the game's ArenaView
type Ev = { actor: 0 | 1; kind: 'hit' | 'crit' | 'miss'; hp: [number, number] }
const EVENTS: Ev[] = [
  { actor: 0, kind: 'hit', hp: [100, 79] },
  { actor: 1, kind: 'miss', hp: [100, 79] },
  { actor: 1, kind: 'hit', hp: [83, 79] },
  { actor: 0, kind: 'crit', hp: [83, 41] },
  { actor: 1, kind: 'hit', hp: [69, 41] },
  { actor: 0, kind: 'hit', hp: [69, 0] },
]
const START = 0.55
const STEP = 0.92
const FA = { g: G.halfmoon, name: 'Blue Moon', breed: 'Halfmoon · Lv 12' }
const FB = { g: G.plakat, name: 'Red Dagger', breed: 'Plakat · Lv 13' }
const UNIT = 2.4

function evState(t: number) {
  const el = t - START
  const n = EVENTS.length
  const step = el < 0 ? -1 : Math.min(n, Math.floor(el / STEP))
  const ph = el < 0 ? 0 : (el % STEP) / STEP
  return { step, ph, done: step >= n, el }
}

function hpAt(t: number): [number, number] {
  const { step, ph } = evState(t)
  if (step < 0) return [100, 100]
  const cur = EVENTS[Math.min(EVENTS.length - 1, step)].hp
  const prev = step === 0 ? [100, 100] : EVENTS[step - 1].hp
  if (step >= EVENTS.length) return EVENTS[EVENTS.length - 1].hp
  const k = smooth((ph - 0.3) / 0.25)
  return [lerp(prev[0], cur[0], k), lerp(prev[1], cur[1], k)]
}

function drawArena(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  drawTankBack(ctx, w, h, t, { water: 100, happy: false, seed: 99, plants: true })
  const { step, ph, done, el } = evState(t)
  const ev = !done && step >= 0 ? EVENTS[step] : null
  const gt = gravelTop(h)
  const e = bettaExtent(FA.g)
  const s = (w * 0.3) / (e.right - e.left)
  const baseY = Math.min(h * 0.52, gt - h * 0.2)
  const gap = w * 0.17
  const pos = [
    { x: w / 2 - gap, y: baseY, face: 1, tilt: 0, flare: 1, sick: false },
    { x: w / 2 + gap, y: baseY, face: -1, tilt: 0, flare: 1, sick: false },
  ]
  pos.forEach((p, i) => {
    p.y += Math.sin(t * 1.4 + i * 2) * 4
    p.x += Math.sin(t * 0.9 + i) * 3
  })
  // the two fish slide into place at the start
  const enter = smooth(t / 0.6)
  pos[0].x -= (1 - enter) * w * 0.3
  pos[1].x += (1 - enter) * w * 0.3
  if (ev) {
    const at = pos[ev.actor]
    const df = pos[1 - ev.actor]
    const lunge = ph < 0.3 ? Math.sin((ph / 0.3) * (Math.PI / 2)) : Math.max(0, 1 - (ph - 0.3) / 0.5)
    at.x += at.face * lunge * gap * 0.42
    at.tilt = at.face * -0.1 * lunge
    if (ev.kind === 'miss') df.y -= Math.sin(Math.min(1, ph / 0.4) * Math.PI) * 26
    else if (ph > 0.25 && ph < 0.75) {
      const k = 1 - (ph - 0.25) / 0.5
      df.x += at.face * 14 * k
      df.tilt = at.face * 0.18 * k
    }
  }
  if (done) {
    const k = smooth((el - EVENTS.length * STEP) / 0.7)
    const lo = pos[1]
    lo.y = lerp(lo.y, gt - 22, k)
    lo.flare = 1 - k
    lo.sick = k > 0.3
    lo.tilt = 0.25 * lo.face * k
    pos[0].flare = 0.6 + 0.4 * Math.sin(t * 3)
  }
  const hp = hpAt(t)
  ;[FA, FB].forEach((F_, i) => {
    const p = pos[i]
    placeFish(ctx, F_.g, p.x, p.y, s, p.face, p.tilt, { t, flare: p.flare, swim: 0.6, sick: p.sick, health: hp[i] })
  })
  // fin flakes from every hit
  EVENTS.forEach((ev2, i) => {
    if (ev2.kind === 'miss') return
    const t0 = START + i * STEP + STEP * 0.3
    const a = t - t0
    if (a < 0 || a > 1.1) return
    const dir = ev2.actor === 0 ? 1 : -1
    const hx = w * (ev2.actor === 0 ? 0.6 : 0.4)
    const col = ev2.actor === 0 ? FB.g.fin : FA.g.fin
    const n = ev2.kind === 'crit' ? 24 : 13
    for (let j = 0; j < n; j++) {
      const vx = dir * (20 + prand(j + i * 40, 1) * 70)
      const vy = (prand(j + i * 40, 2) - 0.5) * 70
      const x = hx + (vx * (1 - Math.exp(-1.5 * a))) / 1.5
      const y = baseY + (prand(j + i * 40, 3) - 0.5) * 20 + vy * a + 15 * a * a
      const life = clamp(1 - 0.9 * a)
      ctx.fillStyle = prand(j, 4) < 0.5 ? col : '#e8f6ff'
      ctx.globalAlpha = life * 0.85
      ctx.beginPath()
      ctx.ellipse(x, y, 2.2, 1.2, vx * 0.02, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
  if (ev && ev.kind === 'crit' && ph > 0.28 && ph < 0.42) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.fillRect(0, 0, w, h)
  }
  drawTankFront(ctx, w, h, t, { water: 100, happy: false, seed: 99, leaf: false })
}

function Plate({ side, name, breed, hp, color, win }: { side: 'l' | 'r'; name: string; breed: string; hp: number; color: string; win: number }) {
  return (
    <div style={{ width: 640, textAlign: side === 'l' ? 'left' : 'right' }}>
      <div style={{ display: 'flex', justifyContent: side === 'l' ? 'flex-start' : 'flex-end', alignItems: 'baseline', gap: 16 }}>
        <span style={{ fontFamily: F.display, fontSize: 46, fontWeight: 700, color: '#f6ecd6' }}>{name}</span>
        <span style={{ fontFamily: F.mono, fontSize: 20, color: C.dim }}>{breed}</span>
      </div>
      <div style={{ marginTop: 12, height: 20, borderRadius: 99, background: 'rgba(3,17,26,0.7)', border: '1.5px solid rgba(255,255,255,0.15)', overflow: 'hidden', display: 'flex', justifyContent: side === 'l' ? 'flex-start' : 'flex-end' }}>
        <div style={{ width: `${hp}%`, height: '100%', background: hp > 35 ? `linear-gradient(90deg, ${color}, ${color}cc)` : `linear-gradient(90deg, ${C.coral}, #ff5d6c)` }} />
      </div>
      <div style={{ marginTop: 10, fontFamily: F.mono, fontSize: 22, color: win > 0 ? C.gold : C.text, opacity: 0.9 }}>
        {win > 0 ? 'WINNER' : `HP ${Math.round(hp)}`}
      </div>
    </div>
  )
}

export function ArenaScene({ dur }: { dur: number }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = f / fps
  const hp = hpAt(t)
  const { done, el } = evState(t)
  const win = done ? smooth((el - EVENTS.length * STEP) / 0.4) : 0
  return (
    <SceneFade dur={dur}>
      <Canvas width={1920} height={1080} unit={UNIT} draw={drawArena} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(3,17,26,0.85) 0%, rgba(3,17,26,0) 24%, rgba(3,17,26,0) 62%, rgba(3,17,26,0.92) 100%)' }} />
      <div style={{ position: 'absolute', left: 90, right: 90, top: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Plate side="l" name={FA.name} breed={FA.breed} hp={hp[0]} color={C.teal} win={win} />
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontFamily: F.display, fontSize: 64, fontWeight: 800, color: C.gold, fontStyle: 'italic' }}>VS</div>
          <div style={{ fontFamily: F.mono, fontSize: 18, letterSpacing: '0.18em', color: C.dim, marginTop: 4 }}>PRO · ROUND OF 16</div>
        </div>
        <Plate side="r" name={FB.name} breed={FB.breed} hp={hp[1]} color={C.teal} win={0} />
      </div>
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 90px 70px' }}>
        <Rise at={6}>
          <Eyebrow color={C.coral}>05 · Fight</Eyebrow>
        </Rise>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
          <Rise at={10}>
            <Title size={92}>Let it fight.</Title>
          </Rise>
          <Rise at={16}>
            <div style={{ fontFamily: F.body, fontSize: 31, color: C.text, textAlign: 'right', lineHeight: 1.4 }}>
              Fights resolve on their own — attack, defense, beauty, traits, health.
              <br />
              <span style={{ color: C.gold, fontWeight: 650 }}>Every fight is decided on-chain.</span>
            </div>
          </Rise>
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity: interpolate(win, [0, 1], [0, 1]),
          pointerEvents: 'none',
        }}
      >
        <div style={{ transform: `scale(${0.8 + 0.2 * win}) translateY(-140px)`, fontFamily: F.display, fontSize: 84, fontWeight: 800, color: C.gold, textShadow: '0 6px 40px rgba(0,0,0,0.7)', letterSpacing: '-0.01em' }}>
          Blue Moon wins
        </div>
      </AbsoluteFill>
    </SceneFade>
  )
}
