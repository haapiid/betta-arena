import { Composition, Still } from 'remotion'
import './lib/brand'
import { Banner, Logo } from './stills'
import { Demo, DEMO_FRAMES } from './Demo'
import { PostGif, GIF_FRAMES } from './PostGif'
import { DemoSquare } from './Square'

export function Root() {
  return (
    <>
      <Still id="Logo" component={Logo} width={400} height={400} />
      <Still id="Banner" component={Banner} width={1500} height={500} />
      <Composition id="DemoVideo" component={Demo} width={1920} height={1080} fps={30} durationInFrames={DEMO_FRAMES} />
      <Composition id="DemoSquare" component={DemoSquare} width={1080} height={1080} fps={30} durationInFrames={DEMO_FRAMES} />
      <Composition id="PostGif" component={PostGif} width={1200} height={675} fps={30} durationInFrames={GIF_FRAMES} />
    </>
  )
}
