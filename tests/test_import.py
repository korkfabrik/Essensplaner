"""Import über Einstellungen > Daten: Vorschau zählt richtig, Schreiben legt neue Gerichte und Termine an,
ändert vorhandene, legt unbekannte Kategorien an, überspringt Ungültiges und meldet Fehler einzelner Einträge.
Läuft gegen die Beispieldaten (heute ist Samstag, 14.11.2026)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start


def patch(js):
    # Fake-Daten erreichbar machen, Anlegen eines Gerichts namens "Klappt nicht" ablehnen
    js = js.replace('class FW{', 'window.__R=R;class FW{', 1)
    return js.replace(
        "if(m.type==='call_service'&&m.service==='add_item'&&",
        "if(m.type==='call_service'&&m.service==='add_item'&&m.service_data&&m.service_data.item==='Klappt nicht')"
        "{r({id:m.id,type:'result',success:false,error:{message:'HA sagt nein'}});return}"
        "if(m.type==='call_service'&&m.service==='add_item'&&", 1)


GERICHTE = {'format': 'essensplaner-gerichte', 'gerichte': [
    {'name': 'Testauflauf', 'kategorie': 'Auflauf', 'kueche': 'Deutsch', 'aufwand': 'einfach', 'portionen': '3',
     'zutaten': ['200 g Käse', '2 Eier', 'Prise Salz'], 'tags': 'schnell, ofen', 'rezept_url': 'javascript:alert(1)'},
    {'id': 'g0', 'name': 'Bandnudeln mit Pilzrahm', 'aufwand': 3},   # vorhanden, Aufwand geändert
    {'name': 'brotzeit'},                                              # am Namen erkannt, nichts geändert, nicht umbenannt
    {'name': ''},                                                      # ohne Namen
    {'name': 'Testauflauf'},                                           # doppelt in der Datei
    {'name': 'Klappt nicht'},                                          # HA lehnt ab
]}

PLAN = {'termine': [
    {'datum': '2026-11-16', 'mahlzeit': 'abend', 'gericht': 'Kürbisrisotto', 'portionen': 2},
    {'datum': '2026-11-17', 'gericht': 'Pizza beim Italiener'},
    {'id': 'w1', 'datum': '2026-11-18', 'mahlzeit': 'Abend', 'gericht': 'Chili con Carne', 'status': 'gekocht'},
    {'datum': '2026-13-01', 'gericht': 'Ungültiges Datum'},
    {'datum': '2026-11-16', 'mahlzeit': 'nacht', 'gericht': 'Unbekannte Mahlzeit'},
]}

with start(patch=patch) as T:
    pg, J, ok, errs, U, OUT = T.pg, T.J, T.ok, T.errs, T.U, T.OUT

    def import_text(kind, payload):
        pg.goto(U + '#einstellungen/daten'); pg.wait_for_timeout(700)
        J("document.querySelector('[data-a=%s]').click()" % kind); pg.wait_for_timeout(300)
        pg.fill('#imp_text', 'Hier ist das Ergebnis:\n```json\n' + json.dumps(payload, ensure_ascii=False) + '\n```')
        J("document.querySelector('[data-a=impcheck]').click()"); pg.wait_for_timeout(400)
        return J("document.querySelector('.sheet').innerText")

    def sent(js_filter):
        return J("(window.__sent||[]).filter(m=>%s)" % js_filter)

    # ----- Gerichte -----
    pv = import_text('impgerichte', GERICHTE)
    T.shot('import-gerichte.png')
    ok('Vorschau Gerichte zählt richtig', '2 neu · 1 geändert · 1 unverändert · 2 übersprungen' in pv, pv[:300])
    ok('Vorschau nennt Gründe', 'Name fehlt' in pv and 'doppelt' in pv, pv[:500])
    ok('Warnung zum unsicheren Link', 'Link bei „Testauflauf“ ignoriert' in pv, pv[:500])
    ok('Unbekannte Kategorie wird angeboten', 'Kategorie Auflauf' in pv and J("document.getElementById('imp_addunknown').checked"))
    J("document.querySelector('[data-a=impapply]').click()"); pg.wait_for_timeout(1500)

    add = sent("m.service==='add_item'&&m.service_data.item==='Testauflauf'")
    d = json.loads(add[0]['service_data']['description']) if add else {}
    ok('Neues Gericht geschrieben', len(add) == 1, add)
    ok('Kategorie, Küche, Aufwand, Portionen übernommen',
       (d.get('kategorie'), d.get('kueche'), d.get('aufwand'), d.get('portionen')) == ('auflauf', 'deutsch', 1, 3), d)
    ok('Zutaten aus Text erkannt', d.get('zutaten') == [{'name': 'Käse', 'menge': 200, 'einheit': 'g'}, {'name': 'Eier', 'menge': 2, 'einheit': ''},
                                                       {'name': 'Prise Salz', 'menge': 0, 'einheit': ''}], d.get('zutaten'))
    ok('Tags getrennt, unsicherer Link leer', d.get('tags') == ['schnell', 'ofen'] and d.get('rezept_url') == '', (d.get('tags'), d.get('rezept_url')))
    upd = sent("m.service==='update_item'&&m.service_data.item==='g0'")
    u = json.loads(upd[0]['service_data']['description']) if upd else {}
    ok('Vorhandenes Gericht geändert, Zutaten bleiben', u.get('aufwand') == 3 and len(u.get('zutaten', [])) == 7, u)
    ok('Unverändertes Gericht nicht geschrieben', not sent("m.service==='update_item'&&m.service_data.item==='g2'"))
    cats = J("window.__R.config.kategorien.map(k=>k.key+':'+k.label)")
    ok('Kategorie in der Config angelegt', 'auflauf:Auflauf' in cats, cats)
    t = J("document.getElementById('toast').textContent")
    ok('Fehler einzelner Einträge gemeldet', '2 importiert, 1 fehlgeschlagen: Klappt nicht (HA sagt nein)' in t, t)
    pg.goto(U + '#rezepte'); pg.wait_for_timeout(600)
    pg.fill('#rq', 'testauflauf'); pg.wait_for_timeout(300)
    ok('Neues Gericht in der Rezeptliste', J("document.querySelectorAll('[data-a=rdetail]').length") == 1)

    # ----- Plan -----
    pv = import_text('impplan', PLAN)
    T.shot('import-plan.png')
    ok('Vorschau Plan zählt richtig', '2 neu · 1 geändert · 0 unverändert · 2 übersprungen' in pv, pv[:300])
    ok('Vorschau: verknüpft und frei', '2 mit einem Gericht verknüpft, 1 freie Einträge' in pv, pv[:400])
    ok('Vorschau nennt Gründe', 'Datum fehlt oder ist ungültig' in pv and 'Unbekannte Mahlzeit' in pv, pv[:600])
    ok('Warnung freier Eintrag', 'Pizza beim Italiener' in pv and 'freier Eintrag' in pv, pv[:600])
    J("document.querySelector('[data-a=impapply]').click()"); pg.wait_for_timeout(1500)

    cr = sent("m.type==='calendar/event/create'")
    byname = {c['event']['summary']: c['event'] for c in cr}
    risotto = json.loads(byname['Kürbisrisotto']['description']) if 'Kürbisrisotto' in byname else {}
    ok('Zwei Termine angelegt', sorted(byname) == ['Kürbisrisotto', 'Pizza beim Italiener'], sorted(byname))
    ok('Risotto verknüpft, Portionen und Zeit', risotto.get('gericht_uid') == 'g37' and risotto.get('portionen') == 2
       and byname['Kürbisrisotto']['dtstart'].startswith('2026-11-16T18:00'), (risotto, byname.get('Kürbisrisotto', {}).get('dtstart')))
    pizza = json.loads(byname['Pizza beim Italiener']['description']) if 'Pizza beim Italiener' in byname else {}
    ok('Freier Eintrag ohne Gericht, erste aktive Mahlzeit', pizza.get('gericht_uid') is None and pizza.get('slot') == 'mittag', pizza)
    up = sent("m.type==='calendar/event/update'&&m.uid==='w1'")
    w1 = json.loads(up[0]['event']['description']) if up else {}
    ok('Vorhandener Termin verschoben und gekocht', bool(up) and up[0]['event']['dtstart'].startswith('2026-11-18T18:00') and w1.get('status') == 'gekocht'
       and w1.get('gericht_uid') == 'g4', (up[:1], w1))
    t = J("document.getElementById('toast').textContent")
    ok('Rückmeldung Plan', 'Import fertig: 2 neu, 1 geändert' in t, t)
    pg.goto(U + '#woche'); pg.wait_for_timeout(800)
    names = J("[...document.querySelectorAll('.ecard h2')].map(h=>h.textContent)")
    ok('Wochenplan zeigt die neuen Termine', 'Kürbisrisotto' in names and 'Pizza beim Italiener' in names, names)
    ok('Keine JS-Fehler', not [e for e in errs if 'HA sagt nein' not in e], errs[:5])
