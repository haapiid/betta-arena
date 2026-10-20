#!/bin/sh
# Flip the site between the demo and the live arena without a rebuild. Run ON the server after a build.
#   sh scripts/site-mode.sh demo   everyone sees labelled demo fights (handy before launch)
#   sh scripts/site-mode.sh live   the real arena; ?demo still previews the demo
set -e
MODE="${1:-}"
case "$MODE" in demo | live) ;; *) echo "usage: sh scripts/site-mode.sh demo|live" >&2; exit 1 ;; esac
APP="$(cd "$(dirname "$0")/.." && pwd)"
sed -i -E "s/name=\"rh-mode\" content=\"[a-z]+\"/name=\"rh-mode\" content=\"$MODE\"/" "$APP/dist/index.html"
grep -o 'rh-mode" content="[a-z]*"' "$APP/dist/index.html"
