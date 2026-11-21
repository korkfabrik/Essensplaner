# Essensplaner – Hinweise für Claude Code

PWA für die Essensplanung, die komplett in Home Assistant lebt. Kein eigenes Backend, kein Build-Schritt, Vanilla JS.
Ausgeliefert wird der Ordner `www/essensplaner/` nach `/config/www/essensplaner/` in Home Assistant, aufgerufen über `https://<ha>/local/essensplaner/index.html`.

Der Nutzer liest Code gut, programmiert aber selbst wenig. Er testet auf einem Pixel 9 Pro (Android, Chrome, als installierte PWA).

## Arbeitsweise und Stil

- Antworten auf Deutsch, knapp. Typische KI-Marker vermeiden: Semikolons, Gedankenstriche, Floskeln, Buzzwords ("nahtlos", "robust" usw.), "Es geht nicht um X, sondern um Y".
- Sagt er "nur Screenshots" oder "nur Mockup", wird kein Code geändert.
- Design-Wünsche betreffen meist den Stil, nicht das Layout. Im Zweifel erst Screenshots zeigen.
- Nach jeder Änderung: Tests laufen lassen, bei sichtbaren Änderungen Screenshot ansehen.

## Pflicht bei jeder Änderung an App-Dateien

1. Version an **zwei** Stellen gleich erhöhen: `APP_VERSION` in `www/essensplaner/version.js` und `CACHE_VERSION` in `www/essensplaner/sw.js`. Sonst bleibt das Handy auf dem alten Cache.
2. Neuen Abschnitt `### Version x.y.z` direkt unter `## Änderungen` in `www/essensplaner/README.md` (neueste oben, kurz, in Nutzersprache).
3. Neue Dateien in `ASSETS` in `sw.js` eintragen. Der App-Ordner bleibt flach (keine Unterordner).
4. `python3 tests/run_all.py` muss grün sein.

## Aufbau `www/essensplaner/`

| Datei | Inhalt |
| --- | --- |
| `index.html` | Gerüst, CSP-Meta, lädt die Skripte |
| `boot.js` | Startschutz: räumt bei kaputtem Start Service Worker und Cache auf |
| `theme.js` | Hell/Dunkel, Akzentfarbe (nur Farbton gespeichert, Rest abgeleitet), Schriftwahl (Figtree Standard) |
| `ha.js` | WebSocket-Client für Home Assistant (`callService`, `request`, Abos) |
| `app.js` | Hauptlogik: Zustand `S`, Ansichten Woche/Rezepte/Auswertung, Sheets, Aktionen |
| `settings.js` | Einstellungsseiten (verbindung, planung, rezeptdaten, einkauf, daten, darstellung) |
| `transfer.js` | Export und Import (Rezepte, Plan) als JSON |
| `swipe.js` | Wischgesten auf Karten |
| `styles.css` | Basis plus angehängte Override-Blöcke je Version. Spätere Blöcke gewinnen |
| `sw.js` | Service Worker, Cache `essensplaner-<CACHE_VERSION>` |
| `diag.html` | Diagnoseseite, läuft auch wenn die App leer bleibt |
| `font-*.woff2`, `icon-*.png` | Schriften lokal (Lizenz in `Fonts-LICENSE.txt`), Hummer-Icon |

### app.js in Kürze

- Klicks laufen über Delegation: `data-a="<aktion>"` ruft `A[<aktion>]` auf. Schreibende Aktionen stehen in `MUTATING` und laufen nacheinander (`S.busy`).
- `render()` baut die aktuelle Ansicht neu, `showSheet(titel, html)` öffnet ein Fenster von unten, `S.sheet.type` sagt welches.
- Alle Texte aus HA gehen durch `esc()`. Kein `innerHTML` mit ungeprüften Daten. Links nur über `safeUrl()`.
- Abschnitte sind mit `/* ---------- Titel ---------- */` markiert (Ablage, Woche füllen, Freie Einträge, Einkaufsliste …).

## Datenmodell in Home Assistant

- **Rezepte:** Local To-do (Standard `todo.gerichte`). Titel = Name, Beschreibung = JSON `{v, kategorie, kueche, aufwand 1-3, portionen, dauer_min, zutaten:[{name, menge, einheit}], tags, bewertung, favorit, notiz, rezept_url, erstellt}`.
- **Plan:** Local Calendar (Standard `calendar.essensplan`). Titel = Gerichtname, Beschreibung = JSON `{v:1, gericht_uid, slot, status:'geplant'|'gekocht', portionen, notiz, eingekauft?, auto?}`. `gericht_uid` fehlt bei freien Einträgen. `auto` = Lauf-ID von "Woche füllen" (für Rückgängig).
- **Gemeinsame Config:** Eintrag `config` in `todo.essensplaner_config`, JSON. Wichtige Schlüssel: `kategorien`, `kuechen`, `einheiten`, `slots` (Mahlzeiten mit Zeiten und `aktiv`), `standard_portionen`, `vorrat_nie`, `vorrat_opt` (Grundvorrat), `ablage` (`[{id, name, gericht_uid, portionen, eingekauft, notiz}]`), `frei_ignoriert` (kleingeschriebene Namen). Schreiben nur über `patchConfig(fn, quiet)`, das serialisiert.
- **Einkaufsliste:** beliebige HA-To-do-Liste (z. B. eine Bring-Liste), Einträge per `todo.add_item`.
- **Pro Gerät (localStorage):** `essensplaner_settings` (Entitäten), `essensplaner_auth` (OAuth-Token), `essensplaner_theme`, `essensplaner_accent`, `essensplaner_font`.

Anmeldung per OAuth2 über die HA-Login-Seite (wie das HA-Frontend), kein Long-Lived-Token. Plan wird von heute minus 365 bis plus 60 Tage geladen.

## Design (festgelegt)

- Stil "Notiz": Hintergrund `#FBFAF7`, weiße Karten, Rand `#E5E0D6`, Kategorie als Textmarker hinter dem Namen (`--m-fleisch` usw.). Dunkelmodus vorhanden.
- Akzentfarbe aus `theme.js` (`--accent`, `--accent-text`, `--accent-soft`, `--accent-border`, `--on-accent`). "Heute" in Akzentfarbe.
- Gekochte Gerichte: durchgestrichen, nur Titel. Kochmütze = gekocht, Tasche = eingekauft.
- Leere Tage einzeilig, bei halb geplantem Tag sitzt der leere Platz als kleiner Knopf in der Kopfzeile.
- Ablage (Gerichte ohne Tag) immer sichtbar, in Akzentfarbe.

## Tests

```
pip install playwright aiohttp   # Chromium: python3 -m playwright install chromium
python3 tests/run_all.py
```

- `tests/harness.py` startet einen lokalen Server und ersetzt Home Assistant im Browser (`tests/fake_ha.js`, Daten aus `tests/fixtures/ha_state.json`). Das Fake merkt sich Änderungen an Kalender, Config und Rezepten.
- Die Uhr im Browser steht auf Samstag, 14.11.2026, 12:00, passend zu den Testdaten.
- Screenshots landen in `tests/out/` (nicht eingecheckt).
- `test_csp_echt.py` braucht aiohttp und Port 8765.
- Neue Funktion = neuer Test nach dem Muster der vorhandenen.

Was die Tests nicht abdecken: echtes HA (Kalender-UIDs, REST), Tastatur auf dem Handy, echtes Wischen, Bring.

## Ausrollen

- Normalfall: HA holt `main` selbst aus GitHub. `ha/essensplaner_update.sh` läuft per `shell_command.essensplaner_update`, ausgelöst vom Knopf `script.essensplaner_aktualisieren` oder bei neuem Commit über die GitHub-Integration. Einrichtung in `ha/EINRICHTEN.md`, gleicher Aufbau wie bei Merker. Alles, was auf `main` landet, ist also kurz danach live. Das Skript bricht ab, wenn `version.js` und `sw.js` nicht übereinstimmen.
- `scripts/build_zip.sh` baut `dist/essensplaner-pwa-v<version>.zip` (Ordner `essensplaner` darin).
- `scripts/deploy.sh` kopiert per `rsync` über SSH nach `/config/www/essensplaner` (Ziel per Umgebungsvariable, siehe Skript).

## Offene Ideen

Assist-Sprachabfrage ("Was gibt's heute?"), Erinnerung am Vortag, Dashboard-Kachel, Reste einplanen, Bewertung nach dem Kochen, Offline weiterarbeiten.
Kippbare Entscheidungen: Standard-Portionen beim Planen statt Rezept-Portionen, Ansicht startet immer mit "5 Tage".
Auf echtem HA noch ungeprüft: "Woche füllen" (1.8.x), freie Einträge (1.9.x).
