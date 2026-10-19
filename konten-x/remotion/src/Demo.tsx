import { AbsoluteFill, Sequence } from 'remotion'
import { C } from './lib/brand'
import { TitleScene, EndScene } from './scenes/TitleEnd'
import { ShopScene } from './scenes/Shop'
import { JarSceneComp } from './scenes/Jar'
import { LevelScene } from './scenes/Level'
import { ArenaScene } from './scenes/Arena'
import { BracketScene, PrizeScene } from './scenes/Bracket'

export const SCENES = [
  { id: 'title', dur: 100, C: TitleScene },
  { id: 'shop', dur: 130, C: ShopScene },
  { id: 'jar', dur: 459, C: JarSceneComp },
  { id: 'level', dur: 130, C: LevelScene },
  { id: 'arena', dur: 200, C: ArenaScene },
  { id: 'bracket', dur: 115, C: BracketScene },
  { id: 'prize', dur: 105, C: PrizeScene },
  { id: 'end', dur: 105, C: EndScene },
]
export const DEMO_FRAMES = SCENES.reduce((a, s) => a + s.dur, 0)

export function Demo() {
  let at = 0
  return (
    <AbsoluteFill style={{ background: C.ink }}>
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
