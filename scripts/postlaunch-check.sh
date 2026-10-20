#!/bin/sh
# Quick health check of a running install. Run ON the server:  sh scripts/postlaunch-check.sh [https://yourdomain]
# Read only: it calls the engine and the site and prints what it finds.
SITE="${1:-}"
API="http://127.0.0.1:5050"
ok() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILED=1; }
FAILED=0

echo "== engine"
S="$(curl -s -m 10 "$API/api/status")" || S=""
[ -n "$S" ] && ok "API answers on $API" || bad "no answer from $API (pm2 status / pm2 logs betta-engine)"
node -e '
const s = JSON.parse(process.argv[1] || "{}");
const say = (good, text) => console.log((good ? "  \x1b[32mok\x1b[0m   " : "  \x1b[33mnote\x1b[0m ") + text);
say(!s.standby, s.standby ? "standby: TOKEN_ADDRESS is empty (the site shows the demo)" : `token ${s.token}`);
if (!s.standby) {
  say(!!s.curve, s.curve ? `Pons curve ${s.curve}` : "no Pons curve found (graduated already, or not a Pons token)");
  say(s.engine !== "error", `engine state: ${s.engine}`);
  say(true, `fights: ${s.ring.total}, shelf: ${s.shelf.length}, jumped: ${s.jumpedCount}`);
  say(true, `fee tank: ${s.fees.tankEth} ETH of ${s.fees.stepEth}; bells rung: ${s.rounds.length}; burned by bells: ${s.totals.burnedByBell}`);
  const last = s.rounds[0];
  if (last) say(last.stage === "done", `last bell #${last.n}: ${last.stage} (${last.route}) buy ${last.buyTx}`);
  say(s.ethUsd > 0, s.ethUsd > 0 ? `ETH $${s.ethUsd}, $BETTA $${s.price?.tokenUsd || 0} (${s.price?.source || "no price yet"})` : "no ETH price yet (outbound https blocked?)");
}
' "$S" 2>/dev/null || bad "could not read /api/status"
curl -s -m 10 -o /dev/null -w '%{http_code}' "$API/api/card/site.png" | grep -q 200 && ok "site card renders (og:image)" || bad "site card does not render (fonts in engine/fonts?)"

if [ -n "$SITE" ]; then
  echo "== site $SITE"
  curl -s -m 10 -o /dev/null -w '%{http_code}' "$SITE/" | grep -q 200 && ok "home page" || bad "home page"
  curl -s -m 10 "$SITE/api/health" | grep -q '"ok":true' && ok "/api goes to the engine" || bad "/api does not reach the engine (nginx)"
  curl -s -m 10 "$SITE/" | grep -q 'og:image" content="https' && ok "og:image is absolute" || bad "og:image missing: set SITE_URL in .env and rebuild"
  curl -s -m 10 "$SITE/" | grep -o 'rh-mode" content="[a-z]*"'
fi
exit $FAILED
