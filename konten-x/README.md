# Betta Arena: X (Twitter) launch kit

Everything for the $BETTA launch account. $BETTA is a memecoin on Robinhood Chain, launching on the Pons
launchpad. The token is **not deployed yet**, so nothing here shows a contract address or a price. The only
launch claim is "Coming soon on Pons · Robinhood Chain". All fights, holders and numbers in the content are
demo data.

The story the content tells (see `../CONCEPT.md`): every buy throws a betta into the ring and it fights the
champion on the spot; Pons pays the creator a fee on every trade, the fee tank fills, the bell rings and all of
it buys $BETTA, which sinks to the deep (the dead address); the ten biggest holders who never sold get a jar on
the shelf; sell once and your fish jumps the jar.

| File | Size | Format | Where it goes on X |
| --- | --- | --- | --- |
| `logo-x.png` | 213 KB | 400x400 PNG | **Profile photo** (Edit profile → avatar). The gold halfmoon betta inside a gold ring; reads cropped to a circle and at 48 px. |
| `banner-x.png` | 560 KB | 1500x500 PNG | **Header photo** (Edit profile → banner). Ringside: Ronin (challenger) vs Kaiser (champion) in the ring with HP bars and the belt. Text stays out of the bottom-left 420x200 area that the avatar covers. |
| `post.gif` | 11.1 MB | 1200x675 GIF, 6 s seamless loop, 15 fps | Attach to a **post** (GIF limit 15 MB). A buy drops a betta into the ring; it fights the champion, who keeps the belt; "Every buy is a fight." |
| `demo-video.mp4` | 8.4 MB | 1920x1080 H.264 MP4, 30 fps, 44.3 s, no audio | Attach to the **launch post** and pin it. Every buy is a fight → a buy lands (tx hash → breed, name; buy size → level) → it drops into the ring and fights the champion → belt + streak → creator fees fill the fee tank → the bell rings → all of it buys $BETTA (ticket stamped SUNK) → it sinks to the deep, burn counter rolls up → the shelf of 10 jars, one sells and its fish jumps the jar → "The deep keeps everything." |
| `demo-video-square.mp4` | 3.4 MB | 1080x1080 H.264 MP4, 30 fps, 44.3 s, no audio | The same cut framed for the mobile timeline. Use it as a reply or a repost. |
| `remotion/` | — | Remotion project | Source for all of the above. See `remotion/README.md`. |

## Launch post captions

No price, no promises: describe what happens, in the fight-night voice.

1. Every buy is a fight.
   Buy $BETTA and a betta drops into the ring. Your transaction picks its breed and name; a bigger buy brings a
   higher level. It fights the champion on the spot.
   Coming soon on Pons · Robinhood Chain

2. The house buys back.
   Pons pays the creator a fee on every trade. When the fee tank fills, the bell rings: all of it buys $BETTA
   and sends it straight to the dead address.
   The deep keeps everything.

3. Ten jars on the shelf, for the ten biggest holders who never sold.
   No payouts. Just the jar, where the whole market can see it.
   Sell once and your fish jumps the jar.

4. Tonight's card: whoever buys next.
   The champion's streak is on the board. Win and you take the belt. Every fight replays from its transaction.
   $BETTA · Coming soon on Pons · Robinhood Chain

Posting tips: upload the logo and banner first. Put `demo-video.mp4` on the launch post (caption 1) and pin it.
Use `post.gif` with caption 4, and the square cut as a reply to caption 2 or 3. Add the contract address and the
Pons link only once the token is live.

## Re-render

```bash
cd konten-x/remotion
npm install
npx remotion still  Logo       out/logo-x.png
npx remotion still  Banner     out/banner-x.png
npx remotion render PostGif    out/post.gif              --codec=gif --every-nth-frame=2
npx remotion render DemoVideo  out/demo-video.mp4        --codec=h264 --crf=18
npx remotion render DemoSquare out/demo-video-square.mp4 --codec=h264 --crf=20
# then copy out/* into konten-x/
```
