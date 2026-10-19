import { AbsoluteFill } from 'remotion'
import { Demo } from './Demo'
import { C, F } from './lib/brand'
import { Brandmark } from './lib/ui'

// 1080x1080 cut for the feed: the 16:9 demo scaled into the middle, with a brand header and footer.
export function DemoSquare() {
  const k = 1080 / 1920
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: 'radial-gradient(700px 400px at 50% 0%, rgba(242,193,78,0.10), transparent 70%), radial-gradient(800px 400px at 50% 100%, rgba(95,224,208,0.10), transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, height: 236, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Brandmark size={72} />
        <div style={{ fontFamily: F.display, fontSize: 34, color: C.text, marginTop: 8 }}>
          Raise it. Groom it. <span style={{ color: C.coral, fontWeight: 600 }}>Let it fight.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 236, left: 0, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0', borderTop: `1px solid ${C.lineSoft}`, borderBottom: `1px solid ${C.lineSoft}`, overflow: 'hidden' }}>
        <Demo />
      </div>
      <div style={{ position: 'absolute', bottom: 0, height: 236, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 14, padding: '14px 30px', borderRadius: 999, border: '2px solid rgba(242,193,78,0.55)', background: 'rgba(10,36,48,0.85)', fontFamily: F.mono, fontSize: 30, color: C.text }}>
          <span style={{ color: C.gold, fontWeight: 700 }}>$BETTA</span>
          <span style={{ color: C.faint }}>·</span>
          <span>Coming soon on Robinhood Chain</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
