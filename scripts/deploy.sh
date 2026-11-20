#!/usr/bin/env bash
# Kopiert die App per SSH nach Home Assistant (Add-on "Advanced SSH & Web Terminal" oder "Terminal & SSH").
# Ziel setzen, z. B.:  HA_SSH=root@homeassistant.local HA_PORT=22 scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${HA_SSH:?HA_SSH setzen, z. B. root@homeassistant.local}"
PORT="${HA_PORT:-22}"
V=$(sed -n "s/.*APP_VERSION = '\(.*\)'.*/\1/p" www/essensplaner/version.js)
S=$(sed -n "s/^const CACHE_VERSION = '\(.*\)'.*/\1/p" www/essensplaner/sw.js)
[ "$V" = "$S" ] || { echo "Version passt nicht: version.js=$V sw.js=$S" >&2; exit 1; }
rsync -av --delete -e "ssh -p $PORT" www/essensplaner/ "$HA_SSH:/config/www/essensplaner/"
echo "Version $V ausgerollt. Am Handy die App öffnen, sie meldet die neue Version."
