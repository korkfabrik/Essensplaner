# Essensplaner PWA

Rezepte liegen in einer Home-Assistant-To-do-Liste, geplante und gekochte Gerichte in einem Kalender. Die App hat kein eigenes Backend.

## 1. Listen und Kalender

Die App braucht zwei Local-To-do-Listen und einen Local Calendar. Die Entitäten sind frei wählbar (Einstellungen, Listen und Kalender). Standard:

| Zweck | Entität | Integration |
| --- | --- | --- |
| Rezepte | `todo.gerichte` | Local To-do |
| Gemeinsame Einstellungen | `todo.essensplaner_config` | Local To-do |
| Plan | `calendar.essensplan` | Local Calendar |
| Einkaufsliste (optional) | jede To-do-Liste, z. B. aus Bring | beliebig |

Fehlt eine Liste oder der Kalender, zeigt "Testen" (Einstellungen, Listen und Kalender) daneben "Anlegen". Die App legt die Integration dann wie "Integration hinzufügen" in HA an. Der Name ergibt sich aus der ID (`todo.gerichte` wird zu "Gerichte"). Danach "Speichern" tippen.

Anlegen geht nur mit einem HA-Konto mit Adminrechten. Ohne Adminrechte die Integrationen in HA unter Geräte & Dienste anlegen. Die Einkaufsliste muss es in HA schon geben (z. B. über die Bring-Integration).

## 2. Installieren

1. ZIP entpacken, den Ordner `essensplaner` nach `/config/www/` kopieren (Samba, SSH oder File Editor). Gibt es `www` noch nicht, anlegen und Home Assistant einmal neu starten.
2. Die App öffnen: `https://<deine-ha-adresse>/local/essensplaner/index.html`
3. "Mit Home Assistant anmelden" tippen. Es öffnet sich die normale HA-Anmeldeseite, danach geht es automatisch zurück in die App.
4. Unter Einstellungen, "Listen und Kalender" auf "Testen" tippen. Fehlende Listen dort anlegen oder abweichende Entitäten eintragen, dann speichern.

## Anmeldung

Die App meldet sich wie das HA-Frontend selbst an (OAuth2 über `/auth/authorize`). Es wird kein Langzeit-Token gebraucht.

- Gespeichert wird ein Refresh-Token im Browser des Geräts. Die App holt sich damit alle 30 Minuten einen neuen Zugriffstoken.
- In HA erscheint die Anmeldung unter Profil, Sicherheit, Aktualisierungstoken, mit der HA-Adresse als Client. Dort lässt sie sich auch widerrufen.
- "Abmelden" in den Einstellungen widerruft den Refresh-Token in HA und löscht ihn auf dem Gerät.
- Jede Person meldet sich mit dem eigenen HA-Konto an. Ein Konto ohne Adminrechte reicht.
- Die App muss unter derselben Adresse laufen wie HA (`/local/…`). Wird HA über zwei Adressen aufgerufen (z. B. intern und Tailscale), ist das für den Browser jeweils eine eigene App mit eigener Anmeldung.

## 3. Zum Homescreen hinzufügen

Service Worker und Installation als App funktionieren nur über HTTPS (Nabu Casa, Tailscale mit HTTPS oder Reverse Proxy). Über reines `http://` läuft die App inklusive Anmeldung normal im Browser, lässt sich aber nicht richtig installieren.

- iPhone (Safari): Teilen, Zum Home-Bildschirm
- Android (Chrome): Menü, App installieren

## 4. Update

1. Dateien im Ordner ersetzen.
2. Bei eigenen Änderungen die Version an zwei Stellen gleich erhöhen: `CACHE_VERSION` in `sw.js` und `APP_VERSION` in `version.js`.
3. Beim nächsten Öffnen lädt der Service Worker die neue Version komplett im Hintergrund und meldet "Neue Version installiert" mit "Neu laden".

Hängt ein Gerät trotzdem auf der alten Version: Einstellungen, "Cache leeren". Startet die App gar nicht, räumt der Startschutz (`boot.js`) Service Worker und Cache einmal selbst auf und lädt neu. Klappt das nicht, erscheint eine Meldung mit "Zurücksetzen und neu laden".

## Diagnose

`https://<deine-ha-adresse>/local/essensplaner/diag.html` zeigt die Versionen auf dem Server, Service Worker, Caches, Anmeldung, Offline-Stand und ob alle Dateien erreichbar sind. "Reparieren" setzt die App zurück. Die Seite läuft auch, wenn die App leer bleibt.

## Wie die Daten gespeichert werden

- Rezept: Eintrag in `todo.gerichte`, Name im Titel, alles andere als JSON in der Beschreibung (Kategorie, Küche, Aufwand, Portionen, Zutaten, Tags, Bewertung, Favorit, Notiz).
- Plan: Termin in `calendar.essensplan`, Gerichtname im Titel, in der Beschreibung die UID des Rezepts, Mahlzeit, Status (geplant oder gekocht) und Portionen. Ein umbenanntes Rezept bleibt dadurch verknüpft.
- Gemeinsame Einstellungen (Kategorien, Küchen, Einheiten, Mahlzeiten und Zeiten, Standard-Portionen): ein Eintrag "config" in `todo.essensplaner_config`. Fehlt er, legt die App ihn selbst an.
- Von Hand in HA geschriebene Rezepte ohne JSON werden angezeigt, der Text erscheint als Notiz.
- Unbekannte JSON-Felder bleiben beim Speichern erhalten.

## Funktionen in v1

- Wochenplan: Beim Öffnen immer heute plus 4 Tage (5 Tage), alternativ die ganze Woche (Montag bis Sonntag). Jeder Tag steht einmal in einer Liste, heute ist hervorgehoben und zeigt die volle Karte mit Zutaten, die übrigen Tage sind kompakt mit Haken und Menü. Der kleine Knopf neben dem Datum schaltet zwischen "5 Tage" und "Woche" um. Mit den Pfeilen blättert man um 5 Tage (bzw. eine Woche), "Heute" springt zurück. Planen per Rezeptauswahl oder als freier Eintrag, als gekocht markieren, verschieben, Portionen und Notiz, löschen
- Rezepte: Suche (Name, Zutat, Tag), Filter, Sortierung, anlegen, bearbeiten, löschen, einplanen
- Auswertung: Häufigkeit und zuletzt gekocht, lange nicht gekocht, Verteilung nach Kategorie und Aufwand
- Einkaufsliste: Zutaten der geplanten Gerichte im angezeigten Zeitraum ab heute, auf Portionen umgerechnet und zusammengefasst, Vorschau, dann auf die Einkaufsliste

## Hinweise und Grenzen

- Die dunkle Leiste unten auf Android greift erst, wenn Chrome das geänderte Manifest übernommen hat. Das kann etwas dauern. Schneller geht es, wenn man die App vom Homescreen entfernt und neu hinzufügt.

- Ohne Verbindung zeigt die App den letzten Stand mit Uhrzeit ("Stand: heute, 14:32") und sperrt Änderungen. Offline-Bearbeitung gibt es nicht. Beim Abmelden wird der gespeicherte Stand gelöscht.
- Die Zurück-Geste schließt offene Fenster. Woche, Rezepte, Auswertung und Einstellungen haben eigene Adressen (`#woche`, `#rezepte`, `#auswertung`, `#einstellungen`).
- Löschen von Einträgen und Rezepten geht ohne Rückfrage, dafür mit "Rückgängig". An HA geht das Löschen erst nach 6 Sekunden oder wenn die App in den Hintergrund geht.
- Schreibende Aktionen laufen nacheinander. Ein Doppeltipp legt nichts doppelt an.
- Links zu Rezepten werden nur mit http:// oder https:// gespeichert und geöffnet.
- Rezepte aktualisieren sich live, der Kalender beim Öffnen der App, beim Wochenwechsel und nach jeder eigenen Änderung.
- Wurde ein Rezept auf einem anderen Gerät geändert, fragt die App vor dem Überschreiben nach.
- Termine werden mit der Zeitzone des Geräts geschrieben. Stimmt sie nicht mit der HA-Zeitzone überein, können sich Uhrzeiten verschieben.
- Die Zutatenreihenfolge im Rezept ändert man mit den Pfeilen, nicht per Ziehen.
- Der Verbindungstest meldet, ob der Kalender Termine mit UID liefert. Ohne UID lassen sich Termine nicht ändern oder löschen. Der Test sagt das erst, wenn mindestens ein Termin existiert.
- Noch nicht enthalten: Bilder, Rezept-Import per Link, Nährwerte, Push-Nachrichten.
- Die Schriften liegen lokal als `font-<name>.woff2` im App-Ordner (SIL Open Font License, Texte gebündelt in `Fonts-LICENSE.txt`). Gewählt wird unter Einstellungen > Darstellung > Schrift.

## Gekocht und Portionen

- Vor jedem Gericht steht ein Kästchen. Leer heißt offen, grün mit Haken heißt gekocht. Antippen schaltet um. Es gibt keine eigene Zeile für "gekocht".
- Portionen wählt man mit den Knöpfen 1 bis 4, dahinter steht ein kleines Feld für andere Zahlen. Die Auswahl gibt es beim Planen, beim Einplanen aus dem Rezept und im Eintrag (drei Punkte). Vorgewählt ist die Standard-Anzahl aus den Einstellungen. Die Einkaufsliste rechnet die Zutaten damit auf die gewählten Portionen um.

## Wischen

Auf der Wochenansicht lassen sich Gerichte wischen (Touch und Maus):

- **Nach rechts:** als gekocht markieren, nochmal nach rechts macht es wieder offen
- **Nach links, halb:** auf einen anderen Tag verschieben (Fenster mit den nächsten 5 Tagen und einem Feld für ein anderes Datum, mit Rückgängig)
- **Nach links, ganz:** löschen (mit Rückgängig, an HA geht das Löschen erst nach 6 Sekunden)

Die Karte folgt dem Finger, der Hintergrund zeigt die Aktion (grün, orange, rot). Alles geht auch über die drei Punkte an der Karte.

## Export und Import

Einstellungen, Export und Import. Gerichte und Plan lassen sich als JSON-Text kopieren oder als Datei speichern, zum Beispiel um sie einer KI zu geben, und das Ergebnis wieder importieren. Der Export enthält eine Anleitung für die KI und die erlaubten Werte.

- **Gerichte:** Jedes Gericht hat seine `id` (die UID in HA). Beim Import wird zuerst über die `id` zugeordnet, sonst über den Namen (Groß und Kleinschreibung egal). Einträge ohne `id` und mit neuem Namen werden angelegt. Importieren ändert und ergänzt, es löscht nichts. Unbekannte Felder an bestehenden Gerichten bleiben erhalten.
- **Plan:** Termine werden über ihre `id` erkannt, sonst über Datum, Mahlzeit und Gerichtname. Das Gericht wird über `gericht_id` gefunden, sonst über den Namen. Ohne Treffer entsteht ein freier Eintrag. Beim Import in ein anderes Home Assistant (andere UIDs) klappt die Zuordnung deshalb über die Namen.
- **Vorschau:** Vor dem Schreiben zeigt die App, was neu, geändert, unverändert oder übersprungen wird und warum (zum Beispiel ungültiges Datum, unbekannte Mahlzeit, doppelter Name). Unbekannte Kategorien, Küchen und Einheiten lassen sich dabei in den Einstellungen mit anlegen.
- Der Import erkennt JSON auch in KI-Antworten mit Erklärtext oder Codeblock. Ein Plan-Export im Gerichte-Import (und umgekehrt) wird abgewiesen.
- Tipp: Vor einem größeren Import eine Sicherung exportieren.

## Einstellungen

Aufbau wie in der Merker-App: oben eine Statuskarte (Verbindung, Home-Assistant-Adresse, Version), darunter große Zeilen mit aktuellem Stand. Jede Zeile öffnet eine Unterseite (`#einstellungen/<seite>`), die Zurück-Geste führt zur Übersicht.

- **Listen und Kalender:** Entitäten eintragen, testen, fehlende anlegen, speichern
- **Mahlzeiten:** Mahlzeiten ein- und ausschalten, Namen und Zeiten, Standard-Portionen. Änderungen werden sofort in HA gespeichert und gelten für alle Geräte.
- **Rezeptdaten:** Kategorien, Küchen und Einheiten hinzufügen, umbenennen, entfernen. Umbenennen ändert nur den Namen. Wird ein Eintrag noch von Rezepten genutzt, fragt die App vor dem Entfernen nach.
- **Export und Import:** siehe oben
- **Darstellung:** Akzentfarbe wie in der Merker-App (eine Reihe runder Farben, ganz rechts die eigene Farbe mit Farbton-Regler und Hexcode, gespeichert wird nur der Farbton) und Erscheinungsbild Gerät, Hell oder Dunkel. Gilt nur auf diesem Gerät.
- **Daten neu laden**, **Cache leeren** (orange) und **Abmelden** (rot, mit Rückfrage)

## Änderungen

Neueste Version oben. Bei jeder Änderung einen neuen Abschnitt "### Version x.y.z" direkt unter dieser Zeile einfügen.

### Version 1.9.3

- Auswertung: Ohne Rezepte steht bei „Lange nicht gekocht“ jetzt „Noch keine Rezepte angelegt.“ statt eines falschen Hinweises.

### Version 1.9.2

- Freie Einträge: Ein Tipp auf einen Namen bietet drei Wege an: neues Gericht anlegen, mit einem vorhandenen Gericht verknüpfen oder ignorieren.
- Verknüpfen mit vorhandenem Gericht: Suchliste, ähnliche Namen stehen oben.
- Gibt es den Namen schon als Gericht, fragt das Formular, ob die Einträge damit verknüpft werden sollen. Das hilft auch nach einem Abbruch mittendrin.
- "Zu Gericht machen" am einzelnen Eintrag verknüpft jetzt ebenfalls alle Einträge mit diesem Namen.
- Ignorieren: Namen wie "Essen bei Oma" zählen nicht mehr als frei. Unten in der Liste stehen sie unter "Ignoriert" und lassen sich wieder anzeigen.
- Einträge, deren Gericht gelöscht wurde, erscheinen jetzt auch in der Liste (mit Hinweis "Gericht gelöscht") und lassen sich neu zuordnen.
- Bei mehr als vier Einträgen zeigt die App beim Verknüpfen den Fortschritt.

### Version 1.9.1

- Rezepte: Links neben dem Plus steht "Frei" mit der Anzahl der freien Einträge (Plan der letzten 12 Monate und Ablage, nach Namen zusammengefasst). Ein Tipp öffnet die Liste. Ein Eintrag daraus öffnet das Rezeptformular, nach dem Speichern sind alle Einträge mit diesem Namen mit dem neuen Gericht verknüpft.

### Version 1.9.0

- Freie Einträge lassen sich zu einem Gericht machen. Im Eintrag gibt es den Knopf "Zu Gericht machen". Er öffnet das Rezeptformular mit dem Namen, nach dem Speichern ist der Eintrag mit dem neuen Gericht verknüpft und es taucht in der Rezeptliste auf.

### Version 1.8.1

- Vorschau von "Füllen": Das Tauschen-Icon ist jetzt der Funken statt des Würfels.

### Version 1.8.0

- Neuer Knopf "Füllen" in der Wochenansicht. Er schlägt für alle freien Abende im angezeigten Zeitraum ein Gericht vor, nur Abend, Vergangenes bleibt leer.
- Gleiche Regeln wie bei den Vorschlägen: lange nicht gekocht, nichts doppelt in der Woche, Montag bis Donnerstag einfach, Kategorien gemischt. Schon Geplantes zählt mit.
- Gerichte aus der Ablage kommen zuerst dran und bleiben als eingekauft markiert.
- Die Vorschau zeigt jeden Tag. Würfel tauscht das Gericht, Kreuz lässt den Tag leer. Erst "Übernehmen" schreibt in den Kalender.
- Danach erscheint 15 Sekunden "Alles rückgängig". Das löscht genau die Einträge dieses Laufs und legt Ablage-Gerichte zurück.

### Version 1.7.5

- Kopfzeile mit Knopf: Wochentag, Tag und Datum stehen jetzt auf einer Grundlinie.

### Version 1.7.4

- Ist nur Mittag oder nur Abend geplant, steht der leere Platz als kleiner Knopf rechts in der Kopfzeile des Tages. Es gibt keine eigene Zeile mehr dafür.

### Version 1.7.3

- Beim Einplanen aus der Ablage sind belegte Plätze jetzt auch als "belegt" markiert, wie beim Verschieben.
- Die Knöpfe unten im Einplanen-Fenster stehen untereinander.

### Version 1.7.2

- Die Ablage ist immer sichtbar. Ohne Einträge zeigt sie eine schmale Zeile mit "Hinzufügen", damit man jederzeit ein Gericht ohne Tag ablegen kann.
- Tage ohne geplante Mahlzeit sind eine einzige schmale Zeile: Datum links, Mittag und Abend rechts nebeneinander. Das spart viel Scrollen.
- Leere Plätze neben einem geplanten Gericht sind etwas niedriger.

### Version 1.7.1

- Verschieben: Plätze, an denen schon ein Gericht steht, sind mit "belegt" markiert (gestrichelt, in Akzentfarbe). Verschieben geht dort weiter.
- Die zwei Knöpfe unten stehen untereinander und berühren sich nicht mehr.
- Die Ablage ist in Akzentfarbe hervorgehoben, in der Leiste und in der Auswahl beim Planen.

### Version 1.7.0
- Ablage für Gerichte ohne festen Tag (meist schon eingekauft). Im Wochenplan erscheint oben eine Leiste mit Chips, sobald etwas in der Ablage liegt. Ein Tipp auf einen Chip öffnet die Tagesauswahl. Beim Planen stehen die Gerichte aus der Ablage ganz oben.
- Wege in die Ablage: beim Planen der Haken "Eingekauft, Tag später wählen", das Plus in der Leiste, oder im Verschieben-Fenster "Ohne Tag (Ablage)".
- Die Ablage liegt als `ablage` in der gemeinsamen Config.

### Version 1.6.4
- Gekochte Gerichte zeigen im Wochenplan nur noch den Titel (ohne Mahlzeit, Kategorie, Dauer, Portionen, Zutaten und Notiz). Details bleiben über die drei Punkte erreichbar.

### Version 1.6.3
- Sicherheit: Content Security Policy in `index.html` (nur eigene Skripte, keine Inline-Skripte, Verbindungen nur zum eigenen Home Assistant). Datum aus Kalendereinträgen wird auf das Format JJJJ-MM-TT geprüft. Angriffstest mit Schadtext in allen Datenfeldern (Rezepte, Termine, Config, Entitätsnamen, Einkaufsliste, Import) ohne Befund.

### Version 1.6.2
- Prüfung: Eingekauft-Knopf gegen Doppeltipp geschützt. Freie Einträge ohne Zutaten werden beim Senden nicht als eingekauft markiert. Export und Import des Plans enthalten jetzt `eingekauft`. Bei drei Mahlzeiten brechen die Knöpfe beim Planen und Verschieben sauber um.

### Version 1.6.1
- Verschieben: Bei mehreren Mahlzeiten hat jeder Tag einen Knopf pro Mahlzeit, auch der aktuelle Tag. So geht Mittag nach Abend und umgekehrt. Beim freien Datum gibt es zusätzlich die Mahlzeit zur Auswahl. Rückgängig stellt Tag und Mahlzeit wieder her.

### Version 1.6.0
- Gekocht wird mit einer Kochmütze statt einem Haken markiert (dunkel gefüllt = gekocht).
- Neu: Markierung "eingekauft" (Tasche unter der Kochmütze, grün = eingekauft). Antippen schaltet um. Wer Zutaten über die Einkaufsliste sendet, markiert die beteiligten Gerichte automatisch als eingekauft. Eingekaufte Gerichte fehlen bei der nächsten Einkaufsliste, ein Hinweis nennt die Anzahl. Gespeichert als `eingekauft` im Kalendereintrag.

### Version 1.5.1
- Grundvorrat: Neue Einstellungsseite "Einkaufsliste" mit zwei Listen. "Nie auf die Einkaufsliste" (Standard: Salz, Pfeffer, Öl, Essig, Gewürze, Pulver usw.) fällt aus der Auswahl ganz raus, auch für Wörter, die so enden (Olivenöl, Paprikapulver). "Nur optional" (Standard: Mehl, Zucker, Zwiebel, Knoblauch) erscheint mit "Vorrat prüfen" und ist nicht vorausgewählt, auch für Wörter, die so beginnen (Knoblauchzehe). Die Listen liegen in der gemeinsamen Config.

### Version 1.5.0
- Vorschläge beim Planen: Ohne Suchtext stehen oben drei Gerichte mit "Vorschlag". Bevorzugt werden Gerichte, die schon gekocht wurden und lange her sind. Was in den 6 Tagen davor oder danach schon geplant ist, fällt raus. Die Kategorien der Woche werden berücksichtigt (nicht zu viel Fleisch, Fisch höchstens einmal, nach zwei Fleischtagen bevorzugt vegetarisch oder vegan). Montag bis Donnerstag nur Gerichte mit Aufwand einfach. Die drei Vorschläge haben möglichst unterschiedliche Kategorien.

### Version 1.4.10
- Freie Einträge (ohne Rezept): Name lässt sich im Eintrag-Fenster (drei Punkte) ändern.

### Version 1.4.9
- "Heute" im Wochenplan ist in der Akzentfarbe hinterlegt.

### Version 1.4.8
- Icon-Dateien korrigiert (in 1.4.7 waren sie leer/weiß).

### Version 1.4.7
- Neues App-Icon: roter Hummer auf Off-White (auch als runde Android-Variante mit Schutzzone).

### Version 1.4.6
- Einkaufsliste-Knopf sitzt oben neben den Pfeilen, gleich groß wie diese, mit dunklem Rand. "Heute" (nach dem Blättern) steht jetzt in der Zeile darunter.
- Mehrere leere Mahlzeiten eines Tages stehen nebeneinander statt untereinander.

### Version 1.4.5
- Nach dem Einplanen kommt statt der Frage ein kurzer Hinweis unten mit dem Knopf "Zutaten einkaufen". Er verschwindet nach 6 Sekunden von selbst.

### Version 1.4.4
- Nach dem Einplanen eines Gerichts mit Zutaten fragt die App, ob die Zutaten auf die Einkaufsliste sollen. "Ja" öffnet die Einkaufsliste nur für dieses Gericht.
- Einkaufsliste: Zutaten, die schon auf der Liste stehen, sind grün hinterlegt mit "schon drauf" und oben gezählt. Der Vergleich erkennt einfache Mehrzahl (Zwiebel = Zwiebeln).

### Version 1.4.3
- Wochenplan: Antippen der Zutaten öffnet das Gericht.
- Knopf für die Einkaufsliste sitzt oben neben "5 Tage" (nur wenn eine Einkaufsliste eingetragen ist), der große Knopf am Listenende entfällt.

### Version 1.4.2
- Listen und Kalender: Jedes Feld ist eine Auswahlliste der vorhandenen Entitäten (nach Namen sortiert), "Andere ID eingeben" blendet ein Textfeld ein.
- "Bring-Liste" heißt jetzt "Einkaufsliste", es geht jede To-do-Liste.

### Version 1.4.0
- Neuer Stil: warmes Off-White, weiße Karten mit feinem Rand, Kategorie als farbige Markierung hinter dem Gerichtsnamen, gekochte Gerichte durchgestrichen, helle Navigation.
- Figtree ist die neue Standardschrift.
- Fehler behoben: Beim Planen rutschte das Fenster mit wenigen Treffern unter die Bildschirmtastatur.

### Version 1.3.1
- Design A ohne schwarze Rahmen: Kacheln, Listen und Eingabefelder sind reine Farbflächen.

### Version 1.3.0
- Neues Design "Kacheln": eckig, dicke Ränder, flache Farbflächen je Kategorie (Fleisch orange, Vegetarisch grün, Fisch blau, sonst violett), dunkle Navigation mit gelbem aktivem Reiter, im Dunkelmodus angepasste Farben.
- Schriftauswahl unter Einstellungen > Darstellung > Schrift (Archivo als Standard, dazu Space Grotesk, Work Sans, DM Sans, Manrope, Figtree, Bricolage Grotesque, Inter, System).

### Version 1.2.1
- Akzentfarbe wie in Merker: Reihe runder Farben, eigene Farbe per Farbton-Regler und Hexcode (statt Farbfeldern mit Namen). Ältere Auswahl wird übernommen
- Verschieben: die nächsten 5 Tage und darunter ein Feld für ein anderes Datum
- Fenster scrollen jetzt, wenn der Inhalt höher ist als der Bildschirm. Vorher wurde die Liste abgeschnitten (Verschieben, lange Rezeptlisten)

### Version 1.2.0
- Akzentfarbe frei wählbar (Farbwähler), Hell und Dunkel werden mit gutem Kontrast abgeleitet
- Standardansicht heute plus 4 Tage, also 5 Tage, Knopf heißt "5 Tage", Blättern um 5 Tage
- Kästchen vor jedem Gericht: leer für offen, grün mit Haken für gekocht, antippen schaltet um

### Version 1.1.1
- Gekocht als grüner Haken vor dem Gerichtsnamen statt als eigene Zeile
- Portionen als Knöpfe 1 bis 4 mit kleinem Feld für andere Zahlen, beim Planen, Einplanen und im Eintrag
- Umschalter heißt "+5 Tage" statt "6 Tage"
- Meldungen am unteren Rand brechen nicht mehr in einer schmalen Spalte um

### Version 1.1.0
- Wischgesten statt Knöpfen: rechts gekocht, halb links verschieben, ganz links löschen
- Export und Import für Gerichte und Plan (JSON, auch für KIs), mit Vorschau und Prüfung der Zuordnung über UID und Name
- Eigene Akzentfarbe (Standard Terrakotta) mit sechs Farben zur Auswahl
- Gerichte auf der Wochenansicht farbig nach Kategorie
- Umschalter Heute + 5 Tage / Woche als dezenter Knopf neben dem Datum
- Gericht planen: Tastatur sofort offen, Suche und freier Eintrag in einem Feld (der Text steht als erste Zeile)
- "Morgen" zeigt den Wochentag dazu
- Android, dunkles Design: untere Leiste nicht mehr weiß (dunkle Farben im Manifest, wie bei Merker)

### Version 1.0.7
- Wochenplan neu: alle Tage untereinander in einer Liste (keine Tagesleiste und keine zweite Liste mehr, keine doppelten Tage), heute oben und hervorgehoben
- Standard ist heute plus 5 Tage, die Woche ist per Umschalter wählbar. Beim Öffnen beginnt die App immer wieder mit heute plus 5 Tage
- Andere Tage als kompakte Karten, heute mit Zutaten und großem Knopf
- Einkaufsliste nimmt den angezeigten Zeitraum
- Einplanen aus der Rezeptliste verschiebt die Wochenansicht nicht mehr

### Version 1.0.6
- Einstellungen im Stil der Merker-App, in eigener Datei `settings.js`
- Mahlzeiten, Kategorien, Küchen und Einheiten werden direkt bearbeitet und sofort gespeichert (vorher Textfelder mit Speichern-Knopf)
- Erscheinungsbild Gerät, Hell oder Dunkel
- Abmelden mit Rückfrage als Fenster
- Ein aus der Config entfernter Wert bleibt im Rezeptformular als "(entfernt)" auswählbar, statt beim Speichern still zu verschwinden

### Version 1.0.5
- Keine Unterordner mehr: Icons und Schrift liegen direkt im App-Ordner. Manche Dateimanager konnten die Unterordner beim Kopieren aus der ZIP auf eine SMB-Freigabe nicht anlegen.

### Version 1.0.4
- Zurück-Geste schließt Fenster, Ansichten mit eigener Adresse
- Startschutz (`boot.js`) und Diagnoseseite (`diag.html`)
- Service Worker cache-first mit vollständigem Cache je Version, Hinweis bei neuer Version
- Offline lesen mit letztem Stand
- Rückgängig beim Löschen und beim Abhaken statt Rückfrage
- Statuszeile in den Einstellungen, Abmelden mit Rückfrage
- Verständliche Meldung, wenn HA das Anlegen einer Liste abbricht
- Version steht nur noch in `version.js` und `sw.js`

### Version 1.0.3
- Button "App neu laden" (Einstellungen und Anmeldebildschirm): meldet nur den eigenen Service Worker ab, leert den App-Cache, frischt die App-Dateien auf und startet neu

### Version 1.0.2
- Fehlende To-do-Listen und Kalender lassen sich aus dem Verbindungstest heraus anlegen (Admin-Konto nötig)
- Aufwand kann leer bleiben ("keine Angabe"), bisher wurde beim Bearbeiten "einfach" gesetzt

### Version 1.0.1
- Anmeldung über die HA-Anmeldeseite statt Langzeit-Token, mit automatischer Erneuerung und Abmelden
- Rezept-Links nur noch mit http/https (vorher konnte ein `javascript:`-Link Code ausführen)
- Doppeltipps auf schreibende Aktionen werden ignoriert
- Live-Updates überschreiben keine offenen Eingaben mehr (Einstellungen, Rezeptsuche)
- Zutaten ohne Menge gehen ohne einzelne Einheit auf die Einkaufsliste
