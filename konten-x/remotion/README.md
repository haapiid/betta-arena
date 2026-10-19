# Betta Arena: launch content (Remotion)

This project renders every X (Twitter) asset in `konten-x/`. The fish, jar, food, pitcher, mirror and
tank are drawn by the game's own canvas renderers. `src/render/*.ts` is a snapshot of `../../src/render`,
so this project builds even while the game source changes. The only change from the game is that
`tank.ts` reads `globalThis.__BETTA_DPR`, which keeps the gravel sharp when scaled up.

- Remotion `4.0.530` (pinned exactly), React 19.2.0
- Fonts: Fraunces (variable, from `@fontsource-variable/fraunces`), Hanken Grotesk and JetBrains Mono (from `public/fonts` of the game)

## Setup

```bash
cd konten-x/remotion
npm install
```

## Render everything (run from `konten-x/remotion`)

```bash
npx remotion still  Logo        out/logo-x.png
npx remotion still  Banner      out/banner-x.png
npx remotion render PostGif     out/post.gif               --codec=gif --every-nth-frame=2
npx remotion render DemoVideo   out/demo-video.mp4         --codec=h264 --crf=18
npx remotion render DemoSquare  out/demo-video-square.mp4  --codec=h264 --crf=20
```

The same commands are available as `npm run render:logo | render:banner | render:gif | render:demo | render:square`.
Copy the files from `out/` into `konten-x/` afterwards. `remotion.config.ts` sets yuv420p / bt709 output so X accepts the MP4 as-is.

If Remotion cannot download its headless Chrome, add
`--browser-executable="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"` to any command,
or uncomment `Config.setBrowserExecutable` in `remotion.config.ts`.

Preview and edit interactively with `npx remotion studio`.

## Layout

| Path | What |
| --- | --- |
| `src/Root.tsx` | Compositions: `Logo`, `Banner`, `DemoVideo` (1920x1080, 30 fps, 1344 frames = 44.8 s), `DemoSquare` (1080x1080), `PostGif` (1200x675, 6 s loop) |
| `src/Demo.tsx` | Scene order and durations of the demo video |
| `src/scenes/*` | Title, Shop (buy a betta), Jar (feed, water change + ketapang, Mirror Flaring), Level (stats + traits), Arena (bout), Bracket (16-fish bracket) + Prize split, End card |
| `src/lib/jarScene.ts` | Stateless version of the game's `TankView`, so any frame can be rendered in any order |
| `src/lib/jarTimeline.ts` | The single continuous jar shot as a pure function of time |
| `src/PostGif.tsx` | Seamless 6 s loop: the motion periods divide 6 s exactly, and the first 0.8 s cross-fades from one loop later |
| `src/stills.tsx` | Profile picture and header |

The ffmpeg build bundled with Remotion is at `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`.
It is useful for pulling a frame out to check it, e.g. `ffmpeg -ss 20 -i out/demo-video.mp4 -frames:v 1 f.png`.
