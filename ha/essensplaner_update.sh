#!/bin/sh
# Holt die neueste Version des Essensplaners aus GitHub (Branch main) nach /config/www/essensplaner.
# Aufgerufen über shell_command.essensplaner_update. Liegt in Home Assistant unter /config/scripts/essensplaner_update.sh.
# Öffentliches Repository: kein Token nötig. Privates Repository: GitHub-Token (nur Lesen, nur dieses Repository)
# allein in /config/.essensplaner_github_token.
# Die vorige Version bleibt als /config/essensplaner_backup liegen (zum Zurückholen von Hand).
# Die Variablen mit EP_ davor sind nur für die Tests gedacht.
set -eu
REPO="korkfabrik/Essensplaner"
BRANCH="main"
TOKEN_FILE="${EP_TOKEN_FILE:-/config/.essensplaner_github_token}"
TARGET="${EP_TARGET:-/config/www/essensplaner}"
BACKUP="${EP_BACKUP:-/config/essensplaner_backup}"
WORK="${EP_WORK:-/tmp/essensplaner_update}"
URL="${EP_URL:-https://api.github.com/repos/$REPO/tarball/$BRANCH}"

TOKEN=""
[ -s "$TOKEN_FILE" ] && TOKEN=$(tr -d ' \r\n' < "$TOKEN_FILE")

rm -rf "$WORK"
mkdir -p "$WORK/src"
if command -v curl >/dev/null 2>&1; then
  if [ -n "$TOKEN" ]; then
    curl -sSfL -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -o "$WORK/src.tar.gz" "$URL"
  else
    curl -sSfL -H "Accept: application/vnd.github+json" -o "$WORK/src.tar.gz" "$URL"
  fi
elif [ -n "$TOKEN" ]; then
  wget -q --header="Authorization: Bearer $TOKEN" --header="Accept: application/vnd.github+json" -O "$WORK/src.tar.gz" "$URL"
else
  wget -q --header="Accept: application/vnd.github+json" -O "$WORK/src.tar.gz" "$URL"
fi
tar -xzf "$WORK/src.tar.gz" -C "$WORK/src"
SRC=$(find "$WORK/src" -mindepth 1 -maxdepth 1 -type d | head -n 1)
APP="$SRC/www/essensplaner"
[ -f "$APP/sw.js" ] && [ -f "$APP/index.html" ] && [ -f "$APP/version.js" ] || { rm -rf "$WORK"; echo "Download unvollständig: sw.js, index.html oder version.js fehlt"; exit 1; }
VERSION=$(sed -n "s/^const CACHE_VERSION = '\([^']*\)'.*/\1/p" "$APP/sw.js")
APPV=$(sed -n "s/.*APP_VERSION = '\([^']*\)'.*/\1/p" "$APP/version.js")
# Gleiche Prüfung wie scripts/build_zip.sh: sonst bleibt das Handy auf dem alten Cache
[ -n "$VERSION" ] && [ "$VERSION" = "$APPV" ] || { rm -rf "$WORK"; echo "Version passt nicht: version.js=$APPV sw.js=$VERSION. Nichts geändert."; exit 1; }

# Erst komplett daneben kopieren, dann austauschen: die App ist nie halb aktualisiert
mkdir -p "$(dirname "$TARGET")"
rm -rf "$TARGET.new"
cp -r "$APP" "$TARGET.new"
rm -rf "$BACKUP"
[ -d "$TARGET" ] && mv "$TARGET" "$BACKUP"
mv "$TARGET.new" "$TARGET"
rm -rf "$WORK"
echo "Essensplaner $VERSION installiert"
