# Betta Arena: launch content (Remotion)

This project renders every X (Twitter) asset in `konten-x/` for the $BETTA memecoin launch on Pons
(Robinhood Chain). The look follows the site's "night at the betta fights" (`src/places/*`): ringside,
the bell, the deep, the keepers' shelf. The fish and tanks are drawn by the site's own canvas renderers:
`src/render/*.ts` is a snapshot of `../../src/render` (trimmed to what is used), so this project builds
even while the site source changes. The only change from the site is that `tank.ts` reads
`globalThis.__BETTA_DPR`, which keeps the gravel sharp when scaled up.

- Remotion `4.0.530` (pinned exactly), React 19.2.0
- Fonts in `public/fonts`: Fraunces (roman + italic, variable), Hanken Grotesk, JetBrains Mono
- All fights, holders and numbers in the content are demo data: there is no contract address yet.

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
| `src/Root.tsx` | Compositions: `Logo`, `Banner`, `DemoVideo` (1920x1080, 30 fps, 1329 frames = 44.3 s), `DemoSquare` (1080x1080), `PostGif` (1200x675, 6 s loop) |
| `src/Demo.tsx` | Scene order and durations of the demo video |
| `src/scenes/TitleEnd.tsx` | "Every buy is a fight." title, and the "The deep keeps everything." end card |
| `src/scenes/Ringside.tsx` | A buy lands (tx hash → breed, name; buy size → level), and the belt + streak with the fight ticker |
| `src/scenes/Arena.tsx` | The challenger drops into the ring and fights the champion (HP bars, strikes) |
| `src/scenes/Bell.tsx` | Creator fees fill the fee tank, the bell rings, the buyback ticket gets stamped SUNK |
| `src/scenes/Deep.tsx` | Coins sink to the deep, the burn counter rolls up |
| `src/scenes/Shelf.tsx` | Ten jars for the ten biggest holders who never sold; one sells and its fish jumps the jar |
| `src/lib/ring.ts` | The bout as a pure function of time (drop-in, strikes, loser sinks); logic and animation time are separate so the GIF loops |
| `src/lib/night.tsx` | Ringside backdrop (spotlights, crowd, flashes), the framed ring and the fighters' plates |
| `src/lib/cast.ts` | The demo fish, the demo buy and the two scripted bouts |
| `src/PostGif.tsx` | Seamless 6 s loop: a buy drops a betta in, the champion keeps the belt, the ring resets |
| `src/stills.tsx` | Profile picture and header |

The ffmpeg build bundled with Remotion is at `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe`.
It is useful for pulling a frame out to check it, e.g. `ffmpeg -ss 20 -i out/demo-video.mp4 -frames:v 1 f.png`.
