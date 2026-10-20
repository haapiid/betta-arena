# Betta Arena ($BETTA) · memecoin edition (20 Oct 2026)

A memecoin on **Robinhood Chain (4663)**, launched on **Pons**. No NFTs, no paid game: the token is the
game. Every buy throws a betta into the ring; creator fees buy $BETTA back and sink it to the deep.
The earlier on-chain game (NFT fish, shop, tournaments) is kept on the `game-onchain` branch.

## Lore

**The Arena** is one big glass tank on a market stall at night. One betta holds the belt.

- **Every buy throws a betta into the ring.** Its breed, name and stats come from the buy's
  transaction hash; a bigger buy brings a higher-level fish. It fights the champion on the spot.
  Win and it takes the belt; lose and the champion's streak grows. Everyone can replay every fight.
- **The house buys back.** Pons pays the creator a fee on every trade. When the fee tank reaches the
  next step, the engine claims it and spends all of it buying $BETTA.
- **Everything bought back sinks to the deep.** It goes straight to the dead address: burned, for good.
  The supply only goes down.
- **The shelf:** the ten biggest holders who never sold get a jar on the shelf. No money, just the jar.
- **Sell once and your fish jumps the jar.** Off the shelf, struck through, for good.
- Tagline: **"Every buy is a fight."** Closing: **"The deep keeps everything."**
- Voice: deadpan fight-night announcer. Never yield, APY, passive income or promises of value.

| Word on the site | What it is in the engine |
|---|---|
| a betta enters the ring | one buy tx of at least `FIGHT_MIN_TOKENS` (tokens out of the curve / a pool / a router into a plain wallet) |
| the fight | `fight(challenger, champion, txHash)`: the same integer fight engine as before, seeded by the tx hash |
| the belt / the champion | the fish that won the last fight; its streak is how many challengers it beat |
| the fee tank | the Pons fee escrow (ETH) |
| the bell | a buyback round: claim the escrow, buy $BETTA, send it to the dead address |
| the deep | the dead address `0x…dEaD`; burned = its balance |
| the shelf | top 10 holders by balance who never sold |
| jumped the jar | sold (sent $BETTA to the curve, a pool or a router): out for good |
| your jar | the wallet check |

## Mechanics

1. Every few seconds the engine reads the Pons fee escrow for the creator wallet (the engine's key).
2. When it holds at least `BUYBACK_STEP_ETH` (default 0.02 ETH), the engine claims it.
3. It spends everything it claimed (never its small gas buffer) buying $BETTA:
   - while the token is on the Pons bonding curve: `curve.buy(eth, minOut, 0x…dEaD)`, so the tokens land
     in the dead address in the same transaction;
   - after graduation: a Uniswap v4 swap into the engine wallet, then a transfer of exactly what was
     bought to the dead address.
4. Every transaction hash is saved before it is awaited; a restart checks the chain and resumes the
   round instead of buying twice. Every round is shown with its transactions.

No ETH goes to holders and there is no treasury step: 100% of claimed creator fees become burned $BETTA.
