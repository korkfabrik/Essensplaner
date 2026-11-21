# Essensplaner aus GitHub nach Home Assistant holen

Einmal einrichten. Danach holt HA die neueste Version von `main` nach `/config/www/essensplaner`, sobald dort ein neuer Commit landet. Zusätzlich gibt es einen Knopf zum Aktualisieren von Hand. Die App zeigt beim nächsten Öffnen "Neue Version installiert" mit "Neu laden".

Gleicher Aufbau wie bei Merker. Wer Merker schon so eingerichtet hat, kennt alle Schritte. Die GitHub-Integration aus Schritt 4 gibt es dann schon, dort kommt nur das zweite Repository dazu.

Du brauchst Zugriff auf die Dateien in `/config`, zum Beispiel mit dem Add-on "File editor" oder "Studio Code Server". Das Repository muss öffentlich sein (sonst siehe "Privates Repository" unten).

## 1. Skript ablegen

Im Ordner `/config/scripts` (bei Merker schon angelegt) die Datei `essensplaner_update.sh` anlegen und den Inhalt von `ha/essensplaner_update.sh` aus diesem Repository hineinkopieren (auf GitHub die Datei öffnen, "Raw", alles kopieren).

Das Skript prüft vor dem Austausch, ob `version.js` und `sw.js` dieselbe Version tragen. Passt das nicht oder fehlt etwas, bricht es ab und lässt die installierte App in Ruhe.

## 2. configuration.yaml

In `/config/configuration.yaml` unter dem vorhandenen `shell_command:` (von Merker) eine Zeile ergänzen, mit zwei Leerzeichen eingerückt:

```yaml
shell_command:
  merker_update: "sh /config/scripts/merker_update.sh"
  essensplaner_update: "sh /config/scripts/essensplaner_update.sh"
```

Danach Entwicklerwerkzeuge → YAML → "Konfiguration prüfen", dann "Neu starten". Neu laden reicht nicht.

Test: Entwicklerwerkzeuge → Aktionen → `shell_command.essensplaner_update` → "Aktion ausführen". Die Antwort muss `returncode: 0` und `stdout: Essensplaner x.y.z installiert` enthalten.

## 3. Skript "Essensplaner aktualisieren" (der Knopf)

Einstellungen → Automatisierungen & Szenen → Reiter **Skripte** (nicht Automatisierungen) → "Skript hinzufügen" → "Neues Skript erstellen" → ⋮ → "In YAML bearbeiten", alles ersetzen durch:

```yaml
alias: Essensplaner aktualisieren
description: Holt die neueste Version aus GitHub nach /config/www/essensplaner
mode: single
sequence:
  - action: shell_command.essensplaner_update
    response_variable: result
    continue_on_error: true
  - action: notify.mobile_app_p9p
    data:
      title: 🍽️ Essensplaner
      message: >-
        {% if result is defined and result.returncode == 0 %}✅ {{ result.stdout }}
        {% else %}⚠️ Update fehlgeschlagen: {{ (result.stderr or result.stdout) if result is defined else 'keine Antwort' }}{% endif %}
```

Speichern. Die Entität heißt `script.essensplaner_aktualisieren` und lässt sich als Knopf aufs Dashboard legen. Die Nachricht geht an das Pixel. Ohne Nachricht den zweiten Schritt (`notify…`) löschen.

## 4. GitHub-Integration

Einstellungen → Geräte & Dienste → **GitHub** → "Konfigurieren" und zusätzlich `korkfabrik/Essensplaner` auswählen. Ist die Integration noch nicht da: "Integration hinzufügen" → GitHub, den angezeigten Code unter `github.com/login/device` eingeben, dann wie beschrieben das Repository auswählen.

Es entsteht ein Gerät "korkfabrik/Essensplaner" mit dem Sensor "Letzter Commit". Seine Entitäts-ID steht nach Antippen unter dem Zahnrad.

## 5. Automation: Update bei neuem Commit

Reiter **Automatisierungen** → Neue Automation → ⋮ → "In YAML bearbeiten". `sensor.PLATZHALTER_ESSENSPLANER_LETZTER_COMMIT` durch die ID aus Schritt 4 ersetzen:

```yaml
alias: Essensplaner bei neuem Commit aktualisieren
description: Holt die App nach jedem neuen Commit auf main aus GitHub
triggers:
  - trigger: state
    entity_id: sensor.PLATZHALTER_ESSENSPLANER_LETZTER_COMMIT
    attribute: sha
conditions:
  - condition: template
    value_template: >-
      {{ trigger.from_state is not none
         and trigger.from_state.state not in ['unknown', 'unavailable']
         and trigger.to_state.state not in ['unknown', 'unavailable'] }}
actions:
  - action: script.essensplaner_aktualisieren
mode: single
```

Hat der Sensor kein Attribut `sha`, die Zeile `attribute: sha` löschen. Dann löst eine neue Commit-Nachricht aus.

Die Integration fragt GitHub regelmäßig ab. Ein Update kommt deshalb einige Minuten nach dem Push. Ob die Automation gelaufen ist: Automation öffnen → ⋮ → "Traces".

## Privates Repository

Ist das Repository privat, braucht das Skript einen Token mit Leserecht: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Repository access: nur dieses Repository. Permissions: Contents = Read-only. Den Token als einzige Zeile in `/config/.essensplaner_github_token` schreiben. Die GitHub-Integration sieht ein privates Repository nicht. Dann statt Schritt 4 und 5 den Knopf aus Schritt 3 nutzen oder das Skript per Zeit-Auslöser starten.

## Fehler

- "Not a valid option at sequence": YAML eines Skripts im Automations-Editor eingefügt. Reiter **Skripte** nehmen.
- `shell_command.essensplaner_update` fehlt bei den Aktionen: Neustart nach Schritt 2 vergessen oder Einrückung in `configuration.yaml` falsch.
- `curl: (22) ... 404`: Repository privat und kein gültiger Token, oder `REPO` im Skript falsch geschrieben.
- "Version passt nicht": Auf `main` liegt ein Stand, bei dem `version.js` und `sw.js` nicht übereinstimmen. Die installierte App bleibt, wie sie war. Im Repository beide Versionen angleichen.

## Zurück zur vorigen Version

Die vorige Version liegt nach jedem Update unter `/config/essensplaner_backup`. Zurück: Ordner `/config/www/essensplaner` löschen und `/config/essensplaner_backup` dorthin umbenennen. Am Handy danach in der App unter Einstellungen "Cache leeren" tippen.
