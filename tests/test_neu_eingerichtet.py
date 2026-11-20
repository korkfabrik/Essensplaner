"""Frisch eingerichtet: leeres Home Assistant ohne Rezepte und Plan. Es darf keine Kochhistorie auftauchen."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import start, load_state

leer = {'recipes': [], 'events': [], 'config': load_state()['config']}

with start(state=leer) as T:
    pg, J, ok, errs, U, OUT = T.pg, T.J, T.ok, T.errs, T.U, T.OUT
    pg.goto(U + '#woche'); pg.wait_for_timeout(1200)
    ok('Woche rendert', J("!!document.querySelector('.daysec')"))
    ok('Keine Einträge im Plan', J("document.querySelectorAll('.ecard').length") == 0)
    ok('Nichts gekocht', J("document.querySelectorAll('.chkbox.on').length") == 0)
    ok('Legt selbst keine Einträge an', T.sent('calendar/event/create') == 0 and T.sent('add_item') == 0)
    T.shot('neu_woche.png')
    pg.goto(U + '#rezepte'); pg.wait_for_timeout(800)
    ok('Keine Rezepte', J("document.querySelectorAll('[data-a=rdetail]').length") == 0)
    pg.goto(U + '#auswertung'); pg.wait_for_timeout(800)
    T.shot('neu_auswertung.png')
    txt = J("document.querySelector('#main').innerText")
    ok('Auswertung ohne Gerichtnamen', not any(n in txt for n in ('Brotzeit', 'Chili', 'Bandnudeln')), txt[:300])
    ok('Hinweis ohne Rezepte', 'Noch keine Rezepte angelegt.' in txt and 'Alle Rezepte wurden' not in txt)
    ok('Keine JS-Fehler', not errs, errs[:5])
