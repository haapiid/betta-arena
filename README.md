# Betta Arena ($BETTA)

A web3 betta-keeping game. Buy a betta, keep it alive in one of **3 jars**, train it, level it up
through its life, then enter it in **automatic tournaments** every few days. The top four split the pot.

Fish are drawn procedurally on canvas (not pixel art): translucent fins with branching rays, scales,
iridescent sheen, rippling fin edges, gills that open when flaring, fins that clamp when sick, and a
dead fish that floats belly-up.

## Run

```bash
npm install
cp .env.example .env   # optional
npm run dev            # http://localhost:3110
npm run build          # output in dist/
```

## Game rules

| Part | Rule |
|---|---|
| Food | Sold in packs of portions (Pellets 10/30, Daphnia 10/25, Bloodworms 10/25; the big pack is cheaper per portion). One feed uses one portion; no portions left = no feeding until you buy a pack. |
| Jars | Max 3 fish. A dead fish stays in its jar until buried; a jar may stay empty. |
| Hunger | Rises ~4.5/h. Above 75 it drains health; at 100 health falls fast. |
| Water | Clouds ~2.8/h. Below 25 it drains health; below 35 the fish can get sick. |
| Sickness | −3 health/h and −25% attack in the arena. Cured by Methylene Blue / Betta Revive. |
| XP | Healthy fish (health > 60, not sick) earn 2 XP/h. Free training (8h cooldown) and Growth Vitamins add more. Daily cap 120 XP. Tournament XP (win 40, loss 15) is uncapped. |
| Rush training | Don't want to wait 8h? Pay 5 coins per hour left (rounded up, max 40) to train now. A confirmation dialog shows the exact price first. Refused if the fish can't gain XP (sick, weak, hungry, daily cap reached), so coins are never wasted. |
| Levels | 1–30. Each level adds the breed's growth rate to attack/defense/beauty (e.g. Plakat +1.7 ATK/lv, Platinum +1.9 BEAUTY/lv). |
| Traits | One pick from 3 offered options every 5 levels (Thick Scales, Fin Ripper, Second Wind, ...). |
| Age | Juvenile (×0.88, smaller) → Adult (×1.0) → Prime (×1.1) → Senior (×1.0 → ×0.8). Dies of old age at `VITE_LIFESPAN_DAYS` (60). |
| Boosters | Fighter Tonic / Scale Armor / Color Enhancer: +10 for 24h, same stat refreshes, never stacks. |
| Divisions | Rookie Lv 1–10 (entry fee 25), Pro Lv 11–20 (100), Elite Lv 21–30 (300). Every fish pays the same fee. Up to 16 fish, single elimination; a smaller field gets byes, and fewer than 4 entrants calls the round off (fees refunded). |
| Registration | Closes 1 hour before the bell (or a tenth of a very short round). After that there are no new entries and no withdrawals. |
| Tournament | Every `VITE_TOURNAMENT_DAYS` days. Health ≥ 40 to enter, max 3 of your fish per round. |
| Fights | Automatic: HP from DEF + health, damage = ATK vs DEF, BEAUTY = crit & dodge, traits bend the odds. Seeded RNG: replays match results exactly. |
| Prize | After a 5% arena burn: champion 60%, runner-up 25%, each losing semifinalist 7.5%. Fish come home wounded and can die if health hits 0. |

## Structure

| File | What it holds |
|---|---|
| `src/game/species.ts` | 10 breeds: price, base stats, growth per level, colours/pattern. Set `image` to use your own art. |
| `src/game/fish.ts` | Care decay, XP & levels, age stages, training, buffs, item effects |
| `src/game/traits.ts` | Traits and the 3-option offer |
| `src/game/items.ts` | Food, water care, medicine, boosters, vitamins |
| `src/game/battle.ts` | The automatic fight simulation |
| `src/game/tournament.ts` | Round schedule, registration lock, divisions, NPC fields, bracket with byes, pot & prize split |
| `src/game/store.ts` | Player state + every action (localStorage per wallet) |
| `src/render/betta.ts` | Procedural betta renderer |
| `src/render/tank.ts` | The jar: water, light, plants, gravel, ketapang leaf, bubble nest, murky water |
| `src/components/` | Header/hero, jars, shop, arena (divisions, bracket, replay), how it works |
| `src/lib/wallet.ts` | Connect an Ethereum wallet (MetaMask, Rabby, ...) |

## Breeding

| Part | Rule |
|---|---|
| Sex | Every fish is ♂ or ♀. Females cost 60% of a male, carry short fins and an egg spot, and do not fight; they breed. |
| Requirements | One ♂ + one ♀, both level 10+, past juvenile, health above 70, not sick, not entered in the arena, fewer than 3 spawns each, not resting. Plus one empty jar as the spawning tank. |
| Cost | 150 coins (50% burned). Parents lose 20 health and rest 7 days. Max 3 spawns per fish per life. |
| Timeline | 24h spawning (bubble nest) → 24h eggs → 3 fry hatch. The keeper keeps one; the other two are released. |
| Form | Rolled per fry from a cross table (see below). The breeding panel shows every possible form with its chance before you pay. |
| Colours | Each colour comes from one parent or blends between both. 6% chance of a rare mutation (Galaxy, Mustard Gas, Avatar Gold, Black Orchid, Copper Dragon) that the shop never sells. |
| Stats | Base stats = parents' average ± 5 + a potential bonus of +1 per 5 average parent levels (max +6). Growth per level = parents' average ± 0.1. |
| Traits | 25% chance per fry to be born with one parent trait (free, does not use a level pick). |
| Lineage | Shop fish are Gen 1; a fry is one generation above its older parent. Parent names are recorded. |

### Cross table (tail form)

| Cross | Possible fry |
|---|---|
| Halfmoon × Plakat | 50% **HMPK**, 25% Halfmoon, 25% Plakat |
| Halfmoon × Crowntail | 50% **Half-Sun**, 25% Halfmoon, 25% Crowntail |
| Halfmoon × Double Tail | 50% **Double Tail Halfmoon**, 25% / 25% parents |
| Crowntail × Plakat | 50% **Crowntail Plakat (CTPK)**, 25% / 25% parents |
| Double Tail × Plakat | 50% **Double Tail Plakat (DTPK)**, 25% / 25% parents |
| Crowntail × Double Tail | 40% **Double Crown**, 30% / 30% parents |
| Veiltail × anything | 60% the other form, 40% Veiltail |
| Same form × same form | Same form. A hybrid × the same hybrid: 60% hybrid, 20% / 20% its two base forms |
| Hybrid × one of its base forms | 50% hybrid, 50% that base form (e.g. HMPK × Halfmoon) |
| Hybrid × anything else | Averaged over the hybrid's two base forms (e.g. HMPK × Crowntail → Half-Sun, CTPK, Crowntail, Halfmoon, Plakat) |
| Giant parent | Tail form as above; 40% chance of a giant body (70% if both parents are giants). A giant body on a plakat tail makes a Giant Plakat; on a hybrid it makes e.g. a "Giant Halfmoon Plakat". |

Code: `src/game/breeding.ts` (rules and genetics), `src/components/Breeding.tsx` (breeding panel, spawning jar, fry picker).

## Leaderboard & community

- **Leaderboard** (`/#leaderboard`): top earners, most titles and fight wins over the last 30 rounds, across all divisions. Built from round results in `src/game/leaderboard.ts`; once the game is on chain, swap in an indexer over real results.
- **Community page** (`/community`): channel cards, contract address with copy, top keepers and upcoming events. Fill the links in `.env` (`VITE_LINK_X`, `VITE_LINK_TELEGRAM`, `VITE_LINK_DISCORD`, `VITE_LINK_DEXSCREENER`, `VITE_LINK_BUY`, `VITE_LINK_DOCS`, `VITE_TOKEN_ADDRESS`). Empty links show "Coming soon".
- When hosting, make the server send `index.html` for `/community` (SPA fallback). Vercel/Netlify: add a rewrite of `/*` to `/index.html`.

## Swapping in real fish art

For now every fish is drawn in code. When you have artwork, put transparent PNGs (fish facing right)
in `public/fish/` and set `image: '/fish/name.png'` on the breed in `src/game/species.ts`. Jars,
shop and arena pick it up automatically.

## Important: this is a demo (off-chain) build

Balances, fish, stakes and tournament results currently live in the browser (localStorage), and the
other entrants are NPCs (`VITE_NPC_FILL=true`). The wallet is only used as an identity. Before using a real token:

1. Move balances, purchases, stakes and payouts into a smart contract (Solidity contract on Ethereum).
2. Run tournaments on a server or on chain with verifiable randomness (e.g. VRF), not in the
   player's browser. `runTournament()` is already pure and deterministic, so it can be moved as is.
3. Keep fish state on a server or on chain so it cannot be edited through localStorage.
4. Check the law: betting real money can count as gambling in many countries, Indonesia included.

`.env`: `VITE_DEMO_MODE=false` hides the faucet and "ring the bell now". `VITE_CARE_SPEED` speeds up
hunger, water, ageing and cooldowns for testing (e.g. `60` = one minute feels like an hour).
