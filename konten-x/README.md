# Betta Arena: X (Twitter) launch kit

Everything for the $BETTA launch account. The token is **not deployed yet**, so none of this content shows
a contract address, price or yield. The only claims are "Coming soon on Robinhood Chain" and
"Every fight is decided on-chain".

| File | Size | Format | Where it goes on X |
| --- | --- | --- | --- |
| `logo-x.png` | 213 KB | 400x400 PNG | **Profile photo** (Edit profile → avatar). The gold-and-teal halfmoon sits inside a gold ring and still reads cropped to a circle and at 48 px. |
| `banner-x.png` | 886 KB | 1500x500 PNG | **Header photo** (Edit profile → banner). Text stays out of the bottom-left 420x200 area that the avatar covers. |
| `post.gif` | 7.4 MB | 1200x675 GIF, 6 s seamless loop, 15 fps | Attach to a **post** (GIF limit 15 MB). A betta flaring at the mirror beside its jar. |
| `demo-video.mp4` | 10.6 MB | 1920x1080 H.264 MP4, 30 fps, 44.8 s, no audio | Attach to the **launch post**, or pin it. The full game loop: buy → feed → water change → Mirror Flaring → level up → arena → bracket → prize split → end card. |
| `demo-video-square.mp4` | 3.9 MB | 1080x1080 H.264 MP4, 44.8 s, no audio | The same cut framed for the mobile feed. Use it as a reply or a repost. |
| `remotion/` | — | Remotion project | Source for all of the above. See `remotion/README.md` for the render commands. |

## Suggested launch captions

1. Raise it. Groom it. Let it fight.
   Betta Arena: keep a betta in a glass jar, train it, then send it into 16-fish brackets.
   $BETTA · Coming soon on Robinhood Chain

2. Feed it. Change its water. Put a mirror beside the jar and watch it flare.
   Then the bracket decides who's best. Every fight is decided on-chain.
   Betta Arena · coming soon on Robinhood Chain

3. Rookie. Pro. Elite.
   Every few days, 16 bettas enter and one leaves as champion.
   Betta Arena ($BETTA): coming soon on Robinhood Chain.

Posting tips: put the video (`demo-video.mp4`) on the launch post and pin it. Save `post.gif` for a follow-up post
on the training feature. Upload the logo and banner before the first post.

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
