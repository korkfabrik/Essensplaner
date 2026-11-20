"""Fehlerfälle: HA lehnt Schreiben ab (Woche füllen meldet es und bietet Entfernen an), Ablage-Suche ohne
Groß-/Kleinschreibung, Config-Änderung eines anderen Geräts geht beim eigenen Speichern nicht verloren."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start


def patch(js):
    # Daten des nachgebauten HA von außen erreichbar machen und Anlegen ab dem n-ten Termin ablehnen lassen
    js = js.replace('class FW{', 'window.__R=R;class FW{', 1)
    js = js.replace("if(m.type==='calendar/event/create'){",
                    "if(m.type==='calendar/event/create'&&window.__failAfter!=null&&window.__failAfter--<=0)"
                    "{r({id:m.id,type:'result',success:false,error:{message:'HA sagt nein'}});return}"
                    "if(m.type==='calendar/event/create'){", 1)
    return js


with start(patch=patch) as T:
    pg, J, ok, errs, U = T.pg, T.J, T.ok, T.errs, T.U
    ok('Fake-Daten erreichbar', J("!!window.__R"))
    pg.goto(U + '#woche'); pg.wait_for_timeout(1000)
    cards0 = J("document.querySelectorAll('.ecard').length")

    # 1) Woche füllen: erster Abend klappt, dann lehnt HA ab
    J("document.querySelector('[data-a=fillopen]').click()"); pg.wait_for_timeout(400)
    n = J("document.querySelectorAll('.fillrow').length")
    ok('Vorschau mit mehreren Abenden', n >= 2, n)
    J("window.__failAfter=1")
    J("document.querySelector('[data-a=fillok]').click()"); pg.wait_for_timeout(1200)
    t = J("document.getElementById('toast').textContent")
    ok('Abbruch wird gemeldet', 'abgebrochen nach 1 Abend' in t and 'HA sagt nein' in t, t)
    ok('Fehlermeldung rot', 'err' in J("document.getElementById('toast').className"))
    ok('Fenster geschlossen', J("document.getElementById('sheet').hidden"))
    ok('Ein Abend angelegt', J("document.querySelectorAll('.ecard').length") == cards0 + 1)
    J("window.__failAfter=null")
    J("document.querySelector('#toast button').click()"); pg.wait_for_timeout(1000)
    ok('Entfernen räumt auf', J("document.querySelectorAll('.ecard').length") == cards0)

    # 2) Ablage-Suche im Picker
    J("document.querySelector('[data-a=abadd]').click()"); pg.wait_for_timeout(300)
    pg.fill('#pq', 'Fertigpizza'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
    hits = {}
    for q in ['fertig', 'Fertig', 'FERTIGPIZZA']:
        pg.fill('#pq', q); pg.wait_for_timeout(200)
        hits[q] = J("document.querySelectorAll('#plist [data-a=pickablage]').length")
    ok('Ablage-Suche ohne Groß-/Kleinschreibung', all(v == 1 for v in hits.values()), hits)
    J("document.querySelector('[data-a=closesheet]').click()"); pg.wait_for_timeout(300)

    # 3) Anderes Gerät legt etwas in die Ablage, dieses Gerät weiß davon noch nichts
    J("(()=>{const c=window.__R.config; c.ablage=(c.ablage||[]).concat([{id:'fremd1',name:'Vom anderen Handy',gericht_uid:null,portionen:2,eingekauft:true}]);})()")
    J("document.querySelector('[data-a=abadd]').click()"); pg.wait_for_timeout(300)
    pg.fill('#pq', 'Suppe vom Vortag'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1000)
    names = J("window.__R.config.ablage.map(a=>a.name)")
    ok('Fremde Änderung bleibt erhalten', 'Vom anderen Handy' in names and 'Suppe vom Vortag' in names and 'Fertigpizza' in names, names)
    ok('Ablage-Leiste zeigt alle drei', J("document.querySelectorAll('.abl-chip:not(.add)').length") == 3)
    ok('Keine JS-Fehler', not [e for e in errs if 'HA sagt nein' not in e], errs[:5])
