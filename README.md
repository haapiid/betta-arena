# Betta Arena ($BETTA)

A memecoin on **Robinhood Chain**, launched on **Pons**. Every buy throws a betta into the ring and
fights the champion; creator fees buy $BETTA back and sink it to the deep (the dead address).
Lore and engine words: [CONCEPT.md](CONCEPT.md). Launch: [docs/DEPLOY.md](docs/DEPLOY.md).

The earlier game (NFT fish, shop, tournaments, game server) is on the **`game-onchain`** branch.

## Parts

| Part | Where | Does |
|---|---|---|
| Engine | `engine/` (Node, viem) | Follows every $BETTA Transfer: balances, sells (jumped the jar), and every buy ≥ `FIGHT_MIN_TOKENS` becomes a fight against the champion. Claims the Pons creator fees and buys back & burns. Read-only API + live event stream. State in one JSON file. |
| Site | `src/` (React, Vite, GSAP, Lenis) | One walk through a night at the betta fights: ringside (the live ring replaying every fight), the rule board, the shelf, the bell (fee tank + buyback tickets), the deep (burned supply, jumpers), your jar (wallet check), closing. Labelled demo fights until launch. Read-only Connect wallet (your fish, your jar, your place on the shelf), a share card for every fight, prices in USD, Terms and Privacy pages. |
| Pons stand-in | `contracts/` (Hardhat) | **Local testing only**: a token with `curve()`, a curve that charges a creator fee, a claimable fee escrow; `scripts/local.ts` deploys it and plays traffic. |

Shared code: `src/game/battle.ts` (the integer fight engine), `src/game/ring.ts` (the fish a buy brings and
the fight against the champion) and `src/game/species.ts`. The engine decides with them and the site replays
with them, so a replay always matches what the engine recorded.

## Run locally

```bash
npm install && (cd engine && npm install)
npm run dev                       # site on http://localhost:3110 with demo fights
                                  # (set ENGINE_URL=http://127.0.0.1:5050 in .env to use a local engine instead)
```

With the engine on a local chain:

```bash
cd contracts && npm install && npx hardhat node                    # terminal 1
npx hardhat run scripts/local.ts --network localhost              # terminal 2: deploys, prints the engine .env lines
cd ../engine && cp .env.example .env                               # set RPC_URL=http://127.0.0.1:8545, CHAIN_ID=31337,
                                                                   # TOKEN_ADDRESS, PONS_FEE_ESCROW, START_BLOCK from above,
                                                                   # ENGINE_KEY = Hardhat account #2, BUYBACK_STEP_ETH=0.05
npm start                                                          # terminal 3
cd ../contracts && TRAFFIC=1 npx hardhat run scripts/local.ts --network localhost   # buys and sells
```

## Sharing

`src/card/cards.ts` draws the 1200×630 cards in the browser (Share → Post on X / Save image) and in the engine
(`/api/card/fight/<n>.png`, `/api/card/site.png`). A shared link `https://SITE/fight/<n>` is served by the engine:
X shows that fight's card, people are sent on to `/?fight=<n>`. Set `SITE_URL` in both `.env` files.

## Server scripts

| Script | Does |
|---|---|
| `scripts/install-server.sh domain email` | Fresh Ubuntu VPS: Node 22, nginx (site, `/api`, `/fight/`, headers), pm2, HTTPS |
| `scripts/site-mode.sh demo\|live` | Flips the built site between labelled demo fights and the live arena, no rebuild |
| `scripts/postlaunch-check.sh [https://site]` | Read-only health check of the engine, prices, cards and nginx |
| `engine/scripts/dryrun.ts 0xTOKEN [blocks]` | Replays a real token's transfers through the rules without writing anything |

## Tests

```bash
cd engine && npm test     # buys vs transfers vs sells, fish from tx hash, fights match replays, shelf, slippage
```
