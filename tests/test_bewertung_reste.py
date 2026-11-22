"""Nach dem Kochen: Popup mit Sternen (8 Sekunden), Bewertung landet im Rezept, Rückgängig,
Reste morgen Mittag mit einem Tipp, Reste an einem anderen Tag und abends, Reste zählen nicht als gekocht.
Heute ist Samstag, 14.11.2026. w0 = Brotzeit heute Abend, w1 = Chili con Carne morgen Abend."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start

with start() as T:
    pg, J, ok, errs, U, OUT, sent = T.pg, T.J, T.ok, T.errs, T.U, T.OUT, T.sent
    rate_open = lambda: J("!document.getElementById('rate').hidden")
    toast = lambda: J("document.getElementById('toast').textContent")

    def brotzeit_count():
        pg.goto(U + '#auswertung'); pg.wait_for_timeout(500)
        n = J("(()=>{const r=[...document.querySelectorAll('.srow')].find(x=>x.querySelector('.n').textContent==='Brotzeit'); return r?parseInt(r.querySelector('.c').textContent,10):0})()")
        pg.goto(U + '#woche'); pg.wait_for_timeout(600)
        return n

    c0 = brotzeit_count()

    # 1) Gekocht -> Popup mit Sternen und Reste-Knopf
    J("document.querySelector('.swipe[data-uid=w0] .chkbox').click()"); pg.wait_for_timeout(700)
    ok('Popup erscheint', rate_open())
    ok('Popup nennt das Gericht', J("document.querySelector('#rate .rate-h b').textContent") == 'Brotzeit')
    ok('Fünf Sterne, keiner gesetzt', J("document.querySelectorAll('#rate .rate-star').length") == 5 and J("document.querySelectorAll('#rate .rate-star.on').length") == 0)
    ok('Reste-Knopf: morgen Mittag', J("document.querySelector('#rate .rate-restbtn').textContent") == 'Reste morgen Mittag', J("document.querySelector('#rate .rate-restbtn').textContent"))
    T.shot('bewertung.png')

    # 2) Vier Sterne
    J("document.querySelector('#rate .rate-star[data-n=\"4\"]').click()"); pg.wait_for_timeout(900)
    upd = J("(window.__sent||[]).filter(m=>m.service==='update_item'&&m.service_data.item==='g2').map(m=>JSON.parse(m.service_data.description))")
    ok('Bewertung im Rezept gespeichert', len(upd) == 1 and upd[0].get('bewertung') == 4 and len(upd[0].get('zutaten', [])) == 5, upd)
    ok('Popup zu, Bestätigung', not rate_open() and toast() == 'Bewertet: ★★★★☆', toast())
    J("document.querySelector('.swipe[data-uid=w0] [data-a=entry]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('.sheet [data-a=rdetail]').click()"); pg.wait_for_timeout(300)
    ok('Rezept zeigt 4 von 5 Sternen', '4 von 5 Sternen' in J("document.querySelector('.sheet').innerText"))
    J("document.querySelector('[data-a=closesheet]').click()"); pg.wait_for_timeout(300)

    # 3) Zurück auf geplant: kein Popup
    J("document.querySelector('.swipe[data-uid=w0] .chkbox').click()"); pg.wait_for_timeout(700)
    ok('Auf geplant: kein Popup, normaler Hinweis', not rate_open() and 'Wieder auf geplant' in toast(), toast())

    # 4) Wieder gekocht: Sterne vorbelegt, Reste morgen Mittag
    J("document.querySelector('.swipe[data-uid=w0] .chkbox').click()"); pg.wait_for_timeout(700)
    ok('Sterne zeigen bisherige Bewertung', J("document.querySelectorAll('#rate .rate-star.on').length") == 4)
    n0 = sent('calendar/event/create')
    J("document.querySelector('#rate .rate-restbtn').click()"); pg.wait_for_timeout(900)
    cr = J("(window.__sent||[]).filter(m=>m.type==='calendar/event/create').slice(-1)[0]")
    meta = json.loads(cr['event']['description']) if cr else {}
    ok('Reste angelegt', sent('calendar/event/create') == n0 + 1)
    ok('Reste morgen Mittag', cr['event']['dtstart'].startswith('2026-11-15T12:00') and meta.get('slot') == 'mittag', cr['event']['dtstart'])
    ok('Reste verknüpft, eingekauft, markiert', meta.get('gericht_uid') == 'g2' and meta.get('eingekauft') is True and meta.get('reste') is True and meta.get('status') == 'geplant', meta)
    ok('Bestätigung Reste', 'Reste eingeplant: Morgen' in toast() and 'Mittag' in toast(), toast())
    rest_uid = J("[...document.querySelectorAll('.swipe')].find(s=>s.querySelector('.restbadge'))?.dataset.uid")
    ok('Karte zeigt Reste', bool(rest_uid))
    T.shot('reste-woche.png')

    # 5) Reste abhaken: kein Popup, zählt nicht als gekocht
    J("document.querySelector('.swipe[data-uid=\"%s\"] .chkbox').click()" % rest_uid); pg.wait_for_timeout(700)
    ok('Reste gekocht: kein Popup', not rate_open() and 'Als gekocht markiert' in toast(), toast())
    c1 = brotzeit_count()
    ok('Auswertung zählt nur das echte Kochen', c1 == c0 + 1, (c0, c1))

    # 6) Anderer Tag: Auswahl mit Mittag und Abend, Standard markiert
    J("document.querySelector('.swipe[data-uid=w1] .chkbox').click()"); pg.wait_for_timeout(700)
    ok('Morgen gekocht: Reste übermorgen', 'Reste Montag Mittag' == J("document.querySelector('#rate .rate-restbtn').textContent"), J("document.querySelector('#rate .rate-restbtn').textContent"))
    J("document.querySelector('#rate [data-a=restpick]').click()"); pg.wait_for_timeout(400)
    ok('Auswahl offen, Popup zu', J("!!document.querySelector('.sheet-restpick')") and not rate_open())
    ok('Auswahl bietet Mittag und Abend', J("document.querySelectorAll('[data-a=restto][data-slot=mittag]').length") == 5 and J("document.querySelectorAll('[data-a=restto][data-slot=abend]').length") == 5)
    ok('Standard markiert', J("document.querySelector('[data-a=restto].isdef').dataset.d") == '2026-11-16' and J("document.querySelector('[data-a=restto].isdef').dataset.slot") == 'mittag')
    T.shot('reste-auswahl.png')
    J("document.querySelector('[data-a=restto][data-d=\"2026-11-16\"][data-slot=abend]').click()"); pg.wait_for_timeout(900)
    cr = J("(window.__sent||[]).filter(m=>m.type==='calendar/event/create').slice(-1)[0]")
    meta = json.loads(cr['event']['description'])
    ok('Reste Montag Abend', cr['event']['dtstart'].startswith('2026-11-16T18:00') and meta.get('slot') == 'abend' and meta.get('gericht_uid') == 'g4', (cr['event']['dtstart'], meta))
    ok('Auswahl geschlossen', J("document.getElementById('sheet').hidden"))

    # 7) Freier Eintrag: Popup ohne Sterne, nur Reste. Verschwindet nach 8 Sekunden
    J("document.querySelector('.slotbtn').click()"); pg.wait_for_timeout(400)
    pg.fill('#pq', 'Essen bei Oma'); pg.keyboard.press('Enter'); pg.wait_for_timeout(900)
    free_uid = J("[...document.querySelectorAll('.swipe')].find(s=>s.textContent.includes('Essen bei Oma'))?.dataset.uid")
    J("document.querySelector('.swipe[data-uid=\"%s\"] .chkbox').click()" % free_uid); pg.wait_for_timeout(700)
    ok('Freier Eintrag: Popup ohne Sterne', rate_open() and J("document.querySelectorAll('#rate .rate-star').length") == 0 and J("!!document.querySelector('#rate .rate-restbtn')"))
    pg.wait_for_timeout(7000)
    ok('Nach 7 Sekunden noch da', rate_open())
    pg.wait_for_timeout(1500)
    ok('Nach 8 Sekunden weg', not rate_open())

    # 8) Rückgängig im Popup
    J("document.querySelector('.swipe[data-uid=w1] [data-a=entry]').click()"); pg.wait_for_timeout(300)
    J("document.querySelector('[data-a=entrycook]').click()"); pg.wait_for_timeout(700)   # w1 wieder geplant
    J("document.querySelector('.swipe[data-uid=w1] .chkbox').click()"); pg.wait_for_timeout(700)  # wieder gekocht -> Popup
    J("document.querySelector('#rate [data-a=rateundo]').click()"); pg.wait_for_timeout(800)
    last = J("(window.__sent||[]).filter(m=>m.type==='calendar/event/update'&&m.uid==='w1').slice(-1)[0]")
    ok('Rückgängig setzt auf geplant', json.loads(last['event']['description']).get('status') == 'geplant' and not rate_open())
    ok('Keine JS-Fehler', not errs, errs[:5])
