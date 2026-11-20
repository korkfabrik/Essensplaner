#!/usr/bin/env bash
# Baut dist/essensplaner-pwa-v<version>.zip mit dem Ordner "essensplaner" darin.
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(sed -n "s/.*APP_VERSION = '\(.*\)'.*/\1/p" www/essensplaner/version.js)
S=$(sed -n "s/^const CACHE_VERSION = '\(.*\)'.*/\1/p" www/essensplaner/sw.js)
if [ "$V" != "$S" ]; then echo "Version passt nicht: version.js=$V sw.js=$S" >&2; exit 1; fi
mkdir -p dist
rm -f "dist/essensplaner-pwa-v$V.zip"
(cd www && zip -r -q "../dist/essensplaner-pwa-v$V.zip" essensplaner)
echo "dist/essensplaner-pwa-v$V.zip"
