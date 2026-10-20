import { AbsoluteFill, Sequence } from 'remotion'
import { C } from './lib/brand'
import { TitleScene, EndScene } from './scenes/TitleEnd'
import { BuyScene, BeltScene } from './scenes/Ringside'
import { ArenaScene } from './scenes/Arena'
import { FeeScene, BuybackScene } from './scenes/Bell'
import { DeepScene } from './scenes/Deep'
import { ShelfScene } from './scenes/Shelf'

// A night at the betta fights: a buy lands → its betta fights the champion → the belt →
// creator fees fill the tank → the bell buys $BETTA → it sinks to the deep → the shelf → closing.
export const SCENES = [
  { id: 'title', dur: 90, C: TitleScene },
  { id: 'buy', dur: 130, C: BuyScene },
  { id: 'fight', dur: 285, C: ArenaScene },
  { id: 'belt', dur: 96, C: BeltScene },
  { id: 'fees', dur: 190, C: FeeScene },
  { id: 'buyback', dur: 114, C: BuybackScene },
  { id: 'deep', dur: 135, C: DeepScene },
  { id: 'shelf', dur: 175, C: ShelfScene },
  { id: 'end', dur: 114, C: EndScene },
]
export const DEMO_FRAMES = SCENES.reduce((a, s) => a + s.dur, 0)

export function Demo() {
  let at = 0
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {SCENES.map((s) => {
        const from = at
        at += s.dur
        return (
          <Sequence key={s.id} from={from} durationInFrames={s.dur} name={s.id}>
            <s.C dur={s.dur} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
