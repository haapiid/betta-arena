import { AbsoluteFill } from 'remotion'
import { Demo } from './Demo'
import { C, DISPLAY } from './lib/brand'
import { Brandmark, LaunchPill, Turn } from './lib/ui'

// 1080x1080 cut for the mobile timeline: the 16:9 demo scaled into the middle, with a brand header and footer.
export function DemoSquare() {
  const k = 1080 / 1920
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ background: 'radial-gradient(700px 400px at 50% 0%, rgba(255,65,80,0.10), transparent 70%), radial-gradient(800px 400px at 50% 100%, rgba(242,193,78,0.08), transparent 70%)' }} />
      <div style={{ position: 'absolute', top: 0, height: 236, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Brandmark size={50} />
        <div style={{ ...DISPLAY, fontSize: 64, color: C.cream, marginTop: 14 }}>
          Every buy is <Turn>a fight.</Turn>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 236, left: 0, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: '0 0', overflow: 'hidden' }}>
        <Demo />
      </div>
      <div style={{ position: 'absolute', bottom: 0, height: 236, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LaunchPill size={27} />
      </div>
    </AbsoluteFill>
  )
}
