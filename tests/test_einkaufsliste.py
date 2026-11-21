"""Einkaufsliste: Mengen nach Portionen umrechnen und zusammenfassen, Grundvorrat (nie / optional),
schon auf der Liste, nur offene Gerichte ab heute, Tage abwählen, Senden an die Liste und
Gerichte danach als eingekauft markieren.

Eigene kleine Testdaten, damit sich jede Menge nachrechnen lässt. Heute ist Samstag, 14.11.2026."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start


def rec(uid, name, portionen, zutaten):
    return {'uid': uid, 'summary': name, 'status': 'needs_action',
            'description': json.dumps({'kategorie': 'vegetarisch', 'aufwand': 1, 'portionen': portionen, 'zutaten': zutaten, 'tags': []})}


def z(name, menge=0, einheit='', optional=False):
    d = {'name': name, 'menge': menge, 'einheit': einheit}
    if optional:
        d['optional'] = True
    return d


def ev(uid, day, gid, portionen, status='geplant', eingekauft=False):
    meta = {'v': 1, 'slot': 'abend', 'status': status, 'portionen': portionen, 'gericht_uid': gid}
    if eingekauft:
        meta['eingekauft'] = True
    return {'uid': uid, 'summary': 'x', 'start': day + 'T18:00:00', 'end': day + 'T19:00:00', 'description': json.dumps(meta)}


STATE = {
    'recipes': [
        # Rezept für 2 Portionen
        rec('r1', 'Nudeln mit Tomaten', 2, [z('Spaghetti', 250, 'g'), z('Tomaten', 1, 'dose'), z('Zwiebel', 1),
                                            z('Salz', optional=True), z('Olivenöl')]),
        # Rezept für 4 Portionen
        rec('r2', 'Paprikapfanne', 4, [z('Zwiebel', 2), z('Paprika', 3, 'stk'), z('Knoblauchzehe', 2)]),
        rec('r3', 'Ohne Zutaten', 2, []),
    ],
    'events': [
        ev('e1', '2026-11-14', 'r1', 4),                     # Faktor 2
        ev('e2', '2026-11-15', 'r2', 2),                     # Faktor 0,5
        ev('e3', '2026-11-16', 'r1', 2, eingekauft=True),    # schon eingekauft: fehlt
        ev('e4', '2026-11-13', 'r1', 2),                     # gestern: fehlt
        ev('e5', '2026-11-17', 'r2', 4, status='gekocht'),   # gekocht: fehlt
        ev('e6', '2026-11-18', 'r3', 2),                     # ohne Zutaten
    ],
    'config': {
        'v': 1,
        'kategorien': [{'key': 'vegetarisch', 'label': 'Vegetarisch'}],
        'kuechen': [{'key': 'deutsch', 'label': 'Deutsch'}],
        'einheiten': ['g', 'stk', 'dose'],
        'slots': [{'key': 'abend', 'label': 'Abend', 'start': '18:00', 'ende': '19:00', 'aktiv': True}],
        'standard_portionen': 4,
        'vorrat_nie': ['Salz', 'Öl'],
        'vorrat_opt': ['Knoblauch', 'Zwiebel'],
    },
}


def patch(js):
    # Die Einkaufsliste (todo.zuhause) hat eigene Einträge: Tomate offen, Spaghetti schon abgehakt
    return js.replace(
        "if(m.type==='todo/item/list'){",
        "if(m.type==='todo/item/list'&&m.entity_id==='todo.zuhause'){r({id:m.id,type:'result',success:true,result:{items:["
        "{uid:'b1',summary:'Tomate',status:'needs_action'},{uid:'b2',summary:'Spaghetti',status:'completed'}]}});return}"
        "if(m.type==='todo/item/list'){", 1)


ROWS = """[...document.querySelectorAll('#shoplist .shop-row')].map(l=>({
  name: l.querySelector('.t').childNodes[0].textContent.trim(),
  q: l.querySelector('.q').textContent.trim(),
  checked: l.querySelector('input').checked,
  hint: (l.querySelector('.hint')||{}).textContent||'',
  drauf: !!l.querySelector('.onbadge')}))"""

with start(state=STATE, patch=patch) as T:
    pg, J, ok, errs, U, OUT = T.pg, T.J, T.ok, T.errs, T.U, T.OUT
    pg.goto(U + '#woche'); pg.wait_for_timeout(1000)
    ok('Einkaufs-Knopf da', J("!!document.querySelector('[data-a=shop]')"))
    J("document.querySelector('[data-a=shop]').click()"); pg.wait_for_timeout(800)
    T.shot('einkauf.png')

    days = J("[...document.querySelectorAll('.sday')].map(c=>c.value)")
    ok('Nur offene Tage ab heute mit Gerichten', days == ['2026-11-14', '2026-11-15', '2026-11-18'], days)
    ok('Hinweis auf schon Eingekauftes', '1 Gericht ist schon eingekauft' in J("document.querySelector('.sheet').innerText"))

    rows = {r['name']: r for r in J(ROWS)}
    ok('Grundvorrat "nie" fehlt (Salz, Olivenöl)', 'Salz' not in rows and 'Olivenöl' not in rows, list(rows))
    ok('Spaghetti nach Portionen umgerechnet', rows.get('Spaghetti', {}).get('q') == '500 g', rows.get('Spaghetti'))
    ok('Abgehakter Eintrag zählt nicht als drauf', rows.get('Spaghetti', {}).get('checked') and not rows['Spaghetti']['drauf'])
    ok('Tomaten verdoppelt', rows.get('Tomaten', {}).get('q') == '2 dose', rows.get('Tomaten'))
    ok('Tomaten stehen schon drauf (Tomate = Tomaten)', rows.get('Tomaten', {}).get('drauf') and not rows['Tomaten']['checked'])
    ok('Zwiebeln aus zwei Gerichten zusammengefasst', rows.get('Zwiebel', {}).get('q') == '3', rows.get('Zwiebel'))
    ok('Zwiebel als Vorrat nicht vorausgewählt', rows.get('Zwiebel', {}).get('hint') == 'Vorrat prüfen' and not rows['Zwiebel']['checked'])
    ok('Knoblauchzehe zählt als Vorrat Knoblauch', rows.get('Knoblauchzehe', {}).get('hint') == 'Vorrat prüfen', rows.get('Knoblauchzehe'))
    ok('Stückzahl aufgerundet (1,5 -> 2 Stk)', rows.get('Paprika', {}).get('q') == '2 Stk' and rows['Paprika']['checked'], rows.get('Paprika'))
    ok('Zähler schon drauf', '1 Zutat steht schon' in J("document.getElementById('shopsum').innerText"))

    # Sonntag abwählen: Paprikapfanne fällt raus
    J("(()=>{const c=document.querySelector('.sday[value=\"2026-11-15\"]'); c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.wait_for_timeout(200)
    rows2 = {r['name']: r for r in J(ROWS)}
    ok('Tag abgewählt: Paprika weg, Zwiebel nur noch 2', 'Paprika' not in rows2 and rows2.get('Zwiebel', {}).get('q') == '2', rows2)
    J("(()=>{const c=document.querySelector('.sday[value=\"2026-11-15\"]'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));})()")
    pg.wait_for_timeout(200)

    # Senden: nur die angehakten Zutaten, mit Menge als Beschreibung
    J("document.querySelector('[data-a=shopsend]').click()"); pg.wait_for_timeout(1200)
    adds = J("(window.__sent||[]).filter(m=>m.service==='add_item'&&m.target&&m.target.entity_id==='todo.zuhause').map(m=>[m.service_data.item,m.service_data.description||''])")
    ok('Gesendet: Spaghetti und Paprika mit Menge', sorted(map(tuple, adds)) == [('Paprika', '2 Stk'), ('Spaghetti', '500 g')], adds)
    upd = J("(window.__sent||[]).filter(m=>m.type==='calendar/event/update').map(m=>[m.uid,JSON.parse(m.event.description).eingekauft])")
    ok('Beteiligte Gerichte als eingekauft markiert', sorted(map(tuple, upd)) == [('e1', True), ('e2', True)], upd)
    ok('Gericht ohne Zutaten nicht markiert', not any(u[0] == 'e6' for u in upd))
    t = J("document.getElementById('toast').textContent")
    ok('Rückmeldung', '2 Zutaten auf die Einkaufsliste' in t and 'als eingekauft markiert' in t, t)
    ok('Taschen-Symbol jetzt an', J("document.querySelectorAll('.swipe[data-uid=e1] .buybox.on, .swipe[data-uid=e2] .buybox.on').length") == 2)

    # Alles eingekauft: Liste meldet das
    J("document.querySelector('[data-a=shop]').click()"); pg.wait_for_timeout(800)
    txt = J("document.querySelector('.sheet').innerText")
    ok('Danach nur noch das Gericht ohne Zutaten', J("[...document.querySelectorAll('.sday')].map(c=>c.value)") == ['2026-11-18'] and 'Keine Zutaten' in txt, txt[:200])
    ok('Keine JS-Fehler', not errs, errs[:5])
