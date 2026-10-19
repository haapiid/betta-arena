#!/usr/bin/env bash
# Local testing: deploy fresh contracts to the Hardhat node (npx hardhat node in contracts/) and
# point server/.env at them with an empty database. Usage: bash scripts/local-deploy.sh [minutes-until-round-1]
set -euo pipefail
cd "$(dirname "$0")/../../contracts"
MIN="${1:-2}"
START=$(node -e "console.log(new Date(Date.now()+${MIN}*60000).toISOString())")
SIGNER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 OPERATOR_ADDRESS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
  TOURNAMENT_DAYS="${TOURNAMENT_DAYS:-0.005}" SEASON_START="$START" npx hardhat run scripts/deploy.ts --network localhost > /dev/null
node -e '
const fs=require("fs"); const d=require("./deployments/31337.json"); const p="../server/.env";
let s=fs.readFileSync(p,"utf8");
const set=(k,v)=>{ s=new RegExp("^"+k+"=","m").test(s)? s.replace(new RegExp("^"+k+"=.*$","m"),k+"="+v) : s+"\n"+k+"="+v };
set("TOKEN_ADDRESS",d.token); set("FISH_ADDRESS",d.fish); set("SHOP_ADDRESS",d.shop); set("ARENA_ADDRESS",d.arena);
set("START_BLOCK",d.startBlock); set("DATA_DIR","./data-local-"+Date.now());
fs.writeFileSync(p,s); console.log("deployed; round 1 opens", d.seasonStart, "arena", d.arena);'
