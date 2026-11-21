# Essensplaner

Wochenplan für Gerichte als PWA, die komplett in Home Assistant lebt: Rezepte in einer To-do-Liste, Plan im Kalender, gemeinsame Einstellungen in einem Config-Eintrag. Kein eigenes Backend.

- App: `www/essensplaner/` (Anleitung für Installation, Anmeldung, Datenmodell und Änderungsliste in `www/essensplaner/README.md`)
- Tests: `tests/` (Playwright, nachgebautes Home Assistant), `python3 tests/run_all.py`
- Ausrollen: HA holt sich `main` selbst aus GitHub (Anleitung `ha/EINRICHTEN.md`), sonst `scripts/build_zip.sh` oder `scripts/deploy.sh`
- Icon-Quellen: `design/`
- Hinweise für Claude Code: `CLAUDE.md`

`tests/fixtures/ha_state.json` enthält erfundene Beispieldaten (Rezepte und Plan), keine echten Daten.
